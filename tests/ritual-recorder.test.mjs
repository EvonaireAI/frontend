import assert from 'node:assert/strict'
import { test } from 'node:test'

const { RitualRecorder } = await import('../lib/ritual-recorder.ts')

// Minimal MediaRecorder stand-in: mirrors the real state transitions and the
// async `stop` event the browser queues after stop() flushes the last chunk.
class MockRecorder {
  static instances = []

  constructor(stream) {
    this.stream = stream
    this.state = 'inactive'
    this.ondataavailable = null
    this.onstop = null
    MockRecorder.instances.push(this)
  }

  start() {
    this.state = 'recording'
  }

  stop() {
    this.state = 'inactive'
    queueMicrotask(() => this.onstop?.())
  }

  emit(data) {
    this.ondataavailable?.({ data })
  }
}

globalThis.MediaRecorder = MockRecorder

const mockStream = () => {
  const tracks = [{ stopped: false, stop() { this.stopped = true } }]
  return { tracks, getTracks: () => tracks }
}

const deferred = () => {
  let resolve, reject
  const promise = new Promise((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

// onstop is queued as a microtask, so blob delivery and track release need one
// extra turn before assertions run.
const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

test('a start that wins its race begins capture and reports recording', async () => {
  const recorder = new RitualRecorder()
  const stream = mockStream()
  const started = await recorder.start(async () => stream, () => {})

  assert.equal(started, true)
  assert.equal(recorder.recording, true)
  assert.equal(MockRecorder.instances.at(-1).state, 'recording')
})

test('stop ends capture, delivers one blob, and releases the mic', async () => {
  const recorder = new RitualRecorder()
  const stream = mockStream()
  const blobs = []
  await recorder.start(async () => stream, (blob) => blobs.push(blob))

  const live = MockRecorder.instances.at(-1)
  live.emit('chunk-a')
  live.emit('chunk-b')
  recorder.stop()
  await flush()

  assert.equal(recorder.recording, false)
  assert.equal(blobs.length, 1)
  assert.equal(blobs[0].size, 7 + 7)
  assert.deepEqual(stream.tracks.map((t) => t.stopped), [true])
})

test('stop without an active capture is a no-op', () => {
  const recorder = new RitualRecorder()
  recorder.stop()
  recorder.stop()
  assert.equal(recorder.recording, false)
})

test('a second stop does not deliver the blob twice', async () => {
  const recorder = new RitualRecorder()
  const blobs = []
  await recorder.start(async () => mockStream(), (blob) => blobs.push(blob))

  recorder.stop()
  recorder.stop()
  await flush()

  assert.equal(blobs.length, 1)
})

test('a permission granted after teardown releases the stream instead of recording', async () => {
  const recorder = new RitualRecorder()
  const pending = deferred()
  const stream = mockStream()
  const blobs = []
  const start = recorder.start(() => pending.promise, (blob) => blobs.push(blob))

  recorder.teardown()
  pending.resolve(stream)

  assert.equal(await start, false)
  assert.deepEqual(stream.tracks.map((t) => t.stopped), [true])
  assert.equal(recorder.recording, false)
})

test('an older start superseded by a newer one releases its stream', async () => {
  const recorder = new RitualRecorder()
  const first = deferred()
  const second = deferred()
  const firstStream = mockStream()
  const secondStream = mockStream()

  const firstStart = recorder.start(() => first.promise, () => {})
  const secondStart = recorder.start(() => second.promise, () => {})

  second.resolve(secondStream)
  assert.equal(await secondStart, true)

  first.resolve(firstStream)
  assert.equal(await firstStart, false)
  assert.deepEqual(firstStream.tracks.map((t) => t.stopped), [true])

  // The live recorder belongs to the second stream.
  assert.equal(MockRecorder.instances.at(-1).stream, secondStream)
})

test('stop while permission is still pending cancels the pending start', async () => {
  const recorder = new RitualRecorder()
  const pending = deferred()
  const stream = mockStream()
  const start = recorder.start(() => pending.promise, () => {})

  recorder.stop()
  pending.resolve(stream)

  assert.equal(await start, false)
  assert.deepEqual(stream.tracks.map((t) => t.stopped), [true])
})

test('teardown during capture stops the recorder and mic without delivering a blob', async () => {
  const recorder = new RitualRecorder()
  const stream = mockStream()
  const blobs = []
  await recorder.start(async () => stream, (blob) => blobs.push(blob))

  const live = MockRecorder.instances.at(-1)
  recorder.teardown()
  await flush()

  assert.equal(live.state, 'inactive')
  assert.equal(recorder.recording, false)
  assert.deepEqual(stream.tracks.map((t) => t.stopped), [true])
  assert.equal(blobs.length, 0)
})

test('teardown releases the mic even if the stop event never arrives', async () => {
  const recorder = new RitualRecorder()
  const stream = mockStream()
  await recorder.start(async () => stream, () => {})

  const live = MockRecorder.instances.at(-1)
  live.stop = function () { this.state = 'recording' } // wedged recorder
  recorder.teardown()

  assert.deepEqual(stream.tracks.map((t) => t.stopped), [true])
})

test('capture can restart after a normal stop', async () => {
  const recorder = new RitualRecorder()
  await recorder.start(async () => mockStream(), () => {})
  recorder.stop()
  await flush()

  const secondStream = mockStream()
  const started = await recorder.start(async () => secondStream, () => {})

  assert.equal(started, true)
  assert.equal(recorder.recording, true)
})

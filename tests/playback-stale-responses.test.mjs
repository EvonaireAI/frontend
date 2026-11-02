import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { afterEach, beforeEach, test } from 'node:test'

// Node strips TypeScript; resolve the extensionless imports used by Next.js.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('.') && context.parentURL?.endsWith('.ts')) {
      const candidate = new URL(`${specifier}.ts`, context.parentURL)
      if (existsSync(candidate)) return nextResolve(candidate.href, context)
    }
    return nextResolve(specifier, context)
  },
})
const { PlaybackMeter } = await import('../lib/playback-metering.ts')

let store
let requests
let pending
let originalFetch
let originalLocalStorage
let originalWindow
let originalConsoleError

beforeEach(() => {
  store = new Map()
  requests = []
  pending = []
  originalFetch = Object.getOwnPropertyDescriptor(globalThis, 'fetch')
  originalLocalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
  originalConsoleError = Object.getOwnPropertyDescriptor(console, 'error')
  globalThis.window = {}
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  }
  console.error = () => {}
  globalThis.fetch = async (url, options) => {
    requests.push({ url, ...options })
    assert.ok(pending.length, `Unexpected request: ${url}`)
    // Awaiting lets a test hold a response back until after a later
    // operation has committed, which is how stale deliveries are made.
    const result = await pending.shift()
    if (result instanceof Response) return result
    return Response.json(result.body, { status: result.status })
  }
})

afterEach(() => {
  if (originalFetch) Object.defineProperty(globalThis, 'fetch', originalFetch)
  else delete globalThis.fetch
  if (originalLocalStorage) Object.defineProperty(globalThis, 'localStorage', originalLocalStorage)
  else delete globalThis.localStorage
  if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow)
  else delete globalThis.window
  if (originalConsoleError) Object.defineProperty(console, 'error', originalConsoleError)
})

const reply = (status, body = {}) => ({ status, body })
const flush = () => new Promise((resolve) => setTimeout(resolve, 0))
const deferred = () => {
  let resolve
  const promise = new Promise((res) => { resolve = res })
  return { promise, resolve }
}
const session = (id) => reply(200, { session_id: id, heartbeat_interval_seconds: 25 })
const grant = (sessionId, url) =>
  reply(200, {
    session_id: sessionId,
    stream_token: 'st',
    stream_url: url,
    expires_at: '2030-01-01T00:00:00Z',
    rotate_after_seconds: 120,
    rotate_on_events: ['PAUSE'],
  })

test('a start response arriving after end() adopts nothing', async () => {
  store.set('access_token', 'a1')
  const changes = []
  const meter = new PlaybackMeter(() => 0, { onSessionChange: (id) => changes.push(id) })

  const held = deferred()
  pending.push(held.promise)
  const started = meter.start(5)
  meter.end()
  held.resolve(Response.json({ session_id: 7, heartbeat_interval_seconds: 25 }, { status: 200 }))
  await started
  await flush()

  assert.equal(meter.activeSessionId, null)
  assert.equal(meter.listening, false)
  assert.deepEqual(changes, [])
})

test('a superseded start cannot adopt its session over the newer one', async () => {
  store.set('access_token', 'a1')
  const meter = new PlaybackMeter(() => 0)

  const held = deferred()
  pending.push(held.promise)
  pending.push(session(11))
  const first = meter.start(5)
  await meter.start(9)
  assert.equal(meter.activeSessionId, 11)

  // The earlier start's response lands after the newer session was adopted
  held.resolve(Response.json({ session_id: 7, heartbeat_interval_seconds: 25 }, { status: 200 }))
  await first
  await flush()

  assert.equal(meter.activeSessionId, 11)
  assert.equal(meter.listening, true)

  pending.push(reply(200))
  meter.end()
  await flush()
})

test('a stream grant minted for an ended listen is refused', async () => {
  store.set('access_token', 'a1')
  const meter = new PlaybackMeter(() => 0)

  pending.push(session(7))
  await meter.start(5)

  const held = deferred()
  pending.push(held.promise)
  const acquiring = meter.acquireStreamUrl()
  meter.end()
  held.resolve(
    Response.json(
      {
        session_id: 7,
        stream_token: 'st',
        stream_url: 'https://cdn.example/ended.m3u8',
        expires_at: '2030-01-01T00:00:00Z',
        rotate_after_seconds: 120,
        rotate_on_events: [],
      },
      { status: 200 },
    ),
  )
  await assert.rejects(acquiring, /stream_denied/)

  assert.equal(meter.currentStreamUrl, null)
  assert.equal(meter.activeSessionId, null)
})

test('an old grant cannot replace a newer ritual session or URL', async () => {
  store.set('access_token', 'a1')
  const meter = new PlaybackMeter(() => 0)

  pending.push(session(7))
  await meter.start(5)

  const held = deferred()
  pending.push(held.promise)
  const acquiring = meter.acquireStreamUrl()

  pending.push(session(11))
  await meter.start(9)

  held.resolve(
    Response.json(
      {
        session_id: 7,
        stream_token: 'st',
        stream_url: 'https://cdn.example/old.m3u8',
        expires_at: '2030-01-01T00:00:00Z',
        rotate_after_seconds: 120,
        rotate_on_events: [],
      },
      { status: 200 },
    ),
  )
  await assert.rejects(acquiring, /stream_denied/)

  assert.equal(meter.activeSessionId, 11)
  assert.equal(meter.currentStreamUrl, null)

  pending.push(reply(200))
  meter.end()
  await flush()
})

test('a superseded heartbeat arriving after end() raises no callback', async () => {
  store.set('access_token', 'a1')
  const superseded = []
  const meter = new PlaybackMeter(() => 0, { onSuperseded: (d) => superseded.push(d) })

  pending.push(session(7))
  await meter.start(5)
  meter.onPause()

  const held = deferred()
  pending.push(held.promise)
  meter.onPlaying()
  meter.end()
  held.resolve(Response.json({ status: 'superseded' }, { status: 409 }))
  await flush()
  await flush()

  assert.deepEqual(superseded, [])
})

test('a superseded heartbeat in its own operation still fires the callback', async () => {
  store.set('access_token', 'a1')
  const superseded = []
  const meter = new PlaybackMeter(() => 0, { onSuperseded: (d) => superseded.push(d) })

  pending.push(session(7))
  await meter.start(5)
  meter.onPause()

  pending.push(reply(409, { status: 'superseded', detail: 'moved' }))
  meter.onPlaying()
  await flush()
  await flush()

  assert.equal(superseded.length, 1)
  assert.equal(meter.activeSessionId, null)

  meter.end()
})

test('a grant in its own operation still adopts', async () => {
  store.set('access_token', 'a1')
  const meter = new PlaybackMeter(() => 0)

  pending.push(session(7))
  await meter.start(5)
  pending.push(grant(7, 'https://cdn.example/live.m3u8'))

  const url = await meter.acquireStreamUrl()
  assert.equal(url, 'https://cdn.example/live.m3u8')
  assert.equal(meter.currentStreamUrl, 'https://cdn.example/live.m3u8')

  meter.end()
  await flush()
})

test('end() clears committed state when nothing is in flight', async () => {
  store.set('access_token', 'a1')
  const meter = new PlaybackMeter(() => 0)

  pending.push(session(7))
  await meter.start(5)

  pending.push(reply(200))
  meter.end()
  await flush()

  assert.equal(meter.activeSessionId, null)
  assert.equal(meter.listening, false)
  assert.equal(meter.currentStreamUrl, null)
})

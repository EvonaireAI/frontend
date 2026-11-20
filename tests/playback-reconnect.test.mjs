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
const { ReconnectBudget } = await import('../lib/playback-reconnect.ts')

let store
let requests
let mintCount
let latestToken
let denyMints
let originalFetch
let originalLocalStorage
let originalWindow
let originalConsoleError

beforeEach(() => {
  store = new Map()
  requests = []
  mintCount = 0
  latestToken = null
  denyMints = false
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

  // The server side of the stream-token contract: only the newest minted
  // token hash is valid, so every earlier grant 403s the stream URL.
  globalThis.fetch = async (url, options) => {
    requests.push({ url: String(url), ...options })
    if (String(url).includes('/analytics/playback/start/')) {
      return Response.json({ session_id: 7, heartbeat_interval_seconds: 25 }, { status: 200 })
    }
    if (String(url).includes('/analytics/playback/stream-token/')) {
      if (denyMints) {
        return Response.json(
          { error: 'stream_denied', reason: 'unavailable', detail: 'mint failed' },
          { status: 403 },
        )
      }
      mintCount += 1
      const token = `tok-${mintCount}`
      latestToken = token
      return Response.json(
        {
          session_id: 7,
          stream_token: token,
          stream_url: `https://api.test/stream/?session_id=7&stream_token=${token}`,
          expires_at: '2030-01-01T00:00:00Z',
          rotate_after_seconds: 120,
          rotate_on_events: ['PAUSE', 'RESUME', 'SEEK', 'RECONNECT'],
        },
        { status: 200 },
      )
    }
    if (String(url).includes('/analytics/playback/')) {
      return Response.json({}, { status: 200 })
    }
    throw new Error(`Unexpected request: ${url}`)
  }
})

afterEach(() => {
  // end() while the fetch mock is still installed: clears the rotation
  // timer and lets the fire-and-forget end POST resolve against the mock.
  meter.end()
  if (originalFetch) Object.defineProperty(globalThis, 'fetch', originalFetch)
  else delete globalThis.fetch
  if (originalLocalStorage) Object.defineProperty(globalThis, 'localStorage', originalLocalStorage)
  else delete globalThis.localStorage
  if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow)
  else delete globalThis.window
  if (originalConsoleError) Object.defineProperty(console, 'error', originalConsoleError)
})

const settle = () => new Promise((resolve) => setTimeout(resolve, 20))

// A stand-in for the <audio> element plus the page's handleMediaError
// decision flow, using the same ReconnectBudget the component now uses.
// assign() mirrors assignStreamSource followed by the browser's fetch of
// the URL: the backend honors only the newest minted token, so a stale
// token produces the same 403 -> error event a real player sees. When
// state.denyStream is set, every fetch fails regardless of token, which is
// what a closed session or revoked consent looks like downstream.
function makeRig(budget, state) {
  const listeners = {}
  const audio = {
    src: '',
    currentTime: 42,
    networkState: 3,
    addEventListener: (ev, fn) => {
      const list = listeners[ev] ?? (listeners[ev] = [])
      list.push(fn)
    },
    removeEventListener: (ev, fn) => {
      listeners[ev] = (listeners[ev] || []).filter((f) => f !== fn)
    },
    fire: (ev) => {
      for (const fn of [...(listeners[ev] || [])]) fn()
    },
    fetchSrc() {
      const token = new URL(this.src).searchParams.get('stream_token')
      setTimeout(() => {
        this.fire(state.denyStream || token !== latestToken ? 'error' : 'loadedmetadata')
      }, 0)
    },
    assign(url) {
      this.src = url
      this.fetchSrc()
    },
    refetch() {
      this.fetchSrc()
    },
  }

  const outcomes = []
  audio.addEventListener('error', () => {
    void (async () => {
      // Mirrors page.tsx handleMediaError: budget gate, fail(), re-acquire,
      // assign; a failed acquire leaves the failure counted.
      if (budget.exhausted) {
        outcomes.push('unavailable')
        return
      }
      budget.fail()
      try {
        const url = await meter.acquireStreamUrl('RECONNECT')
        audio.assign(url)
        outcomes.push('reconnecting')
      } catch {
        outcomes.push('failed')
      }
    })()
  })
  audio.addEventListener('loadedmetadata', () => budget.reset())

  return { audio, outcomes }
}

let meter
beforeEach(() => {
  store.set('access_token', 'a1')
  meter = new PlaybackMeter(() => 42)
})

test('repeated dead-token errors keep recovering past the attempt cap', async () => {
  const budget = new ReconnectBudget(2)
  const { audio, outcomes } = makeRig(budget, { denyStream: false })

  await meter.start(5)
  audio.assign(await meter.acquireStreamUrl())
  await settle()

  // Each cycle is what a seek after rotation looks like: the transport event
  // mints a new token server-side, the URL embedded in src is now stale, the
  // next fetch 403s, and the player reconnects. Five cycles is more than the
  // old lifetime cap of two ever allowed.
  for (const i of [0, 1, 2, 3, 4]) {
    meter.rotateFor('SEEK')
    await settle()
    audio.refetch()
    await settle()
    assert.equal(budget.exhausted, false, `cycle ${i} exhausted the budget`)
    assert.equal(
      new URL(audio.src).searchParams.get('stream_token'),
      latestToken,
      `cycle ${i} left a stale token in src`,
    )
  }

  assert.equal(outcomes.filter((o) => o === 'reconnecting').length, 5)
  assert.equal(outcomes.includes('unavailable'), false)
})

test('control: a budget that never resets reproduces the permanent failure', async () => {
  // Same decision flow with reset() stubbed to a no-op, which is exactly the
  // pre-fix semantics: the counter only cleared on a fresh page load.
  let failures = 0
  const legacyBudget = {
    get exhausted() {
      return failures >= 2
    },
    fail() {
      failures += 1
    },
    reset() {},
  }
  const { audio, outcomes } = makeRig(legacyBudget, { denyStream: false })

  await meter.start(5)
  audio.assign(await meter.acquireStreamUrl())
  await settle()

  for (const i of [0, 1, 2, 3]) {
    meter.rotateFor('SEEK')
    await settle()
    audio.refetch()
    await settle()
  }

  assert.equal(outcomes.includes('unavailable'), true)
  assert.notEqual(
    new URL(audio.src).searchParams.get('stream_token'),
    latestToken,
    'expected src to be stuck on a dead token',
  )
})

test('consecutive failed reconnects still exhaust the budget', async () => {
  const budget = new ReconnectBudget(2)
  const state = { denyStream: false }
  const { audio, outcomes } = makeRig(budget, state)

  await meter.start(5)
  audio.assign(await meter.acquireStreamUrl())
  await settle()

  // Both ends now deny: mints fail and every stream fetch fails, which is
  // what a restricted account or dead session looks like downstream.
  denyMints = true
  state.denyStream = true

  const mintsBefore = requests.filter((r) => r.url.includes('stream-token')).length
  for (const i of [0, 1, 2]) {
    audio.refetch()
    await settle()
  }

  assert.equal(budget.exhausted, true)
  const mintsAfter = requests.filter((r) => r.url.includes('stream-token')).length
  // Two attempts were made; the third error short-circuited on the budget.
  assert.equal(mintsAfter - mintsBefore, 2)
  assert.equal(outcomes.filter((o) => o === 'failed').length, 2)
  assert.equal(outcomes[outcomes.length - 1], 'unavailable')
})

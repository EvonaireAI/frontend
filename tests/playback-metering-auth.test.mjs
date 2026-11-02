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
    const result = pending.shift()
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
const refreshRequests = () => requests.filter((r) => r.url.includes('/auth/refresh/'))

test('a 401 on session start refreshes the token and retries', async () => {
  store.set('access_token', 'a1')
  store.set('refresh_token', 'r1')
  const meter = new PlaybackMeter(() => 0)

  pending.push(reply(401))
  pending.push(reply(200, { access: 'a2' }))
  pending.push(reply(200, { session_id: 7, heartbeat_interval_seconds: 25 }))
  await meter.start(5)

  assert.equal(requests.length, 3)
  assert.ok(requests[0].url.includes('/analytics/playback/start/'))
  assert.equal(requests[0].headers.Authorization, 'Bearer a1')
  assert.equal(JSON.parse(requests[1].body).refresh, 'r1')
  assert.ok(requests[2].url.includes('/analytics/playback/start/'))
  assert.equal(requests[2].headers.Authorization, 'Bearer a2')
  assert.equal(meter.activeSessionId, 7)
  assert.equal(meter.listening, true)

  pending.push(reply(200))
  meter.end()
  await flush()
})

test('concurrent 401s share a single token refresh', async () => {
  store.set('access_token', 'a1')
  store.set('refresh_token', 'r1')
  const meter = new PlaybackMeter(() => 0)
  pending.push(reply(200, { session_id: 9, heartbeat_interval_seconds: 25 }))
  await meter.start(9)
  assert.equal(requests.length, 1)

  pending.push(reply(401), reply(401))
  pending.push(reply(200, { access: 'a2' }))
  pending.push(reply(200), reply(200))
  await Promise.all([meter.reportEvent('PAUSE'), meter.reportEvent('SEEK')])

  assert.equal(refreshRequests().length, 1)
  const eventRetries = requests.slice(-2)
  for (const r of eventRetries) {
    assert.ok(r.url.includes('/analytics/playback/event/'))
    assert.equal(r.headers.Authorization, 'Bearer a2')
  }

  pending.push(reply(200))
  meter.end()
  await flush()
})

test('a failed refresh returns the original 401 without retrying', async () => {
  store.set('access_token', 'a1')
  store.set('refresh_token', 'r1')
  const meter = new PlaybackMeter(() => 0)

  pending.push(reply(401))
  pending.push(reply(401))
  await meter.start(5)

  assert.equal(requests.length, 2)
  assert.equal(meter.activeSessionId, null)
  // Unmetered playback still proceeds; the refresh failure cleared the session
  assert.equal(meter.listening, true)
  assert.equal(store.get('access_token'), undefined)

  meter.end()
})

test('non-401 responses never touch the refresh endpoint', async () => {
  store.set('access_token', 'a1')
  store.set('refresh_token', 'r1')
  const meter = new PlaybackMeter(() => 0)

  pending.push(reply(200, { session_id: 3, heartbeat_interval_seconds: 25 }))
  await meter.start(3)

  assert.equal(requests.length, 1)
  assert.equal(refreshRequests().length, 0)
  assert.equal(meter.activeSessionId, 3)

  pending.push(reply(200))
  meter.end()
  await flush()
})

test('a still-401 retry does not loop back into another refresh', async () => {
  store.set('access_token', 'a1')
  store.set('refresh_token', 'r1')
  const meter = new PlaybackMeter(() => 0)

  pending.push(reply(401))
  pending.push(reply(200, { access: 'a2' }))
  pending.push(reply(401))
  await meter.start(5)

  assert.equal(requests.length, 3)
  assert.equal(meter.activeSessionId, null)
  assert.equal(store.get('access_token'), 'a2')

  meter.end()
})

test('session end refreshes and retries instead of dropping the close', async () => {
  store.set('access_token', 'a1')
  store.set('refresh_token', 'r1')
  const meter = new PlaybackMeter(() => 0)
  pending.push(reply(200, { session_id: 4, heartbeat_interval_seconds: 25 }))
  await meter.start(4)

  pending.push(reply(401))
  pending.push(reply(200, { access: 'a2' }))
  pending.push(reply(200))
  meter.end()
  await flush()

  const endRequests = requests.filter((r) => r.url.includes('/analytics/playback/end/'))
  assert.equal(endRequests.length, 2)
  assert.equal(endRequests[1].headers.Authorization, 'Bearer a2')
})

// JWT-shaped tokens so post() can compare account identity across a 401.
const jwt = (userId, jti = 'j') =>
  `h.${Buffer.from(JSON.stringify({ user_id: userId, jti })).toString('base64url')}.s`

test('a delayed 401 after an account switch is not refreshed or retried', async () => {
  store.set('access_token', jwt('acct-a', 't1'))
  store.set('refresh_token', 'r1')
  const meter = new PlaybackMeter(() => 0)

  pending.push(reply(401))
  const started = meter.start(5)
  // The account changed while the start request was in flight
  store.set('access_token', jwt('acct-b', 't2'))
  store.set('refresh_token', 'r2')
  await started

  assert.equal(requests.length, 1)
  assert.equal(refreshRequests().length, 0)
  assert.equal(meter.activeSessionId, null)
  assert.equal(meter.listening, true)

  meter.end()
})

test('a 401 after sign-out is not refreshed or retried', async () => {
  store.set('access_token', jwt('acct-a', 't1'))
  store.set('refresh_token', 'r1')
  const meter = new PlaybackMeter(() => 0)

  pending.push(reply(401))
  const started = meter.start(5)
  store.delete('access_token')
  store.delete('refresh_token')
  await started

  assert.equal(requests.length, 1)
  assert.equal(refreshRequests().length, 0)

  meter.end()
})

test('a rotation for the same account still refreshes and retries', async () => {
  store.set('access_token', jwt('acct-a', 't1'))
  store.set('refresh_token', 'r1')
  const meter = new PlaybackMeter(() => 0)

  pending.push(reply(401))
  const started = meter.start(5)
  // A concurrent request refreshed first: token rotated, same account
  store.set('access_token', jwt('acct-a', 't2'))
  pending.push(reply(200, { access: jwt('acct-a', 't3') }))
  pending.push(reply(200, { session_id: 7, heartbeat_interval_seconds: 25 }))
  await started

  assert.equal(requests.length, 3)
  assert.equal(refreshRequests().length, 1)
  assert.equal(requests[2].headers.Authorization, `Bearer ${jwt('acct-a', 't3')}`)
  assert.equal(meter.activeSessionId, 7)

  pending.push(reply(200))
  meter.end()
  await flush()
})

test('a refresh resolving under a different account still blocks the retry', async () => {
  store.set('access_token', jwt('acct-a', 't1'))
  store.set('refresh_token', 'r1')
  const meter = new PlaybackMeter(() => 0)

  pending.push(reply(401))
  // The refresh minted a token for another session, not the sender's
  pending.push(reply(200, { access: jwt('acct-b', 't9') }))
  await meter.start(5)

  assert.equal(requests.length, 2)
  assert.equal(refreshRequests().length, 1)
  assert.equal(meter.activeSessionId, null)

  meter.end()
})

test('an unauthenticated request is not refreshed or retried after a 401', async () => {
  const meter = new PlaybackMeter(() => 0)

  pending.push(reply(401))
  await meter.start(5)

  assert.equal(requests.length, 1)
  assert.equal(refreshRequests().length, 0)

  meter.end()
})

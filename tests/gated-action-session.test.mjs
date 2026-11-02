import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { test } from 'node:test'

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

// localStorage/window mocks — the lib reads tokens through them.
const store = new Map()
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
}
globalThis.window = { localStorage: globalThis.localStorage }

const {
  runGatedAction,
  requestGatewayCompletion,
  onGatewayCompletionRequest,
  onGatewayProgress,
  emitGatewayProgress,
  captureGatewaySessionTag,
  GatewayIncompleteError,
  GatewayCancelledError,
  GatewaySessionChangedError,
} = await import('../lib/gateway-quiz.ts')

const denial = {
  error: 'gateway_incomplete',
  detail: 'finish the gateway',
  answered: 1,
  total: 3,
  remaining: 2,
}

function setSession({ access = 'A_ACCESS', refresh = 'A_REFRESH' } = {}) {
  store.clear()
  if (access !== null) store.set('access_token', access)
  if (refresh !== null) store.set('refresh_token', refresh)
}

// A completion listener that mimics the modal host: queues each request so
// the test can complete, cancel, or hold it across a session swap.
function fakeModalHost() {
  const buffered = []
  const waiters = []
  const unsubscribe = onGatewayCompletionRequest((request) => {
    const waiter = waiters.shift()
    if (waiter) waiter(request)
    else buffered.push(request)
  })
  const next = () =>
    buffered.length ? Promise.resolve(buffered.shift()) : new Promise((r) => waiters.push(r))
  return { next, unsubscribe }
}

test('gated action retries under the same session marker', async () => {
  setSession()
  const host = fakeModalHost()
  try {
    let calls = 0
    const run = runGatedAction(async () => {
      calls += 1
      if (calls === 1) throw new GatewayIncompleteError(denial)
      return 'joined'
    })
    const request = await host.next()
    request.resolve()
    assert.equal(await run, 'joined')
    assert.equal(calls, 2)
  } finally {
    host.unsubscribe()
  }
})

test('a logout during the modal abandons the retry', async () => {
  setSession()
  const host = fakeModalHost()
  try {
    let calls = 0
    const run = runGatedAction(async () => {
      calls += 1
      if (calls === 1) throw new GatewayIncompleteError(denial)
      return 'joined'
    })
    const request = await host.next()
    // The user signs out while the modal is open, then the host completes.
    store.clear()
    request.resolve()
    await assert.rejects(run, GatewaySessionChangedError)
    assert.equal(calls, 1)
  } finally {
    host.unsubscribe()
  }
})

test('an account switch during the modal abandons the retry', async () => {
  setSession()
  const host = fakeModalHost()
  try {
    let calls = 0
    const run = runGatedAction(async () => {
      calls += 1
      if (calls === 1) throw new GatewayIncompleteError(denial)
      return 'joined'
    })
    const request = await host.next()
    // A -> B while the modal is open; the first account's action must not
    // replay under B's credentials.
    setSession({ access: 'B_ACCESS', refresh: 'B_REFRESH' })
    request.resolve()
    await assert.rejects(run, GatewaySessionChangedError)
    assert.equal(calls, 1)
  } finally {
    host.unsubscribe()
  }
})

test('a cancelled modal still aborts quietly without a retry', async () => {
  setSession()
  const host = fakeModalHost()
  try {
    let calls = 0
    const run = runGatedAction(async () => {
      calls += 1
      if (calls === 1) throw new GatewayIncompleteError(denial)
      return 'joined'
    })
    const request = await host.next()
    request.reject(new GatewayCancelledError())
    await assert.rejects(run, GatewayCancelledError)
    assert.equal(calls, 1)
  } finally {
    host.unsubscribe()
  }
})

test('a non-gateway failure propagates untouched', async () => {
  setSession()
  const boom = new Error('HTTP 500')
  await assert.rejects(
    runGatedAction(async () => { throw boom }),
    (err) => err === boom,
  )
})

test('progress events carry the tag captured before their request', () => {
  setSession()
  const seen = []
  const off = onGatewayProgress((progress, tag) => seen.push([progress, tag]))
  try {
    const tag = captureGatewaySessionTag()
    emitGatewayProgress(
      { answered_count: 2, total: 3, remaining: 1, completed: false },
      tag,
    )
    assert.equal(seen.length, 1)
    assert.equal(seen[0][1], 'A_ACCESS')
    assert.equal(seen[0][0].answered_count, 2)
  } finally {
    off()
  }
})

test('the session tag reflects the token at capture time, not emit time', () => {
  setSession()
  const tag = captureGatewaySessionTag()
  setSession({ access: 'B_ACCESS', refresh: 'B_REFRESH' })
  // The response resolved after the switch: the tag still names A's session,
  // which is what lets the listener drop it.
  assert.equal(tag, 'A_ACCESS')
  assert.notEqual(tag, localStorage.getItem('access_token'))
})

test('requestGatewayCompletion rejects when no host is mounted', async () => {
  await assert.rejects(requestGatewayCompletion(denial), GatewayIncompleteError)
})

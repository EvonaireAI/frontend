import assert from 'node:assert/strict'
import { test } from 'node:test'

const { SessionScope } = await import('../lib/session-scope.ts')

// Mirrors the guarded-load pattern the providers run: capture the session
// before awaiting, apply only if it still owns the state at resolve time.
function observe(scope, load) {
  const applied = []
  const session = scope.current
  if (!session) return { applied, run: Promise.resolve() }
  const run = (async () => {
    try {
      const value = await load()
      if (scope.isCurrent(session)) applied.push(value)
    } catch {
      // Providers keep last-known state on failure, same as production.
    }
  })()
  return { applied, run }
}

const deferred = () => {
  let resolve, reject
  const promise = new Promise((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

const memberA = 'member-a@example.test'
const memberB = 'member-b@example.test'

test('no session exists before activation or after deactivation', () => {
  const scope = new SessionScope()
  assert.equal(scope.current, null)
  scope.activate(memberA)
  assert.notEqual(scope.current, null)
  scope.deactivate()
  assert.equal(scope.current, null)
})

test('activate reports a change only when the identity changes', () => {
  const scope = new SessionScope()
  assert.equal(scope.activate(memberA), true)
  assert.equal(scope.activate(memberA), false)
  assert.equal(scope.activate(memberB), true)
  assert.equal(scope.activate(memberB), false)
})

test('a load resolving inside its own session applies', async () => {
  const scope = new SessionScope()
  scope.activate(memberA)
  const pending = deferred()
  const { applied, run } = observe(scope, () => pending.promise)
  pending.resolve('entitlements-a')
  await run
  assert.deepEqual(applied, ['entitlements-a'])
})

test('a response resolving after logout is discarded', async () => {
  const scope = new SessionScope()
  scope.activate(memberA)
  const pending = deferred()
  const { applied, run } = observe(scope, () => pending.promise)
  scope.deactivate()
  pending.resolve('entitlements-a')
  await run
  assert.deepEqual(applied, [])
})

test('a response resolving after an account switch is discarded', async () => {
  const scope = new SessionScope()
  scope.activate(memberA)
  const stale = deferred()
  const fresh = deferred()
  const first = observe(scope, () => stale.promise)
  scope.activate(memberB)
  const second = observe(scope, () => fresh.promise)
  stale.resolve('entitlements-a')
  fresh.resolve('entitlements-b')
  await Promise.all([first.run, second.run])
  assert.deepEqual(first.applied, [])
  assert.deepEqual(second.applied, ['entitlements-b'])
})

test('an in-flight load survives a same-account user refresh', async () => {
  const scope = new SessionScope()
  scope.activate(memberA)
  const pending = deferred()
  const { applied, run } = observe(scope, () => pending.promise)
  // The provider re-runs its effect on every new user object; the same
  // account must not invalidate loads already in flight.
  assert.equal(scope.activate(memberA), false)
  pending.resolve('entitlements-a')
  await run
  assert.deepEqual(applied, ['entitlements-a'])
})

test('re-login after logout invalidates pre-logout loads', async () => {
  const scope = new SessionScope()
  scope.activate(memberA)
  const beforeLogout = scope.current
  const pending = deferred()
  const { applied, run } = observe(scope, () => pending.promise)
  scope.deactivate()
  scope.activate(memberA)
  assert.notEqual(scope.current, beforeLogout)
  pending.resolve('entitlements-a')
  await run
  assert.deepEqual(applied, [])
})

test('a null session starts no load and is never current', () => {
  const scope = new SessionScope()
  let fetched = false
  const { applied, run } = observe(scope, () => { fetched = true; return Promise.resolve('x') })
  return run.then(() => {
    assert.equal(fetched, false)
    assert.deepEqual(applied, [])
    assert.equal(scope.isCurrent(null), false)
  })
})

test('a failed load leaves the session usable for the next load', async () => {
  const scope = new SessionScope()
  scope.activate(memberA)
  const failing = observe(scope, () => Promise.reject(new Error('HTTP 500')))
  await failing.run
  assert.deepEqual(failing.applied, [])
  const recovered = observe(scope, () => Promise.resolve('entitlements-a'))
  await recovered.run
  assert.deepEqual(recovered.applied, ['entitlements-a'])
})

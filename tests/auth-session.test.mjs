import assert from 'node:assert/strict'
import { test } from 'node:test'

const { AuthSession } = await import('../lib/auth-session.ts')

// Mirrors the guarded-commit pattern AuthProvider runs: capture the
// generation before awaiting, apply only if it still owns the session at
// resolve time, and guard the failure path the same way.
function attempt(session, load) {
  const applied = []
  const generation = session.current
  const run = (async () => {
    try {
      const value = await load()
      if (session.owns(generation)) applied.push(value)
    } catch {
      if (session.owns(generation)) applied.push('cleared')
    }
  })()
  return { applied, run }
}

// Mirrors login(): each attempt begins a new generation and commits only
// while it still owns the session.
function signIn(session, load) {
  const applied = []
  const generation = session.begin()
  const run = (async () => {
    const value = await load()
    if (session.owns(generation)) applied.push(value)
    return value
  })()
  return { applied, run }
}

const deferred = () => {
  let resolve, reject
  const promise = new Promise((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

test('begin and end advance the generation', () => {
  const session = new AuthSession()
  const first = session.current
  const second = session.begin()
  assert.notEqual(second, first)
  assert.equal(session.current, second)
  session.end()
  assert.notEqual(session.current, second)
})

test('a load resolving inside its own session applies', async () => {
  const session = new AuthSession()
  session.begin()
  const pending = deferred()
  const { applied, run } = attempt(session, () => pending.promise)
  pending.resolve('profile-a')
  await run
  assert.deepEqual(applied, ['profile-a'])
})

test('a profile resolving after logout is discarded', async () => {
  const session = new AuthSession()
  session.begin()
  const pending = deferred()
  const { applied, run } = attempt(session, () => pending.promise)
  session.end()
  pending.resolve('profile-a')
  await run
  assert.deepEqual(applied, [])
})

test('a profile resolving after an account switch is discarded', async () => {
  const session = new AuthSession()
  session.begin()
  const stale = deferred()
  const fresh = deferred()
  const first = attempt(session, () => stale.promise)
  session.begin()
  const second = attempt(session, () => fresh.promise)
  stale.resolve('profile-a')
  fresh.resolve('profile-b')
  await Promise.all([first.run, second.run])
  assert.deepEqual(first.applied, [])
  assert.deepEqual(second.applied, ['profile-b'])
})

test('a failure resolving after logout does not clear the next session', async () => {
  const session = new AuthSession()
  session.begin()
  const pending = deferred()
  const { applied, run } = attempt(session, () => pending.promise)
  session.end()
  session.begin()
  pending.reject(new Error('HTTP 500'))
  await run
  assert.deepEqual(applied, [])
})

test('a failure inside its own session still clears state', async () => {
  const session = new AuthSession()
  session.begin()
  const { applied, run } = attempt(session, () => Promise.reject(new Error('HTTP 500')))
  await run
  assert.deepEqual(applied, ['cleared'])
})

test('a superseded login still returns its response but commits nothing', async () => {
  const session = new AuthSession()
  const stale = deferred()
  const first = signIn(session, () => stale.promise)
  const second = signIn(session, () => Promise.resolve('login-b'))
  stale.resolve('login-a')
  const [firstValue] = await Promise.all([first.run, second.run])
  assert.equal(firstValue, 'login-a')
  assert.deepEqual(first.applied, [])
  assert.deepEqual(second.applied, ['login-b'])
})

test('a login resolving after logout commits nothing', async () => {
  const session = new AuthSession()
  const pending = deferred()
  const { applied, run } = signIn(session, () => pending.promise)
  session.end()
  pending.resolve('login-a')
  await run
  assert.deepEqual(applied, [])
})

test('re-login after logout invalidates pre-logout loads', async () => {
  const session = new AuthSession()
  session.begin()
  const beforeLogout = session.current
  const pending = deferred()
  const { applied, run } = attempt(session, () => pending.promise)
  session.end()
  session.begin()
  assert.notEqual(session.current, beforeLogout)
  pending.resolve('profile-a')
  await run
  assert.deepEqual(applied, [])
})

test('a failed login attempt still supersedes in-flight loads', async () => {
  const session = new AuthSession()
  session.begin()
  const pending = deferred()
  const { applied, run } = attempt(session, () => pending.promise)
  const failed = signIn(session, () => Promise.reject(new Error('bad credentials')))
  await assert.rejects(failed.run)
  pending.resolve('profile-a')
  await run
  assert.deepEqual(applied, [])
})

test('a consent call resolving after sign-out is discarded', async () => {
  const session = new AuthSession()
  session.begin()
  const pending = deferred()
  const { applied, run } = attempt(session, () => pending.promise)
  session.end()
  pending.resolve('consented')
  await run
  assert.deepEqual(applied, [])
})

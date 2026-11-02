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
const { authService } = await import('../lib/auth.ts')
const initialTokens = { access_token: 'initial-access', refresh_token: 'initial-refresh' }
const refreshedAccess = 'refreshed-access'
const profile = { email: 'member@example.test', first_name: 'Test', last_name: 'Member' }
let requests
let pending
let storage
let originalFetch
let originalStorage
let originalDocument

beforeEach(() => {
  requests = []
  pending = []
  storage = new Map(Object.entries(initialTokens))
  originalFetch = Object.getOwnPropertyDescriptor(globalThis, 'fetch')
  originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document')
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: key => storage.delete(key),
  } })
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { cookie: 'session=1' } })
  globalThis.fetch = async (url, options) => {
    requests.push({ url, ...options })
    assert.ok(pending.length, `Unexpected request: ${url}`)
    const result = pending.shift()
    if (result instanceof Error) throw result
    return Response.json(result.body, { status: result.status })
  }
})
afterEach(() => {
  for (const [key, descriptor] of [['fetch', originalFetch], ['localStorage', originalStorage], ['document', originalDocument]]) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor)
    else delete globalThis[key]
  }
})
const reply = (status, body = {}) => ({ status, body })
const paths = () => requests.map(request => new URL(request.url, 'https://example.test').pathname)
function assertLoggedOut() {
  assert.equal(storage.has('access_token'), false)
  assert.equal(storage.has('refresh_token'), false)
  assert.match(document.cookie, /session=;/)
}

test('successful profile request does not refresh', async () => {
  pending.push(reply(200, profile))
  assert.deepEqual(await authService.getProfile(), profile)
  assert.deepEqual(paths(), ['/api/me/'])
})

test('401 refreshes and retries with the observed replacement access token', async () => {
  pending.push(reply(401), reply(200, { access: refreshedAccess }), reply(200, profile))
  assert.deepEqual(await authService.getProfile(), profile)
  assert.deepEqual(paths(), ['/api/me/', '/api/auth/refresh/', '/api/me/'])
  assert.deepEqual(JSON.parse(requests.find(request => request.method === 'POST').body), { refresh: initialTokens.refresh_token })
  const profileRequests = requests.filter(request => request.url.endsWith('/me/'))
  assert.deepEqual(profileRequests.map(request => request.headers.Authorization),
    [initialTokens.access_token, storage.get('access_token')].map(token => `Bearer ${token}`))
})

test('persistent 401 logs out without starting another refresh cycle', async () => {
  pending.push(reply(401), reply(200, { access: refreshedAccess }), reply(401))
  await assert.rejects(authService.getProfile(), /Authentication required/)
  assert.deepEqual(paths(), ['/api/me/', '/api/auth/refresh/', '/api/me/'])
  assertLoggedOut()
})

test('failed refresh logs out without retrying the profile', async () => {
  pending.push(reply(401), reply(401))
  await assert.rejects(authService.getProfile(), /Authentication required/)
  assert.deepEqual(paths(), ['/api/me/', '/api/auth/refresh/'])
  assertLoggedOut()
})

test('missing refresh token logs out without calling refresh endpoint', async () => {
  storage.delete('refresh_token')
  pending.push(reply(401))
  await assert.rejects(authService.getProfile(), /Authentication required/)
  assert.deepEqual(paths(), ['/api/me/'])
  assertLoggedOut()
})

test('non-authentication profile failure does not refresh or clear session', async () => {
  pending.push(reply(503))
  await assert.rejects(authService.getProfile(), /Failed to fetch profile/)
  assert.deepEqual(paths(), ['/api/me/'])
  assert.deepEqual(Object.fromEntries(storage), initialTokens)
})

test('server failure after refresh preserves the refreshed session', async () => {
  pending.push(reply(401), reply(200, { access: refreshedAccess }), reply(503))
  await assert.rejects(authService.getProfile(), /Failed to fetch profile/)
  assert.deepEqual(paths(), ['/api/me/', '/api/auth/refresh/', '/api/me/'])
  assert.equal(storage.get('access_token'), refreshedAccess)
  assert.equal(storage.get('refresh_token'), initialTokens.refresh_token)
})

test('refresh network failure logs out', async () => {
  pending.push(reply(401), new TypeError('Network unavailable'))
  await assert.rejects(authService.getProfile(), /Authentication required/)
  assert.deepEqual(paths(), ['/api/me/', '/api/auth/refresh/'])
  assertLoggedOut()
})

test('profile retry network failure preserves the refreshed session', async () => {
  const networkError = new TypeError('Profile network unavailable')
  pending.push(reply(401), reply(200, { access: refreshedAccess }), networkError)
  await assert.rejects(authService.getProfile(), error => error === networkError)
  assert.deepEqual(paths(), ['/api/me/', '/api/auth/refresh/', '/api/me/'])
  assert.equal(storage.get('access_token'), refreshedAccess)
  assert.equal(storage.get('refresh_token'), initialTokens.refresh_token)
})

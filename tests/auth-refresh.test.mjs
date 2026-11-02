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

let store
let requests
let pending
let originalFetch
let originalLocalStorage

beforeEach(() => {
  store = new Map()
  requests = []
  pending = []
  originalFetch = Object.getOwnPropertyDescriptor(globalThis, 'fetch')
  originalLocalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  }
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
})
const reply = (status, body = {}) => ({ status, body })

test('refreshToken stores a rotated refresh token', async () => {
  store.set('refresh_token', 'r1')
  pending.push(reply(200, { access: 'a2', refresh: 'r2' }))
  await authService.refreshToken()
  assert.equal(store.get('access_token'), 'a2')
  assert.equal(store.get('refresh_token'), 'r2')

  // The next refresh must send the rotated token, not the blacklisted one.
  pending.push(reply(200, { access: 'a3', refresh: 'r3' }))
  await authService.refreshToken()
  assert.equal(requests.length, 2)
  assert.deepEqual(JSON.parse(requests[1].body), { refresh: 'r2' })
})

test('refreshToken keeps the stored refresh token when none is returned', async () => {
  store.set('refresh_token', 'r1')
  pending.push(reply(200, { access: 'a2' }))
  await authService.refreshToken()
  assert.equal(store.get('access_token'), 'a2')
  assert.equal(store.get('refresh_token'), 'r1')
})

test('refreshToken clears the session when the refresh is rejected', async () => {
  store.set('access_token', 'a1')
  store.set('refresh_token', 'r1')
  pending.push(reply(401, { detail: 'Token is blacklisted' }))
  await assert.rejects(authService.refreshToken(), /Token refresh failed/)
  assert.equal(store.get('access_token'), undefined)
  assert.equal(store.get('refresh_token'), undefined)
})

test('refreshToken sends the stored token in the request body', async () => {
  store.set('refresh_token', 'r-stored')
  pending.push(reply(200, { access: 'a2' }))
  await authService.refreshToken()
  assert.equal(requests.length, 1)
  assert.match(requests[0].url, /\/auth\/refresh\/$/)
  assert.equal(requests[0].method, 'POST')
  assert.deepEqual(JSON.parse(requests[0].body), { refresh: 'r-stored' })
})

test('refreshToken throws without a stored token and does not call the API', async () => {
  await assert.rejects(authService.refreshToken(), /No refresh token available/)
  assert.equal(requests.length, 0)
})

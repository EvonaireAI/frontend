import assert from 'node:assert/strict'
import { test } from 'node:test'

// authedFetch attaches the current access token, retries once on 401 after
// a deduplicated refresh, and refuses to replay a request under a different
// account than the one it was sent for.

const { authedFetch } = await import('../lib/authed-fetch.ts')

const store = new Map()
globalThis.localStorage = {
  getItem: (key) => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => void store.set(key, String(value)),
  removeItem: (key) => void store.delete(key),
  clear: () => store.clear(),
}
globalThis.window = globalThis

const jwt = (userId) => `h.${btoa(JSON.stringify({ user_id: userId }))}.s`

let calls
function stubFetch(handler) {
  calls = []
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init })
    return handler(String(url), init, calls.length)
  }
}
const jsonResponse = (status, body = {}) => new Response(JSON.stringify(body), { status })
const authOf = (call) => new Headers(call.init.headers).get('Authorization')

function reset() {
  store.clear()
  store.set('refresh_token', 'refresh-1')
  stubFetch(() => jsonResponse(200, { ok: true }))
}

test('non-401 responses pass through with the caller token attached', async () => {
  reset()
  store.set('access_token', 'token-a')
  const res = await authedFetch('/api/things/', { headers: { 'Content-Type': 'application/json' } })
  assert.equal(res.status, 200)
  assert.equal(calls.length, 1)
  assert.equal(authOf(calls[0]), 'Bearer token-a')
  assert.equal(new Headers(calls[0].init.headers).get('Content-Type'), 'application/json')
})

test('a 401 triggers one refresh and a retry carrying the new token', async () => {
  reset()
  store.set('access_token', jwt(7))
  let refreshed = false
  stubFetch((url) => {
    if (url.endsWith('/auth/refresh/')) {
      refreshed = true
      return jsonResponse(200, { access: jwt(7), refresh: 'refresh-2' })
    }
    return refreshed ? jsonResponse(200, { ok: true }) : jsonResponse(401)
  })

  const res = await authedFetch('/api/things/')
  assert.equal(res.status, 200)
  assert.equal(calls.length, 3)
  assert.equal(calls[1].url, '/api/auth/refresh/')
  assert.equal(authOf(calls[2]), `Bearer ${jwt(7)}`)
  assert.equal(store.get('refresh_token'), 'refresh-2')
})

test('concurrent 401s share a single refresh', async () => {
  reset()
  store.set('access_token', jwt(7))
  let refreshCalls = 0
  stubFetch((url) => {
    if (url.endsWith('/auth/refresh/')) {
      refreshCalls++
      return jsonResponse(200, { access: jwt(7) })
    }
    return refreshCalls > 0 ? jsonResponse(200) : jsonResponse(401)
  })

  const [a, b] = await Promise.all([authedFetch('/api/a/'), authedFetch('/api/b/')])
  assert.equal(a.status, 200)
  assert.equal(b.status, 200)
  assert.equal(refreshCalls, 1)
})

test('a failed refresh returns the original 401', async () => {
  reset()
  store.set('access_token', jwt(7))
  stubFetch((url) => (url.endsWith('/auth/refresh/') ? jsonResponse(500) : jsonResponse(401)))

  const res = await authedFetch('/api/things/')
  assert.equal(res.status, 401)
  assert.equal(calls.length, 2)
})

test('unauthenticated requests never trigger a refresh', async () => {
  reset()
  store.delete('refresh_token')
  stubFetch(() => jsonResponse(401))
  const res = await authedFetch('/api/public/')
  assert.equal(res.status, 401)
  assert.equal(calls.length, 1)
})

test('a second 401 after refresh is returned, not retried', async () => {
  reset()
  store.set('access_token', jwt(7))
  stubFetch((url) => (url.endsWith('/auth/refresh/') ? jsonResponse(200, { access: jwt(7) }) : jsonResponse(401)))

  const res = await authedFetch('/api/things/')
  assert.equal(res.status, 401)
  assert.equal(calls.length, 3)
})

test('an account switch mid-request blocks the retry', async () => {
  reset()
  store.set('access_token', jwt(7))
  stubFetch((url) => {
    if (url.endsWith('/auth/refresh/')) return jsonResponse(200, { access: jwt(9) })
    store.set('access_token', jwt(9))
    return jsonResponse(401)
  })

  const res = await authedFetch('/api/things/')
  assert.equal(res.status, 401)
  assert.equal(calls.length, 1)
})

test('a retry after refresh still under the wrong account is not sent', async () => {
  reset()
  store.set('access_token', jwt(7))
  let refreshCalls = 0
  stubFetch((url) => {
    if (url.endsWith('/auth/refresh/')) {
      refreshCalls++
      store.set('access_token', jwt(9))
      return jsonResponse(200, { access: jwt(9) })
    }
    return refreshCalls > 0 ? jsonResponse(200) : jsonResponse(401)
  })

  const res = await authedFetch('/api/things/')
  assert.equal(res.status, 401)
  assert.equal(calls.length, 2)
})

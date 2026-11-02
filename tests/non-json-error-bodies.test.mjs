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
const { sanctuariesService } = await import('../lib/sanctuaries.ts')

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
    return pending.shift()
  }
})
afterEach(() => {
  if (originalFetch) Object.defineProperty(globalThis, 'fetch', originalFetch)
  else delete globalThis.fetch
  if (originalLocalStorage) Object.defineProperty(globalThis, 'localStorage', originalLocalStorage)
  else delete globalThis.localStorage
})

// A proxy/WAF error page: HTML body, not JSON.
const htmlReply = (status, statusText) =>
  new Response('<html><body>Bad Gateway</body></html>', { status, statusText })

const jsonReply = (status, body) => Response.json(body, { status })

test('login falls back to its message when the 401 body is HTML', async () => {
  pending.push(htmlReply(502, 'Bad Gateway'))
  await assert.rejects(authService.login('a@b.c', 'pw'), /Login failed/)
})

test('login falls back to its message when the error body is empty', async () => {
  pending.push(new Response(null, { status: 401 }))
  await assert.rejects(authService.login('a@b.c', 'pw'), /Login failed/)
})

test('login still surfaces a JSON detail message', async () => {
  pending.push(jsonReply(401, { detail: 'No active account found' }))
  await assert.rejects(authService.login('a@b.c', 'pw'), /No active account found/)
})

test('resetPassword falls back when the error body is HTML', async () => {
  pending.push(htmlReply(500, 'Internal Server Error'))
  await assert.rejects(
    authService.resetPassword('tok', 'a', 'b'),
    /Failed to reset password/,
  )
})

test('resetPassword still surfaces a confirm_password field error', async () => {
  pending.push(jsonReply(400, { confirm_password: ['Passwords do not match.'] }))
  await assert.rejects(
    authService.resetPassword('tok', 'a', 'b'),
    /Passwords do not match\./,
  )
})

test('uploadRitual falls back when the error body is HTML', async () => {
  pending.push(htmlReply(502, 'Bad Gateway'))
  await assert.rejects(authService.uploadRitual(new FormData()), /Failed to upload ritual/)
})

test('createSanctuary falls back with statusText when the body is HTML', async () => {
  pending.push(htmlReply(503, 'Service Unavailable'))
  await assert.rejects(
    sanctuariesService.createSanctuary({ title: 'T', privacy: 'public' }),
    /Failed to create sanctuary: Service Unavailable/,
  )
})

test('approveRequest still surfaces a JSON detail message', async () => {
  pending.push(jsonReply(403, { detail: 'Only the owner can approve.' }))
  await assert.rejects(
    sanctuariesService.approveRequest(1, 2),
    /Only the owner can approve\./,
  )
})

test('leaveSanctuary falls back when the error body is empty', async () => {
  pending.push(new Response(null, { status: 500, statusText: 'Internal Server Error' }))
  await assert.rejects(
    sanctuariesService.leaveSanctuary(1),
    /Failed to leave sanctuary: Internal Server Error/,
  )
})

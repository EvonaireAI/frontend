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
const { getDeviceId, clearDeviceId } = await import('../lib/device-identity.ts')

const DEVICE_ID_KEY = 'evonaire_device_id'

const saved = {
  window: Object.getOwnPropertyDescriptor(globalThis, 'window'),
  localStorage: Object.getOwnPropertyDescriptor(globalThis, 'localStorage'),
  document: Object.getOwnPropertyDescriptor(globalThis, 'document'),
}

let store

function restore(name, descriptor) {
  if (descriptor) Object.defineProperty(globalThis, name, descriptor)
  else delete globalThis[name]
}

function installStorage() {
  store = new Map()
  globalThis.localStorage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
  }
}

beforeEach(() => {
  globalThis.window = {}
  installStorage()
})

afterEach(() => {
  restore('window', saved.window)
  restore('localStorage', saved.localStorage)
  restore('document', saved.document)
})

test('mints an id on first use and reuses it afterwards', () => {
  const first = getDeviceId()
  assert.match(first, /^[0-9a-f-]{36}$/)
  assert.equal(store.get(DEVICE_ID_KEY), first)
  assert.equal(getDeviceId(), first)
})

test('returns undefined outside the browser', () => {
  delete globalThis.window
  assert.equal(getDeviceId(), undefined)
})

test('returns undefined when storage read throws', () => {
  globalThis.localStorage = {
    getItem() {
      throw new Error('denied')
    },
    setItem() {
      throw new Error('denied')
    },
    removeItem() {
      throw new Error('denied')
    },
  }
  assert.equal(getDeviceId(), undefined)
})

test('returns undefined when storage write throws', () => {
  globalThis.localStorage = {
    getItem: () => null,
    setItem() {
      throw new Error('quota')
    },
    removeItem() {},
  }
  assert.equal(getDeviceId(), undefined)
})

test('clearDeviceId drops the id so the next session mints a different one', () => {
  const first = getDeviceId()
  clearDeviceId()
  assert.equal(store.has(DEVICE_ID_KEY), false)
  const second = getDeviceId()
  assert.match(second, /^[0-9a-f-]{36}$/)
  assert.notEqual(second, first)
})

test('clearDeviceId tolerates missing storage and a missing window', () => {
  assert.doesNotThrow(() => {
    globalThis.localStorage = {
      removeItem() {
        throw new Error('denied')
      },
    }
    clearDeviceId()
    delete globalThis.window
    clearDeviceId()
  })
})

test('logout clears the device id along with the tokens', async () => {
  globalThis.document = { cookie: 'session=1' }
  store.set('access_token', 'A-access')
  store.set('refresh_token', 'A-refresh')
  store.set(DEVICE_ID_KEY, 'device-of-A')

  const { authService } = await import('../lib/auth.ts')
  authService.logout()

  assert.equal(store.has('access_token'), false)
  assert.equal(store.has('refresh_token'), false)
  assert.equal(store.has(DEVICE_ID_KEY), false)
  assert.match(globalThis.document.cookie, /^session=;/)
})

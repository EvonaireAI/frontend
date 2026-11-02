import assert from 'node:assert/strict'
import { test } from 'node:test'

const { isAuthStorageKey } = await import('../lib/auth-storage.ts')

test('the token keys signal an external session change', () => {
  assert.equal(isAuthStorageKey('access_token'), true)
  assert.equal(isAuthStorageKey('refresh_token'), true)
})

test('a storage clear resets the session', () => {
  assert.equal(isAuthStorageKey(null), true)
})

test('unrelated keys do not reset auth state', () => {
  assert.equal(isAuthStorageKey('evonaire_device_id'), false)
  assert.equal(isAuthStorageKey('theme'), false)
  assert.equal(isAuthStorageKey('access_token_backup'), false)
  assert.equal(isAuthStorageKey(''), false)
})

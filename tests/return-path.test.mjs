import assert from 'node:assert/strict'
import { test } from 'node:test'

// safeReturnPath decides whether a ?from= value may be navigated to after
// login. Only same-origin absolute paths pass; protocol-relative, external,
// and parser-confusion inputs all fall back to the default route.

import { safeReturnPath } from '../lib/return-path.ts'

test('internal paths pass through', () => {
  assert.equal(safeReturnPath('/dashboard'), '/dashboard')
  assert.equal(safeReturnPath('/member/billing?tab=invoices'), '/member/billing?tab=invoices')
  assert.equal(safeReturnPath('/steward/requests'), '/steward/requests')
})

test('missing or oversized input is rejected', () => {
  assert.equal(safeReturnPath(null), null)
  assert.equal(safeReturnPath(undefined), null)
  assert.equal(safeReturnPath(''), null)
  assert.equal(safeReturnPath(`/${'a'.repeat(2048)}`), null)
})

test('external and protocol-relative values are rejected', () => {
  assert.equal(safeReturnPath('//evil.example'), null)
  assert.equal(safeReturnPath('https://evil.example'), null)
  assert.equal(safeReturnPath('http://evil.example'), null)
  assert.equal(safeReturnPath('javascript:alert(1)'), null)
  assert.equal(safeReturnPath('data:text/html,<b>'), null)
  assert.equal(safeReturnPath('evil.example'), null)
})

test('backslash and whitespace tricks are rejected', () => {
  assert.equal(safeReturnPath('/\\evil.example'), null)
  assert.equal(safeReturnPath('\\\\evil.example'), null)
  assert.equal(safeReturnPath('/path\\evil'), null)
  assert.equal(safeReturnPath('/path with space'), null)
  assert.equal(safeReturnPath('/path\n/evil'), null)
})

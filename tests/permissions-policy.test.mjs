import assert from 'node:assert/strict'
import { test } from 'node:test'

// The header table gives /creator/upload microphone=(self) — it is the only
// surface calling getUserMedia — and keeps microphone=() everywhere else.
// Sources are written so each path resolves to exactly one entry and one
// Permissions-Policy value; this suite simulates Next's path matching for
// the source shapes in the config and pins that contract.

import nextConfig from '../next.config.mjs'

const entries = await nextConfig.headers()

// Minimal matcher for the two source shapes this config uses: a literal
// path, or a path whose body is a regex group (Next's documented exclusion
// pattern, e.g. /((?!api|_next).*) taken from the matcher docs).
function sourceToRegExp(source) {
  if (source.includes('(')) {
    return new RegExp(`^${source}$`)
  }
  const escaped = source.replace(/[.*+?^${}|[\]\\]/g, '\\$&')
  return new RegExp(`^${escaped}$`)
}

const compiled = entries.map((entry) => ({
  ...entry,
  matches: sourceToRegExp(entry.source),
}))

function headersFor(path) {
  return compiled.filter((entry) => entry.matches.test(path))
}

function permissionsPolicyValue(entry) {
  const hits = entry.headers.filter((h) => h.key === 'Permissions-Policy')
  assert.equal(hits.length, 1, 'one Permissions-Policy per entry')
  return hits[0].value
}

const probePaths = ['/creator/upload', '/creator', '/', '/member', '/auth/login']

test('a future /creator/upload/<sub> route still gets the restrictive policy', () => {
  const hits = headersFor('/creator/upload/extra')
  assert.equal(hits.length, 1)
  assert.match(permissionsPolicyValue(hits[0]), /microphone=\(\)/)
})

test('every path resolves to exactly one header entry', () => {
  for (const path of probePaths) {
    assert.equal(headersFor(path).length, 1, path)
  }
})

test('only the recorder page gets microphone=(self)', () => {
  const [upload] = headersFor('/creator/upload')
  assert.match(permissionsPolicyValue(upload), /microphone=\(self\)/)

  for (const path of ['/creator', '/', '/member', '/auth/login']) {
    const [entry] = headersFor(path)
    assert.match(permissionsPolicyValue(entry), /microphone=\(\)/, path)
  }
})

test('the other security headers are identical on both entries', () => {
  const [upload] = headersFor('/creator/upload')
  const [rest] = headersFor('/')
  const baseline = rest.headers.filter((h) => h.key !== 'Permissions-Policy')
  const scoped = upload.headers.filter((h) => h.key !== 'Permissions-Policy')
  assert.deepEqual(scoped, baseline)
})

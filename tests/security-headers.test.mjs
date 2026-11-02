import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import test from 'node:test'

function headersFor(apiBase) {
  const env = { ...process.env }
  delete env.NEXT_PUBLIC_API_BASE_URL
  if (apiBase !== undefined) env.NEXT_PUBLIC_API_BASE_URL = apiBase
  // A fresh process observes build-time configuration without a cached import.
  return JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', `
    import config from './next.config.mjs'
    console.log(JSON.stringify(await config.headers()))
  `], { env, encoding: 'utf8' }))
}

function policyFor(apiBase) {
  const routes = headersFor(apiBase)
  const route = routes.find(({ source }) => source === '/:path*')
  assert.ok(route, 'security headers cover all routes')
  const policies = route.headers.filter(({ key }) => key.toLowerCase() === 'content-security-policy')
  assert.equal(policies.length, 1, 'exactly one CSP header')
  const entries = policies[0].value.split(';').map((directive) => directive.trim().split(/\s+/))
  const policy = new Map(entries.map(([name, ...sources]) => [name, sources]))
  assert.equal(policy.size, entries.length, 'no duplicate directives')
  return policy
}

for (const apiBase of [undefined, '/api', '/custom/api']) {
  test(`same-origin API configuration: ${String(apiBase)}`, () => {
    const policy = policyFor(apiBase)
    assert.deepEqual(policy.get('connect-src'), ["'self'"])
    assert.deepEqual(policy.get('img-src'), ["'self'", 'data:', 'blob:'])
  })
}

for (const apiBase of ['https://api.example.test/api/', 'http://localhost:8000/api/']) {
  test(`absolute API configuration: ${apiBase}`, () => {
    const origin = new URL(apiBase).origin
    const policy = policyFor(apiBase)
    assert.deepEqual(policy.get('connect-src'), ["'self'", origin])
    assert.ok(policy.get('img-src').includes(origin))
    assert.ok(policy.get('media-src').includes(origin))
    assert.ok(!policy.get('connect-src').includes(apiBase), 'allow an origin, not a path')
  })
}

test('invalid API configuration does not broaden network access', () => {
  assert.deepEqual(policyFor('not a URL').get('connect-src'), ["'self'"])
})

test('embedding, object and form restrictions remain explicit', () => {
  const policy = policyFor()
  for (const [name, expected] of Object.entries({
    'default-src': ["'self'"],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
    'frame-src': ['https://docs.google.com'],
  })) assert.deepEqual(policy.get(name), expected, name)
})

test('existing security headers are preserved without duplicate names', () => {
  const [{ headers }] = headersFor()
  const names = headers.map(({ key }) => key.toLowerCase())
  assert.equal(new Set(names).size, names.length)
  for (const name of ['x-frame-options', 'x-content-type-options', 'referrer-policy',
    'strict-transport-security', 'permissions-policy']) assert.ok(names.includes(name), name)
})

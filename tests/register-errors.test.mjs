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
const { ApiError, toApiError } = await import('../lib/api-errors.ts')
const { authService } = await import('../lib/auth.ts')

const form = {
  first_name: 'Test',
  last_name: 'Member',
  email: 'member@example.test',
  password: 'secret',
}

let requests
let pending
let originalFetch

beforeEach(() => {
  requests = []
  pending = []
  originalFetch = Object.getOwnPropertyDescriptor(globalThis, 'fetch')
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
})
const reply = (status, body = {}) => ({ status, body })

test('toApiError splits field errors from the detail summary', () => {
  const err = toApiError(
    {
      detail: 'Validation failed.',
      password: ['This password is too short.', 'This password is too common.'],
      email: 'user with this email address already exists.',
    },
    'Registration failed',
    400,
  )
  assert.ok(err instanceof ApiError)
  assert.ok(err instanceof Error)
  assert.equal(err.status, 400)
  assert.equal(err.nonFieldMessage, 'Validation failed.')
  assert.deepEqual(err.fields, {
    password: ['This password is too short.', 'This password is too common.'],
    email: ['user with this email address already exists.'],
  })
  assert.match(err.message, /Validation failed\./)
  assert.match(err.message, /password: This password is too short\./)
})

test('toApiError flattens nested serializer errors to dotted keys', () => {
  const err = toApiError({ profile: { website: ['Enter a valid URL.'] } }, 'Registration failed')
  assert.deepEqual(err.fields, { 'profile.website': ['Enter a valid URL.'] })
  assert.match(err.message, /profile\.website: Enter a valid URL\./)
})

test('toApiError falls back on bodies with no usable message', () => {
  for (const body of [null, {}, [], 42]) {
    const err = toApiError(body, 'Registration failed')
    assert.equal(err.message, 'Registration failed')
    assert.deepEqual(err.fields, {})
  }
  const err = toApiError('Something went wrong', 'Registration failed')
  assert.equal(err.message, 'Something went wrong')
})

test('register throws an ApiError carrying field errors', async () => {
  pending.push(reply(400, { password: ['This password is too short.'] }))
  await assert.rejects(
    authService.register(form),
    (err) => {
      assert.ok(err instanceof ApiError)
      assert.equal(err.status, 400)
      assert.deepEqual(err.fields, { password: ['This password is too short.'] })
      return true
    },
  )
  assert.equal(requests.length, 1)
  assert.match(requests[0].url, /\/auth\/register\/$/)
})

test('register keeps the detail message when there are no field errors', async () => {
  pending.push(reply(403, { detail: 'Registration is currently disabled.' }))
  await assert.rejects(authService.register(form), (err) => {
    assert.ok(err instanceof ApiError)
    assert.equal(err.message, 'Registration is currently disabled.')
    assert.equal(err.nonFieldMessage, 'Registration is currently disabled.')
    assert.deepEqual(err.fields, {})
    return true
  })
})

test('register surfaces non_field_errors in the summary', async () => {
  pending.push(reply(400, { non_field_errors: ['Unable to create account.'], first_name: ['Required.'] }))
  await assert.rejects(authService.register(form), (err) => {
    assert.equal(err.nonFieldMessage, 'Unable to create account.')
    assert.deepEqual(err.fields, { first_name: ['Required.'] })
    return true
  })
})

test('register reports the fallback when the error body is not JSON', async () => {
  pending.push(new Response('<html>Bad Gateway</html>', { status: 502 }))
  await assert.rejects(authService.register(form), (err) => {
    assert.ok(err instanceof ApiError)
    assert.equal(err.status, 502)
    assert.equal(err.message, 'Registration failed')
    return true
  })
})

test('register resolves with the response body on success', async () => {
  pending.push(reply(201, { id: 7, email: form.email }))
  const result = await authService.register(form)
  assert.deepEqual(result, { id: 7, email: form.email })
})

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

// middleware.ts holds two parallel lists: the prefixes it gates and the
// matcher Next uses to decide whether the middleware runs at all. Adding a
// route to one and forgetting the other is a silent fail-open, because an
// unmatched route never reaches the check. `next/server` does not resolve
// under plain Node, so the guard reads the two arrays from the source.

const source = readFileSync(new URL('../middleware.ts', import.meta.url), 'utf8')

function stringsInArrayAfter(marker) {
  const markerAt = source.indexOf(marker)
  assert.notEqual(markerAt, -1, `middleware.ts no longer contains ${marker}`)
  const open = source.indexOf('[', markerAt)
  const close = source.indexOf(']', open)
  assert.ok(open !== -1 && close > open, `no array literal after ${marker}`)
  return [...source.slice(open, close).matchAll(/"([^"]*)"/g)].map((match) => match[1])
}

test('every protected prefix has a matcher entry in the same order', () => {
  const routes = stringsInArrayAfter('const protectedRoutes')
  const matcher = stringsInArrayAfter('matcher:')

  assert.ok(routes.length > 0, 'protectedRoutes is empty')
  assert.deepEqual(
    routes.map((route) => `${route}/:path*`),
    matcher,
  )
})

test('neither list repeats an entry', () => {
  for (const [name, marker] of [
    ['protectedRoutes', 'const protectedRoutes'],
    ['matcher', 'matcher:'],
  ]) {
    const values = stringsInArrayAfter(marker)
    assert.equal(new Set(values).size, values.length, `${name} has a duplicate entry`)
  }
})

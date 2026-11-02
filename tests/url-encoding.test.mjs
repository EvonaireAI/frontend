import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { test } from 'node:test'

// Dynamic values interpolated into API request URLs used to go in raw. A
// path segment containing %2F or dots survives fetch normalization and
// reaches a different endpoint than intended, and an unescaped `&` or `#`
// in a query value silently truncates the request. Every `${ident}` inside
// an API_BASE_URL template must therefore be wrapped in encodeURIComponent.
//
// The allowlist covers interpolations that are already encoded or are not
// single values at all:
//   - API_BASE_URL itself
//   - `path`: whole-path arguments passed to shared request helpers
//   - `params`, `query`, `suffix`, `qs`: URLSearchParams.toString() output,
//     which is percent-encoded by construction
const ALLOWED_BARE_IDENTIFIERS = new Set([
  'API_BASE_URL',
  'path',
  'params',
  'query',
  'suffix',
  'qs',
])

const libDir = new URL('../lib/', import.meta.url)
const files = readdirSync(libDir).filter((name) => /\.tsx?$/.test(name))

// URL templates are always single-line in this codebase. A nested template
// (e.g. `${qs ? `?${qs}` : ""}`) truncates the outer match at the inner
// backtick, which still leaves only allowlisted fragments uninspected.
const urlTemplate = /`[^`]*\$\{API_BASE_URL\}[^`]*`/g
const interpolation = /\$\{([^}]*)\}/g
const bareIdentifier = /^[A-Za-z_$][\w$]*$/

test('every dynamic value in an API URL is encodeURIComponent-wrapped', () => {
  const violations = []
  for (const file of files) {
    const source = readFileSync(new URL(file, libDir), 'utf8')
    for (const template of source.matchAll(urlTemplate)) {
      for (const match of template[0].matchAll(interpolation)) {
        const expr = match[1].trim()
        if (!bareIdentifier.test(expr)) continue
        if (ALLOWED_BARE_IDENTIFIERS.has(expr)) continue
        const line = source.slice(0, template.index).split('\n').length
        violations.push(`${file}:${line} interpolates \${${expr}} raw`)
      }
    }
  }
  assert.deepEqual(violations, [])
})

test('the URLSearchParams allowlist is not hiding raw segments', () => {
  // If a helper ever interpolates a *string* variable into the middle of a
  // path under an allowlisted name, this guard would miss it. Assert the
  // allowlisted names only ever appear in query position (after `?`) or as
  // a full-path argument, never between two slashes.
  const rawBetweenSlashes = /\/\$\{(params|query|suffix|qs)\}\//
  for (const file of files) {
    const source = readFileSync(new URL(file, libDir), 'utf8')
    for (const template of source.matchAll(urlTemplate)) {
      assert.equal(
        rawBetweenSlashes.test(template[0]),
        false,
        `${file} places an allowlisted fragment mid-path: ${template[0]}`,
      )
    }
  }
})

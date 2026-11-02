import assert from 'node:assert/strict'
import { test } from 'node:test'

const { avatarFileError } = await import('../lib/image-upload.ts')

test('accepts the raster types the profile endpoints expect', () => {
  for (const type of ['image/png', 'image/jpeg', 'image/webp', 'image/gif']) {
    assert.equal(avatarFileError({ name: 'photo.bin', type }), null, type)
  }
})

test('accepts reported types case-insensitively', () => {
  assert.equal(avatarFileError({ name: 'photo.png', type: 'IMAGE/PNG' }), null)
})

test('rejects SVG with a message naming the accepted formats', () => {
  const message = avatarFileError({ name: 'avatar.svg', type: 'image/svg+xml' })
  assert.match(message, /SVG/)
  assert.match(message, /PNG, JPEG, WebP, or GIF/)
})

test('rejects SVG hidden behind an empty type by its extension', () => {
  assert.notEqual(avatarFileError({ name: 'avatar.svg', type: '' }), null)
})

test('falls back to the extension only when the browser reports no type', () => {
  for (const name of ['a.png', 'a.JPG', 'a.jpeg', 'a.webp', 'a.gif']) {
    assert.equal(avatarFileError({ name, type: '' }), null, name)
  }
  assert.notEqual(avatarFileError({ name: 'a.txt', type: '' }), null)
  assert.notEqual(avatarFileError({ name: 'a', type: '' }), null)
})

test('rejects non-image types even when the name looks like an image', () => {
  assert.notEqual(avatarFileError({ name: 'avatar.png', type: 'text/html' }), null)
  assert.notEqual(avatarFileError({ name: 'avatar.png', type: 'application/pdf' }), null)
})

test('rejects a missing file description without throwing', () => {
  assert.notEqual(avatarFileError({}), null)
})

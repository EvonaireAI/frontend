import assert from 'node:assert/strict'
import { test } from 'node:test'

// The audio gate mirrors lib/image-upload.ts: the picker's `accept` hint is
// not a check, so the upload path validates file.type against an allowlist
// and only falls back to the extension when the browser reports no type.
// The recorder helpers keep the declared mimeType, the filename extension,
// and the bytes MediaRecorder actually produced in agreement.

import {
  audioFileError,
  extensionForAudioType,
  preferredRecordingType,
} from '../lib/audio-upload.ts'

test('accepts the common audio containers by reported type', () => {
  for (const type of [
    'audio/mpeg',
    'audio/mp4',
    'audio/x-m4a',
    'audio/wav',
    'audio/ogg',
    'audio/webm',
    'audio/flac',
    'audio/aac',
  ]) {
    assert.equal(audioFileError({ name: 'a.bin', type }), null, type)
  }
})

test('rejects non-audio and unexpected audio types', () => {
  for (const type of [
    'video/mp4',
    'image/png',
    'image/svg+xml',
    'application/pdf',
    'application/octet-stream',
    'text/plain',
    'audio/midi',
  ]) {
    assert.match(audioFileError({ name: 'a.bin', type }) ?? '', /Choose an/)
  }
})

test('empty type falls back to the extension, and only the extension', () => {
  assert.equal(audioFileError({ name: 'ritual.mp3', type: '' }), null)
  assert.equal(audioFileError({ name: 'ritual.M4A', type: '' }), null)
  assert.match(audioFileError({ name: 'ritual.exe', type: '' }) ?? '', /Choose an/)
  assert.match(audioFileError({ name: 'no-extension', type: '' }) ?? '', /Choose an/)
  // A reported type wins over a misleading extension.
  assert.match(audioFileError({ name: 'disguised.mp3', type: 'video/mp4' }) ?? '', /Choose an/)
})

test('preferredRecordingType returns the first supported candidate', () => {
  assert.equal(
    preferredRecordingType((t) => t === 'audio/mp4'),
    'audio/mp4',
  )
  assert.equal(
    preferredRecordingType((t) => t.startsWith('audio/webm')),
    'audio/webm;codecs=opus',
  )
  assert.equal(
    preferredRecordingType(() => false),
    null,
  )
  // A picky isTypeSupported that throws is skipped, not fatal.
  assert.equal(
    preferredRecordingType((t) => {
      if (t === 'audio/mp4') throw new Error('nope')
      return t === 'audio/webm'
    }),
    'audio/webm',
  )
})

test('extensionForAudioType maps containers honestly', () => {
  assert.equal(extensionForAudioType('audio/mpeg'), 'mp3')
  assert.equal(extensionForAudioType('audio/mp4'), 'm4a')
  assert.equal(extensionForAudioType('audio/webm;codecs=opus'), 'webm')
  assert.equal(extensionForAudioType('audio/ogg'), 'ogg')
  assert.equal(extensionForAudioType('audio/x-wav'), 'wav')
})

test('extensionForAudioType never invents a known-sounding extension', () => {
  // Unknown but well-formed audio subtype falls back to the subtype itself.
  assert.equal(extensionForAudioType('audio/opus'), 'opus')
  // Garbage or non-audio input must not come back as ".mp3".
  assert.equal(extensionForAudioType(''), 'bin')
  assert.equal(extensionForAudioType('video/mp4'), 'bin')
  assert.equal(extensionForAudioType('audio/'), 'bin')
})

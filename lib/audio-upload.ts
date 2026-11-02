// Audio upload gate for the creator ritual form.
//
// The file input's `accept="audio/*"` is a picker hint, not a check: the
// browser fills `file.type` from the extension, and both can be changed in
// devtools. The backend is the real boundary. This gate stops the honest
// misclick before it uploads a file the rituals endpoint does not expect.
//
// The recorder side has the mirror-image problem: MediaRecorder emits a
// browser-chosen container (Chrome gives audio/webm, Safari audio/mp4) and
// the page used to label every recording "audio/mp3" regardless. A declared
// type that does not match the bytes either fails backend validation or,
// worse, passes as something it is not — the same stored-content hazard the
// avatar gate rejects. preferredRecordingType and extensionForAudioType keep
// the declared type, the filename, and the actual bytes in agreement.

const ALLOWED_TYPES = new Set([
  "audio/mpeg",
  "audio/mp4",
  "audio/x-m4a",
  "audio/wav",
  "audio/x-wav",
  "audio/wave",
  "audio/ogg",
  "audio/webm",
  "audio/flac",
  "audio/aac",
])

// Some mobile pickers hand over an empty `type`. The extension is only a
// fallback for those, and it decides nothing when the browser reports a type.
const ALLOWED_EXTENSIONS = [".mp3", ".m4a", ".wav", ".ogg", ".webm", ".flac", ".aac"]

export function audioFileError(file: { name?: string; type?: string }): string | null {
  const type = (file.type ?? "").toLowerCase()

  if (ALLOWED_TYPES.has(type)) return null

  if (!type) {
    const name = (file.name ?? "").toLowerCase()
    if (ALLOWED_EXTENSIONS.some((extension) => name.endsWith(extension))) return null
  }

  return "Choose an MP3, M4A, WAV, OGG, WebM, FLAC, or AAC audio file."
}

// MediaRecorder container preference, most portable first. audio/mp4 (AAC)
// plays in every modern browser and is what Safari records natively; the
// webm/opus entries are what Chromium and Firefox produce.
const RECORDING_TYPE_PREFERENCE = [
  "audio/mp4",
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
]

// First entry the browser's MediaRecorder accepts, or null to let it pick
// its own default. Pass MediaRecorder.isTypeSupported bound to the class.
export function preferredRecordingType(
  isSupported: (type: string) => boolean,
): string | null {
  for (const type of RECORDING_TYPE_PREFERENCE) {
    try {
      if (isSupported(type)) return type
    } catch {
      // A picky implementation throws on malformed candidates; skip it
    }
  }
  return null
}

const EXTENSION_BY_TYPE: Record<string, string> = {
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/wave": "wav",
  "audio/ogg": "ogg",
  "audio/webm": "webm",
  "audio/flac": "flac",
  "audio/aac": "aac",
}

// Extension that honestly describes a blob of `type`. Falls back to the
// subtype when it is a safe token, else "bin" rather than lying with ".mp3".
export function extensionForAudioType(type: string): string {
  const base = (type ?? "").toLowerCase().split(";")[0].trim()

  if (EXTENSION_BY_TYPE[base]) return EXTENSION_BY_TYPE[base]

  const subtype = base.startsWith("audio/") ? base.slice(6) : ""
  if (/^[a-z0-9]+$/.test(subtype)) return subtype

  return "bin"
}

// Avatar upload gate.
//
// The file input's `accept="image/*"` is a picker hint, not a check: it still
// offers SVG and every other image type, and its value can be cleared from
// devtools. The backend is the real boundary. This gate stops the honest
// misclick before it uploads a file the profile endpoints do not expect.
//
// SVG is rejected explicitly rather than by omission. An SVG is an active
// document, so an avatar served inline becomes stored XSS in every view that
// renders it. Whether the backend stores it safely is not something this file
// can promise, so it does not send one.

const ALLOWED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
])

// Some mobile pickers hand over an empty `type`. The extension is only a
// fallback for those, and it decides nothing when the browser reports a type.
const ALLOWED_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp", ".gif"]

export function avatarFileError(file: { name?: string; type?: string }): string | null {
  const type = (file.type ?? "").toLowerCase()

  if (ALLOWED_TYPES.has(type)) return null

  if (type === "image/svg+xml") {
    return "SVG images are not accepted. Upload a PNG, JPEG, WebP, or GIF."
  }

  if (!type) {
    const name = (file.name ?? "").toLowerCase()
    if (ALLOWED_EXTENSIONS.some((extension) => name.endsWith(extension))) return null
  }

  return "Choose a PNG, JPEG, WebP, or GIF image."
}

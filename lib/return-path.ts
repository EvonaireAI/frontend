// Sanitize a `?from=` return path before the login page navigates to it.
//
// middleware.ts attaches `from=<pathname>` when it bounces a logged-out user
// to /auth/login. Honoring it after login is correct UX — but only while it
// stays a same-origin absolute path. An unchecked value is an open redirect:
// `?from=//evil.example` is protocol-relative, `?from=\\evil.example` is a
// backslash trick some parsers treat as `//`, and `?from=https://...` is
// outright external. Anything that is not clearly an internal path is
// dropped in favor of the caller's fallback.

const MAX_RETURN_PATH_LENGTH = 2048

export function safeReturnPath(from: string | null | undefined): string | null {
  if (!from || from.length > MAX_RETURN_PATH_LENGTH) return null

  // Must be a single leading slash: "/dashboard" in, "//evil" and "/\evil" out.
  if (!from.startsWith("/") || from.startsWith("//") || from.includes("\\")) {
    return null
  }

  // No control characters or whitespace — a path the router cannot carry
  // cleanly is not a path we carry at all.
  if (/[\s]/.test(from)) return null

  return from
}

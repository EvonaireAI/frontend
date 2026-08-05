// Visible dynamic watermark (Session 12, CEO framework area 3).
//
// This is the highest-value protection we can actually ship on the web. It does
// not prevent a recording; it makes a leaked recording traceable, and the fact
// that it is visible is itself the deterrent.
//
// What is rendered: an 8-character pseudonym, the short session id, and a live
// timestamp. Never the email, never the raw user id — a watermark that leaks
// personal data to anyone standing behind the listener is a privacy failure,
// not a protection.

export interface WatermarkIdentity {
  /** 8-char opaque pseudonym. Never derived from anything human-readable. */
  pseudonym: string
  /** Short form of the active playback session id, or "—" before one exists. */
  sessionLabel: string
}

const PSEUDONYM_LENGTH = 8
// Crockford-style alphabet: no I/L/O/U, so a pseudonym read off a screenshot
// and typed into a support ticket survives the trip.
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"

const cache = new Map<string, string>()

function encode(bytes: Uint8Array): string {
  let out = ""
  for (let i = 0; i < PSEUDONYM_LENGTH; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length]
  }
  return out
}

// Non-cryptographic fallback for insecure contexts (plain http on a LAN, older
// engines) where crypto.subtle is unavailable. Still one-way and still opaque —
// it just is not a security boundary, and it does not need to be: the pseudonym
// identifies a leak to us, it does not authenticate anyone.
function fallbackDigest(input: string): string {
  const bytes = new Uint8Array(PSEUDONYM_LENGTH)
  let h1 = 0x811c9dc5
  let h2 = 0x01000193
  for (let i = 0; i < input.length; i++) {
    h1 = Math.imul(h1 ^ input.charCodeAt(i), 0x01000193) >>> 0
    h2 = Math.imul(h2 + input.charCodeAt(i) * (i + 1), 0x85ebca6b) >>> 0
  }
  for (let i = 0; i < PSEUDONYM_LENGTH; i++) {
    const mixed = i % 2 === 0 ? h1 >>> (i * 3) % 24 : h2 >>> (i * 3) % 24
    bytes[i] = mixed & 0xff
  }
  return encode(bytes)
}

/**
 * Derive the watermark pseudonym for a user.
 *
 * The Session 12 backend contract does not yet expose a server-side HMAC
 * pseudonym field, so this derives one in the browser: SHA-256 over the user id
 * with a fixed domain-separation prefix, truncated to 8 characters. It is
 * stable per user, opaque on screen, and reversible only by the platform (which
 * knows the user ids and can recompute the mapping).
 *
 * When the backend adds a pseudonym to the profile payload, pass it through
 * `serverPseudonym` and this derivation is skipped — that is the preferred
 * source, because a server HMAC keyed on ANALYTICS_HASH_SALT cannot be
 * recomputed by anyone holding only the client bundle.
 */
export async function derivePseudonym(
  userId: number | string | undefined,
  serverPseudonym?: string,
): Promise<string> {
  if (serverPseudonym) return serverPseudonym.slice(0, PSEUDONYM_LENGTH).toUpperCase()
  if (userId === undefined || userId === null || userId === "") return "————————"

  const material = `evonaire:watermark:v1:${userId}`
  const cached = cache.get(material)
  if (cached) return cached

  let result: string
  try {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(material))
    result = encode(new Uint8Array(digest))
  } catch {
    result = fallbackDigest(material)
  }

  cache.set(material, result)
  return result
}

/** Session ids are small integers; the short form keeps the overlay unobtrusive. */
export function shortSessionLabel(sessionId: number | null): string {
  if (sessionId === null || sessionId === undefined) return "—"
  return `S${String(sessionId).slice(-6)}`
}

/** UTC so a leaked recording timestamps identically wherever it is reviewed. */
export function watermarkTimestamp(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0")
  return (
    `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())} ` +
    `${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}:${pad(now.getUTCSeconds())}Z`
  )
}

export function watermarkText(identity: WatermarkIdentity, now: Date): string {
  return `${identity.pseudonym} · ${identity.sessionLabel} · ${watermarkTimestamp(now)}`
}

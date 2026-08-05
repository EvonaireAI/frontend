// ClaimChain — provenance, licensing and revocation records (Session 13).
//
// READ THIS BEFORE EDITING ANY COPY IN THIS FEATURE.
//
// Claim events are hash-chained in our own database and batched into Merkle
// roots. Those roots are NOT published to any external chain or timestamp
// authority: `CLAIMCHAIN_ANCHORING_ENABLED` is false and the adapter is the
// null adapter, so every batch sits at `anchor_status: "pending"` — a settled
// state, not work in flight.
//
// Consequences for the UI, all of them deliberate:
//   - the words "blockchain", "on-chain", "immutable" and "notarised" appear
//     nowhere in this feature;
//   - `pending` reads "Sealed — not yet published externally", never "Pending
//     anchoring…" with a spinner, because nothing is being awaited;
//   - the labels below branch on `anchoring.enabled` at runtime, so the day
//     anchoring is switched on the copy tells the truth with no redeploy.
//
// What the ledger actually offers is tamper-*evidence*: editing any row
// invalidates every hash after it. That is worth saying plainly and worth
// nothing if we inflate it.

import { licenseLabel, type LicenseLevel } from "./commons"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "/api"

function getAuthHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {}
  const token = localStorage.getItem("access_token")
  return token ? { Authorization: `Bearer ${token}` } : {}
}

// ── Errors ───────────────────────────────────────────────────────────────────

export class ClaimChainError extends Error {
  status: number
  detail: string | null

  constructor(status: number, detail: string | null) {
    super(detail || `ClaimChain request failed (${status})`)
    this.name = "ClaimChainError"
    this.status = status
    this.detail = detail
  }
}

async function readError(response: Response): Promise<ClaimChainError> {
  let detail: string | null = null
  try {
    const body = await response.json()
    detail = body?.detail ?? body?.error ?? body?.reason ?? null
  } catch {
    detail = null
  }
  return new ClaimChainError(response.status, detail)
}

// ── Types (mirror backend-code/docs/API_CONTRACTS.md — Session 13) ────────────

export type { LicenseLevel }

export type LicenseScope = "personal_listening"
export type LicenseSource = "purchase" | "gift" | "membership"
export type LicenseStatus = "active" | "revoked"

/** `pending` = root sealed, not published. `null` = not yet batched. */
export type AnchorStatus = "pending" | "anchored" | "failed"

export type ClaimEventType =
  | "CONTENT_REGISTERED"
  | "LICENSE_GRANTED"
  | "LICENSE_REVOKED"
  | "ENTITLEMENT_GRANTED"
  | "ENTITLEMENT_REVOKED"
  | "TAKEDOWN"
  | "ENFORCEMENT_ACTION"

/**
 * Present on every provenance and verification response. `note` is the
 * backend's own words about what is and is not published — render it verbatim.
 */
export interface Anchoring {
  enabled: boolean
  adapter: string
  note: string
}

export interface ContentFingerprint {
  id: number
  /** Opaque subject reference, e.g. "ritual:41". */
  subject_ref: string
  algo: string
  sha256: string
  byte_size: number
  storage_key: string
  /** The ritual's own creation date, not the day the fingerprint was taken. */
  first_seen_at: string
  created_at: string
}

export interface FingerprintPage {
  count: number
  next?: string | null
  previous?: string | null
  results: ContentFingerprint[]
}

export interface LicenseHolder {
  id: number
  email: string
}

/** All four default to false. Absence of a flag is never read as permission. */
export interface AiUse {
  train: boolean
  finetune: boolean
  dataset_reuse: boolean
  redistribute: boolean
}

export interface LicenseRecord {
  id: number
  listing: number | null
  listing_title: string | null
  ritual: number | null
  entitlement: number | null
  holder: LicenseHolder | null
  level: LicenseLevel
  scope: LicenseScope
  source: LicenseSource
  ai_use: AiUse
  terms_version: string
  terms_hash: string
  terms_snapshot: Record<string, unknown>
  claim_token: string
  /** The URL a creator sends to a platform or a lawyer. */
  verify_url: string
  status: LicenseStatus
  granted_at: string
  revoked_at: string | null
  // The contract prints `null` without showing the populated shape, so accept
  // an object, a bare id, or a string and let `revokerLabel` sort it out.
  revoked_by: LicenseHolder | number | string | null
  revoke_reason: string
}

export interface ClaimEvent {
  id: number
  event_type: ClaimEventType
  subject_ref: string
  /** Salted pseudonyms and hashes only — no personal or emotional data. */
  public_payload: Record<string, unknown>
  payload_hash: string
  prev_hash: string | null
  batch: number | null
  batch_index: number | null
  batch_root: string | null
  anchor_status: AnchorStatus | null
  created_at: string
}

export interface ContentProvenance {
  ritual_id: number
  ritual_title: string
  /** Newest first. More than one row is a genuine version history. */
  fingerprints: ContentFingerprint[]
  licenses: LicenseRecord[]
  events: ClaimEvent[]
  anchoring: Anchoring
}

export interface LicensePage {
  count: number
  next?: string | null
  previous?: string | null
  results: LicenseRecord[]
}

/** The public `/api/verify/{claim_token}/` payload. Identities never appear. */
export interface VerificationChainLink {
  event_type: ClaimEventType
  payload_hash: string
  prev_hash: string | null
  created_at: string
  batch_root: string | null
  anchor_status: AnchorStatus | null
}

export interface Verification {
  claim_token: string
  status: LicenseStatus
  revoked: boolean
  license: {
    level: LicenseLevel
    scope: LicenseScope
    source: LicenseSource
    ai_use: AiUse
    terms_version: string
    terms_hash: string
  }
  content: { ref: string; algo: string; sha256: string }
  /** One-way references. Resolvable by Evonaire, useless to anyone else. */
  parties: { creator_ref: string; holder_ref: string }
  granted_at: string
  revoked_at: string | null
  chain: VerificationChainLink[]
  anchoring: Anchoring
}

// ── Labels ───────────────────────────────────────────────────────────────────

export function licenseLevelLabel(level: LicenseLevel): string {
  return licenseLabel(level)
}

const SOURCE_LABELS: Record<LicenseSource, string> = {
  purchase: "Purchase",
  gift: "Gift",
  membership: "Membership",
}

export function sourceLabel(source: LicenseSource): string {
  return SOURCE_LABELS[source] ?? source
}

const SCOPE_LABELS: Record<string, string> = {
  personal_listening: "Personal listening",
}

export function scopeLabel(scope: string): string {
  return SCOPE_LABELS[scope] ?? scope.replace(/_/g, " ")
}

const EVENT_LABELS: Record<ClaimEventType, string> = {
  CONTENT_REGISTERED: "Content registered",
  LICENSE_GRANTED: "License granted",
  LICENSE_REVOKED: "License withdrawn",
  ENTITLEMENT_GRANTED: "Access granted",
  ENTITLEMENT_REVOKED: "Access withdrawn",
  TAKEDOWN: "Takedown recorded",
  ENFORCEMENT_ACTION: "Enforcement action",
}

export function eventLabel(type: ClaimEventType | string): string {
  return (
    EVENT_LABELS[type as ClaimEventType] ??
    // Unknown future event types read as a sentence rather than as SHOUTING.
    type.toLowerCase().replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase())
  )
}

/**
 * Human label for a batch's publication state, branching on `anchoring.enabled`
 * so this needs no edit on the day anchoring is turned on.
 *
 * A null status means the event has not been batched yet. Batches seal every
 * few minutes, so that one genuinely is a transient state — unlike `pending`,
 * which is where every batch sits today and will stay until anchoring ships.
 */
export function anchorStatusLabel(
  status: AnchorStatus | null | undefined,
  anchoring?: Anchoring | null,
): string {
  if (!status) return "Not yet sealed"
  switch (status) {
    case "pending":
      return anchoring?.enabled
        ? "Sealed — awaiting publication"
        : "Sealed — not yet published externally"
    case "anchored":
      return "Sealed and published externally"
    case "failed":
      return "Sealed — publication did not complete"
    default:
      return status
  }
}

/**
 * The four machine-use rights, in the order they are recorded.
 *
 * `deniedLabel` exists so a compact chip can state the denial in its own text.
 * All four are false today, and a chip reading "AI training" would be read as a
 * permission by anyone not hovering it.
 */
export const AI_USE_ROWS: Array<{ key: keyof AiUse; label: string; deniedLabel: string }> = [
  { key: "train", label: "AI training", deniedLabel: "No AI training" },
  { key: "finetune", label: "Fine-tuning", deniedLabel: "No fine-tuning" },
  { key: "dataset_reuse", label: "Dataset reuse", deniedLabel: "No dataset reuse" },
  { key: "redistribute", label: "Redistribution", deniedLabel: "No redistribution" },
]

/** "sha256" is a field value; "SHA-256" is how it is written for a reader. */
export function algoLabel(algo: string): string {
  return algo?.toLowerCase() === "sha256" ? "SHA-256" : (algo ?? "").toUpperCase()
}

export function revokerLabel(revokedBy: LicenseRecord["revoked_by"]): string | null {
  if (revokedBy === null || revokedBy === undefined) return null
  if (typeof revokedBy === "string") return revokedBy
  if (typeof revokedBy === "number") return `account #${revokedBy}`
  return revokedBy.email || `account #${revokedBy.id}`
}

// ── Formatting helpers ───────────────────────────────────────────────────────

/** First 12 characters, the length used everywhere a hash is shown compactly. */
export function shortHash(hash: string | null | undefined, length = 12): string {
  if (!hash) return "—"
  return hash.length <= length ? hash : hash.slice(0, length)
}

const BYTE_UNITS = ["bytes", "KB", "MB", "GB", "TB"]

export function humaniseBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || Number.isNaN(bytes)) return "—"
  if (bytes < 1024) return `${bytes} ${bytes === 1 ? "byte" : "bytes"}`
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < BYTE_UNITS.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value.toFixed(value >= 100 || unit === 0 ? 0 : 1)} ${BYTE_UNITS[unit]}`
}

/** Parses "ritual:41" → 41. Returns null for anything else. */
export function ritualIdFromSubjectRef(subjectRef: string): number | null {
  const match = /^ritual:(\d+)$/.exec(subjectRef)
  return match ? Number(match[1]) : null
}

// ── Client-side chain verification ───────────────────────────────────────────

export type ChainCheck =
  | { outcome: "empty" }
  | { outcome: "single"; events: number }
  | { outcome: "intact"; events: number; links: number }
  | {
      outcome: "broken"
      events: number
      /** The event whose `prev_hash` did not match its predecessor. */
      brokenEventId: number
      previousEventId: number
      expected: string
      found: string | null
    }

/**
 * Walk the events and confirm each one's `prev_hash` equals the previous
 * event's `payload_hash`. Ten lines, run in the creator's own browser, and
 * the whole point of publishing the hashes: it turns "trust us" into something
 * they can check for themselves.
 *
 * Events are sorted by `created_at` then `id` first. The chain is append-only
 * so creation order *is* chain order, and the contract does not state the
 * order `events[]` arrives in. Sorting normalises that without touching the
 * hash comparison, so a genuine break still surfaces.
 */
export function verifyEventChain(events: ClaimEvent[]): ChainCheck {
  if (!events || events.length === 0) return { outcome: "empty" }

  const ordered = [...events].sort((a, b) => {
    const byTime = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    return byTime !== 0 ? byTime : a.id - b.id
  })

  if (ordered.length === 1) return { outcome: "single", events: 1 }

  for (let i = 1; i < ordered.length; i++) {
    const previous = ordered[i - 1]
    const current = ordered[i]
    if (current.prev_hash !== previous.payload_hash) {
      return {
        outcome: "broken",
        events: ordered.length,
        brokenEventId: current.id,
        previousEventId: previous.id,
        expected: previous.payload_hash,
        found: current.prev_hash,
      }
    }
  }

  return { outcome: "intact", events: ordered.length, links: ordered.length - 1 }
}

/** Same walk, for the hash list on the public verification page. */
export function verifyVerificationChain(chain: VerificationChainLink[]): ChainCheck {
  return verifyEventChain(
    (chain || []).map((link, index) => ({
      id: index,
      event_type: link.event_type,
      subject_ref: "",
      public_payload: {},
      payload_hash: link.payload_hash,
      prev_hash: link.prev_hash,
      batch: null,
      batch_index: null,
      batch_root: link.batch_root,
      anchor_status: link.anchor_status,
      created_at: link.created_at,
    })),
  )
}

// ── Requests ─────────────────────────────────────────────────────────────────

/** The caller's fingerprinted content, newest first. */
export async function fetchMyContent(params?: {
  limit?: number
  offset?: number
}): Promise<FingerprintPage> {
  const query = new URLSearchParams()
  if (params?.limit) query.set("limit", String(params.limit))
  if (params?.offset) query.set("offset", String(params.offset))
  const suffix = query.toString() ? `?${query}` : ""

  const response = await fetch(`${API_BASE_URL}/claimchain/content/${suffix}`, {
    headers: getAuthHeaders(),
  })
  if (!response.ok) throw await readError(response)
  return response.json()
}

/**
 * Provenance, licenses and claim history for one ritual.
 *
 * A creator asking for someone else's ritual gets 404, identical to a ritual
 * that does not exist — provenance is deliberately not probeable by id, so
 * treat 404 as "not yours or not there" and say nothing more.
 */
export async function fetchContentProvenance(ritualId: number): Promise<ContentProvenance> {
  const response = await fetch(`${API_BASE_URL}/claimchain/content/${ritualId}/`, {
    headers: getAuthHeaders(),
  })
  if (!response.ok) throw await readError(response)
  return response.json()
}

export async function fetchLicenses(params?: {
  held?: boolean
  status?: LicenseStatus
  listing?: number
  ritual?: number
  limit?: number
}): Promise<LicensePage> {
  const query = new URLSearchParams()
  if (params?.held) query.set("held", "true")
  if (params?.status) query.set("status", params.status)
  if (params?.listing !== undefined) query.set("listing", String(params.listing))
  if (params?.ritual !== undefined) query.set("ritual", String(params.ritual))
  if (params?.limit) query.set("limit", String(params.limit))
  const suffix = query.toString() ? `?${query}` : ""

  const response = await fetch(`${API_BASE_URL}/claimchain/licenses/${suffix}`, {
    headers: getAuthHeaders(),
  })
  if (!response.ok) throw await readError(response)
  return response.json()
}

/** Licenses the caller holds as a buyer. */
export function fetchHeldLicenses(): Promise<LicensePage> {
  return fetchLicenses({ held: true, limit: 200 })
}

export const REVOKE_REASON_MIN_LENGTH = 20

/**
 * Withdraw a license. Creator of the content or a Steward only.
 *
 * Returns the updated record so the caller can patch one row in place instead
 * of refetching the page — the creator should see exactly what changed.
 */
export async function revokeLicense(licenseId: number, reason: string): Promise<LicenseRecord> {
  const response = await fetch(`${API_BASE_URL}/claimchain/licenses/${licenseId}/revoke/`, {
    method: "POST",
    headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ reason }),
  })
  if (!response.ok) throw await readError(response)
  return response.json()
}

/**
 * Re-read one license after a 400 that says it was already revoked.
 *
 * There is no `GET /api/claimchain/licenses/{id}/` in the contract, so this
 * filters the list by ritual and picks the row out. Still one narrow request,
 * still no page refetch.
 */
export async function refetchLicense(
  licenseId: number,
  ritualId: number,
): Promise<LicenseRecord | null> {
  const page = await fetchLicenses({ ritual: ritualId, limit: 200 })
  return page.results.find((license) => license.id === licenseId) ?? null
}

/**
 * Public verification. Unauthenticated by design: a verification page that
 * needs an account verifies nothing.
 *
 * Deliberately sends no auth header even when the visitor happens to be signed
 * in, so the response cannot vary by who is looking. Returns null on 404 —
 * "no license matches this link", with no distinction between never-existed
 * and removed.
 */
export async function fetchVerification(claimToken: string): Promise<Verification | null> {
  const response = await fetch(`${API_BASE_URL}/verify/${encodeURIComponent(claimToken)}/`, {
    cache: "no-store",
  })
  if (response.status === 404) return null
  if (!response.ok) throw await readError(response)
  return response.json()
}

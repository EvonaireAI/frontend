// Guardian Dashboard data layer (Session 11).
//
// The API is still spelled `moderation` / `moderator` / `case`; the display
// names are Guardian / Care Case / Care History. Keep the code-internal names
// here and the display names in the components.
//
// Everything the Guardian workspace reads comes from ONE filterable list
// endpoint plus the overview aggregate. The five workflow transitions
// (assign / delegate / release / resolve / archive) are dedicated endpoints —
// never PATCH `status` directly, or the timestamps and actor stamps go
// unwritten.

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "/api"

function authHeaders(): Record<string, string> {
  const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null
  return token ? { Authorization: `Bearer ${token}` } : {}
}

/** Carries the server's `detail` and machine-readable `code` so callers can
 *  toast the message verbatim and branch on the code. */
export class ModerationApiError extends Error {
  status: number
  code?: string

  constructor(message: string, status: number, code?: string) {
    super(message)
    this.name = "ModerationApiError"
    this.status = status
    this.code = code
  }
}

async function toError(response: Response, fallback: string): Promise<ModerationApiError> {
  let detail = fallback
  let code: string | undefined
  try {
    const body = await response.json()
    if (typeof body?.detail === "string") detail = body.detail
    if (typeof body?.code === "string") code = body.code
  } catch {
    // non-JSON body — keep the fallback
  }
  return new ModerationApiError(detail, response.status, code)
}

// ── Shape helper ────────────────────────────────────────────────────────────

export interface ListPage<T> {
  results: T[]
  /** Total across all pages when paginated; the array length when not. */
  count: number
  next: string | null
  previous: string | null
  /** True when the server returned the DRF envelope rather than a bare array. */
  paginated: boolean
}

/**
 * `GET /api/moderations/cases/` returns a **bare array** by default and only
 * switches to `{count, next, previous, results}` when `page`/`page_size` is
 * sent. Case History pages; the other tabs don't. Both shapes land here.
 */
export function unwrapList<T>(payload: unknown): ListPage<T> {
  if (Array.isArray(payload)) {
    return { results: payload as T[], count: payload.length, next: null, previous: null, paginated: false }
  }
  const envelope = payload as { count?: number; next?: string | null; previous?: string | null; results?: T[] }
  if (envelope && Array.isArray(envelope.results)) {
    return {
      results: envelope.results,
      count: typeof envelope.count === "number" ? envelope.count : envelope.results.length,
      next: envelope.next ?? null,
      previous: envelope.previous ?? null,
      paginated: true,
    }
  }
  return { results: [], count: 0, next: null, previous: null, paginated: false }
}

// ── Types ───────────────────────────────────────────────────────────────────

/** Derived server-side. Never re-compute it from `status` + `assigned_moderator`. */
export type CaseStage = "pending_review" | "active" | "resolved" | "archived"

/** `closed` is legacy (pre-Session-11) and is treated as resolved everywhere. */
export type CaseStatus = "open" | "assigned" | "resolved" | "closed" | "archived"

export type CaseSeverity = "low" | "medium" | "high"

export interface CaseHistoryEntry {
  at: string
  by: string
  event: string
  [key: string]: unknown
}

export interface ModerationCase {
  id: number
  ritual: number | null
  ritual_title?: string
  reporter?: number | null
  reporter_email?: string
  emotional_state?: number | null
  flagged_by_ai: boolean
  violation_type?: string
  flagged_reason?: string
  severity: CaseSeverity
  assigned_moderator?: number | null
  assigned_moderator_email?: string
  assigned_at?: string | null
  status: CaseStatus
  stage?: CaseStage
  crisis_escalated?: boolean
  resolution_note?: string
  resolved_at?: string | null
  resolved_by?: number | null
  resolved_by_email?: string
  archived_at?: string | null
  archived_by?: number | null
  archived_by_email?: string
  created_at: string
  updated_at: string
  history: CaseHistoryEntry[]
}

export interface CareFeedItem {
  id: number
  type: "blessing" | "feedback" | "case"
  ritual?: number | null
  ritual_title?: string
  user?: number | null
  giver_email?: string
  feedback_text?: string
  is_anonymous?: boolean
  emotional_state?: number | null
  flagged_by_ai?: boolean
  flagged_reason?: string
  severity?: CaseSeverity
  assigned_moderator?: number | null
  assigned_moderator_email?: string
  status?: string
  created_at?: string
  updated_at?: string
  history?: CaseHistoryEntry[]
}

export interface GuardianOverview {
  pending_review: number
  active: number
  active_mine: number
  resolved_this_week: number
  escalations_open: number
  escalations_total: number
  archived: number
  rituals_awaiting_review: number
  listings_awaiting_review: number
  /** Always carries all three keys. */
  live_by_severity: Record<CaseSeverity, number>
  /** Uses the key `"unspecified"` for null violation types. */
  live_by_violation_type: Record<string, number>
  as_of: string
}

export interface CaseFilters {
  stage?: CaseStage
  status?: string
  /** `me` · `unassigned` · `any` · a guardian user id */
  assigned?: string | number
  severity?: string
  violation_type?: string
  escalated?: boolean
  flagged_by_ai?: boolean
  /** `YYYY-MM-DD` or a full ISO-8601 timestamp */
  since?: string
  until?: string
  /** Substring over flagged_reason, resolution_note and the ritual title. */
  q?: string
  /** Sending either one opts the response into the paginated envelope. */
  page?: number
  page_size?: number
}

function buildQuery(filters: object): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters as Record<string, unknown>)) {
    if (value === undefined || value === null || value === "") continue
    params.set(key, String(value))
  }
  const query = params.toString()
  return query ? `?${query}` : ""
}

// ── Reads ───────────────────────────────────────────────────────────────────

export const moderationService = {
  async getOverview(): Promise<GuardianOverview> {
    const response = await fetch(`${API_BASE_URL}/moderations/overview/`, { headers: authHeaders() })
    if (!response.ok) throw await toError(response, "Failed to load the Guardian overview")
    return response.json()
  },

  /** One list serves Pending Reviews, Active Cases and Case History. */
  async listCases(filters: CaseFilters = {}): Promise<ListPage<ModerationCase>> {
    const response = await fetch(`${API_BASE_URL}/moderations/cases/${buildQuery(filters)}`, {
      headers: authHeaders(),
    })
    if (!response.ok) throw await toError(response, "Failed to load care cases")
    return unwrapList<ModerationCase>(await response.json())
  },

  async getCase(caseId: number): Promise<ModerationCase> {
    const response = await fetch(`${API_BASE_URL}/moderations/cases/${caseId}/`, { headers: authHeaders() })
    if (!response.ok) throw await toError(response, "Failed to load the care case")
    return response.json()
  },

  async getCareFeed(limit = 50): Promise<CareFeedItem[]> {
    const response = await fetch(`${API_BASE_URL}/moderations/care-feed/?limit=${limit}`, {
      headers: authHeaders(),
    })
    if (!response.ok) throw await toError(response, "Failed to load the Care Feed")
    const data = await response.json()
    return Array.isArray(data) ? data : unwrapList<CareFeedItem>(data).results
  },

  // ── Transitions ───────────────────────────────────────────────────────────

  /**
   * Empty body = the caller takes the case. `moderator_id` delegates
   * (`400 not_a_guardian` if the target isn't one). `release: true` returns it
   * to Pending Reviews.
   */
  async assignCase(
    caseId: number,
    body: { moderator_id?: number; release?: boolean; note?: string } = {},
  ): Promise<ModerationCase> {
    const response = await fetch(`${API_BASE_URL}/moderations/cases/${caseId}/assign/`, {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    if (!response.ok) throw await toError(response, "Failed to assign the case")
    return response.json()
  },

  /** `resolution_note` is required — it becomes the Care History record. */
  async resolveCase(caseId: number, resolutionNote: string): Promise<ModerationCase> {
    const response = await fetch(`${API_BASE_URL}/moderations/cases/${caseId}/resolve/`, {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ resolution_note: resolutionNote }),
    })
    if (!response.ok) throw await toError(response, "Failed to resolve the case")
    return response.json()
  },

  /** Terminal, and resolve-first: `400 not_resolved` on anything unresolved. */
  async archiveCase(caseId: number, note?: string): Promise<ModerationCase> {
    const response = await fetch(`${API_BASE_URL}/moderations/cases/${caseId}/archive/`, {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(note ? { note } : {}),
    })
    if (!response.ok) throw await toError(response, "Failed to archive the case")
    return response.json()
  },

  async escalateCase(
    caseId: number,
    notes: string,
  ): Promise<{ detail: string; case_id: number; severity: string; crisis_escalated: boolean; intervention_id: number }> {
    const response = await fetch(`${API_BASE_URL}/moderations/cases/${caseId}/escalate/`, {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ notes }),
    })
    if (!response.ok) throw await toError(response, "Failed to escalate the case")
    return response.json()
  },
}

// ── Display helpers ─────────────────────────────────────────────────────────

export const VIOLATION_TYPE_LABELS: Record<string, string> = {
  cultural_harm: "Cultural Harm",
  safety_risk: "Safety Risk",
  misinformation: "Misinformation",
  inappropriate_content: "Inappropriate Content",
  spam: "Spam",
  other: "Other",
  unspecified: "Unspecified",
}

export function violationLabel(type: string | null | undefined): string {
  if (!type) return "Unspecified"
  return VIOLATION_TYPE_LABELS[type] ?? type.replace(/_/g, " ")
}

export const SEVERITY_CHIPS: Record<CaseSeverity, { label: string; className: string }> = {
  high: { label: "High", className: "bg-red-100 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-300" },
  medium: {
    label: "Medium",
    className: "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-950/40 dark:text-yellow-300",
  },
  low: {
    label: "Low",
    className: "bg-green-100 text-green-800 border-green-200 dark:bg-green-950/40 dark:text-green-300",
  },
}

export const STAGE_LABELS: Record<CaseStage, string> = {
  pending_review: "Pending Review",
  active: "Active",
  resolved: "Resolved",
  archived: "Archived",
}

/** The stage as the server derived it. Falls back only for pre-Session-11
 *  payloads that predate the field — never as the primary source. */
export function caseStage(c: ModerationCase): CaseStage {
  if (c.stage) return c.stage
  if (c.status === "archived") return "archived"
  if (c.status === "resolved" || c.status === "closed") return "resolved"
  return c.assigned_moderator ? "active" : "pending_review"
}

/** Compact relative age, e.g. "3d" / "4h" / "12m". */
export function relativeAge(iso: string | null | undefined): string {
  if (!iso) return "—"
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return "—"
  const minutes = Math.max(0, Math.floor((Date.now() - then) / 60000))
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

/** Human label for a `history[].event` code. */
export const HISTORY_EVENT_LABELS: Record<string, string> = {
  case_assigned: "Case assigned",
  case_released: "Case released",
  case_resolved: "Case resolved",
  case_archived: "Case archived",
  case_update: "Case updated",
  crisis_escalation: "Care escalation",
  user_report: "Reported by a member",
  ritual_approve: "Ritual approved",
  ritual_reject: "Ritual rejected",
}

export function historyEventLabel(event: string): string {
  return HISTORY_EVENT_LABELS[event] ?? event.replace(/_/g, " ")
}

// Steward Console data layer (Session 11).
//
// Three steward-only aggregates: the Platform Overview (the CEO's five
// questions in one request), Trust & Care (oversight over the Guardian queues)
// and The Archive (one merged, read-only audit trail).
//
// All three are `IsAuthenticated, IsAdminUser` — which now honours
// `role="superadmin"` as well as `role="admin"`. Gate the UI with
// `isSteward()` from lib/roles, never with `role === "admin"`.

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "/api"

function authHeaders(): Record<string, string> {
  const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export class AdminApiError extends Error {
  status: number
  code?: string

  constructor(message: string, status: number, code?: string) {
    super(message)
    this.name = "AdminApiError"
    this.status = status
    this.code = code
  }
}

async function toError(response: Response, fallback: string): Promise<AdminApiError> {
  let detail = fallback
  let code: string | undefined
  try {
    const body = await response.json()
    if (typeof body?.detail === "string") detail = body.detail
    if (typeof body?.code === "string") code = body.code
  } catch {
    // non-JSON body — keep the fallback
  }
  return new AdminApiError(detail, response.status, code)
}

// ── Platform Overview ───────────────────────────────────────────────────────

export interface PlatformHealth {
  members_total: number
  members_active: number
  members_joined_7d: number
  creators_active: number
  guardians_active: number
  stewards_active: number
  sanctuaries_active: number
  rituals_approved: number
  listings_published: number
  care_cases_live: number
  escalations_open: number
  rts_interventions_open: number
}

export interface PendingReviewCounts {
  role_requests: number
  care_cases: number
  rituals: number
  commons_listings: number
  agora_content: number
  royalty_periods: number
  /**
   * Session 12. Only the *case-less* (warning-level) abuse flags — lock-level
   * flags open their own `ModerationCase` and are already counted in
   * `care_cases`, so nothing is double-counted.
   */
  content_protection_flags?: number
  /** The sum of the counters above — this is the console badge number. */
  total: number
}

/** Identical payload to `GET /api/payments/metrics/overview/` — don't fetch both. */
export interface MembershipsSummary {
  mrr_cents: number
  active_subscriptions: number
  arpu_cents: number
  by_plan?: Array<{ plan?: string; plan_name?: string; count: number; mrr_cents?: number }>
  [key: string]: unknown
}

export interface RoyaltiesSummary {
  /** While true, no money moves — say so rather than implying live payouts. */
  shadow_mode: boolean
  current_period_key: string | null
  /** `null` until the month's period row exists — render "not yet computed". */
  current_period: { period: string; status: string; [key: string]: unknown } | null
  latest_paid_period: { period: string; status: string; [key: string]: unknown } | null
  periods_awaiting_approval: number
  outstanding_creator_balance_cents: number
  minimum_payout_cents: number
}

export interface CommunitySummary {
  care_cases_opened_7d: number
  care_cases_resolved_7d: number
  member_reports_7d: number
  agora_care_flags_7d: number
  rts_care_flags_7d: number
  blessings_7d: number
}

export interface PlatformOverview {
  platform_health: PlatformHealth
  pending_reviews: PendingReviewCounts
  memberships: MembershipsSummary
  royalties: RoyaltiesSummary
  community: CommunitySummary
  as_of: string
}

// ── Trust & Care ────────────────────────────────────────────────────────────

export interface TrustCareCases {
  pending_review: number
  active: number
  resolved: number
  archived: number
  escalations_open: number
  escalations_total: number
  opened_in_window: number
  resolved_in_window: number
  live_by_severity: Record<string, number>
  live_by_violation_type: Record<string, number>
}

export interface GuardianWorkloadRow {
  guardian_id: number
  guardian_email: string
  active: number
  resolved_in_window: number
}

export interface TrustCare {
  window_days: number
  cases: TrustCareCases
  reports: {
    total: number
    in_window: number
    ai_flagged_total: number
    by_violation_type: Record<string, number>
  }
  agora_flags: {
    total: number
    in_window: number
    content_pending_review: number
    content_removed_by_moderation: number
    by_reason: Record<string, number>
  }
  rts_interventions: {
    open: number
    opened_in_window: number
    by_type: Record<string, number>
  }
  /**
   * Session 12. Behavioural request-pattern signals only — no emotional
   * inference and no profiling. Optional so the tab still renders against a
   * backend that predates the block.
   */
  content_protection?: {
    flags_open: number
    flags_in_window: number
    sessions_terminated_in_window: number
    playback_restrictions_active: number
    /** Keyed by `AbuseFlag.Action`. */
    by_action: Record<string, number>
  }
  guardian_workload: GuardianWorkloadRow[]
  /** `supported` is false until an appeal model ships — key off the flag. */
  appeals: { supported: boolean; count: number; detail: string }
  as_of: string
}

// ── The Archive ─────────────────────────────────────────────────────────────

/** Five sources since Session 12 added `security`. */
export type ArchiveType = "sanctuary" | "moderation" | "royalty" | "subscription" | "security"

export interface ArchiveEntry {
  /** `"<kind>:<pk>"` — a React key, never a fetchable id. */
  id: string
  type: ArchiveType
  action: string
  at: string
  /** `null` for royalty ledger rows (the engine writes them) and deleted actors. */
  actor: { id: number; email: string } | null
  subject: string
  /** Ready to display as-is. */
  summary: string
  /** Source-specific detail for the expanded row. */
  context: Record<string, unknown>
}

export interface ArchivePage {
  total: number
  limit: number
  offset: number
  has_more: boolean
  types: ArchiveType[]
  available_types: ArchiveType[]
  entries: ArchiveEntry[]
}

export interface ArchiveFilters {
  /** Comma-separated sources; defaults to all four. */
  type?: string
  action?: string
  since?: string
  until?: string
  actor_id?: number
  /** Default 50, max 200. Deep offsets get progressively more expensive. */
  limit?: number
  offset?: number
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

export const adminService = {
  async getPlatformOverview(): Promise<PlatformOverview> {
    const response = await fetch(`${API_BASE_URL}/admin/overview/`, { headers: authHeaders() })
    if (!response.ok) throw await toError(response, "Failed to load the platform overview")
    return response.json()
  },

  /** `days` sets the trailing window for every `*_in_window` figure (max 365). */
  async getTrustCare(days = 7): Promise<TrustCare> {
    const response = await fetch(`${API_BASE_URL}/admin/trust-care/?days=${days}`, { headers: authHeaders() })
    if (!response.ok) throw await toError(response, "Failed to load Trust & Care")
    return response.json()
  },

  async getArchive(filters: ArchiveFilters = {}): Promise<ArchivePage> {
    const response = await fetch(`${API_BASE_URL}/admin/archive/${buildQuery(filters)}`, { headers: authHeaders() })
    if (!response.ok) throw await toError(response, "Failed to load The Archive")
    return response.json()
  },
}

// ── Display helpers ─────────────────────────────────────────────────────────

export const ARCHIVE_TYPE_LABELS: Record<string, string> = {
  sanctuary: "Sanctuaries",
  moderation: "Care cases",
  royalty: "Royalties",
  subscription: "Memberships",
  security: "Content protection",
}

export function archiveTypeLabel(type: string): string {
  return ARCHIVE_TYPE_LABELS[type] ?? type.replace(/_/g, " ")
}

export const ARCHIVE_TYPE_CHIPS: Record<string, string> = {
  sanctuary: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300",
  moderation: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300",
  royalty: "bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300",
  subscription: "bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300",
  security: "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300",
}

/**
 * Actors are genuinely absent on rows no person wrote — the royalty engine, and
 * the Session 12 detector / sweep / webhook rows in the security trail. Never
 * print "null".
 */
export function actorLabel(actor: ArchiveEntry["actor"], type: string): string {
  if (actor?.email) return actor.email
  return type === "royalty" || type === "security" ? "System" : "—"
}

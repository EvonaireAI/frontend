// Steward Console data layer (Session 11).

import { caseStage, unwrapList, type ModerationCase } from "./moderation"

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

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

function emptyRoyaltiesSummary(): RoyaltiesSummary {
  return {
    shadow_mode: true,
    current_period_key: null,
    current_period: null,
    latest_paid_period: null,
    periods_awaiting_approval: 0,
    outstanding_creator_balance_cents: 0,
    minimum_payout_cents: 0,
  }
}

function emptyMembershipsSummary(): MembershipsSummary {
  return { mrr_cents: 0, active_subscriptions: 0, arpu_cents: 0, by_plan: [] }
}

/** When `/admin/overview/` is missing (older API), stitch counts from existing routes. */
async function buildPlatformOverviewFallback(): Promise<PlatformOverview> {
  const headers = authHeaders()
  const asOf = new Date().toISOString()
  const weekAgo = Date.now() - WEEK_MS

  const roleRequestsPromise = fetch(`${API_BASE_URL}/admin/role-requests/`, { headers }).then(async (res) => {
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data) ? data : []
  })

  const casesPromise = fetch(`${API_BASE_URL}/moderations/cases/`, { headers }).then(async (res) => {
    if (!res.ok) return [] as ModerationCase[]
    return unwrapList<ModerationCase>(await res.json()).results
  })

  const ritualsPromise = fetch(`${API_BASE_URL}/moderations/rituals/pending/`, { headers }).then(async (res) => {
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data) ? data : []
  })

  const listingsPromise = fetch(`${API_BASE_URL}/commons/review-queue/`, { headers }).then(async (res) => {
    if (!res.ok) return 0
    const data = (await res.json()) as { queue?: unknown[] }
    return Array.isArray(data.queue) ? data.queue.length : 0
  })

  const membershipsPromise = fetch(`${API_BASE_URL}/payments/metrics/overview/`, { headers }).then(async (res) => {
    if (!res.ok) return null
    return (await res.json()) as MembershipsSummary
  })

  const [roleRequests, cases, pendingRituals, commonsListings, membershipsPayload] = await Promise.all([
    roleRequestsPromise,
    casesPromise,
    ritualsPromise,
    listingsPromise,
    membershipsPromise,
  ])

  let care_cases = 0
  let escalations_open = 0
  let care_cases_opened_7d = 0
  let care_cases_resolved_7d = 0
  let member_reports_7d = 0

  for (const c of cases) {
    const stage = caseStage(c)
    if (stage === "pending_review" || stage === "active") care_cases++
    if (c.crisis_escalated && (stage === "pending_review" || stage === "active")) escalations_open++
    if (new Date(c.created_at).getTime() >= weekAgo) care_cases_opened_7d++
    if (stage === "resolved" && new Date(c.updated_at).getTime() >= weekAgo) care_cases_resolved_7d++
    if (c.reporter && new Date(c.created_at).getTime() >= weekAgo) member_reports_7d++
  }

  const role_requests = roleRequests.length
  const rituals = pendingRituals.length
  const agora_content = 0
  const royalty_periods = 0

  const pending_reviews: PendingReviewCounts = {
    role_requests,
    care_cases,
    rituals,
    commons_listings: commonsListings,
    agora_content,
    royalty_periods,
    total: role_requests + care_cases + rituals + commonsListings + agora_content + royalty_periods,
  }

  return {
    platform_health: {
      members_total: 0,
      members_active: 0,
      members_joined_7d: 0,
      creators_active: 0,
      guardians_active: 0,
      stewards_active: 0,
      sanctuaries_active: 0,
      rituals_approved: 0,
      listings_published: 0,
      care_cases_live: care_cases,
      escalations_open,
      rts_interventions_open: 0,
    },
    pending_reviews,
    memberships: membershipsPayload ?? emptyMembershipsSummary(),
    royalties: emptyRoyaltiesSummary(),
    community: {
      care_cases_opened_7d,
      care_cases_resolved_7d,
      member_reports_7d,
      agora_care_flags_7d: 0,
      rts_care_flags_7d: 0,
      blessings_7d: 0,
    },
    as_of: asOf,
  }
}

function aggregateTrustCareFromCases(cases: ModerationCase[], days: number): TrustCare {
  const windowStart = Date.now() - days * 24 * 60 * 60 * 1000
  const inWindow = (iso: string) => new Date(iso).getTime() >= windowStart

  let pending_review = 0
  let active = 0
  let resolved = 0
  let archived = 0
  let escalations_open = 0
  let escalations_total = 0
  let opened_in_window = 0
  let resolved_in_window = 0

  const live_by_severity: Record<string, number> = {}
  const live_by_violation_type: Record<string, number> = {}

  let reports_total = 0
  let reports_in_window = 0
  let ai_flagged_total = 0
  const reports_by_violation: Record<string, number> = {}

  const workload = new Map<
    number,
    { guardian_email: string; active: number; resolved_in_window: number }
  >()

  for (const c of cases) {
    const stage = caseStage(c)

    if (stage === "pending_review") pending_review++
    if (stage === "active") active++
    if (stage === "resolved") resolved++
    if (stage === "archived") archived++

    if (inWindow(c.created_at)) opened_in_window++
    if (stage === "resolved" && inWindow(c.updated_at)) resolved_in_window++

    if (c.crisis_escalated) {
      escalations_total++
      if (stage === "pending_review" || stage === "active") escalations_open++
    }

    if (stage === "pending_review" || stage === "active") {
      const sev = c.severity ?? "low"
      live_by_severity[sev] = (live_by_severity[sev] ?? 0) + 1
      const vt = c.violation_type || "unspecified"
      live_by_violation_type[vt] = (live_by_violation_type[vt] ?? 0) + 1
    }

    if (c.reporter) {
      reports_total++
      if (inWindow(c.created_at)) reports_in_window++
      const rvt = c.violation_type || "unspecified"
      reports_by_violation[rvt] = (reports_by_violation[rvt] ?? 0) + 1
    }
    if (c.flagged_by_ai) ai_flagged_total++

    if (c.assigned_moderator != null) {
      const guardian_id = c.assigned_moderator
      const existing = workload.get(guardian_id) ?? {
        guardian_email: c.assigned_moderator_email ?? `Guardian #${guardian_id}`,
        active: 0,
        resolved_in_window: 0,
      }
      if (stage === "active") existing.active++
      if (stage === "resolved" && inWindow(c.updated_at)) existing.resolved_in_window++
      workload.set(guardian_id, existing)
    }
  }

  return {
    window_days: days,
    cases: {
      pending_review,
      active,
      resolved,
      archived,
      escalations_open,
      escalations_total,
      opened_in_window,
      resolved_in_window,
      live_by_severity,
      live_by_violation_type,
    },
    reports: {
      total: reports_total,
      in_window: reports_in_window,
      ai_flagged_total,
      by_violation_type: reports_by_violation,
    },
    agora_flags: {
      total: 0,
      in_window: 0,
      content_pending_review: 0,
      content_removed_by_moderation: 0,
      by_reason: {},
    },
    rts_interventions: {
      open: 0,
      opened_in_window: 0,
      by_type: {},
    },
    guardian_workload: [...workload.entries()].map(([guardian_id, row]) => ({
      guardian_id,
      guardian_email: row.guardian_email,
      active: row.active,
      resolved_in_window: row.resolved_in_window,
    })),
    appeals: {
      supported: false,
      count: 0,
      detail: "Appeals will appear here once the appeals workflow ships.",
    },
    as_of: new Date().toISOString(),
  }
}

/** When `/admin/trust-care/` is missing (older API), derive Trust & Care from cases. */
async function buildTrustCareFallback(days: number): Promise<TrustCare> {
  const headers = authHeaders()
  const response = await fetch(`${API_BASE_URL}/moderations/cases/`, { headers })
  const cases = response.ok
    ? unwrapList<ModerationCase>(await response.json()).results
    : []
  return aggregateTrustCareFromCases(cases, days)
}

const ARCHIVE_AVAILABLE_TYPES: ArchiveType[] = [
  "sanctuary",
  "moderation",
  "royalty",
  "subscription",
  "security",
]

/** When `/admin/archive/` is missing (older API), return an empty page the tab can render. */
function buildArchiveEmptyPage(filters: ArchiveFilters): ArchivePage {
  const limit = filters.limit ?? 50
  const offset = filters.offset ?? 0
  return {
    total: 0,
    limit,
    offset,
    has_more: false,
    types: ARCHIVE_AVAILABLE_TYPES,
    available_types: ARCHIVE_AVAILABLE_TYPES,
    entries: [],
  }
}

export const adminService = {
  async getPlatformOverview(): Promise<PlatformOverview> {
    const response = await fetch(`${API_BASE_URL}/admin/overview/`, { headers: authHeaders() })
    if (response.ok) return response.json()
    if (response.status === 404) return buildPlatformOverviewFallback()
    throw await toError(response, "Failed to load the platform overview")
  },

  /** `days` sets the trailing window for every `*_in_window` figure (max 365). */
  async getTrustCare(days = 7): Promise<TrustCare> {
    const response = await fetch(`${API_BASE_URL}/admin/trust-care/?days=${days}`, { headers: authHeaders() })
    if (response.ok) return response.json()
    if (response.status === 404) return buildTrustCareFallback(days)
    throw await toError(response, "Failed to load Trust & Care")
  },

  async getArchive(filters: ArchiveFilters = {}): Promise<ArchivePage> {
    const response = await fetch(`${API_BASE_URL}/admin/archive/${buildQuery(filters)}`, { headers: authHeaders() })
    if (response.ok) return response.json()
    if (response.status === 404) return buildArchiveEmptyPage(filters)
    throw await toError(response, "Failed to load The Archive")
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

// Typed client for the /api/v1/ MVP contract (tech directive groups A-I)
// plus /admin-api/v1/ steward operations. Every function maps 1:1 to the
// contract; problem+json bodies surface as V1Error with the RFC 7807 code.

function getAuthHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {}
  const token = localStorage.getItem("access_token")
  return token ? { Authorization: `Bearer ${token}` } : {}
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "/api"
const V1 = `${API_BASE_URL}/v1`
const ADMIN_V1 = `${API_BASE_URL.replace(/\/api$/, "")}/admin-api/v1`

export class V1Error extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message)
    this.name = "V1Error"
  }
}

async function v1<T>(path: string, init?: RequestInit, admin = false): Promise<T> {
  const headers = { ...getAuthHeaders(), ...(init?.headers as Record<string, string>) }
  const res = await fetch(`${admin ? ADMIN_V1 : V1}${path}`, { ...init, headers })
  const body = res.status === 204 ? null : await res.json().catch(() => null)
  if (!res.ok) {
    const code = (body && (body.code || body.title)) || `HTTP_${res.status}`
    const detail = (body && (body.detail || body.message)) || res.statusText
    throw new V1Error(res.status, String(code), String(detail))
  }
  return body as T
}

const json = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
})

const patch = (body: unknown): RequestInit => ({
  method: "PATCH",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
})

// ── A. Gateway, Authentication, Holding Garden ───────────────────────────────

export interface GatewayApplication {
  id: number
  selected_role: string
  country: string
  age_band: string
  education_status: string
  education_score: number | null
  verification_status: string
  entry_score: number
  entry_status: string
  status: string
  submitted_at: string | null
  decided_at: string | null
}

export interface GatewayStatus {
  application: GatewayApplication | null
  quiz: { status: string; correct: number; total: number; completed_at: string | null } | null
}

export interface HoldingGardenStatus {
  entry_score: number
  entry_status: string
  role: string
  position_hint: { higher_scored_entries: number }
  platform: { moderation_load: string; open_regions: string[] }
}

export interface MePermissions {
  role: string
  plan: string
  gateway_approved: boolean
  scopes: string[]
}

export const v1Gateway = {
  apply: (body: Record<string, unknown>) =>
    v1<GatewayApplication>(`/gateway/applications/`, json(body)),
  status: () => v1<GatewayStatus>(`/gateway/status/`),
  completeEducation: () =>
    v1<{ education_status: string; education_score: number }>(`/gateway/education/complete/`, { method: "POST" }),
  submitVerification: () =>
    v1<{ verification_status: string; checkr_configured: boolean }>(`/gateway/verification/`, { method: "POST" }),
  holdingGarden: () => v1<HoldingGardenStatus>(`/holding-garden/status/`),
  appeal: (reason: string) =>
    v1<{ id: string; status: string }>(`/gateway/appeals/`, json({ reason })),
  permissions: () => v1<MePermissions>(`/me/permissions/`),
}

// ── B. Memberships ───────────────────────────────────────────────────────────

export interface MembershipLimits {
  max_sanctuaries: number | null
  max_care_level: number
  monthly_level1_play_quota: number | null
  agora: "browse" | "join" | "host"
  journal_history_days: number | null
  journal_export: boolean
  ai_insights: "none" | "monthly" | "full"
  timeline_history_days: number | null
  priority_support: boolean
}

export interface MembershipPlan {
  code: string
  display_name: string
  monthly_price_usd: string
  entitlements: string[]
  limits?: MembershipLimits
}

export interface MembershipSummary {
  plan: string
  display_name?: string
  entitlements: string[]
  limits?: MembershipLimits
}

export const v1Memberships = {
  plans: () => v1<{ plans: MembershipPlan[] }>(`/memberships/plans/`),
  checkout: (plan: string) => v1<{ checkout_url: string }>(`/memberships/checkout/`, json({ plan })),
  current: () => v1<Record<string, unknown>>(`/memberships/current/`),
  cancel: () => v1<Record<string, unknown>>(`/memberships/cancel/`, { method: "POST" }),
}

// ── C. Marketplace and creator offerings ─────────────────────────────────────

export interface Offering {
  id: number
  title: string
  summary: string
  modality?: string
  runtime_minutes?: number
  care_level?: string
  license_level: string
  price_amount: string
  price_currency: string
  regions: string[]
  availability_seats: number | null
  status: string
  creator?: number
}

export interface CheckoutResult {
  order_id: string
  status: string
  license_id?: string
  claim_token?: string
  checkout_url?: string
}

export const v1Marketplace = {
  offerings: (params = "") => v1<{ results: Offering[] }>(`/marketplace/offerings/${params}`),
  offering: (id: number) => v1<Offering>(`/marketplace/offerings/${id}/`),
  checkout: (body: Record<string, unknown>, idempotencyKey?: string) =>
    v1<CheckoutResult>(`/marketplace/checkout/`, {
      ...json(body),
      headers: {
        "Content-Type": "application/json",
        ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
      },
    }),
  usage: (licenseId: string, progressSec: number, completionRatio: number) =>
    v1<{ id: string }>(`/marketplace/usage/`, json({
      license_id: licenseId,
      progress_sec: progressSec,
      completion_ratio: completionRatio,
    })),
}

export const v1Creator = {
  createOffering: (body: Record<string, unknown>) =>
    v1<Offering>(`/creator/offerings/`, json(body)),
  updateOffering: (id: number, body: Record<string, unknown>) =>
    v1<Offering>(`/creator/offerings/${id}/`, patch(body)),
  submitOffering: (id: number) =>
    v1<Offering>(`/creator/offerings/${id}/submit/`, { method: "POST" }),
  analytics: () => v1<{ offerings: Record<string, unknown>[] }>(`/creator/analytics/`),
  revenue: () => v1<{ gross_payable: string }>(`/creator/revenue/`),
  earnings: () => v1<{ available_balance: string; lifetime: string }>(`/creators/earnings/`),
  payoutOnboarding: () => v1<{ onboarding_url: string }>(`/creators/payout-onboarding/`, { method: "POST" }),
  payouts: () => v1<{ results: Record<string, unknown>[] }>(`/creators/payouts/`),
  transactions: () => v1<{ results: Record<string, unknown>[] }>(`/creator/transactions/`),
}

// ── D. Rights, consents, ClaimChain ──────────────────────────────────────────

export interface V1License {
  id: string
  offering: number
  scope: string
  status: string
  claim_token: string
  expires_at: string | null
}

export interface AccessCheckResult {
  granted: boolean
  ttl_seconds: number
  grant_id?: string
}

export interface ClaimChainReceipt {
  id: string
  event_type: string
  subject_ref: string
  receipt_hash: string
  prev_hash: string
  anchor_status: string
  created_at: string
  chain_valid?: boolean
}

export const v1Rights = {
  registerLicense: (body: Record<string, unknown>) =>
    v1<V1License>(`/rights/licenses/`, json(body)),
  license: (id: string) => v1<V1License>(`/rights/licenses/${id}/`),
  grantConsent: (documentCode: string, documentVersion: string, licenseId?: string) =>
    v1<{ id: string }>(`/rights/consents/`, json({
      document_code: documentCode,
      document_version: documentVersion,
      ...(licenseId ? { license: licenseId } : {}),
    })),
  revokeConsent: (id: string) =>
    v1<{ revoked: boolean }>(`/rights/consents/${id}/revoke/`, { method: "POST" }),
  accessCheck: (claimToken: string, purpose = "playback") =>
    v1<AccessCheckResult>(`/rights/access-checks/`, json({ claim_token: claimToken, purpose })),
  receipts: () => v1<{ results: ClaimChainReceipt[] }>(`/claimchain/receipts/`),
  verify: (claimToken: string) =>
    v1<ClaimChainReceipt>(`/claimchain/receipts/${encodeURIComponent(claimToken)}/`),
}

// ── E. Payments, ledger, refunds ─────────────────────────────────────────────

export interface Purchase {
  id: string
  offering?: { title: string }
  amount: string
  currency: string
  status: string
  license_status: string
  created_at: string
}

export interface LedgerEvent {
  id: string
  event_type: string
  amount: string
  currency: string
  created_at: string
}

export const v1Finance = {
  refund: (orderId: string, reason = "") =>
    v1<{ status: string }>(`/payments/refund-requests/`, json({ order_id: orderId, reason })),
  purchases: () => v1<{ results: Purchase[] }>(`/me/purchases/`),
  entitlements: () => v1<{ membership: MembershipSummary; licenses: V1License[] }>(`/me/entitlements/`),
  ledger: () => v1<{ results: LedgerEvent[] }>(`/me/ledger/`),
  receipts: () => v1<{ results: ClaimChainReceipt[] }>(`/me/receipts/`),
}

// ── F. Horae scheduling and classes ──────────────────────────────────────────

export interface AvailabilitySlot {
  id: number
  creator: number
  starts_at: string
  ends_at: string
  capacity: number
  seats_remaining: number
  is_active: boolean
}

export interface Booking {
  id: string
  slot: number | null
  class_offering: number | null
  status: string
  cancelled_at: string | null
  created_at: string
}

export interface ClassOffering {
  id: number
  title: string
  starts_at: string
  ends_at: string
  capacity: number
  seats_remaining: number
  price_amount: string
  status: string
}

export const v1Horae = {
  availability: (creatorId?: number) =>
    v1<{ results: AvailabilitySlot[] }>(`/horae/availability/${creatorId ? `?creator_id=${creatorId}` : ""}`),
  publishSlot: (body: Record<string, unknown>) =>
    v1<AvailabilitySlot>(`/horae/availability/`, json(body)),
  bookings: () => v1<{ results: Booking[] }>(`/bookings/`),
  book: (slotId: number, paymentRef?: string) =>
    v1<Booking>(`/bookings/`, json({ slot_id: slotId, payment_ref: paymentRef || "" })),
  cancel: (bookingId: string) =>
    v1<{ status: string }>(`/bookings/${bookingId}/cancel/`, { method: "POST" }),
  reschedule: (bookingId: string, newSlotId: number) =>
    v1<Booking>(`/bookings/${bookingId}/reschedule/`, json({ new_slot_id: newSlotId })),
  classes: () => v1<{ results: ClassOffering[] }>(`/classes/`),
  bookClass: (classId: number, paymentRef?: string) =>
    v1<Booking>(`/classes/${classId}/book/`, json({ payment_ref: paymentRef || "" })),
}

// ── G. Guardian, safety, support ─────────────────────────────────────────────

export interface GuardianCase {
  id: number
  violation_type: string
  severity: string
  status: string
  flagged_reason: string
  created_at: string
}

export interface GuardianAssignment {
  id: number
  case: GuardianCase
  status: string
  created_at: string
}

export const v1Ops = {
  safetyReport: (body: { violation_type: string; severity: string; reason: string; ritual_id?: number }) =>
    v1<{ case_id: number; status: string }>(`/safety/reports/`, json(body)),
  supportRequest: (body: { category: string; subject: string; body: string }) =>
    v1<{ id: number }>(`/support/requests/`, json(body)),
  myCases: () => v1<{ results: GuardianCase[] }>(`/guardian/cases/`),
  availableWork: () =>
    v1<{ pending_assignments: GuardianAssignment[]; open_cases: GuardianCase[] }>(`/guardian/available-work/`),
  acceptAssignment: (id: number) =>
    v1<GuardianAssignment>(`/guardian/assignments/${id}/accept/`, { method: "POST" }),
  logTime: (body: { minutes: number; worked_on: string; assignment?: number; note?: string }) =>
    v1<{ id: number }>(`/guardian/time-entries/`, json(body)),
}

// ── admin-api/v1: steward operations ─────────────────────────────────────────

export interface OpsSummary {
  users: Record<string, number>
  gateway: Record<string, number>
  moderation: Record<string, number>
  marketplace: Record<string, number>
  memberships: Record<string, number>
}

export interface AuditEvent {
  id: number
  actor: number | null
  actor_role: string
  action: string
  resource_type: string
  resource_id: string
  result: string
  detail: Record<string, unknown>
  created_at: string
}

export const v1Admin = {
  opsSummary: () => v1<OpsSummary>(`/operations/summary/`, undefined, true),
  gatewayApplications: (entryStatus?: string) =>
    v1<{ results: GatewayApplication[] }>(
      `/gateway/applications/${entryStatus ? `?entry_status=${entryStatus}` : ""}`, undefined, true),
  decideApplication: (applicationId: number, decision: string, reason: string) =>
    v1<{ id: number; status: string }>(
      `/gateway/applications/`, json({ application_id: applicationId, decision, reason }), true),
  assignCase: (caseId: number, guardianId: number) =>
    v1<GuardianAssignment>(`/cases/${caseId}/assign/`, json({ guardian_id: guardianId }), true),
  auditEvents: (action?: string) =>
    v1<{ results: AuditEvent[] }>(`/audit/events/${action ? `?action=${action}` : ""}`, undefined, true),
  reconciliation: () => v1<Record<string, unknown>>(`/finance/reconciliation/`, undefined, true),
}

// ── H. GAIA (Zero Dependence: consent-first, deterministic) ──────────────────

export interface GaiaQuestion {
  id: string
  topic: string
  title: string
  source_id: string
  route: string
}

export interface GaiaCapabilities {
  name: string
  approved: string[]
  prohibited: string[]
  questions?: GaiaQuestion[]
  catalog_version?: string
}

export interface GaiaGuidanceAnswer {
  mode: string
  question_id: string
  topic: string
  answer: string
  source_route: string
  no_personal_inference: boolean
}

export interface GaiaRoute {
  id: string
  label: string
  route: string
}

export interface ZeroDependenceStatus {
  mode: "no-ai" | "ai-optional"
  gaia_lite_permission_active: boolean
  vendor_ai_permission_active: boolean
  essential_features_require_ai: boolean
  routes: GaiaRoute[]
  revoked_active_permissions?: number
}

export const v1Gaia = {
  capabilities: () => v1<GaiaCapabilities>(`/gaia/capabilities/`),
  educate: (topic: string) => v1<Record<string, unknown>>(`/gaia/education/`, json({ topic })),
  navigate: (query: string) => v1<Record<string, unknown>>(`/gaia/navigation/`, json({ query })),
  consentStatus: () => v1<{ ai_guidance_consent: boolean }>(`/gaia/consent-status/`),
  guidance: (questionId: string) =>
    v1<GaiaGuidanceAnswer>(`/gaia/guidance/`, json({ question_id: questionId })),
  zeroDependence: () => v1<ZeroDependenceStatus>(`/gaia/zero-dependence/`),
  disableAllAi: () => v1<ZeroDependenceStatus>(`/gaia/zero-dependence/`, json({})),
}

export interface PurposeConsent {
  purpose: string
  document_code: string
  active: boolean
  consent_id: string | null
}

export const v1Consents = {
  list: () => v1<{ consents: PurposeConsent[] }>(`/consents/`),
  set: (purpose: string, action: "grant" | "revoke") =>
    v1<PurposeConsent>(`/consents/`, json({ purpose, action })),
}

export const v1Privacy = {
  export: () => v1<Record<string, unknown>>(`/privacy/export/`),
  erase: (password: string) => v1<{ detail: string }>(`/privacy/delete/`, json({ password })),
}

// ── I. Reflection Room ───────────────────────────────────────────────────────

export interface Reflection {
  id: string
  prompt: string
  text: string
  shared_with_creator: boolean
  created_at: string
}

export const v1Reflections = {
  create: (body: { text: string; prompt?: string; save?: boolean; session_ref?: string }) =>
    v1<Reflection | { ephemeral: boolean }>(`/reflections/`, json(body)),
  list: () => v1<{ results: Reflection[] }>(`/reflections/`),
  remove: (id: string) => v1<null>(`/reflections/${id}/`, { method: "DELETE" }),
  export: () => v1<{ count: number; reflections: Reflection[] }>(`/reflections/export/`, { method: "POST" }),
  share: (id: string, consent: boolean) =>
    v1<{ shared: boolean }>(`/reflections/${id}/share/`, json({ consent })),
}

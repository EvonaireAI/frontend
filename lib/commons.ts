// The Commons — marketplace where creators sell one-off offerings (classes,
// care sessions, bundles, premium rituals) at license levels L1_open /
// L2_guided, paid via Stripe Checkout destination charges. All money fields
// are integer cents. Browse endpoints work logged-out; everything else needs
// a Bearer access token.

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "/api"

function getAuthHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {}
  const token = localStorage.getItem("access_token")
  return token ? { Authorization: `Bearer ${token}` } : {}
}

// ── Types (mirror docs/API_CONTRACTS.md — Session 07) ──────────────────────────

export type LicenseLevel = "L1_open" | "L2_guided"

export type ListingStatus =
  | "draft"
  | "pending_review"
  | "published"
  | "paused"
  | "rejected"

export type PurchaseSource = "purchase" | "gift" | "membership"
export type PurchaseStatus = "active" | "revoked" | "expired"

export interface CommonsCreator {
  id: number
  display_name: string
}

export interface CommonsRitual {
  id: number
  title: string
  care_level: string
}

export interface EarlyAccess {
  until: string
  active: boolean
}

// Public browse / detail shape.
export interface Listing {
  id: number
  creator: CommonsCreator
  title: string
  summary: string
  ritual: CommonsRitual | null
  license_level: LicenseLevel
  price_cents: number
  currency: string
  status: ListingStatus
  early_access: EarlyAccess | null
  has_access: boolean
  published_at: string | null
  created_at: string
}

// Creator-facing shape adds pipeline metadata.
export interface MyListing extends Listing {
  review_note: string | null
  reviewed_at: string | null
  early_access_until: string | null
  updated_at: string
}

export interface CommonsOrder {
  id: number
  amount_cents: number
  currency: string
  status: string
  paid_at: string | null
  created_at: string
}

export interface Purchase {
  id: number
  listing: Listing
  source: PurchaseSource
  status: PurchaseStatus
  expires_at: string | null
  order: CommonsOrder | null
  created_at: string
}

export interface Gift {
  id: number
  listing_id: number
  user_id: number
  source: "gift"
  status: PurchaseStatus
  expires_at: string
}

export interface ListingsPage {
  listings: Listing[]
  next_before: number | null
  has_more: boolean
  is_scholar: boolean
}

export type CheckoutResult =
  | { free: false; order_id: number; session_id: string; session_url: string }
  | { free: true; order_id: number; entitlement_id: number }

// ── Errors ─────────────────────────────────────────────────────────────────────

// Structured tier denial with reason `early_access` — the caller isn't a
// Scholar yet and the listing is still inside its early-access window.
export interface EarlyAccessDenial {
  error: "entitlement_denied"
  reason: "early_access"
  current_plan: string
  required_plan: string
}

export class CommonsApiError extends Error {
  status: number
  code?: string
  // Present when status === 403 and the body is an early-access denial.
  earlyAccess?: EarlyAccessDenial

  constructor(status: number, detail: string, opts?: { code?: string; earlyAccess?: EarlyAccessDenial }) {
    super(detail)
    this.name = "CommonsApiError"
    this.status = status
    this.code = opts?.code
    this.earlyAccess = opts?.earlyAccess
  }

  get isEarlyAccess(): boolean {
    return this.status === 403 && this.earlyAccess?.reason === "early_access"
  }
}

function isEarlyAccessDenial(body: unknown): body is EarlyAccessDenial {
  return (
    typeof body === "object" &&
    body !== null &&
    (body as { error?: string }).error === "entitlement_denied" &&
    (body as { reason?: string }).reason === "early_access"
  )
}

async function toCommonsError(res: Response, fallback: string): Promise<CommonsApiError> {
  // Mutations are throttled 10/min — surface a gentle nudge on 429.
  if (res.status === 429) {
    return new CommonsApiError(429, "One moment — try again shortly.")
  }
  let body: any = null
  try {
    body = await res.json()
  } catch {
    // non-JSON body — keep the fallback
  }
  if (res.status === 403 && isEarlyAccessDenial(body)) {
    return new CommonsApiError(403, "Early access for Scholars", { earlyAccess: body })
  }
  const detail =
    (body && typeof body.detail === "string" && body.detail) ||
    // Field errors like { price_cents: [...] } / { note: [...] } — flatten the first.
    firstFieldError(body) ||
    fallback
  const code = body && typeof body.code === "string" ? body.code : undefined
  return new CommonsApiError(res.status, detail, { code })
}

function firstFieldError(body: any): string | undefined {
  if (!body || typeof body !== "object") return undefined
  for (const key of Object.keys(body)) {
    const v = body[key]
    if (Array.isArray(v) && typeof v[0] === "string") return v[0]
    if (typeof v === "string" && key !== "code") return v
  }
  return undefined
}

// ── Display helpers ──────────────────────────────────────────────────────────

// price_cents=1900 → "$19.00"; price_cents=0 → "Free" (never "$0.00").
export function formatPrice(cents: number, currency = "usd"): string {
  if (cents === 0) return "Free"
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

// Neutral informational chips — never tier-lock badges.
export function licenseLabel(level: LicenseLevel): string {
  return level === "L2_guided" ? "L2 · Guided" : "L1 · Open"
}

// ── Browse (public) ──────────────────────────────────────────────────────────

export interface ListingFilters {
  license_level?: LicenseLevel
  creator?: number
  min_price?: number
  max_price?: number
  before?: number
  limit?: number
}

export async function fetchListings(filters: ListingFilters = {}): Promise<ListingsPage> {
  const params = new URLSearchParams()
  if (filters.license_level) params.set("license_level", filters.license_level)
  if (filters.creator !== undefined) params.set("creator", String(filters.creator))
  if (filters.min_price !== undefined) params.set("min_price", String(filters.min_price))
  if (filters.max_price !== undefined) params.set("max_price", String(filters.max_price))
  if (filters.before !== undefined) params.set("before", String(filters.before))
  if (filters.limit !== undefined) params.set("limit", String(filters.limit))

  const qs = params.toString()
  const res = await fetch(`${API_BASE_URL}/commons/listings/${qs ? `?${qs}` : ""}`, {
    // Send auth when available so has_access / early-access visibility reflect
    // the caller; the endpoint also works logged-out.
    headers: getAuthHeaders(),
  })
  if (!res.ok) throw await toCommonsError(res, "Failed to load the Commons")
  return res.json()
}

export async function fetchListing(id: number): Promise<Listing> {
  const res = await fetch(`${API_BASE_URL}/commons/listings/${id}/`, {
    headers: getAuthHeaders(),
  })
  if (!res.ok) throw await toCommonsError(res, "Failed to load this listing")
  return res.json()
}

// ── Checkout ─────────────────────────────────────────────────────────────────

export async function checkoutListing(
  id: number,
  urls: { success_url: string; cancel_url: string },
): Promise<CheckoutResult> {
  const res = await fetch(`${API_BASE_URL}/commons/listings/${id}/checkout/`, {
    method: "POST",
    headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(urls),
  })
  if (!res.ok) throw await toCommonsError(res, "Checkout is temporarily unavailable")
  return res.json()
}

// ── My purchases ─────────────────────────────────────────────────────────────

export async function fetchPurchases(): Promise<Purchase[]> {
  const res = await fetch(`${API_BASE_URL}/commons/purchases/`, {
    headers: getAuthHeaders(),
  })
  if (!res.ok) throw await toCommonsError(res, "Failed to load your library")
  const data = await res.json()
  return data.purchases ?? []
}

// ── Creator listing manager ──────────────────────────────────────────────────

export async function fetchMyListings(): Promise<MyListing[]> {
  const res = await fetch(`${API_BASE_URL}/commons/my-listings/`, {
    headers: getAuthHeaders(),
  })
  if (!res.ok) throw await toCommonsError(res, "Failed to load your listings")
  const data = await res.json()
  return data.listings ?? []
}

export interface ListingDraftInput {
  title: string
  summary: string
  ritual_id?: number | null
  license_level: LicenseLevel
  price_cents: number
  early_access_until?: string | null
}

export async function createListing(input: ListingDraftInput): Promise<MyListing> {
  const res = await fetch(`${API_BASE_URL}/commons/my-listings/`, {
    method: "POST",
    headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw await toCommonsError(res, "Failed to create the listing")
  return res.json()
}

export async function updateListing(
  id: number,
  patch: Partial<ListingDraftInput>,
): Promise<MyListing> {
  const res = await fetch(`${API_BASE_URL}/commons/my-listings/${id}/`, {
    method: "PATCH",
    headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  })
  if (!res.ok) throw await toCommonsError(res, "Failed to update the listing")
  return res.json()
}

export async function submitForReview(id: number): Promise<MyListing> {
  const res = await fetch(`${API_BASE_URL}/commons/my-listings/${id}/submit-for-review/`, {
    method: "POST",
    headers: getAuthHeaders(),
  })
  if (!res.ok) throw await toCommonsError(res, "Failed to submit for review")
  return res.json()
}

export async function pauseListing(id: number): Promise<MyListing> {
  const res = await fetch(`${API_BASE_URL}/commons/my-listings/${id}/pause/`, {
    method: "POST",
    headers: getAuthHeaders(),
  })
  if (!res.ok) throw await toCommonsError(res, "Failed to pause the listing")
  return res.json()
}

export async function resumeListing(id: number): Promise<MyListing> {
  const res = await fetch(`${API_BASE_URL}/commons/my-listings/${id}/resume/`, {
    method: "POST",
    headers: getAuthHeaders(),
  })
  if (!res.ok) throw await toCommonsError(res, "Failed to resume the listing")
  return res.json()
}

// Exactly one of email / user_id.
export interface GiftInput {
  email?: string
  user_id?: number
  expires_at: string
}

export async function giftListing(id: number, input: GiftInput): Promise<Gift> {
  const res = await fetch(`${API_BASE_URL}/commons/listings/${id}/gift/`, {
    method: "POST",
    headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw await toCommonsError(res, "Failed to send the gift")
  return res.json()
}

// ── Moderator review queue ───────────────────────────────────────────────────

export async function fetchReviewQueue(): Promise<MyListing[]> {
  const res = await fetch(`${API_BASE_URL}/commons/review-queue/`, {
    headers: getAuthHeaders(),
  })
  if (!res.ok) throw await toCommonsError(res, "Failed to load the review queue")
  const data = await res.json()
  return data.queue ?? []
}

export type ReviewDecision =
  | { decision: "approve" }
  | { decision: "reject"; note: string }

export async function submitReviewDecision(id: number, body: ReviewDecision): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/commons/review-queue/${id}/decision/`, {
    method: "POST",
    headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw await toCommonsError(res, "Failed to submit the decision")
  return res.json()
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "/api"

export interface ConnectStatus {
  has_account: boolean
  onboarding_required: boolean
  stripe_account_id?: string
  details_submitted?: boolean
  charges_enabled?: boolean
  payouts_enabled?: boolean
  is_payout_ready?: boolean
  // Single source of truth for "you're all set" — includes a server-side
  // background-check gate on top of is_payout_ready. Never recompute
  // readiness client-side from the other booleans.
  payouts_allowed?: boolean
  disabled_reason?: string | null
  country?: string | null
  requirements_currently_due?: string[]
  // false → Stripe was unreachable and this is the last-synced snapshot
  live?: boolean
  updated_at?: string
}

export class PayoutsApiError extends Error {
  status: number
  code?: string

  constructor(status: number, detail: string, code?: string) {
    super(detail)
    this.name = "PayoutsApiError"
    this.status = status
    this.code = code
  }
}

function getAuthHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {}
  const token = localStorage.getItem("access_token")
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function toPayoutsError(res: Response, fallback: string): Promise<PayoutsApiError> {
  let detail = fallback
  let code: string | undefined
  try {
    const body = await res.json()
    if (typeof body.detail === "string") detail = body.detail
    if (typeof body.error === "string") code = body.error
  } catch {
    // non-JSON error body — keep the fallback message
  }
  return new PayoutsApiError(res.status, detail, code)
}

export async function fetchConnectStatus(): Promise<ConnectStatus> {
  const res = await fetch(`${API_BASE_URL}/payments/connect/status/`, {
    headers: getAuthHeaders(),
  })
  if (!res.ok) throw await toPayoutsError(res, "Failed to check payout status")
  return res.json()
}

// Onboarding links are single-use and short-lived — call at click-time,
// never prefetch or cache. Safe to call repeatedly; the same Stripe
// account is reused, only the link is fresh.
export async function createOnboardingLink(): Promise<{ onboarding_url: string }> {
  const res = await fetch(`${API_BASE_URL}/payments/connect/onboarding/`, {
    method: "POST",
    headers: getAuthHeaders(),
  })
  if (!res.ok) throw await toPayoutsError(res, "Failed to start Stripe onboarding")
  return res.json()
}

// Single-use login link to the creator's Stripe Express dashboard —
// same fetch-at-click-time rule as the onboarding link.
export async function createDashboardLink(): Promise<{ dashboard_url: string }> {
  const res = await fetch(`${API_BASE_URL}/payments/connect/dashboard-link/`, {
    method: "POST",
    headers: getAuthHeaders(),
  })
  if (!res.ok) throw await toPayoutsError(res, "Failed to open the Stripe dashboard")
  return res.json()
}

// Human-friendly labels for Stripe requirement field paths
export function requirementLabel(path: string): string {
  if (path === "external_account") return "Bank account"
  if (path.includes("verification.document")) return "Identity document"
  if (path === "tos_acceptance" || path.startsWith("tos_acceptance.")) {
    return "Stripe terms of service"
  }
  const last = path.split(".").pop() || path
  const words = last.replace(/_/g, " ")
  return words.charAt(0).toUpperCase() + words.slice(1)
}

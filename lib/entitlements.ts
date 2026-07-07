const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "/api"

function getAuthHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {}
  const token = localStorage.getItem("access_token")
  return token ? { Authorization: `Bearer ${token}` } : {}
}

// ── Types (mirror GET /api/payments/entitlements/) ─────────────────────────────

export interface Entitlements {
  display_name: string
  max_care_level: number
  monthly_level1_play_quota: number | null
  max_sanctuaries: number | null
  agora: "browse" | "join" | "host"
  journal_history_days: number | null
  journal_export: boolean
  ai_insights: "none" | "monthly" | "full"
  timeline_history_days: number | null
  priority_support: boolean
}

export interface EntitlementUsage {
  level1_plays_used: number
  level1_plays_limit: number | null
  sanctuaries_used: number
  sanctuaries_limit: number | null
  quota_resets_at: string | null
}

export interface EntitlementsResponse {
  plan: string
  display_name: string
  entitlements: Entitlements
  usage: EntitlementUsage
  subscription: {
    status: string
    current_period_end: string | null
    cancel_at_period_end: boolean
  }
}

// ── Structured entitlement denial (403) ────────────────────────────────────────

export type EntitlementDenialReason = "quota_exceeded" | "care_level" | "sanctuary_limit" | "agora_tier"

export interface EntitlementDenial {
  error: "entitlement_denied"
  reason: EntitlementDenialReason
  current_plan: string
  required_plan: string
  quota?: { used: number; limit: number; resets_at: string }
}

export class EntitlementDeniedError extends Error {
  denial: EntitlementDenial

  constructor(denial: EntitlementDenial) {
    super("entitlement_denied")
    this.name = "EntitlementDeniedError"
    this.denial = denial
  }
}

export function isEntitlementDenial(body: unknown): body is EntitlementDenial {
  return (
    typeof body === "object" &&
    body !== null &&
    (body as { error?: string }).error === "entitlement_denied"
  )
}

// Call on any non-ok response from a tier-enforced endpoint. If the body is a
// structured entitlement denial, broadcasts it (opening the global upgrade
// modal) and throws EntitlementDeniedError; otherwise returns the parsed body
// (or null) so the caller can raise its usual error.
export async function throwIfEntitlementDenied(response: Response): Promise<any> {
  let body: unknown = null
  try {
    body = await response.json()
  } catch {
    return null
  }
  if (response.status === 403 && isEntitlementDenial(body)) {
    emitEntitlementDenial(body)
    throw new EntitlementDeniedError(body)
  }
  return body
}

// ── Denial event bus ────────────────────────────────────────────────────────────
// Lets the plain-fetch service layer open the React upgrade modal and lets the
// entitlements context refetch after any entitlement 403.

type DenialListener = (denial: EntitlementDenial) => void

const denialListeners = new Set<DenialListener>()

export function onEntitlementDenial(listener: DenialListener): () => void {
  denialListeners.add(listener)
  return () => denialListeners.delete(listener)
}

export function emitEntitlementDenial(denial: EntitlementDenial): void {
  denialListeners.forEach((listener) => listener(denial))
}

// Opens the upgrade modal directly (e.g. clicking a locked ritual card),
// without a real 403 having occurred.
export function openUpgradeModal(params: {
  reason: EntitlementDenialReason
  current_plan: string
  required_plan: string
  quota?: { used: number; limit: number; resets_at: string }
}): void {
  emitEntitlementDenial({ error: "entitlement_denied", ...params })
}

// ── API ─────────────────────────────────────────────────────────────────────────

export async function fetchEntitlements(): Promise<EntitlementsResponse> {
  const response = await fetch(`${API_BASE_URL}/payments/entitlements/`, {
    headers: getAuthHeaders(),
  })
  if (!response.ok) {
    throw new Error("Failed to fetch entitlements")
  }
  return response.json()
}

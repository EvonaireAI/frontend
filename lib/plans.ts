// Single source of truth for plan keys → marketing names and per-plan
// entitlement values. UI always shows marketing names; code always
// sends/compares internal plan keys.

export type PlanKey = "free" | "evocore" | "evobloom" | "evoluxe"

export const PLAN_MARKETING_NAMES: Record<PlanKey, string> = {
  free: "Wanderer",
  evocore: "Seeker",
  evobloom: "Scholar",
  evoluxe: "Evoluxe", // unlaunched — never shown on the pricing page
}

export const PLAN_PRICES: Record<PlanKey, number> = {
  free: 0,
  evocore: 11,
  evobloom: 22,
  evoluxe: 33,
}

export function planDisplayName(plan?: string | null): string {
  if (!plan) return PLAN_MARKETING_NAMES.free
  return PLAN_MARKETING_NAMES[plan as PlanKey] ?? plan
}

// Plans shown on the pricing page, in column order (evoluxe is unlaunched
// and must never appear there).
export type PricingPlanKey = Exclude<PlanKey, "evoluxe">
export const PRICING_PLANS: PricingPlanKey[] = ["free", "evocore", "evobloom"]

// Next tier to suggest when a user hits a limit on their current plan.
export function nextPlanUp(plan?: string | null): PlanKey {
  if (plan === "evocore") return "evobloom"
  return "evocore"
}

// Static per-plan entitlement values, mirroring the backend's entitlements
// table. Used where the API can't drive the UI (comparing plans the user
// doesn't have, e.g. the pricing matrix and the upgrade modal comparison).
// `null` limits mean unlimited.
export interface PlanEntitlements {
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

export const PLAN_ENTITLEMENTS: Record<PricingPlanKey, PlanEntitlements> = {
  free: {
    max_care_level: 1,
    monthly_level1_play_quota: 5,
    max_sanctuaries: 1,
    agora: "browse",
    journal_history_days: 7,
    journal_export: false,
    ai_insights: "none",
    timeline_history_days: 7,
    priority_support: false,
  },
  evocore: {
    max_care_level: 2,
    monthly_level1_play_quota: null,
    max_sanctuaries: 3,
    agora: "join",
    journal_history_days: null,
    journal_export: false,
    ai_insights: "monthly",
    timeline_history_days: null,
    priority_support: false,
  },
  evobloom: {
    max_care_level: 3,
    monthly_level1_play_quota: null,
    max_sanctuaries: null,
    agora: "host",
    journal_history_days: null,
    journal_export: true,
    ai_insights: "full",
    timeline_history_days: null,
    priority_support: true,
  },
}

export function getPlanEntitlements(plan?: string | null): PlanEntitlements {
  return PLAN_ENTITLEMENTS[(plan as PricingPlanKey) ?? "free"] ?? PLAN_ENTITLEMENTS.free
}

// `null` limits render as "Unlimited" — never "∞" or "null".
export function formatLimit(limit: number | null | undefined): string {
  return limit === null || limit === undefined ? "Unlimited" : String(limit)
}

export function formatCareLevelAccess(maxCareLevel: number): string {
  if (maxCareLevel <= 1) return "Level 1"
  if (maxCareLevel === 2) return "Levels 1–2"
  return "All levels (1–3)"
}

export function formatAgoraAccess(agora: PlanEntitlements["agora"]): string {
  if (agora === "host") return "Host circles"
  if (agora === "join") return "Join discussions"
  return "Browse only"
}

export function formatHistoryDays(days: number | null): string {
  return days === null ? "Full history" : `${days} days`
}

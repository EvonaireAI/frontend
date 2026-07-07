import { PLAN_MARKETING_NAMES, PLAN_PRICES, type PlanKey } from "./plans"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "/api"

export const PAID_PLANS = ["evocore", "evobloom", "evoluxe"] as const
export type PaidPlan = (typeof PAID_PLANS)[number]

// Derived from the shared plan helper — do not hardcode names here
export const PLAN_DISPLAY: Record<string, { name: string; price: string }> = Object.fromEntries(
  (Object.keys(PLAN_MARKETING_NAMES) as PlanKey[]).map((key) => [
    key,
    { name: PLAN_MARKETING_NAMES[key], price: `$${PLAN_PRICES[key]}/mo` },
  ]),
)

export function isPaidActive(plan: string, status: string): boolean {
  return PAID_PLANS.includes(plan as PaidPlan) &&
    (status === "active" || status === "trialing")
}

export function isPastDue(plan: string, status: string): boolean {
  return PAID_PLANS.includes(plan as PaidPlan) && status === "past_due"
}

export interface SubscriptionDetails {
  plan: string
  display_name: string
  status: string
  current_period_end: string | null
  cancel_at_period_end: boolean
}

export interface Invoice {
  id: string
  amount_paid: number
  currency: string
  status: string
  created: number
  period_end: number
  hosted_invoice_url: string
  invoice_pdf: string
}

function getAuthHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {}
  const token = localStorage.getItem("access_token")
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function fetchSubscription(): Promise<SubscriptionDetails> {
  const res = await fetch(`${API_BASE_URL}/payments/subscription/`, {
    headers: getAuthHeaders(),
  })
  if (!res.ok) throw new Error("Failed to fetch subscription")
  return res.json()
}

export async function fetchInvoices(): Promise<{ invoices: Invoice[] }> {
  const res = await fetch(`${API_BASE_URL}/payments/invoices/`, {
    headers: getAuthHeaders(),
  })
  if (!res.ok) throw new Error("Failed to fetch invoices")
  return res.json()
}

export async function cancelSubscription(): Promise<{ detail: string }> {
  const res = await fetch(`${API_BASE_URL}/payments/cancel/`, {
    method: "POST",
    headers: getAuthHeaders(),
  })
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.detail || "Failed to cancel subscription")
  }
  return res.json()
}

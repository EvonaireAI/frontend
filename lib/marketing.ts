// Staff-only marketing funnel: unique sessions through visit -> CTA click ->
// form view -> completed registration, plus per-source attribution.
// Mirrors the backend `analytics/marketing/dashboard/` aggregate.

import { authedFetch } from "./authed-fetch"
import { MetricsForbiddenError } from "./metrics"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "/api"

export interface MarketingCounts {
  page_view: number
  signup_click: number
  signup_view: number
  signup_complete: number
}

export interface MarketingRates {
  click_through: number | null
  form_start: number | null
  form_completion: number | null
  form_drop_off: number | null
  visit_to_signup: number | null
}

export interface MarketingSource {
  utm_source: string
  visits: number
  clicks: number
  form_views: number
  signups: number
  conversion_rate: number | null
}

export interface MarketingDay extends MarketingCounts {
  date: string
}

export interface MarketingDashboard {
  window_days: number
  window_start: string
  events: MarketingCounts
  sessions: MarketingCounts
  rates: MarketingRates
  sources: MarketingSource[]
  daily: MarketingDay[]
}

export async function getMarketingDashboard(days = 30): Promise<MarketingDashboard> {
  const token = localStorage.getItem("access_token")
  const response = await authedFetch(
    `${API_BASE_URL}/analytics/marketing/dashboard/?days=${encodeURIComponent(days)}`,
    { headers: token ? { Authorization: `Bearer ${token}` } : {} },
  )
  if (response.status === 403) throw new MetricsForbiddenError()
  if (!response.ok) throw new Error("Failed to fetch marketing dashboard")
  return response.json()
}

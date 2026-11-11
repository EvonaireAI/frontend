// Staff-only marketing funnel: unique sessions through visit -> CTA click ->
// form view -> completed registration, per-source and per-campaign attribution,
// and social platform token connections (Instagram, X, Bluesky).
// Mirrors the backend `analytics/marketing/` endpoints.

import { authedFetch } from "./authed-fetch"
import { MetricsForbiddenError } from "./metrics"
import { tr } from "./i18n/index.ts"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "/api"

export type SocialPlatformKey = "instagram" | "x" | "bluesky"

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

export interface MarketingCampaign {
  utm_campaign: string
  utm_source: string
  utm_medium: string
  visits: number
  clicks: number
  form_views: number
  signups: number
  conversion_rate: number | null
  drop_off_rate: number | null
}

export interface MarketingPlatform {
  platform: SocialPlatformKey
  label: string
  requires_token: boolean
  supports_impressions: boolean
  supports_clicks: boolean
  connected: boolean
  account_handle: string
  external_account_id: string
  has_token: boolean
  token_preview: string
  impressions: number | null
  reach: number | null
  platform_clicks: number | null
  engagements: number | null
  followers: number | null
  posts_tracked: number
  last_synced_at: string | null
  last_sync_error: string
  utm_visits: number
  utm_clicks: number
  utm_form_views: number
  utm_signups: number
  utm_conversion_rate: number | null
}

export interface MarketingPlatformConnectInput {
  account_handle: string
  external_account_id?: string
  access_token?: string
  sync_now?: boolean
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
  campaigns: MarketingCampaign[]
  platforms: MarketingPlatform[]
  daily: MarketingDay[]
}

function authHeaders(extra?: Record<string, string>): Record<string, string> {
  const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(extra || {}),
  }
}

async function parseErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body = await response.json()
    if (typeof body?.detail === "string") return body.detail
    for (const val of Object.values(body || {})) {
      if (Array.isArray(val) && typeof val[0] === "string") return val[0]
      if (typeof val === "string") return val
    }
  } catch {
    // Non-JSON error body
  }
  return fallback
}

export async function getMarketingDashboard(days = 30): Promise<MarketingDashboard> {
  const response = await authedFetch(
    `${API_BASE_URL}/analytics/marketing/dashboard/?days=${encodeURIComponent(days)}`,
    { headers: authHeaders() },
  )
  if (response.status === 403) throw new MetricsForbiddenError()
  if (!response.ok) throw new Error(tr("Failed to fetch marketing dashboard"))
  return response.json()
}

export async function connectMarketingPlatform(
  platform: SocialPlatformKey,
  input: MarketingPlatformConnectInput,
): Promise<MarketingPlatform> {
  const response = await authedFetch(
    `${API_BASE_URL}/analytics/marketing/platforms/${encodeURIComponent(platform)}/`,
    {
      method: "PUT",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(input),
    },
  )
  if (response.status === 403) throw new MetricsForbiddenError()
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, tr("Failed to connect {p0}", { p0: platform })))
  }
  return response.json()
}

export async function syncMarketingPlatform(
  platform: SocialPlatformKey,
): Promise<MarketingPlatform> {
  const response = await authedFetch(
    `${API_BASE_URL}/analytics/marketing/platforms/${encodeURIComponent(platform)}/sync/`,
    {
      method: "POST",
      headers: authHeaders(),
    },
  )
  if (response.status === 403) throw new MetricsForbiddenError()
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, `Failed to sync ${platform}`))
  }
  return response.json()
}

export async function disconnectMarketingPlatform(
  platform: SocialPlatformKey,
): Promise<MarketingPlatform> {
  const response = await authedFetch(
    `${API_BASE_URL}/analytics/marketing/platforms/${encodeURIComponent(platform)}/`,
    {
      method: "DELETE",
      headers: authHeaders(),
    },
  )
  if (response.status === 403) throw new MetricsForbiddenError()
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, tr("Failed to disconnect {p0}", { p0: platform })))
  }
  return response.json()
}

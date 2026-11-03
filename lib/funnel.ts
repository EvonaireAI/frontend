// Pre-auth marketing funnel beacon. Events: landing view, signup-CTA click,
// signup-form view, completed registration. The session key is a per-tab
// random id in sessionStorage — it identifies a visit, not a person.
// UTM params and the referrer are captured on first contact and attached
// to every event in the visit so completions stay attributed to source.

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "/api"

export type FunnelEventType =
  | "page_view"
  | "signup_click"
  | "signup_view"
  | "signup_complete"

const SESSION_STORAGE_KEY = "ebn_funnel_session"
const ATTR_STORAGE_KEY = "ebn_funnel_attr"

interface FunnelAttribution {
  utm_source: string
  utm_medium: string
  utm_campaign: string
  referrer: string
}

function sessionKey(): string {
  try {
    const existing = sessionStorage.getItem(SESSION_STORAGE_KEY)
    if (existing) return existing
    const key = crypto.randomUUID().replace(/-/g, "")
    sessionStorage.setItem(SESSION_STORAGE_KEY, key)
    return key
  } catch {
    // Storage blocked (private mode): fall back to an in-memory id so the
    // event still counts, just without cross-event session joins.
    return crypto.randomUUID().replace(/-/g, "")
  }
}

function attribution(): FunnelAttribution {
  try {
    const stored = sessionStorage.getItem(ATTR_STORAGE_KEY)
    if (stored) return JSON.parse(stored) as FunnelAttribution
    const params = new URLSearchParams(window.location.search)
    const attr: FunnelAttribution = {
      utm_source: (params.get("utm_source") || "").slice(0, 100),
      utm_medium: (params.get("utm_medium") || "").slice(0, 100),
      utm_campaign: (params.get("utm_campaign") || "").slice(0, 100),
      referrer: document.referrer.slice(0, 300),
    }
    sessionStorage.setItem(ATTR_STORAGE_KEY, JSON.stringify(attr))
    return attr
  } catch {
    return { utm_source: "", utm_medium: "", utm_campaign: "", referrer: "" }
  }
}

export function trackFunnelEvent(eventType: FunnelEventType): void {
  if (typeof window === "undefined") return
  try {
    const body = JSON.stringify({
      event_type: eventType,
      session_key: sessionKey(),
      path: window.location.pathname.slice(0, 200),
      ...attribution(),
    })
    const url = `${API_BASE_URL}/analytics/funnel/events/`
    // keepalive fetch, not sendBeacon: application/json isn't a simple CORS
    // content type, so a beacon to a cross-origin API would die on preflight.
    void fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {})
  } catch {
    // Analytics must never break the page.
  }
}

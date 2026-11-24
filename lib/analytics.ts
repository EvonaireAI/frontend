// Product analytics (PostHog). Initialized once from
// app/instrumentation-client.ts. Every helper no-ops when
// NEXT_PUBLIC_POSTHOG_KEY is unset, so this ships before the project key
// exists in Vercel.
//
// Privacy posture for a wellness app: autocapture is off (it would send
// clicked-element text, which can be user-written content), all inputs are
// masked, and session replay masks every text node via maskTextFn — replays
// show layout and interaction, never content. Person profiles exist only
// for identified users, and identity lives in localStorage, not cookies.
// FunnelEvent stays the marketing beacon; this is product analytics.

import type { PostHog } from "posthog-js"

let clientPromise: Promise<PostHog | null> | null = null
// The account this browser is currently identified as, so syncAnalyticsUser
// can tell a real logout apart from an anonymous page load.
let identifiedUserId: string | null = null

export function isAnalyticsEnabled(): boolean {
  return typeof window !== "undefined" && Boolean(process.env.NEXT_PUBLIC_POSTHOG_KEY)
}

export function initAnalytics(): Promise<void> {
  if (!isAnalyticsEnabled()) return Promise.resolve()
  if (clientPromise) return clientPromise.then(() => undefined)
  clientPromise = (async () => {
    const { default: posthog } = await import("posthog-js")
    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY as string, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
      // Manual events only. Autocapture's element text can carry user-written
      // content (reflections, feedback), which must never leave as a property.
      autocapture: false,
      capture_pageview: true,
      capture_pageleave: true,
      capture_exceptions: true,
      person_profiles: "identified_only",
      persistence: "localStorage",
      session_recording: {
        maskAllInputs: true,
        maskTextFn: () => "***",
      },
    })
    return posthog
  })().catch(() => null)
  return clientPromise.then(() => undefined)
}

// The SDK loads lazily, so helpers chain off the init promise rather than a
// resolved client — an event fired during the import window is not dropped.
function withClient(fn: (ph: PostHog) => void): void {
  if (!clientPromise) return
  void clientPromise.then((ph) => {
    if (!ph) return
    try {
      fn(ph)
    } catch {
      // Analytics must never break the page.
    }
  })
}

export function trackAnalyticsEvent(
  name: string,
  properties?: Record<string, string | number | boolean | null | undefined>,
): void {
  withClient((ph) => ph.capture(name, properties))
}

export function identifyAnalyticsUser(
  userId: string | number,
  properties?: Record<string, string | number | boolean | null | undefined>,
): void {
  withClient((ph) => ph.identify(String(userId), properties))
}

export function resetAnalytics(): void {
  withClient((ph) => ph.reset())
}

export interface AnalyticsUser {
  id?: number
  email?: string
  role?: string
  subscription_plan?: string
  subscription_status?: string
}

// Called whenever the auth context's user changes. Identifies the account
// once per id, and resets the distinct id only on a real identified→
// anonymous transition (logout) — resetting on every anonymous page load
// would fragment anonymous session stats.
export function syncAnalyticsUser(user: AnalyticsUser | null): void {
  if (user?.id != null) {
    const id = String(user.id)
    if (identifiedUserId === id) return
    identifiedUserId = id
    identifyAnalyticsUser(id, {
      email: user.email,
      role: user.role,
      subscription_plan: user.subscription_plan,
      subscription_status: user.subscription_status,
    })
    return
  }
  if (identifiedUserId !== null) {
    identifiedUserId = null
    resetAnalytics()
  }
}

"use client"

import { useEffect } from "react"
import { useAuth } from "@/lib/auth-context"
import { syncAnalyticsUser } from "@/lib/analytics"

// Keeps PostHog identity in step with the signed-in account. Lives inside
// AuthProvider so it sees every login, logout, and account switch — including
// the storage-event path that drops a stale identity on cross-tab changes.
export function AnalyticsIdentity() {
  const { user } = useAuth()
  useEffect(() => {
    syncAnalyticsUser(user)
  }, [user])
  return null
}

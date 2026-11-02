"use client"

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react"
import { useAuth } from "@/lib/auth-context"
import {
  fetchEntitlements,
  onEntitlementDenial,
  type EntitlementsResponse,
} from "@/lib/entitlements"
import { SessionScope } from "@/lib/session-scope"
import { planDisplayName } from "@/lib/plans"

interface EntitlementsContextType {
  entitlements: EntitlementsResponse | null
  loading: boolean
  refreshEntitlements: () => Promise<void>
  plan: string
  planName: string
}

const EntitlementsContext = createContext<EntitlementsContextType | undefined>(undefined)

export function EntitlementsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [scope] = useState(() => new SessionScope())
  const [entitlements, setEntitlements] = useState<EntitlementsResponse | null>(null)
  const [loading, setLoading] = useState(false)

  const refreshEntitlements = useCallback(async () => {
    const session = scope.current
    if (!session) return
    try {
      setLoading(true)
      const data = await fetchEntitlements()
      if (scope.isCurrent(session)) setEntitlements(data)
    } catch {
      // Keep the last known entitlements; UI falls back to plan info on the user object
    } finally {
      // A stale response must not clear the next session's loading state.
      if (scope.isCurrent(session)) setLoading(false)
    }
  }, [scope])

  // Fetch once after login (whenever the authenticated user changes)
  useEffect(() => {
    if (!user) {
      scope.deactivate()
      setEntitlements(null)
      setLoading(false)
      return
    }
    // A different account must not see the previous account's entitlements
    // while its own load is in flight or after it fails. Key on the
    // immutable id when present; email is editable on the account.
    if (scope.activate(String(user.id ?? user.email))) setEntitlements(null)
    refreshEntitlements()
  }, [user, scope, refreshEntitlements])

  // Refetch after any entitlement 403 so locked states stay accurate
  useEffect(() => {
    return onEntitlementDenial(() => {
      refreshEntitlements()
    })
  }, [refreshEntitlements])

  const plan = entitlements?.plan ?? user?.subscription_plan ?? "free"
  const planName = entitlements?.display_name ?? planDisplayName(plan)

  return (
    <EntitlementsContext.Provider
      value={{ entitlements, loading, refreshEntitlements, plan, planName }}
    >
      {children}
    </EntitlementsContext.Provider>
  )
}

export function useEntitlements() {
  const context = useContext(EntitlementsContext)
  if (context === undefined) {
    throw new Error("useEntitlements must be used within an EntitlementsProvider")
  }
  return context
}

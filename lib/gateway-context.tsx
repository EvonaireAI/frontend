"use client"

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react"
import { useAuth } from "@/lib/auth-context"
import {
  gatewayQuizService,
  onGatewayProgress,
  toProgress,
  type GatewayProgress,
} from "@/lib/gateway-quiz"
import { SessionScope } from "@/lib/session-scope"

interface GatewayContextType {
  // Null until the first status load; the chrome indicator hides while null.
  progress: GatewayProgress | null
  completed: boolean
  refresh: () => Promise<void>
}

const GatewayContext = createContext<GatewayContextType | undefined>(undefined)

export function GatewayProvider({ children }: { children: ReactNode }) {
  const { user, consentsAccepted } = useAuth()
  const [scope] = useState(() => new SessionScope())
  const [progress, setProgress] = useState<GatewayProgress | null>(null)

  const refresh = useCallback(async () => {
    const session = scope.current
    if (!session) return
    try {
      const status = await gatewayQuizService.getStatus()
      if (scope.isCurrent(session)) setProgress(toProgress(status))
    } catch {
      // Keep the last known progress; the indicator is informational only.
    }
  }, [scope])

  // Load progress once the user is authenticated and has consented (Gateway
  // questions only apply post-consent).
  useEffect(() => {
    if (user && consentsAccepted) {
      // A different account must not see the previous account's progress
      // while its own load is in flight or after it fails. Key on the
      // immutable id when present; email is editable on the account.
      if (scope.activate(String(user.id ?? user.email))) setProgress(null)
      refresh()
    } else {
      scope.deactivate()
      setProgress(null)
    }
  }, [user, consentsAccepted, scope, refresh])

  // Stay in sync as answers are submitted anywhere (nudge or completion
  // modal). Events carry the access token captured before their request ran;
  // one emitted under a session that has since changed — a response that
  // crossed an account switch — is dropped rather than lighting the indicator
  // with the previous account's progress. Also requires an active session
  // scope so a late event cannot light the indicator after sign-out.
  useEffect(
    () =>
      onGatewayProgress((next, sessionTag) => {
        if (
          sessionTag !== null &&
          sessionTag === localStorage.getItem("access_token") &&
          scope.current
        ) {
          setProgress(next)
        }
      }),
    [scope],
  )

  return (
    <GatewayContext.Provider value={{ progress, completed: progress?.completed ?? false, refresh }}>
      {children}
    </GatewayContext.Provider>
  )
}

export function useGateway() {
  const context = useContext(GatewayContext)
  if (context === undefined) {
    throw new Error("useGateway must be used within a GatewayProvider")
  }
  return context
}

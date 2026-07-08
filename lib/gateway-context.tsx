"use client"

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react"
import { useAuth } from "@/lib/auth-context"
import {
  gatewayQuizService,
  onGatewayProgress,
  toProgress,
  type GatewayProgress,
} from "@/lib/gateway-quiz"

interface GatewayContextType {
  // Null until the first status load; the chrome indicator hides while null.
  progress: GatewayProgress | null
  completed: boolean
  refresh: () => Promise<void>
}

const GatewayContext = createContext<GatewayContextType | undefined>(undefined)

export function GatewayProvider({ children }: { children: ReactNode }) {
  const { user, consentsAccepted } = useAuth()
  const [progress, setProgress] = useState<GatewayProgress | null>(null)

  const refresh = useCallback(async () => {
    try {
      const status = await gatewayQuizService.getStatus()
      setProgress(toProgress(status))
    } catch {
      // Keep the last known progress; the indicator is informational only.
    }
  }, [])

  // Load progress once the user is authenticated and has consented (Gateway
  // questions only apply post-consent).
  useEffect(() => {
    if (user && consentsAccepted) {
      refresh()
    } else {
      setProgress(null)
    }
  }, [user, consentsAccepted, refresh])

  // Stay in sync as answers are submitted anywhere (nudge or completion modal).
  useEffect(() => onGatewayProgress(setProgress), [])

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

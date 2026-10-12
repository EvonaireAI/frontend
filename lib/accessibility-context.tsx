"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react"
import {
  applyAccessibilityPreferences,
  DEFAULT_A11Y_PREFERENCES,
  loadPreferences,
  savePreferences,
  type AccessibilityPreferences,
} from "@/lib/accessibility-preferences"

type AccessibilityPreferenceKey = keyof AccessibilityPreferences

interface AccessibilityContextType {
  preferences: AccessibilityPreferences
  setPreference: (key: AccessibilityPreferenceKey, value: boolean) => void
  resetPreferences: () => void
}

const AccessibilityContext = createContext<AccessibilityContextType | undefined>(undefined)

export function AccessibilityProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<AccessibilityPreferences>(
    DEFAULT_A11Y_PREFERENCES,
  )

  // Hydrate from localStorage after mount (SSR-safe).
  useEffect(() => {
    setPreferences(loadPreferences())
  }, [])

  // Apply to <html> and persist whenever preferences change.
  useEffect(() => {
    applyAccessibilityPreferences(preferences)
    savePreferences(preferences)
  }, [preferences])

  const setPreference = useCallback((key: AccessibilityPreferenceKey, value: boolean) => {
    setPreferences((prev) => ({ ...prev, [key]: value }))
  }, [])

  const resetPreferences = useCallback(() => {
    setPreferences(DEFAULT_A11Y_PREFERENCES)
  }, [])

  return (
    <AccessibilityContext.Provider value={{ preferences, setPreference, resetPreferences }}>
      {children}
    </AccessibilityContext.Provider>
  )
}

export function useAccessibility() {
  const context = useContext(AccessibilityContext)
  if (context === undefined) {
    throw new Error("useAccessibility must be used within an AccessibilityProvider")
  }
  return context
}

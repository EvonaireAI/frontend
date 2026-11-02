"use client"

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react"
import { authService, type User, type LoginResponse } from "@/lib/auth"
import { isAuthStorageKey } from "@/lib/auth-storage"

interface AuthContextType {
  user: User | null
  loading: boolean
  consentsAccepted: boolean
  login: (email: string, password: string) => Promise<LoginResponse>
  logout: () => void
  refreshUser: () => Promise<void>
  acceptConsent: (privacyPolicy: boolean, termsOfService: boolean) => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [consentsAccepted, setConsentsAccepted] = useState(false)

  const refreshUser = useCallback(async () => {
    try {
      if (authService.isAuthenticated()) {
        const userData = await authService.getProfile()
        setUser(userData)
        setConsentsAccepted(userData.consents_accepted ?? false)
      } else {
        setUser(null)
        setConsentsAccepted(false)
      }
    } catch {
      setUser(null)
      setConsentsAccepted(false)
    }
  }, [])

  useEffect(() => {
    const init = async () => {
      await refreshUser()
      setLoading(false)
    }
    init()
  }, [refreshUser])

  // Storage events only reach other tabs: a login, logout, or account
  // switch elsewhere must drop the identity this tab was showing before it
  // can act on the new session (e.g. submit a form under the new token).
  useEffect(() => {
    let queued = false
    const onStorage = (event: StorageEvent) => {
      if (!isAuthStorageKey(event.key) || queued) return
      // Login and logout write both token keys; collapse them into one reset.
      queued = true
      queueMicrotask(() => {
        queued = false
        setUser(null)
        setConsentsAccepted(false)
        void refreshUser()
      })
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [refreshUser])

  const login = useCallback(async (email: string, password: string): Promise<LoginResponse> => {
    const data = await authService.login(email, password)
    const userData = await authService.getProfile()
    setUser(userData)
    const consented = data.consents_accepted ?? userData.consents_accepted ?? false
    setConsentsAccepted(consented)
    return data
  }, [])

  const logout = useCallback(() => {
    authService.logout()
    setUser(null)
    setConsentsAccepted(false)
  }, [])

  const acceptConsent = useCallback(async (privacyPolicy: boolean, termsOfService: boolean) => {
    await authService.acceptConsent(privacyPolicy, termsOfService)
    setConsentsAccepted(true)
    await refreshUser()
  }, [refreshUser])

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        consentsAccepted,
        login,
        logout,
        refreshUser,
        acceptConsent,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}

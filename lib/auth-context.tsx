"use client"

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react"
import { authService, type User, type LoginResponse } from "@/lib/auth"
import { gatewayQuizService } from "@/lib/gateway-quiz"

interface AuthContextType {
  user: User | null
  loading: boolean
  consentsAccepted: boolean
  gatewayQuizCompleted: boolean
  login: (email: string, password: string) => Promise<LoginResponse>
  logout: () => void
  refreshUser: () => Promise<void>
  refreshGatewayQuizStatus: () => Promise<void>
  acceptConsent: (privacyPolicy: boolean, termsOfService: boolean) => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [consentsAccepted, setConsentsAccepted] = useState(false)
  const [gatewayQuizCompleted, setGatewayQuizCompleted] = useState(false)

  const refreshGatewayQuizStatus = useCallback(async () => {
    try {
      const attempt = await gatewayQuizService.getStatus()
      setGatewayQuizCompleted(attempt.status === "completed")
    } catch {
      setGatewayQuizCompleted(false)
    }
  }, [])

  const refreshUser = useCallback(async () => {
    try {
      if (authService.isAuthenticated()) {
        const userData = await authService.getProfile()
        setUser(userData)
        setConsentsAccepted(userData.consents_accepted ?? false)
        if (userData.consents_accepted) {
          await refreshGatewayQuizStatus()
        } else {
          setGatewayQuizCompleted(false)
        }
      } else {
        setUser(null)
        setConsentsAccepted(false)
        setGatewayQuizCompleted(false)
      }
    } catch {
      setUser(null)
      setConsentsAccepted(false)
      setGatewayQuizCompleted(false)
    }
  }, [refreshGatewayQuizStatus])

  useEffect(() => {
    const init = async () => {
      await refreshUser()
      setLoading(false)
    }
    init()
  }, [refreshUser])

  const login = useCallback(async (email: string, password: string): Promise<LoginResponse> => {
    const data = await authService.login(email, password)
    const userData = await authService.getProfile()
    setUser(userData)
    const consented = data.consents_accepted ?? userData.consents_accepted ?? false
    setConsentsAccepted(consented)
    if (consented) {
      await refreshGatewayQuizStatus()
    } else {
      setGatewayQuizCompleted(false)
    }
    return data
  }, [refreshGatewayQuizStatus])

  const logout = useCallback(() => {
    authService.logout()
    setUser(null)
    setConsentsAccepted(false)
    setGatewayQuizCompleted(false)
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
        gatewayQuizCompleted,
        login,
        logout,
        refreshUser,
        refreshGatewayQuizStatus,
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

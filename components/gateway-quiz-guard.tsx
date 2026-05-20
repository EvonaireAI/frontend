"use client"

import { useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { Loader2 } from "lucide-react"

// Routes the user must still be able to reach before completing the quiz.
const PUBLIC_ROUTES = [
  "/",
  "/auth/login",
  "/auth/register",
  "/auth/resend-activation",
  "/activate",
  "/consent",
  "/gateway-quiz",
  "/privacy",
  "/terms",
]

export function GatewayQuizGuard({ children }: { children: React.ReactNode }) {
  const { user, loading, consentsAccepted, gatewayQuizCompleted } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  const isPublicRoute = PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname?.startsWith("/auth/"),
  )

  useEffect(() => {
    if (loading) return
    if (isPublicRoute) return
    if (!user) return
    // Consent must come first — ConsentGuard handles that redirect.
    if (!consentsAccepted) return
    if (!gatewayQuizCompleted) {
      router.push("/gateway-quiz")
    }
  }, [user, loading, consentsAccepted, gatewayQuizCompleted, isPublicRoute, router])

  if (
    !isPublicRoute &&
    user &&
    consentsAccepted &&
    !gatewayQuizCompleted &&
    !loading
  ) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return <>{children}</>
}

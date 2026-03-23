"use client"

import { useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { Loader2 } from "lucide-react"

// Routes that don't require consent check
const PUBLIC_ROUTES = [
  "/",
  "/auth/login",
  "/auth/register",
  "/auth/resend-activation",
  "/activate",
  "/consent",
]

export function ConsentGuard({ children }: { children: React.ReactNode }) {
  const { user, loading, consentsAccepted } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  const isPublicRoute = PUBLIC_ROUTES.some(route => 
    pathname === route || pathname?.startsWith("/auth/")
  )

  useEffect(() => {
    // Don't do anything while loading
    if (loading) return

    // Don't check consent on public routes
    if (isPublicRoute) return

    // If user is authenticated but hasn't accepted consent, redirect to consent page
    if (user && !consentsAccepted) {
      router.push("/consent")
    }
  }, [user, loading, consentsAccepted, isPublicRoute, router])

  // Show loading while checking auth status
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  // On protected routes, if user is authenticated but hasn't consented, show loading
  // (they will be redirected by the useEffect)
  if (!isPublicRoute && user && !consentsAccepted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return <>{children}</>
}

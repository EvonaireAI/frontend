"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Loader2, ArrowLeft, Shield } from "lucide-react"
import { authService, type User } from "@/lib/auth"
import { isSteward } from "@/lib/roles"
import { GLOSSARY } from "@/lib/glossary"
import { StewardRequestsTab } from "@/components/admin/console/steward-requests-tab"

export default function StewardRequestsPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        if (!authService.isAuthenticated()) {
          router.push("/auth/login")
          return
        }

        const profile = await authService.getProfile()
        if (!isSteward(profile.role)) {
          router.push("/dashboard")
          return
        }
        setUser(profile)
      } catch (error) {
        console.error("Failed to load the steward profile:", error)
        router.push("/auth/login")
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [router])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-accent/5">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-3xl font-bold text-foreground sm:text-4xl">
              <Shield className="h-7 w-7 text-primary" />
              {GLOSSARY.stewardRequests}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Review and approve or reject requests for elevated roles.
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/steward">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to {GLOSSARY.stewardConsole}
            </Link>
          </Button>
        </div>

        <StewardRequestsTab />
      </div>
    </div>
  )
}

"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { authService, type User } from "@/lib/auth"
import { metricsService } from "@/lib/metrics"
import { useMetricsZone, ZoneError } from "@/components/admin/metrics/zone"
import { OverviewCards, OverviewCardsSkeleton } from "@/components/admin/metrics/overview-cards"
import { TierDonut, TierDonutSkeleton } from "@/components/admin/metrics/tier-donut"
import { MrrTrend } from "@/components/admin/metrics/mrr-trend"
import { ConversionFunnel } from "@/components/admin/metrics/conversion-funnel"
import { Loader2 } from "lucide-react"

export default function AdminSubscriptionsPage() {
  const [user, setUser] = useState<User | null>(null)
  const [checkingAccess, setCheckingAccess] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const checkAccess = async () => {
      try {
        if (!authService.isAuthenticated()) {
          router.push("/auth/login")
          return
        }
        const userData = await authService.getProfile()
        if (userData.role !== "admin") {
          router.push("/dashboard")
          return
        }
        setUser(userData)
      } catch {
        router.push("/auth/login")
        return
      } finally {
        setCheckingAccess(false)
      }
    }
    checkAccess()
  }, [router])

  if (checkingAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!user || user.role !== "admin") {
    return null
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">Subscriptions</h1>
          <p className="text-muted-foreground mt-1">
            Revenue, tier mix, churn, and free-to-paid conversion
          </p>
        </div>
        <Dashboard />
      </div>
    </div>
  )
}

function Dashboard() {
  // Headline cards and the tier donut share the overview endpoint — one
  // fetch, one retry, but each zone renders its own skeleton.
  const overviewFetcher = useCallback(() => metricsService.getOverview(), [])
  const overview = useMetricsZone(overviewFetcher)

  return (
    <div className="space-y-6">
      {overview.loading ? (
        <OverviewCardsSkeleton />
      ) : overview.error ? (
        <ZoneError label="the subscription overview" onRetry={overview.retry} />
      ) : (
        overview.data && <OverviewCards overview={overview.data} />
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          {overview.loading ? (
            <TierDonutSkeleton />
          ) : overview.error ? (
            <ZoneError label="the tier breakdown" onRetry={overview.retry} />
          ) : (
            overview.data && <TierDonut overview={overview.data} />
          )}
        </div>
        <div className="lg:col-span-2">
          <MrrTrend />
        </div>
      </div>

      <ConversionFunnel />
    </div>
  )
}

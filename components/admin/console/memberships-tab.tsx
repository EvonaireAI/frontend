"use client"

import { Button } from "@/components/ui/button"
import { ZoneError } from "@/components/admin/metrics/zone"
import { OverviewCards, OverviewCardsSkeleton } from "@/components/admin/metrics/overview-cards"
import { TierDonut, TierDonutSkeleton } from "@/components/admin/metrics/tier-donut"
import { MrrTrend } from "@/components/admin/metrics/mrr-trend"
import { ConversionFunnel } from "@/components/admin/metrics/conversion-funnel"
import { RefreshCw } from "lucide-react"
import type { MetricsOverview } from "@/lib/metrics"
import type { PlatformOverviewState } from "./use-platform-overview"

// Revenue, tier mix, churn and free-to-paid conversion — the Session 02
// dashboard, moved under this tab.
//
// The headline cards and the tier donut read `admin/overview.memberships`,
// which is verbatim the `payments/metrics/overview/` payload the console has
// already fetched. The trend and funnel keep their own endpoints; there is no
// aggregate that carries them.

export function MembershipsTab({ overview, loading, error, reload }: PlatformOverviewState) {
  // Same payload, different name on the wire — the console fetched it once.
  const metrics = (overview?.memberships ?? null) as MetricsOverview | null

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Revenue, tier mix, churn and free-to-paid conversion.
        </p>
        <Button variant="outline" size="sm" onClick={reload} disabled={loading}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {loading ? (
        <OverviewCardsSkeleton />
      ) : error || !metrics ? (
        <ZoneError label="the subscription overview" onRetry={reload} />
      ) : (
        <OverviewCards overview={metrics} />
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          {loading ? (
            <TierDonutSkeleton />
          ) : error || !metrics ? (
            <ZoneError label="the tier breakdown" onRetry={reload} />
          ) : (
            <TierDonut overview={metrics} />
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

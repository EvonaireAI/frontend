"use client"

import { useCallback, useEffect, useState } from "react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { MrrTrend } from "@/components/admin/metrics/mrr-trend"
import { RefreshCw, TrendingDown, TrendingUp } from "lucide-react"
import {
  centsToDollarString,
  metricsService,
  monthLongLabel,
  rateToPercentString,
  type MetricsFunnel,
  type MetricsTimeseries,
} from "@/lib/metrics"

// Platform Intelligence has no aggregate endpoint of its own — these MVP cards
// are derived from the existing payments metrics (timeseries + funnel). Noted
// as a gap in the Session 11 alignment report.

function Metric({
  label,
  value,
  hint,
  direction,
}: {
  label: string
  value: string
  hint?: string
  direction?: "up" | "down"
}) {
  return (
    <div className="rounded-lg border border-border p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 flex items-center gap-2 text-2xl font-bold tabular-nums text-foreground">
        {value}
        {direction === "up" && <TrendingUp className="h-4 w-4 text-green-600" />}
        {direction === "down" && <TrendingDown className="h-4 w-4 text-red-600" />}
      </p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

export function IntelligenceTab() {
  const [timeseries, setTimeseries] = useState<MetricsTimeseries | null>(null)
  const [funnel, setFunnel] = useState<MetricsFunnel | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [series, funnelData] = await Promise.all([metricsService.getTimeseries(12), metricsService.getFunnel(3)])
      setTimeseries(series)
      setFunnel(funnelData)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load platform metrics")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
          <span>{error}</span>
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  const months = timeseries?.months ?? []
  const latest = months.length > 0 ? months[months.length - 1] : null
  const previous = months.length > 1 ? months[months.length - 2] : null
  const netChange = latest?.net_mrr_change_cents ?? 0
  const churnDirection =
    latest && previous ? (latest.churn_rate > previous.churn_rate ? "up" : "down") : undefined

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Growth, retention and conversion, derived from the subscription metrics endpoints.
        </p>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          label="Net MRR change"
          value={centsToDollarString(netChange)}
          hint={latest ? monthLongLabel(latest.month) : "No data yet"}
          direction={netChange === 0 ? undefined : netChange > 0 ? "up" : "down"}
        />
        <Metric
          label="Churn rate"
          value={latest ? rateToPercentString(latest.churn_rate) : "—"}
          hint={previous ? `Was ${rateToPercentString(previous.churn_rate)} the month before` : undefined}
          direction={churnDirection}
        />
        <Metric
          label="Free → paid conversion"
          value={funnel ? rateToPercentString(funnel.conversion_rate) : "—"}
          hint={funnel ? `${funnel.conversions_to_paid.toLocaleString()} of ${funnel.registered_users.toLocaleString()} registered` : undefined}
        />
        <Metric
          label="Median days to convert"
          value={funnel?.median_days_to_convert != null ? `${funnel.median_days_to_convert}` : "—"}
          hint={funnel ? `Across the last ${funnel.months} months` : undefined}
        />
      </div>

      <MrrTrend />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">What isn&apos;t here yet</CardTitle>
          <CardDescription>Being explicit beats implying coverage we don&apos;t have.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            There is no dedicated platform-intelligence aggregate in the API. These cards are composed from
            <span className="font-medium text-foreground"> payments/metrics/timeseries</span> and
            <span className="font-medium text-foreground"> payments/metrics/funnel</span>, which cover the MVP
            questions but nothing about listening behaviour, ritual performance or cohort retention.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

"use client"

import { useCallback, useState } from "react"
import { format } from "date-fns"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { metricsService, rateToPercentString, type MetricsFunnel } from "@/lib/metrics"
import { useMetricsZone, ZoneError, ZoneRefetchDim } from "./zone"

const WINDOW_OPTIONS = [1, 3, 6] as const

// Ordinal ramp steps (brand gold, light→dark with funnel depth).
const STAGE_COLORS = ["var(--chart-3)", "var(--chart-1)", "var(--chart-2)"]

function FunnelStage({
  label,
  count,
  share,
  maxCount,
  color,
}: {
  label: string
  count: number
  share: string | null
  maxCount: number
  color: string
}) {
  const widthPct = maxCount > 0 ? Math.max((count / maxCount) * 100, count > 0 ? 2 : 0) : 0
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm mb-1">
        <span className="text-foreground">{label}</span>
        <span className="text-muted-foreground tabular-nums">
          {count.toLocaleString()}
          {share && <span className="ml-2 text-xs">({share})</span>}
        </span>
      </div>
      <div className="h-6">
        <div
          className="h-full rounded-r"
          style={{ width: `${widthPct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  )
}

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-secondary/50 px-4 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold text-foreground">{value}</p>
    </div>
  )
}

export function ConversionFunnelSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-56" />
      </CardHeader>
      <CardContent className="space-y-4">
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-6 w-1/3" />
      </CardContent>
    </Card>
  )
}

export function ConversionFunnel() {
  const [months, setMonths] = useState<number>(3)

  const fetcher = useCallback(() => metricsService.getFunnel(months), [months])
  const { data, loading, error, retry } = useMetricsZone(fetcher)

  if (loading && !data) return <ConversionFunnelSkeleton />
  if (error && !data) return <ZoneError label="the conversion funnel" onRetry={retry} />
  if (!data) return null

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <CardTitle>Conversion funnel</CardTitle>
            <CardDescription>
              Users registered since {format(new Date(data.window_start), "MMM d, yyyy")}
            </CardDescription>
          </div>
          <ToggleGroup
            type="single"
            size="sm"
            variant="outline"
            value={String(months)}
            onValueChange={(v) => v && setMonths(Number(v))}
          >
            {WINDOW_OPTIONS.map((opt) => (
              <ToggleGroupItem key={opt} value={String(opt)}>
                {opt}m
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      </CardHeader>
      <CardContent>
        {error && <ZoneError label="the conversion funnel" onRetry={retry} />}
        {!error && (
          <ZoneRefetchDim dimmed={loading}>
            {data.registered_users === 0 ? (
              <p className="text-center text-muted-foreground py-8">No signups in this window yet</p>
            ) : (
              <FunnelBody funnel={data} />
            )}
          </ZoneRefetchDim>
        )}
      </CardContent>
    </Card>
  )
}

function FunnelBody({ funnel }: { funnel: MetricsFunnel }) {
  const max = funnel.registered_users
  const shareOf = (count: number) => (max > 0 ? rateToPercentString(count / max) : null)

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <FunnelStage
          label="Registered"
          count={funnel.registered_users}
          share={null}
          maxCount={max}
          color={STAGE_COLORS[0]}
        />
        <FunnelStage
          label="Free actives"
          count={funnel.free_actives}
          share={shareOf(funnel.free_actives)}
          maxCount={max}
          color={STAGE_COLORS[1]}
        />
        <FunnelStage
          label="Paid conversions"
          count={funnel.conversions_to_paid}
          share={shareOf(funnel.conversions_to_paid)}
          maxCount={max}
          color={STAGE_COLORS[2]}
        />
      </div>
      <div className="flex gap-3 flex-wrap">
        <StatChip label="Conversion rate" value={rateToPercentString(funnel.conversion_rate)} />
        <StatChip
          label="Median days to convert"
          value={
            funnel.median_days_to_convert === null
              ? "—"
              : funnel.median_days_to_convert.toLocaleString("en-US", { maximumFractionDigits: 1 })
          }
        />
      </div>
    </div>
  )
}

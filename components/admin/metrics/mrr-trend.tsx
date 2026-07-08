"use client"

import { useCallback, useMemo, useState } from "react"
import { Area, AreaChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { ChartContainer, ChartTooltip } from "@/components/ui/chart"
import {
  metricsService,
  monthLongLabel,
  monthShortLabel,
  centsToDollarString,
  type TimeseriesMonth,
} from "@/lib/metrics"
import { useMetricsZone, ZoneError, ZoneRefetchDim } from "./zone"

const WINDOW_OPTIONS = [3, 6, 12, 24] as const

interface TrendPoint extends TimeseriesMonth {
  label: string
  mrrDollars: number
  churnPct: number
  isCurrent: boolean
}

function dollarsAxisTick(value: number): string {
  if (value >= 1000) return `$${(value / 1000).toLocaleString("en-US", { maximumFractionDigits: 1 })}k`
  return `$${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`
}

// Custom tooltip: the month's MRR plus the movement breakdown behind it.
function MrrTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: TrendPoint }> }) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  const net = p.net_mrr_change_cents
  const rows: Array<[string, string]> = [
    ["New subscriptions", String(p.new_subscriptions)],
    ["Upgrades", String(p.upgrades)],
    ["Downgrades", String(p.downgrades)],
    ["Cancellations", String(p.cancellations)],
    ["Net MRR change", `${net >= 0 ? "+" : "−"}${centsToDollarString(Math.abs(net))}`],
  ]
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="font-medium text-foreground">
        {monthLongLabel(p.month)}
        {p.isCurrent && <span className="text-muted-foreground font-normal"> · month to date</span>}
      </p>
      <p className="text-foreground mt-1 mb-2 font-semibold">MRR {centsToDollarString(p.eom_mrr_cents)}</p>
      <div className="space-y-0.5">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-6">
            <span className="text-muted-foreground">{label}</span>
            <span className="text-foreground tabular-nums">{value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function ChurnTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: TrendPoint }> }) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="font-medium text-foreground">{monthLongLabel(p.month)}</p>
      <div className="mt-1 space-y-0.5">
        <div className="flex items-center justify-between gap-6">
          <span className="text-muted-foreground">Churn rate</span>
          <span className="text-foreground tabular-nums">
            {p.churnPct.toLocaleString("en-US", { maximumFractionDigits: 1 })}%
          </span>
        </div>
        <div className="flex items-center justify-between gap-6">
          <span className="text-muted-foreground">Cancellations</span>
          <span className="text-foreground tabular-nums">{p.cancellations}</span>
        </div>
      </div>
    </div>
  )
}

export function MrrTrendSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-4 w-64" />
      </CardHeader>
      <CardContent className="space-y-6">
        <Skeleton className="h-[220px] w-full" />
        <Skeleton className="h-[120px] w-full" />
      </CardContent>
    </Card>
  )
}

export function MrrTrend() {
  const [months, setMonths] = useState<number>(12)

  const fetcher = useCallback(() => metricsService.getTimeseries(months), [months])
  const { data, loading, error, retry } = useMetricsZone(fetcher)

  const points = useMemo<TrendPoint[]>(() => {
    if (!data) return []
    return data.months.map((m, i) => ({
      ...m,
      label: monthShortLabel(m.month),
      mrrDollars: m.eom_mrr_cents / 100,
      churnPct: m.churn_rate * 100,
      isCurrent: i === data.months.length - 1,
    }))
  }, [data])

  if (loading && !data) return <MrrTrendSkeleton />
  if (error && !data) return <ZoneError label="the MRR trend" onRetry={retry} />
  if (!data) return null

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <CardTitle>MRR &amp; churn</CardTitle>
            <CardDescription>End-of-month MRR with monthly churn rate; last month is in progress</CardDescription>
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
        {error && <ZoneError label="the MRR trend" onRetry={retry} />}
        {!error && points.length === 0 && (
          <p className="text-center text-muted-foreground py-12">No subscription activity yet</p>
        )}
        {!error && points.length > 0 && (
          <ZoneRefetchDim dimmed={loading}>
            <p className="text-xs text-muted-foreground mb-1">MRR ($)</p>
            <ChartContainer
              config={{ mrrDollars: { label: "MRR", color: "var(--chart-1)" } }}
              className="aspect-auto h-[220px] w-full"
            >
              <AreaChart data={points} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} strokeWidth={1} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis tickLine={false} axisLine={false} tickFormatter={dollarsAxisTick} width={52} />
                <ChartTooltip content={<MrrTooltip />} />
                <Area
                  dataKey="mrrDollars"
                  type="monotone"
                  stroke="var(--chart-1)"
                  strokeWidth={2}
                  fill="var(--chart-1)"
                  fillOpacity={0.1}
                  activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
                />
              </AreaChart>
            </ChartContainer>
            <p className="text-xs text-muted-foreground mb-1 mt-6">Churn rate (%)</p>
            <ChartContainer
              config={{ churnPct: { label: "Churn", color: "var(--chart-2)" } }}
              className="aspect-auto h-[120px] w-full"
            >
              <LineChart data={points} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} strokeWidth={1} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => `${v.toLocaleString("en-US", { maximumFractionDigits: 1 })}%`}
                  width={52}
                />
                <ChartTooltip content={<ChurnTooltip />} />
                <Line
                  dataKey="churnPct"
                  type="monotone"
                  stroke="var(--chart-2)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
                />
              </LineChart>
            </ChartContainer>
          </ZoneRefetchDim>
        )}
      </CardContent>
    </Card>
  )
}

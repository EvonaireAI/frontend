"use client"

import { useCallback, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { rateToPercentString } from "@/lib/metrics"
import { getMarketingDashboard, type MarketingDashboard } from "@/lib/marketing"
import { useMetricsZone, ZoneError, ZoneRefetchDim } from "@/components/admin/metrics/zone"

const WINDOW_OPTIONS = [7, 30, 90] as const

const FUNNEL_STAGES = [
  { key: "page_view", label: "Site visits", color: "var(--chart-3)" },
  { key: "signup_click", label: "Sign-up clicks", color: "var(--chart-1)" },
  { key: "signup_view", label: "Form opened", color: "var(--chart-2)" },
  { key: "signup_complete", label: "Registered", color: "var(--chart-4)" },
] as const

function rate(value: number | null | undefined): string {
  return value === null || value === undefined ? "—" : rateToPercentString(value)
}

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-secondary/50 px-4 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold text-foreground">{value}</p>
    </div>
  )
}

function Funnel({ data }: { data: MarketingDashboard }) {
  const max = Math.max(...FUNNEL_STAGES.map((s) => data.sessions[s.key]), 0)
  return (
    <div className="space-y-3">
      {FUNNEL_STAGES.map((stage) => {
        const count = data.sessions[stage.key] ?? 0
        const widthPct = max > 0 ? Math.max((count / max) * 100, count > 0 ? 2 : 0) : 0
        return (
          <div key={stage.key}>
            <div className="flex items-baseline justify-between text-sm mb-1">
              <span className="text-foreground">{stage.label}</span>
              <span className="text-muted-foreground tabular-nums">{count.toLocaleString()} sessions</span>
            </div>
            <div className="h-6">
              <div className="h-full rounded-r" style={{ width: `${widthPct}%`, backgroundColor: stage.color }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function SourcesTable({ data }: { data: MarketingDashboard }) {
  if (data.sources.length === 0) return null
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Traffic sources</CardTitle>
        <CardDescription>Unique sessions by utm_source; blank tags land under direct.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Source</TableHead>
              <TableHead className="text-right">Visits</TableHead>
              <TableHead className="text-right">Clicks</TableHead>
              <TableHead className="text-right">Signups</TableHead>
              <TableHead className="text-right">Conversion</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.sources.map((s) => (
              <TableRow key={s.utm_source}>
                <TableCell className="font-medium">{s.utm_source}</TableCell>
                <TableCell className="text-right tabular-nums">{s.visits.toLocaleString()}</TableCell>
                <TableCell className="text-right tabular-nums">{s.clicks.toLocaleString()}</TableCell>
                <TableCell className="text-right tabular-nums">{s.signups.toLocaleString()}</TableCell>
                <TableCell className="text-right tabular-nums">{rate(s.conversion_rate)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

export function MarketingTab() {
  const [days, setDays] = useState<number>(30)

  const fetcher = useCallback(() => getMarketingDashboard(days), [days])
  const { data, loading, error, retry } = useMetricsZone(fetcher)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Marketing funnel</h2>
          <p className="text-sm text-muted-foreground">
            Anonymous visit sessions through registration, by traffic source.
          </p>
        </div>
        <ToggleGroup
          type="single"
          value={String(days)}
          onValueChange={(v) => v && setDays(Number(v))}
          variant="outline"
          size="sm"
        >
          {WINDOW_OPTIONS.map((d) => (
            <ToggleGroupItem key={d} value={String(d)}>
              {d}d
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      {error && <ZoneError label="the marketing funnel" onRetry={retry} />}

      {loading && !data && (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      )}

      {data && (
        <ZoneRefetchDim dimmed={loading}>
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <StatChip label="Visits" value={data.sessions.page_view.toLocaleString()} />
              <StatChip label="Click-through" value={rate(data.rates.click_through)} />
              <StatChip label="Form completion" value={rate(data.rates.form_completion)} />
              <StatChip label="Form drop-off" value={rate(data.rates.form_drop_off)} />
              <StatChip label="Visit to signup" value={rate(data.rates.visit_to_signup)} />
            </div>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Acquisition funnel</CardTitle>
                <CardDescription>
                  Unique sessions per stage over the last {data.window_days} days.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Funnel data={data} />
              </CardContent>
            </Card>
            <SourcesTable data={data} />
          </div>
        </ZoneRefetchDim>
      )}
    </div>
  )
}

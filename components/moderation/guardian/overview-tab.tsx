"use client"

import { useCallback, useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertTriangle, ArrowRight, CheckCircle2, ClipboardList, Inbox, RefreshCw, Store } from "lucide-react"
import { moderationService, violationLabel, type GuardianOverview } from "@/lib/moderation"
import type { GuardianTab } from "./tabs"

// `GET /api/moderations/overview/` answers this whole tab in one request. Every
// counter deep-links to the tab that actually shows those rows.

interface OverviewTabProps {
  onNavigate: (tab: GuardianTab) => void
}

function CounterCard({
  label,
  value,
  hint,
  icon,
  tone = "default",
  onClick,
}: {
  label: string
  value: number
  hint?: string
  icon: React.ReactNode
  tone?: "default" | "warn" | "danger" | "good"
  onClick: () => void
}) {
  const toneClass =
    tone === "danger"
      ? "text-red-600 dark:text-red-400"
      : tone === "warn"
        ? "text-yellow-600 dark:text-yellow-400"
        : tone === "good"
          ? "text-green-600 dark:text-green-400"
          : "text-primary"

  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left rounded-lg border-2 border-border bg-card p-4 transition-colors hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-ring"
    >
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className={`mt-2 text-3xl font-bold tabular-nums ${toneClass}`}>{value.toLocaleString()}</div>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </button>
  )
}

export function OverviewTab({ onNavigate }: OverviewTabProps) {
  const [data, setData] = useState<GuardianOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setData(await moderationService.getOverview())
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load the overview")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-28 w-full" />
        ))}
      </div>
    )
  }

  if (error || !data) {
    return (
      <Alert variant="destructive">
        <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
          <span>{error ?? "The overview is unavailable."}</span>
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  const severityEntries: Array<["high" | "medium" | "low", number]> = [
    ["high", data.live_by_severity.high],
    ["medium", data.live_by_severity.medium],
    ["low", data.live_by_severity.low],
  ]
  const liveTotal = severityEntries.reduce((sum, [, count]) => sum + count, 0)
  const violationEntries = Object.entries(data.live_by_violation_type ?? {}).sort((a, b) => b[1] - a[1])

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <CounterCard
          label="Pending Review"
          value={data.pending_review}
          hint="Open and unassigned"
          icon={<Inbox className="h-4 w-4" />}
          tone="warn"
          onClick={() => onNavigate("pending")}
        />
        <CounterCard
          label="Active — yours"
          value={data.active_mine}
          hint={`${data.active.toLocaleString()} active across all guardians`}
          icon={<ClipboardList className="h-4 w-4" />}
          onClick={() => onNavigate("active")}
        />
        <CounterCard
          label="Resolved this week"
          value={data.resolved_this_week}
          hint={`${data.archived.toLocaleString()} archived all-time`}
          icon={<CheckCircle2 className="h-4 w-4" />}
          tone="good"
          onClick={() => onNavigate("history")}
        />
        <CounterCard
          label="Open escalations"
          value={data.escalations_open}
          hint={`${data.escalations_total.toLocaleString()} escalated all-time`}
          icon={<AlertTriangle className="h-4 w-4" />}
          tone="danger"
          onClick={() => onNavigate("active")}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Live cases by severity</CardTitle>
            <CardDescription>Open and assigned cases only — {liveTotal.toLocaleString()} in total.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {severityEntries.map(([severity, count]) => {
              const percent = liveTotal > 0 ? Math.round((count / liveTotal) * 100) : 0
              return (
                <div key={severity} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="capitalize text-foreground">{severity}</span>
                    <span className="tabular-nums text-muted-foreground">{count.toLocaleString()}</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={
                        severity === "high" ? "h-full bg-red-500" : severity === "medium" ? "h-full bg-yellow-500" : "h-full bg-green-500"
                      }
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              )
            })}

            {violationEntries.length > 0 && (
              <div className="pt-2">
                <p className="mb-2 text-sm font-medium text-foreground">By violation type</p>
                <div className="flex flex-wrap gap-2">
                  {violationEntries.map(([type, count]) => (
                    <Badge key={type} variant="outline" className="text-xs">
                      {violationLabel(type)} · {count}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Review backlogs</CardTitle>
            <CardDescription>Both queues live on the Sacred Library tab.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <button
              type="button"
              onClick={() => onNavigate("library")}
              className="flex w-full items-center justify-between rounded-lg border border-border p-3 text-left transition-colors hover:border-primary/40"
            >
              <span className="flex items-center gap-2 text-sm text-foreground">
                <ClipboardList className="h-4 w-4 text-muted-foreground" />
                Rituals awaiting review
              </span>
              <span className="flex items-center gap-2 font-semibold tabular-nums">
                {data.rituals_awaiting_review.toLocaleString()}
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate("library")}
              className="flex w-full items-center justify-between rounded-lg border border-border p-3 text-left transition-colors hover:border-primary/40"
            >
              <span className="flex items-center gap-2 text-sm text-foreground">
                <Store className="h-4 w-4 text-muted-foreground" />
                Commons listings awaiting review
              </span>
              <span className="flex items-center gap-2 font-semibold tabular-nums">
                {data.listings_awaiting_review.toLocaleString()}
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </span>
            </button>
            <p className="pt-1 text-xs text-muted-foreground">
              As of {new Date(data.as_of).toLocaleString()}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ArrowRight, RefreshCw, ShieldCheck } from "lucide-react"
import { adminService, type TrustCare } from "@/lib/admin"
import { violationLabel } from "@/lib/moderation"

// Oversight, not action. Stewards read the aggregate here and work individual
// cases through the Guardian tabs, so every row that can be drilled into links
// out to /moderate.

const WINDOW_OPTIONS = [7, 14, 30, 90]

function Breakdown({ title, entries, empty }: { title: string; entries: Array<[string, number]>; empty: string }) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium text-foreground">{title}</p>
      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {entries.map(([key, value]) => (
            <Badge key={key} variant="outline" className="text-xs">
              {violationLabel(key)} · {value.toLocaleString()}
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums text-foreground">
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

export function TrustCareTab() {
  const [days, setDays] = useState(7)
  const [data, setData] = useState<TrustCare | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setData(await adminService.getTrustCare(days))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load Trust & Care")
    } finally {
      setLoading(false)
    }
  }, [days])

  useEffect(() => {
    load()
  }, [load])

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <Alert variant="destructive">
        <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
          <span>{error ?? "Trust & Care is unavailable."}</span>
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  const { cases, reports, agora_flags: agoraFlags, rts_interventions: interventions, appeals } = data

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Window</span>
          <Select value={String(days)} onValueChange={(value) => setDays(Number(value))}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WINDOW_OPTIONS.map((option) => (
                <SelectItem key={option} value={String(option)}>
                  Last {option} days
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base">Care cases</CardTitle>
              <CardDescription>Stage counts now, plus movement over the window.</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/moderate?tab=pending">
                Work the queue
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Pending review" value={cases.pending_review} />
            <Stat label="Active" value={cases.active} />
            <Stat label="Resolved" value={cases.resolved} hint={`${cases.resolved_in_window.toLocaleString()} in window`} />
            <Stat label="Archived" value={cases.archived} />
            <Stat label="Opened in window" value={cases.opened_in_window} />
            <Stat
              label="Open escalations"
              value={cases.escalations_open}
              hint={`${cases.escalations_total.toLocaleString()} all-time`}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Breakdown
              title="Live by severity"
              entries={Object.entries(cases.live_by_severity ?? {})}
              empty="No live cases."
            />
            <Breakdown
              title="Live by violation type"
              entries={Object.entries(cases.live_by_violation_type ?? {})}
              empty="No live cases."
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Member reports</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Stat label="Total" value={reports.total} hint={`${reports.in_window.toLocaleString()} in window`} />
            <Stat label="Flagged by GAIA" value={reports.ai_flagged_total} />
            <Breakdown
              title="By violation type"
              entries={Object.entries(reports.by_violation_type ?? {})}
              empty="Nothing reported."
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Agora flags</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Stat label="Total" value={agoraFlags.total} hint={`${agoraFlags.in_window.toLocaleString()} in window`} />
            <Stat label="Content pending review" value={agoraFlags.content_pending_review} />
            <Stat label="Removed by moderation" value={agoraFlags.content_removed_by_moderation} />
            <Breakdown title="By reason" entries={Object.entries(agoraFlags.by_reason ?? {})} empty="No flags." />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">RTS interventions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Stat
              label="Open"
              value={interventions.open}
              hint={`${interventions.opened_in_window.toLocaleString()} opened in window`}
            />
            <Breakdown title="By type" entries={Object.entries(interventions.by_type ?? {})} empty="No interventions." />
            <Button asChild variant="ghost" size="sm" className="px-0">
              <Link href="/moderate?tab=rts">
                RTS Monitoring
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Guardian workload
          </CardTitle>
          <CardDescription>Who is holding what, and how much they closed in the window.</CardDescription>
        </CardHeader>
        <CardContent>
          {data.guardian_workload.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">No guardians have cases right now.</p>
          ) : (
            <div className="w-full overflow-x-auto rounded-lg border border-border">
              <Table className="min-w-[32rem]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Guardian</TableHead>
                    <TableHead className="text-right">Active</TableHead>
                    <TableHead className="text-right">Resolved in window</TableHead>
                    <TableHead className="text-right">Queue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.guardian_workload.map((row) => (
                    <TableRow key={row.guardian_id}>
                      <TableCell className="break-all text-sm text-foreground">{row.guardian_email}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.active.toLocaleString()}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.resolved_in_window.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild variant="ghost" size="sm">
                          <Link href="/moderate?tab=active">Open</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Appeals</CardTitle>
        </CardHeader>
        <CardContent>
          {appeals.supported ? (
            <Stat label="Open appeals" value={appeals.count} />
          ) : (
            <div className="rounded-lg border border-dashed border-border p-6 text-center">
              <p className="font-medium text-foreground">Appeals aren&apos;t available yet</p>
              <p className="mt-1 text-sm text-muted-foreground">{appeals.detail}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">As of {new Date(data.as_of).toLocaleString()}</p>
    </div>
  )
}

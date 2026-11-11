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
import { fmtLocale, tr, trNode } from "@/lib/i18n"


// Oversight, not action. Stewards read the aggregate here and work individual
// cases through the Guardian tabs, so every row that can be drilled into links
// out to /moderate.

const WINDOW_OPTIONS = [7, 14, 30, 90]

/** `AbuseFlag.Action` — the detector writes the first three, a human the rest. */
const ABUSE_ACTION_LABELS: Record<string, string> = {
  none: "No action yet",
  warned: "Soft warning shown",
  session_terminated: "Session terminated",
  dismiss: "Dismissed — no abuse",
  restrict_playback: "Playback restricted",
  suspend_account: "Account suspended",
}

function Breakdown({
  title,
  entries,
  empty,
  labelFor = violationLabel,
}: {
  title: string
  entries: Array<[string, number]>
  empty: string
  /** Violation types by default; pass a map for other vocabularies. */
  labelFor?: (key: string) => string
}) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium text-foreground">{title}</p>
      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {entries.map(([key, value]) => (
            <Badge key={key} variant="outline" className="text-xs">
              {labelFor(key)} · {value.toLocaleString(fmtLocale())}
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
        {typeof value === "number" ? value.toLocaleString(fmtLocale()) : value}
      </p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

export function TrustCareTab({
  consoleBasePath = "/admin",
  includeGuardianLinks = false,
}: {
  consoleBasePath?: string
  /** When false, omit links into the Guardian Dashboard (steward workspace). */
  includeGuardianLinks?: boolean
}) {
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
      setError(err instanceof Error ? err.message : tr("Failed to load Trust & Care"))
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
            {tr("Retry")}
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  const {
    cases,
    reports,
    agora_flags: agoraFlags,
    rts_interventions: interventions,
    content_protection: contentProtection,
    appeals,
  } = data

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{tr("Window")}</span>
          <Select value={String(days)} onValueChange={(value) => setDays(Number(value))}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WINDOW_OPTIONS.map((option) => (
                <SelectItem key={option} value={String(option)}>
                  {trNode("Last {p0} days", { p0: option })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="mr-2 h-4 w-4" />
          {tr("Refresh")}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base">{tr("Care cases")}</CardTitle>
              <CardDescription>{tr("Stage counts now, plus movement over the window.")}</CardDescription>
            </div>
            {includeGuardianLinks && (
              <Button asChild variant="ghost" size="sm">
                <Link href="/moderate?tab=pending">
                  {tr("Work the queue")}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label={tr("Pending review")} value={cases.pending_review} />
            <Stat label={tr("Active")} value={cases.active} />
            <Stat label={tr("Resolved")} value={cases.resolved} hint={`${cases.resolved_in_window.toLocaleString(fmtLocale())} in window`} />
            <Stat label={tr("Archived")} value={cases.archived} />
            <Stat label={tr("Opened in window")} value={cases.opened_in_window} />
            <Stat
              label={tr("Open escalations")}
              value={cases.escalations_open}
              hint={tr("{p0} all-time", { p0: cases.escalations_total.toLocaleString(fmtLocale()) })}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Breakdown
              title={tr("Live by severity")}
              entries={Object.entries(cases.live_by_severity ?? {})}
              empty={tr("No live cases.")}
            />
            <Breakdown
              title={tr("Live by violation type")}
              entries={Object.entries(cases.live_by_violation_type ?? {})}
              empty={tr("No live cases.")}
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{tr("Member reports")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Stat label={tr("Total")} value={reports.total} hint={`${reports.in_window.toLocaleString(fmtLocale())} in window`} />
            <Stat label={tr("Flagged by GAIA")} value={reports.ai_flagged_total} />
            <Breakdown
              title={tr("By violation type")}
              entries={Object.entries(reports.by_violation_type ?? {})}
              empty={tr("Nothing reported.")}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{tr("Agora flags")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Stat label={tr("Total")} value={agoraFlags.total} hint={`${agoraFlags.in_window.toLocaleString(fmtLocale())} in window`} />
            <Stat label={tr("Content pending review")} value={agoraFlags.content_pending_review} />
            <Stat label={tr("Removed by moderation")} value={agoraFlags.content_removed_by_moderation} />
            <Breakdown title={tr("By reason")} entries={Object.entries(agoraFlags.by_reason ?? {})} empty={tr("No flags.")} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{tr("RTS interventions")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Stat
              label={tr("Open")}
              value={interventions.open}
              hint={tr("{p0} opened in window", { p0: interventions.opened_in_window.toLocaleString(fmtLocale()) })}
            />
            <Breakdown title={tr("By type")} entries={Object.entries(interventions.by_type ?? {})} empty={tr("No interventions.")} />
            {includeGuardianLinks && (
              <Button asChild variant="ghost" size="sm" className="px-0">
                <Link href="/moderate?tab=rts">
                  {tr("RTS Monitoring")}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Session 12. Rendered only when the backend sends the block, so this
          tab still works against a pre-Session-12 API. */}
      {contentProtection && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{tr("Content protection")}</CardTitle>
            <CardDescription>
              {tr("Behavioural request patterns only — no profiling, and no automated restriction. Restricting or suspending an account takes a named guardian and a written reason.")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label={tr("Open flags")} value={contentProtection.flags_open} />
              <Stat label={tr("Flags in window")} value={contentProtection.flags_in_window} />
              <Stat label={tr("Sessions terminated")} value={contentProtection.sessions_terminated_in_window} hint={tr("In window")} />
              <Stat label={tr("Active playback restrictions")} value={contentProtection.playback_restrictions_active} />
            </div>
            <Breakdown
              title={tr("Flags by action taken")}
              entries={Object.entries(contentProtection.by_action ?? {})}
              empty={tr("No flags raised.")}
              labelFor={(key) => ABUSE_ACTION_LABELS[key] ?? key.replace(/_/g, " ")}
            />
            <p className="text-xs text-muted-foreground">
              {tr("The full trail is in ")}
              <Link href={`${consoleBasePath}?tab=archive`} className="text-primary hover:underline">
                {tr("The Archive")}
              </Link>{tr(" under Content protection.")}
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-5 w-5 text-primary" />
            {tr("Guardian workload")}
          </CardTitle>
          <CardDescription>{tr("Who is holding what, and how much they closed in the window.")}</CardDescription>
        </CardHeader>
        <CardContent>
          {data.guardian_workload.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">{tr("No guardians have cases right now.")}</p>
          ) : (
            <div className="w-full overflow-x-auto rounded-lg border border-border">
              <Table className="min-w-[32rem]">
                <TableHeader>
                  <TableRow>
                    <TableHead>{tr("Guardian")}</TableHead>
                    <TableHead className="text-right">{tr("Active")}</TableHead>
                    <TableHead className="text-right">{tr("Resolved in window")}</TableHead>
                    <TableHead className="text-right">{tr("Queue")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.guardian_workload.map((row) => (
                    <TableRow key={row.guardian_id}>
                      <TableCell className="break-all text-sm text-foreground">{row.guardian_email}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.active.toLocaleString(fmtLocale())}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.resolved_in_window.toLocaleString(fmtLocale())}
                      </TableCell>
                      <TableCell className="text-right">
                        {includeGuardianLinks ? (
                          <Button asChild variant="ghost" size="sm">
                            <Link href="/moderate?tab=active">{tr("Open")}</Link>
                          </Button>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
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
          <CardTitle className="text-base">{tr("Appeals")}</CardTitle>
        </CardHeader>
        <CardContent>
          {appeals.supported ? (
            <Stat label={tr("Open appeals")} value={appeals.count} />
          ) : (
            <div className="rounded-lg border border-dashed border-border p-6 text-center">
              <p className="font-medium text-foreground">{tr("Appeals aren't available yet")}</p>
              <p className="mt-1 text-sm text-muted-foreground">{appeals.detail}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">{trNode("As of {p0}", { p0: new Date(data.as_of).toLocaleString(fmtLocale()) })}</p>
    </div>
  )
}

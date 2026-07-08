"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { format } from "date-fns"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { authService } from "@/lib/auth"
import { centsToDollarString } from "@/lib/metrics"
import { currentUtcPeriod, periodLabel, shiftPeriod } from "@/lib/listening"
import {
  royaltiesService,
  RoyaltiesApiError,
  RoyaltiesForbiddenError,
  PAYOUT_STATUS_CHIPS,
  type CreatorEarnings,
  type CreatorStatement,
  type PayoutStatus,
} from "@/lib/royalties"
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Coins,
  Loader2,
  RefreshCw,
  Sparkles,
} from "lucide-react"

function formatMinutes(minutes: number): string {
  return minutes.toLocaleString("en-US", { maximumFractionDigits: 1 })
}

// Status chip; failure_reason (when present) surfaces as a tooltip.
function PayoutStatusChip({
  status,
  failureReason,
}: {
  status: PayoutStatus
  failureReason?: string | null
}) {
  const chip = PAYOUT_STATUS_CHIPS[status] ?? {
    label: status,
    className: "bg-muted text-muted-foreground border-border",
  }
  const badge = (
    <Badge variant="outline" className={`${chip.className} text-xs whitespace-nowrap`}>
      {chip.label}
    </Badge>
  )
  if (!failureReason) return badge
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex cursor-help">{badge}</span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">{failureReason}</TooltipContent>
    </Tooltip>
  )
}

export default function CreatorEarningsPage() {
  const [authChecked, setAuthChecked] = useState(false)
  const router = useRouter()

  // Balance + payout history (one fetch)
  const [earnings, setEarnings] = useState<CreatorEarnings | null>(null)
  const [earningsLoading, setEarningsLoading] = useState(true)
  const [earningsError, setEarningsError] = useState(false)

  // Monthly statement (refetches when the period changes). Defaults to last
  // month — the current month only computes after it ends.
  const [period, setPeriod] = useState(() => shiftPeriod(currentUtcPeriod(), -1))
  const [statement, setStatement] = useState<CreatorStatement | null>(null)
  const [statementLoading, setStatementLoading] = useState(true)
  const [statementError, setStatementError] = useState(false)
  const [statementMissing, setStatementMissing] = useState(false)

  useEffect(() => {
    const checkAccess = async () => {
      try {
        if (!authService.isAuthenticated()) {
          router.push("/auth/login")
          return
        }
        const userData = await authService.getProfile()
        if (userData.role !== "creator") {
          router.push("/dashboard")
          return
        }
        setAuthChecked(true)
      } catch (err) {
        console.error("Failed to verify access:", err)
        router.push("/auth/login")
      }
    }
    checkAccess()
  }, [router])

  const loadEarnings = useCallback(async () => {
    setEarningsLoading(true)
    setEarningsError(false)
    try {
      setEarnings(await royaltiesService.getEarnings())
    } catch (err) {
      if (err instanceof RoyaltiesForbiddenError) {
        router.replace("/dashboard")
        return
      }
      console.error("Failed to load earnings:", err)
      setEarningsError(true)
    } finally {
      setEarningsLoading(false)
    }
  }, [router])

  const loadStatement = useCallback(async () => {
    setStatementLoading(true)
    setStatementError(false)
    setStatementMissing(false)
    try {
      setStatement(await royaltiesService.getStatement(period))
    } catch (err) {
      if (err instanceof RoyaltiesForbiddenError) {
        router.replace("/dashboard")
        return
      }
      setStatement(null)
      if (err instanceof RoyaltiesApiError && err.status === 404) {
        setStatementMissing(true)
      } else {
        console.error("Failed to load statement:", err)
        setStatementError(true)
      }
    } finally {
      setStatementLoading(false)
    }
  }, [period, router])

  useEffect(() => {
    if (authChecked) loadEarnings()
  }, [authChecked, loadEarnings])

  useEffect(() => {
    if (authChecked) loadStatement()
  }, [authChecked, loadStatement])

  // Statements only exist for closed months — never allow the current one
  const lastClosedPeriod = shiftPeriod(currentUtcPeriod(), -1)
  const atNewestPeriod = period >= lastClosedPeriod

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  const belowMinimum =
    earnings !== null && earnings.payable_balance_cents < earnings.minimum_payout_cents

  const statementHasEarnings =
    statement !== null && (statement.total_earned_cents > 0 || statement.member_count > 0)

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 lg:py-12 max-w-5xl">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <Coins className="w-5 h-5 text-primary" />
            <h1 className="text-3xl font-bold text-foreground">Earnings</h1>
          </div>
          <p className="text-muted-foreground">
            Your share of member subscriptions, based on qualified listening. Members stay
            anonymous — you only ever see counts.
          </p>
        </div>

        {/* --- Balance card --- */}
        {earningsLoading ? (
          <div className="grid gap-4 md:grid-cols-3 mb-8">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="pt-6 space-y-3">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-8 w-20" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : earningsError ? (
          <Alert variant="destructive" className="mb-8">
            <AlertDescription className="flex items-center justify-between gap-4 flex-wrap">
              <span>Failed to load your earnings.</span>
              <Button variant="outline" size="sm" onClick={loadEarnings}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        ) : (
          earnings && (
            <div className="mb-8">
              {!earnings.payouts_ready && (
                <div className="mb-4 flex items-start gap-3 bg-yellow-900/20 border border-yellow-500/30 rounded-xl px-4 py-3">
                  <AlertTriangle className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-yellow-200">
                    <Link href="/creator/payouts" className="underline underline-offset-2 hover:text-yellow-100">
                      Finish setting up payouts
                    </Link>{" "}
                    to receive transfers.
                  </p>
                </div>
              )}

              <div
                className={`grid gap-4 md:grid-cols-3 ${earnings.held_cents > 0 ? "lg:grid-cols-4" : ""}`}
              >
                <Card className="bg-card border-border">
                  <CardContent className="pt-6">
                    <p className="text-sm text-muted-foreground">Available for payout</p>
                    <p className="text-4xl font-semibold text-primary mt-1">
                      {centsToDollarString(earnings.payable_balance_cents)}
                    </p>
                    {belowMinimum && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Balances under {centsToDollarString(earnings.minimum_payout_cents)} roll
                        forward to the next month.
                      </p>
                    )}
                  </CardContent>
                </Card>
                <Card className="bg-card border-border">
                  <CardContent className="pt-6">
                    <p className="text-sm text-muted-foreground">Pending review</p>
                    <p className="text-2xl font-semibold text-foreground mt-1">
                      {centsToDollarString(earnings.pending_balance_cents)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Earned in a month the team hasn&apos;t approved yet
                    </p>
                  </CardContent>
                </Card>
                <Card className="bg-card border-border">
                  <CardContent className="pt-6">
                    <p className="text-sm text-muted-foreground">Lifetime earnings</p>
                    <p className="text-2xl font-semibold text-foreground mt-1">
                      {centsToDollarString(earnings.lifetime_earned_cents)}
                    </p>
                  </CardContent>
                </Card>
                {earnings.held_cents > 0 && (
                  <Card className="border-destructive/50 bg-destructive/5">
                    <CardContent className="pt-6">
                      <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-destructive" />
                        On hold
                      </p>
                      <p className="text-2xl font-semibold text-foreground mt-1">
                        {centsToDollarString(earnings.held_cents)}
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>

              {earnings.last_payout && (
                <p className="text-sm text-muted-foreground mt-3">
                  Last payout {centsToDollarString(earnings.last_payout.amount_cents)} ·{" "}
                  {format(new Date(earnings.last_payout.sent_at), "MMMM d, yyyy")}
                </p>
              )}
            </div>
          )
        )}

        {/* --- Monthly statement --- */}
        <Card className="bg-card border-border mb-8">
          <CardHeader>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <CardTitle className="text-foreground">Monthly statement</CardTitle>
                <CardDescription>
                  Statements appear after the month closes and are computed from qualified minutes.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setPeriod((p) => shiftPeriod(p, -1))}
                  aria-label="Previous month"
                  className="bg-transparent border-border"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm font-medium text-foreground min-w-[8.5rem] text-center tabular-nums">
                  {periodLabel(period)}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setPeriod((p) => shiftPeriod(p, 1))}
                  disabled={atNewestPeriod}
                  aria-label="Next month"
                  className="bg-transparent border-border"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {statementLoading && !statement ? (
              <div className="space-y-4">
                <Skeleton className="h-8 w-72" />
                <Skeleton className="h-[160px]" />
              </div>
            ) : statementError ? (
              <Alert variant="destructive">
                <AlertDescription className="flex items-center justify-between gap-4 flex-wrap">
                  <span>Failed to load your statement.</span>
                  <Button variant="outline" size="sm" onClick={loadStatement}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Retry
                  </Button>
                </AlertDescription>
              </Alert>
            ) : statementMissing ? (
              <p className="text-center text-muted-foreground py-8 text-sm">
                No statement yet for this month. Statements appear after the month closes.
              </p>
            ) : statement && !statementHasEarnings ? (
              <p className="text-center text-muted-foreground py-8 text-sm">
                No qualified listening this month.
              </p>
            ) : (
              statement && (
                <div className={statementLoading ? "opacity-50 pointer-events-none transition-opacity" : "transition-opacity"}>
                  <div className="flex items-center gap-3 flex-wrap">
                    <h2 className="text-2xl font-semibold text-foreground">
                      You earned {centsToDollarString(statement.total_earned_cents)} from{" "}
                      {statement.member_count.toLocaleString()}{" "}
                      {statement.member_count === 1 ? "member" : "members"}
                    </h2>
                    {statement.period_status === "computed" && (
                      <Badge
                        variant="outline"
                        className="bg-yellow-900/30 text-yellow-400 border-yellow-500/30 text-xs"
                      >
                        Preliminary — under review
                      </Badge>
                    )}
                  </div>
                  {statement.idle_redistribution_cents > 0 && (
                    <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-primary" />
                      Includes {centsToDollarString(statement.idle_redistribution_cents)} from the
                      community pool
                    </p>
                  )}

                  <div className="mt-6">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Ritual</TableHead>
                          <TableHead className="text-right">Earned</TableHead>
                          <TableHead className="text-right">Listeners</TableHead>
                          <TableHead className="text-right">Qualified minutes</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {statement.by_ritual.map((r) => (
                          <TableRow key={r.ritual_id}>
                            <TableCell className="font-medium text-foreground">
                              {r.ritual_title}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {centsToDollarString(r.earned_cents)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {r.unique_members.toLocaleString()}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatMinutes(r.qualified_minutes)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {statement.payout && (
                    <div className="mt-4 pt-4 border-t border-border flex items-center gap-3 text-sm">
                      <span className="text-muted-foreground">Payout for this month:</span>
                      <span className="font-medium text-foreground tabular-nums">
                        {centsToDollarString(statement.payout.amount_cents)}
                      </span>
                      <PayoutStatusChip
                        status={statement.payout.status}
                        failureReason={statement.payout.failure_reason}
                      />
                    </div>
                  )}
                </div>
              )
            )}
          </CardContent>
        </Card>

        {/* --- Payout history --- */}
        {!earningsLoading && !earningsError && earnings && (
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground">Payout history</CardTitle>
              <CardDescription>
                Payouts run monthly once a period is approved. Balances under{" "}
                {centsToDollarString(earnings.minimum_payout_cents)} roll forward.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {earnings.payout_history.length === 0 ? (
                <p className="text-center text-muted-foreground py-8 text-sm">
                  No payouts yet. Your first payout will appear here.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Period</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {earnings.payout_history.map((p) => (
                      <TableRow key={`${p.period}-${p.created_at}`}>
                        <TableCell className="font-medium text-foreground">
                          {periodLabel(p.period)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {centsToDollarString(p.amount_cents)}
                        </TableCell>
                        <TableCell>
                          <PayoutStatusChip status={p.status} failureReason={p.failure_reason} />
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {format(new Date(p.created_at), "MMM d, yyyy")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

"use client"

import { useCallback, useEffect, useState, type ReactNode } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { format } from "date-fns"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ShadowModeBanner } from "@/components/admin/royalties/shadow-mode-banner"
import { authService, type User } from "@/lib/auth"
import { centsToDollarString, rateToPercentString } from "@/lib/metrics"
import { periodLabel } from "@/lib/listening"
import {
  royaltiesService,
  RoyaltiesApiError,
  RoyaltiesForbiddenError,
  PERIOD_STATUS_CHIPS,
  type RoyaltyPeriodReport,
} from "@/lib/royalties"
import { AlertTriangle, ArrowLeft, CheckCircle, Loader2, RefreshCw, ShieldCheck } from "lucide-react"

function PeriodStatusChip({ status }: { status: string }) {
  const chip = PERIOD_STATUS_CHIPS[status as keyof typeof PERIOD_STATUS_CHIPS] ?? {
    label: status,
    className: "bg-muted text-muted-foreground border-border",
  }
  return (
    <Badge variant="outline" className={`${chip.className} text-xs`}>
      {chip.label}
    </Badge>
  )
}

function StatCard({
  label,
  value,
  caption,
  warning,
}: {
  label: string
  value: string
  caption?: ReactNode
  warning?: boolean
}) {
  return (
    <Card className={warning ? "border-destructive/50 bg-destructive/5" : undefined}>
      <CardContent className="pt-6">
        <p className="text-sm text-muted-foreground flex items-center gap-1.5">
          {warning && <AlertTriangle className="w-4 h-4 text-destructive" />}
          {label}
        </p>
        <p className="text-2xl font-semibold text-foreground mt-1">{value}</p>
        {caption && <p className="text-xs text-muted-foreground mt-1">{caption}</p>}
      </CardContent>
    </Card>
  )
}

export default function AdminRoyaltyPeriodPage() {
  const [user, setUser] = useState<User | null>(null)
  const [checkingAccess, setCheckingAccess] = useState(true)
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const periodId = Number(params.id)

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
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <Link
          href="/admin/royalties"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          All periods
        </Link>
        <PeriodReport periodId={periodId} />
      </div>
    </div>
  )
}

function PeriodReport({ periodId }: { periodId: number }) {
  const router = useRouter()
  const [report, setReport] = useState<RoyaltyPeriodReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [approving, setApproving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    setNotFound(false)
    try {
      setReport(await royaltiesService.getPeriodReport(periodId))
    } catch (err) {
      if (err instanceof RoyaltiesForbiddenError) {
        router.replace("/dashboard")
        return
      }
      if (err instanceof RoyaltiesApiError && err.status === 404) {
        setNotFound(true)
        return
      }
      console.error("Failed to load royalty period report:", err)
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [periodId, router])

  useEffect(() => {
    load()
  }, [load])

  const approve = async () => {
    setApproving(true)
    try {
      const updated = await royaltiesService.approvePeriod(periodId)
      setReport((prev) => (prev ? { ...prev, ...updated } : prev))
      toast.success(`${periodLabel(updated.period)} approved`)
    } catch (err) {
      if (err instanceof RoyaltiesForbiddenError) {
        router.replace("/dashboard")
        return
      }
      // 409 = the period moved on under us — show the server's detail and resync
      toast.error(err instanceof Error ? err.message : "Failed to approve the period")
      load()
    } finally {
      setApproving(false)
    }
  }

  if (loading && !report) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-64" />
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
        <Skeleton className="h-[240px]" />
      </div>
    )
  }

  if (notFound) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground py-8">Royalty period not found.</p>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription className="flex items-center justify-between gap-4 flex-wrap">
          <span>Failed to load the period report.</span>
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  if (!report) return null

  const careFundMode = report.idle_fallback_applied === "care_fund"

  return (
    <div className={loading ? "opacity-50 pointer-events-none transition-opacity" : "transition-opacity"}>
      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-foreground">{periodLabel(report.period)}</h1>
            <PeriodStatusChip status={report.status} />
          </div>
          <p className="text-muted-foreground mt-1">
            {report.computed_at &&
              `Computed ${format(new Date(report.computed_at), "MMM d, yyyy h:mm a")}`}
            {report.approved_at &&
              ` · Approved ${format(new Date(report.approved_at), "MMM d, yyyy h:mm a")}`}
            {report.paid_at && ` · Paid ${format(new Date(report.paid_at), "MMM d, yyyy h:mm a")}`}
          </p>
        </div>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              disabled={report.status !== "computed" || approving}
              className="bg-primary text-primary-foreground hover:bg-gold-muted"
            >
              {approving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ShieldCheck className="w-4 h-4" />
              )}
              Approve period
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Approve {periodLabel(report.period)}?</AlertDialogTitle>
              <AlertDialogDescription>
                This freezes the numbers and makes {centsToDollarString(report.distributed_cents)}{" "}
                payable to {report.creators_earning.toLocaleString()}{" "}
                {report.creators_earning === 1 ? "creator" : "creators"}. It cannot be recomputed
                afterwards.
                {report.shadow_mode && (
                  <span className="block mt-2 text-yellow-400">
                    Shadow mode: no transfers will execute.
                  </span>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={approve}>Approve</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {report.shadow_mode && <ShadowModeBanner />}

      {/* Totals */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mb-4">
        <StatCard label="Gross member revenue" value={centsToDollarString(report.gross_cents)} />
        <StatCard
          label="Platform fee (11%)"
          value={centsToDollarString(report.platform_fee_cents)}
        />
        <StatCard label="Creator pool (89%)" value={centsToDollarString(report.pool_cents)} />
        <StatCard
          label="Distributed to creators"
          value={centsToDollarString(report.distributed_cents)}
          caption={
            report.undistributed_idle_cents > 0
              ? `${centsToDollarString(report.undistributed_idle_cents)} held for Care Fund`
              : undefined
          }
          warning={report.undistributed_idle_cents > 0}
        />
      </div>
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mb-6">
        <StatCard label="Paying members" value={report.paying_members.toLocaleString()} />
        <StatCard
          label="Idle members"
          value={report.idle_members.toLocaleString()}
          caption="No qualified listening this month"
        />
        <StatCard label="Creators earning" value={report.creators_earning.toLocaleString()} />
        <StatCard
          label="Fraud holds"
          value={report.fraud_holds.count.toLocaleString()}
          caption={
            report.fraud_holds.count > 0
              ? `${centsToDollarString(report.fraud_holds.held_cents)} held pending review`
              : "No earnings held this period"
          }
          warning={report.fraud_holds.count > 0}
        />
      </div>

      {/* Idle pool */}
      <Card className="bg-card border-border mb-6">
        <CardHeader>
          <CardTitle className="text-foreground">Idle pool</CardTitle>
          <CardDescription>
            Share of the pool from members with no qualified listening this month.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-2xl font-semibold text-foreground tabular-nums">
              {centsToDollarString(report.idle_pool_cents)}
            </span>
            <span className="text-sm text-muted-foreground">
              from {report.idle_members.toLocaleString()} idle{" "}
              {report.idle_members === 1 ? "member" : "members"} —{" "}
              {careFundMode
                ? "reserved for the Care Fund, not distributed"
                : "redistributed to creators by listening share"}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Top concentrations */}
      <Card className="bg-card border-border mb-6">
        <CardHeader>
          <CardTitle className="text-foreground">Top concentrations</CardTitle>
          <CardDescription>
            Largest creator shares of the pool — an outsized share from few members is the thing to
            check before approving.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {report.top_creators.length === 0 ? (
            <p className="text-center text-muted-foreground py-8 text-sm">
              No creator earnings this period.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Creator</TableHead>
                  <TableHead className="text-right">Earned</TableHead>
                  <TableHead className="w-[40%]">Share of pool</TableHead>
                  <TableHead className="text-right">Members</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.top_creators.map((c) => (
                  <TableRow key={c.creator_id}>
                    <TableCell className="font-medium text-foreground">{c.creator_name}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {centsToDollarString(c.earned_cents)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-2 flex-1 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${Math.min(c.share_of_pool * 100, 100)}%` }}
                          />
                        </div>
                        <span className="text-sm tabular-nums w-14 text-right">
                          {rateToPercentString(c.share_of_pool)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {c.member_count.toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Payout batches */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Payout batches</CardTitle>
          <CardDescription>Transfer runs executed after approval.</CardDescription>
        </CardHeader>
        <CardContent>
          {report.payout_batches.length === 0 ? (
            <p className="text-center text-muted-foreground py-8 text-sm">
              {report.shadow_mode ? "No payouts — shadow mode." : "No payout batches yet."}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Sent</TableHead>
                  <TableHead className="text-right">Total sent</TableHead>
                  <TableHead className="text-right">Skipped</TableHead>
                  <TableHead className="text-right">Blocked</TableHead>
                  <TableHead className="text-right">Failed</TableHead>
                  <TableHead className="text-right">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.payout_batches.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className="bg-muted text-muted-foreground border-border text-xs capitalize"
                      >
                        {b.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{b.sent_count}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {centsToDollarString(b.total_sent_cents)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{b.skipped_count}</TableCell>
                    <TableCell className="text-right tabular-nums">{b.blocked_count}</TableCell>
                    <TableCell className="text-right tabular-nums">{b.failed_count}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {format(new Date(b.created_at), "MMM d, yyyy")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {report.status === "approved" && !report.shadow_mode && (
        <p className="mt-4 text-sm text-muted-foreground flex items-center gap-1.5">
          <CheckCircle className="w-4 h-4 text-green-400" />
          Numbers are frozen — payouts run from this snapshot.
        </p>
      )}
    </div>
  )
}

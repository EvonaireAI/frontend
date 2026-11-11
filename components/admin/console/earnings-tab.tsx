"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ShadowModeBanner } from "@/components/admin/royalties/shadow-mode-banner"
import { centsToDollarString } from "@/lib/metrics"
import { periodLabel } from "@/lib/listening"
import {
  royaltiesService,
  RoyaltiesForbiddenError,
  PERIOD_STATUS_CHIPS,
  type RoyaltyPeriodList,
} from "@/lib/royalties"
import { RefreshCw } from "lucide-react"
import { fmtLocale, tr } from "@/lib/i18n"


// Creator Earnings — the Session 05 royalty periods list, moved under this tab.
// The per-period report and the approve flow keep their own route at
// /admin/royalties/<id>; a row click still goes there.

export function EarningsTab() {
  const router = useRouter()
  const [data, setData] = useState<RoyaltyPeriodList | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      setData(await royaltiesService.getPeriods())
    } catch (err) {
      if (err instanceof RoyaltiesForbiddenError) {
        setError(true)
        return
      }
      console.error("Failed to load royalty periods:", err)
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-12 w-full" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
          <span>{tr("Failed to load royalty periods.")}</span>
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw className="mr-2 h-4 w-4" />
            {tr("Retry")}
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  if (!data) return null

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {tr("Monthly royalty periods — 89% of member fees to creators, 11% platform fee. Review a period's report before approving it.")}
        </p>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="mr-2 h-4 w-4" />
          {tr("Refresh")}
        </Button>
      </div>

      {data.shadow_mode && <ShadowModeBanner />}

      {data.periods.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="py-8 text-center text-muted-foreground">
              {tr("No royalty periods yet. The first period appears after a month closes and computes.")}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="w-full overflow-x-auto rounded-lg border border-border">
          <Table className="min-w-[48rem]">
            <TableHeader>
              <TableRow>
                <TableHead>{tr("Period")}</TableHead>
                <TableHead>{tr("Status")}</TableHead>
                <TableHead className="text-right">{tr("Gross")}</TableHead>
                <TableHead className="text-right">{tr("Platform fee (11%)")}</TableHead>
                <TableHead className="text-right">{tr("Creator pool (89%)")}</TableHead>
                <TableHead className="text-right">{tr("Paying members")}</TableHead>
                <TableHead className="text-right">{tr("Idle members")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.periods.map((period) => {
                const chip = PERIOD_STATUS_CHIPS[period.status] ?? {
                  label: period.status,
                  className: "bg-muted text-muted-foreground border-border",
                }
                return (
                  <TableRow
                    key={period.id}
                    onClick={() => router.push(`/admin/royalties/${period.id}`)}
                    className="cursor-pointer"
                  >
                    <TableCell className="font-medium text-foreground">{periodLabel(period.period)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`${chip.className} text-xs`}>
                        {chip.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {centsToDollarString(period.gross_cents)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {centsToDollarString(period.platform_fee_cents)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {centsToDollarString(period.pool_cents)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {period.paying_members.toLocaleString(fmtLocale())}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{period.idle_members.toLocaleString(fmtLocale())}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

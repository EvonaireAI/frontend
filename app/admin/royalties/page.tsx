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
import { authService, type User } from "@/lib/auth"
import { centsToDollarString } from "@/lib/metrics"
import { periodLabel } from "@/lib/listening"
import {
  royaltiesService,
  RoyaltiesForbiddenError,
  PERIOD_STATUS_CHIPS,
  type RoyaltyPeriodList,
} from "@/lib/royalties"
import { Loader2, RefreshCw } from "lucide-react"

export default function AdminRoyaltiesPage() {
  const [user, setUser] = useState<User | null>(null)
  const [checkingAccess, setCheckingAccess] = useState(true)
  const router = useRouter()

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
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">Royalties</h1>
          <p className="text-muted-foreground mt-1">
            Monthly royalty periods — 89% of member fees to creators, 11% platform fee. Review a
            period&apos;s report before approving it.
          </p>
        </div>
        <PeriodList />
      </div>
    </div>
  )
}

function PeriodList() {
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
        router.replace("/dashboard")
        return
      }
      console.error("Failed to load royalty periods:", err)
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    load()
  }, [load])

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription className="flex items-center justify-between gap-4 flex-wrap">
          <span>Failed to load royalty periods.</span>
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  if (!data) return null

  return (
    <>
      {data.shadow_mode && <ShadowModeBanner />}

      {data.periods.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground py-8">
              No royalty periods yet. The first period appears after a month closes and computes.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Gross</TableHead>
                  <TableHead className="text-right">Platform fee (11%)</TableHead>
                  <TableHead className="text-right">Creator pool (89%)</TableHead>
                  <TableHead className="text-right">Paying members</TableHead>
                  <TableHead className="text-right">Idle members</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.periods.map((p) => {
                  const chip = PERIOD_STATUS_CHIPS[p.status] ?? {
                    label: p.status,
                    className: "bg-muted text-muted-foreground border-border",
                  }
                  return (
                    <TableRow
                      key={p.id}
                      onClick={() => router.push(`/admin/royalties/${p.id}`)}
                      className="cursor-pointer"
                    >
                      <TableCell className="font-medium text-foreground">
                        {periodLabel(p.period)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`${chip.className} text-xs`}>
                          {chip.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {centsToDollarString(p.gross_cents)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {centsToDollarString(p.platform_fee_cents)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {centsToDollarString(p.pool_cents)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {p.paying_members.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {p.idle_members.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </>
  )
}

"use client"

// Creator studio panel — the /api/v1/creator/ surface: earnings balance,
// gross payable, and payout state from the v1 financial ledger.

import { useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Banknote, Coins, Receipt } from "lucide-react"
import { v1Creator, V1Error } from "@/lib/v1"

export function V1StudioPanel() {
  const [earnings, setEarnings] = useState<{ available_balance: string; lifetime: string } | null>(null)
  const [revenue, setRevenue] = useState<{ gross_payable: string } | null>(null)
  const [payouts, setPayouts] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(true)
  const [unavailable, setUnavailable] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [earn, rev, pays] = await Promise.all([
          v1Creator.earnings().catch(() => null),
          v1Creator.revenue().catch(() => null),
          v1Creator.payouts().catch(() => ({ results: [] })),
        ])
        if (cancelled) return
        if (!earn && !rev) {
          setUnavailable(true)
          return
        }
        setEarnings(earn)
        setRevenue(rev)
        setPayouts(pays.results)
      } catch (error) {
        if (!cancelled && error instanceof V1Error) setUnavailable(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (unavailable) return null

  const lastPayout = payouts[0] as { status?: string; amount?: string } | undefined

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-foreground">
          <Coins className="w-5 h-5 text-primary" />
          Marketplace earnings
        </CardTitle>
        <CardDescription>From the /api/v1/ creator ledger</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <Skeleton className="h-16 w-full" />
        ) : (
          <>
            {earnings && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-2">
                  <Banknote className="w-4 h-4" /> Available balance
                </span>
                <span className="font-medium text-foreground">
                  ${earnings.available_balance}
                </span>
              </div>
            )}
            {revenue && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-2">
                  <Receipt className="w-4 h-4" /> Gross payable
                </span>
                <span className="font-medium text-foreground">
                  ${revenue.gross_payable}
                </span>
              </div>
            )}
            {lastPayout && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Latest payout</span>
                <Badge variant="secondary" className="text-xs">
                  {lastPayout.status} {lastPayout.amount ? `$${lastPayout.amount}` : ""}
                </Badge>
              </div>
            )}
            <Link href="/creator/payouts" className="text-xs text-primary hover:underline">
              Manage payouts
            </Link>
          </>
        )}
      </CardContent>
    </Card>
  )
}

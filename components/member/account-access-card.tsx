"use client"

// Account access card — the Seeker-side view of the /api/v1/ contract:
// granted scopes (me/permissions), active entitlements (me/entitlements),
// and recent purchases (me/purchases).

import { useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { KeyRound, Receipt, ShieldCheck } from "lucide-react"
import {
  v1Gateway,
  v1Finance,
  V1Error,
  type MePermissions,
  type V1License,
  type Purchase,
} from "@/lib/v1"

export function AccountAccessCard() {
  const [permissions, setPermissions] = useState<MePermissions | null>(null)
  const [licenses, setLicenses] = useState<V1License[]>([])
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [loading, setLoading] = useState(true)
  const [unavailable, setUnavailable] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [perms, ents, buys] = await Promise.all([
          v1Gateway.permissions(),
          v1Finance.entitlements().catch(() => ({ licenses: [] })),
          v1Finance.purchases().catch(() => ({ results: [] })),
        ])
        if (cancelled) return
        setPermissions(perms)
        setLicenses(ents.licenses)
        setPurchases(buys.results)
      } catch (error) {
        // v1 surface not reachable (older backend) — hide the card rather
        // than break the dashboard.
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

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-foreground">
          <ShieldCheck className="w-5 h-5 text-primary" />
          Your access
        </CardTitle>
        <CardDescription>
          Permissions and purchases granted on your account
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <Skeleton className="h-16 w-full" />
        ) : (
          <>
            {permissions && (
              <div className="flex flex-wrap gap-1.5">
                {permissions.scopes.map((scope) => (
                  <Badge key={scope} variant="secondary" className="text-xs">
                    {scope.replace(/_/g, " ")}
                  </Badge>
                ))}
              </div>
            )}
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-2">
                <KeyRound className="w-4 h-4" /> Active licenses
              </span>
              <span className="font-medium text-foreground">{licenses.length}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-2">
                <Receipt className="w-4 h-4" /> Purchases
              </span>
              <span className="font-medium text-foreground">{purchases.length}</span>
            </div>
            {purchases.length > 0 && (
              <Link
                href="/member/ledger"
                className="text-xs text-primary hover:underline"
              >
                View the full ledger
              </Link>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

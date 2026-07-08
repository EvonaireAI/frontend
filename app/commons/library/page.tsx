"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Library, Music, Play, Gift, RefreshCw, Store } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import {
  fetchPurchases,
  formatPrice,
  type Purchase,
} from "@/lib/commons"
import { LicenseChip } from "@/components/commons/listing-chips"

// Factual status line for a non-active entry — no shaming language.
function statusLine(p: Purchase): string {
  if (p.status === "revoked") return "Refunded"
  if (p.status === "expired") return p.source === "gift" ? "Gift expired" : "Expired"
  return ""
}

function sourceLabel(p: Purchase): string {
  if (p.source === "gift") {
    return p.expires_at ? `Gift · expires ${format(new Date(p.expires_at), "MMM d, yyyy")}` : "Gift"
  }
  if (p.source === "membership") return "Included with membership"
  return ""
}

export default function PurchasesLibraryPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setPurchases(await fetchPurchases())
    } catch {
      setError("We couldn't load your purchases right now.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.replace("/auth/login")
      return
    }
    load()
  }, [authLoading, user, router, load])

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <Library className="w-5 h-5 text-primary" />
          <h1 className="text-3xl font-bold text-foreground">My purchases</h1>
        </div>
        <p className="text-muted-foreground">
          Offerings you own from the Commons — purchases, gifts and membership perks.
        </p>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription className="flex items-center justify-between gap-4 flex-wrap">
            <span>{error}</span>
            <Button variant="outline" size="sm" onClick={load}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="bg-card border-border">
              <CardContent className="p-5 space-y-3">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-6 w-1/2" />
                <Skeleton className="h-4 w-40" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : purchases.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-border rounded-2xl">
          <Library className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-foreground font-medium">Nothing here yet</p>
          <p className="text-sm text-muted-foreground mt-1 mb-5">
            Offerings you buy or receive as gifts will appear here.
          </p>
          <Button asChild variant="outline">
            <Link href="/commons" className="flex items-center gap-2">
              <Store className="w-4 h-4" />
              Browse the Commons
            </Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {purchases.map((p) => {
            const isActive = p.status === "active"
            const line = statusLine(p)
            const source = sourceLabel(p)
            return (
              <Card
                key={p.id}
                className={`bg-card border-border ${isActive ? "" : "opacity-60"}`}
              >
                <CardContent className="p-5 flex items-start justify-between gap-4 flex-wrap">
                  <div className="space-y-2 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <LicenseChip level={p.listing.license_level} />
                      {p.source === "gift" && (
                        <Badge
                          variant="outline"
                          className="bg-secondary text-secondary-foreground border-border text-xs gap-1"
                        >
                          <Gift className="w-3 h-3" />
                          Gift
                        </Badge>
                      )}
                    </div>
                    <h3 className="text-lg font-semibold text-foreground">{p.listing.title}</h3>
                    <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
                      {source && <span>{source}</span>}
                      {p.order && (
                        <span>
                          {formatPrice(p.order.amount_cents, p.order.currency)}
                          {p.order.paid_at
                            ? ` · ${format(new Date(p.order.paid_at), "MMM d, yyyy")}`
                            : ""}
                        </span>
                      )}
                      {line && <span className="text-foreground/70 font-medium">{line}</span>}
                    </div>
                    {p.listing.ritual && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Music className="w-3.5 h-3.5" />
                        <span>{p.listing.ritual.title}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/commons/listings/${p.listing.id}`}>Details</Link>
                    </Button>
                    {/* Only active entries link to playback. */}
                    {isActive && p.listing.ritual && (
                      <Button asChild size="sm">
                        <Link
                          href={`/member/ritual/${p.listing.ritual.id}`}
                          className="flex items-center gap-2"
                        >
                          <Play className="w-4 h-4" />
                          Play
                        </Link>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

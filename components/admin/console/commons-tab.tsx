"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { ArrowRight, Store } from "lucide-react"
import { ReviewQueuePanel } from "@/components/commons/review-queue-panel"
import { fetchListings, formatPrice, licenseLabel, type Listing } from "@/lib/commons"

// The Commons — the Session 07 marketplace surfaces: the listing review queue
// (shared with the Guardian Sacred Library tab) plus what's currently published.

export function CommonsTab() {
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [pendingCount, setPendingCount] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const page = await fetchListings({})
      setListings(page.listings)
    } catch {
      setListings([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const averagePrice =
    listings.length > 0
      ? Math.round(listings.reduce((sum, listing) => sum + listing.price_cents, 0) / listings.length)
      : 0

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs text-muted-foreground">Published listings</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-foreground">
            {loading ? "—" : listings.length.toLocaleString()}
          </p>
        </div>
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs text-muted-foreground">Awaiting review</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-foreground">
            {pendingCount === null ? "—" : pendingCount.toLocaleString()}
          </p>
        </div>
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs text-muted-foreground">Average price</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-foreground">
            {loading ? "—" : formatPrice(averagePrice)}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Listing review queue</CardTitle>
          <CardDescription>The same queue guardians work from the Sacred Library.</CardDescription>
        </CardHeader>
        <CardContent>
          <ReviewQueuePanel onCountChange={setPendingCount} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Store className="h-5 w-5 text-primary" />
                Published listings
              </CardTitle>
              <CardDescription>What members can buy right now.</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/commons">
                Browse The Commons
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-14 w-full" />
              ))}
            </div>
          ) : listings.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Nothing is published yet.</p>
          ) : (
            <div className="space-y-2">
              {listings.slice(0, 10).map((listing) => (
                <div
                  key={listing.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/commons/listings/${listing.id}`}
                      className="break-words font-medium text-foreground hover:text-primary hover:underline"
                    >
                      {listing.title}
                    </Link>
                    <p className="break-all text-xs text-muted-foreground">{listing.creator.display_name}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {licenseLabel(listing.license_level)}
                    </Badge>
                    <span className="text-sm font-medium tabular-nums text-foreground">
                      {formatPrice(listing.price_cents, listing.currency)}
                    </span>
                  </div>
                </div>
              ))}
              {listings.length > 10 && (
                <p className="pt-1 text-xs text-muted-foreground">
                  Showing 10 of {listings.length.toLocaleString()} — browse The Commons for the rest.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

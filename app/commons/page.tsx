"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Store, Sparkles, Library, RefreshCw, Loader2 } from "lucide-react"
import {
  fetchListings,
  type Listing,
  type LicenseLevel,
} from "@/lib/commons"
import { ListingCard } from "@/components/commons/listing-card"

type LicenseFilter = "all" | LicenseLevel
type PriceFilter = "all" | "free" | "paid"

export default function CommonsBrowsePage() {
  const [listings, setListings] = useState<Listing[]>([])
  const [nextBefore, setNextBefore] = useState<number | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [isScholar, setIsScholar] = useState(false)

  const [license, setLicense] = useState<LicenseFilter>("all")
  const [price, setPrice] = useState<PriceFilter>("all")

  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const buildFilters = useCallback(
    (before?: number) => {
      const filters: Parameters<typeof fetchListings>[0] = {}
      if (license !== "all") filters.license_level = license
      // max_price=0 → free only. Paid uses min_price=1.
      if (price === "free") filters.max_price = 0
      if (price === "paid") filters.min_price = 1
      if (before !== undefined) filters.before = before
      return filters
    },
    [license, price],
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const page = await fetchListings(buildFilters())
      setListings(page.listings)
      setNextBefore(page.next_before)
      setHasMore(page.has_more)
      setIsScholar(page.is_scholar)
    } catch {
      setError("We couldn't load the Commons right now.")
    } finally {
      setLoading(false)
    }
  }, [buildFilters])

  useEffect(() => {
    load()
  }, [load])

  const loadMore = async () => {
    if (nextBefore === null) return
    setLoadingMore(true)
    try {
      const page = await fetchListings(buildFilters(nextBefore))
      setListings((prev) => [...prev, ...page.listings])
      setNextBefore(page.next_before)
      setHasMore(page.has_more)
    } catch {
      setError("We couldn't load more listings.")
    } finally {
      setLoadingMore(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Store className="w-5 h-5 text-primary" />
            <h1 className="text-3xl font-bold text-foreground">The Commons</h1>
          </div>
          <p className="text-muted-foreground">
            One-off offerings from creators — classes, care sessions, bundles and premium rituals.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/commons/library" className="flex items-center gap-2">
            <Library className="w-4 h-4" />
            My purchases
          </Link>
        </Button>
      </div>

      {isScholar && (
        <div className="mb-6 flex items-center gap-2 text-sm text-primary bg-primary/10 border border-primary/20 rounded-lg px-4 py-2.5">
          <Sparkles className="w-4 h-4 flex-shrink-0" />
          You&apos;re a Scholar — you&apos;re seeing early-access offerings before everyone else.
        </div>
      )}

      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-center gap-6">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">License</span>
          <ToggleGroup
            type="single"
            value={license}
            onValueChange={(v) => v && setLicense(v as LicenseFilter)}
            variant="outline"
            size="sm"
          >
            <ToggleGroupItem value="all">All</ToggleGroupItem>
            <ToggleGroupItem value="L1_open">L1 · Open</ToggleGroupItem>
            <ToggleGroupItem value="L2_guided">L2 · Guided</ToggleGroupItem>
          </ToggleGroup>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Price</span>
          <ToggleGroup
            type="single"
            value={price}
            onValueChange={(v) => v && setPrice(v as PriceFilter)}
            variant="outline"
            size="sm"
          >
            <ToggleGroupItem value="all">All</ToggleGroupItem>
            <ToggleGroupItem value="free">Free</ToggleGroupItem>
            <ToggleGroupItem value="paid">Paid</ToggleGroupItem>
          </ToggleGroup>
        </div>
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="bg-card border-border">
              <CardContent className="p-5 space-y-3">
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : listings.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-border rounded-2xl">
          <Store className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-foreground font-medium">Nothing here yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            No offerings match these filters right now — check back soon.
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>

          {hasMore && (
            <div className="flex justify-center mt-8">
              <Button variant="outline" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Loading…
                  </>
                ) : (
                  "Load more"
                )}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

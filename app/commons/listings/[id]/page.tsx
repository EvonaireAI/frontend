"use client"

import { Suspense, useCallback, useEffect, useState } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { format } from "date-fns"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { toast } from "sonner"
import {
  ArrowLeft,
  Music,
  Play,
  Check,
  Sparkles,
  Loader2,
  ShoppingCart,
} from "lucide-react"
import {
  checkoutListing,
  fetchListing,
  formatPrice,
  CommonsApiError,
  type Listing,
} from "@/lib/commons"
import { LicenseChip, EarlyAccessBadge } from "@/components/commons/listing-chips"

function DetailContent() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const id = Number(params.id)
  const cancelled = searchParams.get("checkout") === "cancelled"

  const [listing, setListing] = useState<Listing | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [earlyAccessLocked, setEarlyAccessLocked] = useState(false)
  const [buying, setBuying] = useState(false)

  const load = useCallback(async () => {
    if (!Number.isFinite(id)) {
      setNotFound(true)
      setLoading(false)
      return
    }
    setLoading(true)
    setNotFound(false)
    setEarlyAccessLocked(false)
    try {
      const data = await fetchListing(id)
      setListing(data)
    } catch (err) {
      if (err instanceof CommonsApiError && err.isEarlyAccess) {
        setEarlyAccessLocked(true)
      } else if (err instanceof CommonsApiError && err.status === 404) {
        setNotFound(true)
      } else {
        setNotFound(true)
      }
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  const handleBuy = async () => {
    if (!listing) return
    setBuying(true)
    try {
      const origin = window.location.origin
      const result = await checkoutListing(listing.id, {
        success_url: `${origin}/commons/purchase/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/commons/listings/${listing.id}?checkout=cancelled`,
      })
      if (result.free) {
        // Granted instantly, no redirect — flip to the owned state.
        toast.success("Added to your library")
        setListing({ ...listing, has_access: true })
      } else {
        // Same redirect pattern as the subscription checkout.
        window.location.href = result.session_url
      }
    } catch (err) {
      if (err instanceof CommonsApiError && err.isEarlyAccess) {
        setEarlyAccessLocked(true)
      } else {
        toast.error(err instanceof Error ? err.message : "Checkout failed")
      }
      setBuying(false)
    }
  }

  // ── Loading ──
  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <Skeleton className="h-4 w-32 mb-6" />
        <Card className="bg-card border-border">
          <CardContent className="p-6 space-y-4">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-11 w-40" />
          </CardContent>
        </Card>
      </div>
    )
  }

  // ── Scholar early-access upsell (403 entitlement_denied, reason=early_access) ──
  if (earlyAccessLocked) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <BackLink />
        <Card className="bg-card border-primary/30">
          <CardContent className="p-8 text-center">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-5">
              <Sparkles className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-2xl font-semibold text-foreground mb-2">
              Early access for Scholars
            </h1>
            <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
              This offering is available to Scholars first. It opens to everyone else soon —
              upgrade to Scholar to experience it now.
            </p>
            <Button asChild size="lg">
              <Link href="/member/upgrade">Upgrade to Scholar</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ── Not found / unpublished ──
  if (notFound || !listing) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <BackLink />
        <div className="text-center py-20 border border-dashed border-border rounded-2xl">
          <p className="text-foreground font-medium">Offering not found</p>
          <p className="text-sm text-muted-foreground mt-1">
            This listing isn&apos;t available, or hasn&apos;t been published.
          </p>
          <Button asChild variant="outline" className="mt-5">
            <Link href="/commons">Back to the Commons</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <BackLink />

      {cancelled && (
        <Alert className="mb-6">
          <AlertDescription>Checkout cancelled — no charge was made.</AlertDescription>
        </Alert>
      )}

      <Card className="bg-card border-border">
        <CardContent className="p-6 space-y-5">
          <div className="flex items-center gap-2 flex-wrap">
            <LicenseChip level={listing.license_level} />
            {listing.early_access && <EarlyAccessBadge earlyAccess={listing.early_access} />}
          </div>

          <div>
            <h1 className="text-3xl font-bold text-foreground leading-tight">{listing.title}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              by {listing.creator.display_name}
            </p>
          </div>

          <p className="text-foreground/90 leading-relaxed">{listing.summary}</p>

          {listing.ritual && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-secondary/50 rounded-lg px-3 py-2 w-fit">
              <Music className="w-4 h-4" />
              <span>Includes ritual: {listing.ritual.title}</span>
            </div>
          )}

          <div className="flex items-center justify-between pt-4 border-t border-border">
            <span className="text-2xl font-semibold text-foreground">
              {formatPrice(listing.price_cents, listing.currency)}
            </span>

            {listing.has_access ? (
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5 text-sm text-primary font-medium">
                  <Check className="w-4 h-4" />
                  In your library
                </span>
                {listing.ritual && (
                  <Button asChild>
                    <Link href={`/member/ritual/${listing.ritual.id}`} className="flex items-center gap-2">
                      <Play className="w-4 h-4" />
                      Play ritual
                    </Link>
                  </Button>
                )}
              </div>
            ) : (
              <Button size="lg" onClick={handleBuy} disabled={buying}>
                {buying ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Starting checkout…
                  </>
                ) : (
                  <>
                    <ShoppingCart className="w-4 h-4 mr-2" />
                    {listing.price_cents === 0 ? "Add to library" : "Buy"}
                  </>
                )}
              </Button>
            )}
          </div>

          {listing.early_access?.active && (
            <p className="text-xs text-muted-foreground">
              Scholars have early access. Everyone else on{" "}
              {format(new Date(listing.early_access.until), "MMMM d, yyyy")}.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function BackLink() {
  return (
    <Link
      href="/commons"
      className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
    >
      <ArrowLeft className="w-4 h-4" />
      The Commons
    </Link>
  )
}

export default function ListingDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[40vh] flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      }
    >
      <DetailContent />
    </Suspense>
  )
}

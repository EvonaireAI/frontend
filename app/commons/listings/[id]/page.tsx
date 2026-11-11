"use client"

import { Suspense, useCallback, useEffect, useState } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"

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
  defaultRegion,
  regionName,
  REGION_CODES,
  CommonsApiError,
  type Listing,
} from "@/lib/commons"
import { isAllowedExternalUrl } from "@/lib/external-navigation"
import { LicenseChip, EarlyAccessBadge } from "@/components/commons/listing-chips"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { formatDate,tr, trNode  } from "@/lib/i18n"


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
  const [region, setRegion] = useState("US")
  const [consent, setConsent] = useState(false)

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

  // Region-restricted listings only offer their allowed codes; unrestricted
  // listings get the full ISO list. The default follows the browser locale.
  const regionOptions =
    listing?.regions && listing.regions.length > 0 ? listing.regions : REGION_CODES

  useEffect(() => {
    if (!listing) return
    const preferred = defaultRegion()
    setRegion(regionOptions.includes(preferred) ? preferred : regionOptions[0] ?? "US")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listing?.id])

  const handleBuy = async () => {
    if (!listing) return
    setBuying(true)
    try {
      const result = await checkoutListing(listing.id, {
        region,
        consent_checked: consent,
      })
      if (result.free) {
        // Granted instantly, no redirect — flip to the owned state.
        toast.success(tr("Added to your library"))
        setListing({ ...listing, has_access: true })
      } else if (isAllowedExternalUrl(result.session_url)) {
        // Same redirect pattern as the subscription checkout.
        window.location.href = result.session_url
      } else {
        throw new Error(tr("Checkout returned an unexpected URL"))
      }
    } catch (err) {
      if (err instanceof CommonsApiError && err.isEarlyAccess) {
        setEarlyAccessLocked(true)
      } else {
        toast.error(err instanceof Error ? err.message : tr("Checkout failed"))
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
              {tr("Early access for Scholars")}
            </h1>
            <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
              {tr("This offering is available to Scholars first. It opens to everyone else soon — upgrade to Scholar to experience it now.")}
            </p>
            <Button asChild size="lg">
              <Link href="/member/upgrade">{tr("Upgrade to Scholar")}</Link>
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
          <p className="text-foreground font-medium">{tr("Offering not found")}</p>
          <p className="text-sm text-muted-foreground mt-1">
            {tr("This listing isn't available, or hasn't been published.")}
          </p>
          <Button asChild variant="outline" className="mt-5">
            <Link href="/commons">{tr("Back to the Symposium")}</Link>
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
          <AlertDescription>{tr("Checkout cancelled — no charge was made.")}</AlertDescription>
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
              {trNode("by {p0}", { p0: listing.creator.display_name })}
            </p>
          </div>

          <p className="text-foreground/90 leading-relaxed">{listing.summary}</p>

          {listing.ritual && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-secondary/50 rounded-lg px-3 py-2 w-fit">
              <Music className="w-4 h-4" />
              <span>{trNode("Includes ritual: {p0}", { p0: listing.ritual.title })}</span>
            </div>
          )}

          {!listing.has_access && (
            <div className="space-y-4 border-t border-border pt-5">
              <p className="text-xs text-muted-foreground">
                {tr("Personal, non-transferable. No AI training.")}
              </p>
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">{tr("Region")}</span>
                <Select value={region} onValueChange={setRegion}>
                  <SelectTrigger className="w-64">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {regionOptions.map((code) => (
                      <SelectItem key={code} value={code}>
                        {regionName(code)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <label className="flex items-start gap-2.5 text-sm text-foreground/90 cursor-pointer w-fit">
                <Checkbox
                  checked={consent}
                  onCheckedChange={(v) => setConsent(v === true)}
                  className="mt-0.5"
                />
                <span>
                  {tr("I agree to the license terms for this offering.")}
                </span>
              </label>
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
                  {tr("In your library")}
                </span>
                {listing.ritual && (
                  <Button asChild>
                    <Link href={`/member/ritual/${listing.ritual.id}`} className="flex items-center gap-2">
                      <Play className="w-4 h-4" />
                      {tr("Play ritual")}
                    </Link>
                  </Button>
                )}
              </div>
            ) : (
              <Button size="lg" onClick={handleBuy} disabled={buying || !consent}>
                {buying ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {tr("Starting checkout…")}
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
              {trNode("Scholars have early access. Everyone else on {p0}.", { p0: formatDate(new Date(listing.early_access.until), "MMMM d, yyyy") })}
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
      className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors cursor-pointer"
    >
      <ArrowLeft className="w-4 h-4" />
      {tr("The Symposium")}
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

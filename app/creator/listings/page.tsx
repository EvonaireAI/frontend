"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { toast } from "sonner"
import {
  Store,
  Plus,
  Pencil,
  Send,
  Pause,
  Play,
  Gift,
  RefreshCw,
  Music,
  Banknote,
  Loader2,
} from "lucide-react"
import { authService, type Ritual } from "@/lib/auth"
import {
  fetchMyListings,
  submitForReview,
  pauseListing,
  resumeListing,
  formatPrice,
  CommonsApiError,
  type MyListing,
  type ListingStatus,
} from "@/lib/commons"
import { LicenseChip } from "@/components/commons/listing-chips"
import { ListingFormDialog } from "@/components/commons/listing-form-dialog"
import { GiftDialog } from "@/components/commons/gift-dialog"

const STATUS_META: Record<ListingStatus, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-secondary text-secondary-foreground border-border" },
  pending_review: {
    label: "In review",
    className: "bg-gold-muted/10 text-gold-muted border-gold-muted/30",
  },
  published: { label: "Published", className: "bg-primary/10 text-primary border-primary/30" },
  paused: { label: "Paused", className: "bg-muted text-muted-foreground border-border" },
  rejected: { label: "Needs changes", className: "bg-destructive/10 text-destructive border-destructive/30" },
}

export default function CreatorListingsPage() {
  const router = useRouter()
  const [authChecked, setAuthChecked] = useState(false)
  const [listings, setListings] = useState<MyListing[]>([])
  const [rituals, setRituals] = useState<Ritual[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  // Per-listing busy + payout-gate state
  const [busyId, setBusyId] = useState<number | null>(null)
  const [connectBlockedId, setConnectBlockedId] = useState<number | null>(null)

  // Dialogs
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<MyListing | null>(null)
  const [giftOpen, setGiftOpen] = useState(false)
  const [gifting, setGifting] = useState<MyListing | null>(null)

  useEffect(() => {
    const check = async () => {
      try {
        if (!authService.isAuthenticated()) {
          router.push("/auth/login")
          return
        }
        const user = await authService.getProfile()
        if (user.role !== "creator") {
          router.push("/dashboard")
          return
        }
        setAuthChecked(true)
      } catch {
        router.push("/auth/login")
      }
    }
    check()
  }, [router])

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const [myListings, myRituals] = await Promise.all([
        fetchMyListings(),
        authService.getMyRituals().catch(() => [] as Ritual[]),
      ])
      setListings(myListings)
      setRituals(myRituals)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (authChecked) load()
  }, [authChecked, load])

  const upsertListing = (saved: MyListing) => {
    setListings((prev) => {
      const idx = prev.findIndex((l) => l.id === saved.id)
      if (idx === -1) return [saved, ...prev]
      const next = [...prev]
      next[idx] = saved
      return next
    })
  }

  // Wraps a mutating action with per-listing busy state and connect-gate handling.
  const runAction = async (
    id: number,
    action: () => Promise<MyListing>,
    successMsg: string,
  ) => {
    setBusyId(id)
    setConnectBlockedId(null)
    try {
      const updated = await action()
      upsertListing(updated)
      toast.success(successMsg)
    } catch (err) {
      if (err instanceof CommonsApiError && err.code === "connect_not_ready") {
        setConnectBlockedId(id)
      } else {
        toast.error(err instanceof Error ? err.message : "Something went wrong")
      }
    } finally {
      setBusyId(null)
    }
  }

  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }
  const openEdit = (listing: MyListing) => {
    setEditing(listing)
    setFormOpen(true)
  }
  const openGift = (listing: MyListing) => {
    setGifting(listing)
    setGiftOpen(true)
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Store className="w-5 h-5 text-primary" />
            <h1 className="text-3xl font-bold text-foreground">My listings</h1>
          </div>
          <p className="text-muted-foreground">
            Sell one-off offerings in the Commons — draft, submit for review, then publish.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="w-4 h-4 mr-2" />
          New listing
        </Button>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription className="flex items-center justify-between gap-4 flex-wrap">
            <span>We couldn&apos;t load your listings.</span>
            <Button variant="outline" size="sm" onClick={load}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {loading || !authChecked ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="bg-card border-border">
              <CardContent className="p-5 space-y-3">
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-6 w-1/2" />
                <Skeleton className="h-9 w-56" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : listings.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-border rounded-2xl">
          <Store className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-foreground font-medium">No listings yet</p>
          <p className="text-sm text-muted-foreground mt-1 mb-5">
            Create your first offering to sell it in the Commons.
          </p>
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4 mr-2" />
            New listing
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {listings.map((listing) => {
            const meta = STATUS_META[listing.status]
            const busy = busyId === listing.id
            const canEditFull = listing.status === "draft" || listing.status === "rejected"
            const canEditEarlyAccess = listing.status === "published" || listing.status === "paused"
            return (
              <Card key={listing.id} className="bg-card border-border">
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="space-y-2 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className={`${meta.className} text-xs`}>
                          {meta.label}
                        </Badge>
                        <LicenseChip level={listing.license_level} />
                        <span className="text-sm font-medium text-foreground">
                          {formatPrice(listing.price_cents, listing.currency)}
                        </span>
                      </div>
                      <h3 className="text-lg font-semibold text-foreground">{listing.title}</h3>
                      <p className="text-sm text-muted-foreground line-clamp-2">{listing.summary}</p>
                      {listing.ritual && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Music className="w-3.5 h-3.5" />
                          <span>{listing.ritual.title}</span>
                        </div>
                      )}
                      {listing.early_access_until && (
                        <p className="text-xs text-muted-foreground">
                          Scholar early access until{" "}
                          {format(new Date(listing.early_access_until), "MMM d, yyyy")}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Rejection note — surfaced verbatim, no shaming copy. */}
                  {listing.status === "rejected" && listing.review_note && (
                    <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5">
                      <p className="text-xs font-medium text-destructive mb-0.5">
                        Reviewer note
                      </p>
                      <p className="text-sm text-foreground/90">{listing.review_note}</p>
                    </div>
                  )}

                  {/* Payout gate (connect_not_ready) surfaced on submit/resume. */}
                  {connectBlockedId === listing.id && (
                    <Alert>
                      <AlertDescription className="flex items-center justify-between gap-3 flex-wrap">
                        <span className="text-sm">
                          Finish your payout setup before publishing a paid offering.
                        </span>
                        <Button asChild size="sm" variant="outline">
                          <Link href="/creator/payouts" className="flex items-center gap-2">
                            <Banknote className="w-4 h-4" />
                            Finish payout setup
                          </Link>
                        </Button>
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="flex items-center gap-2 flex-wrap">
                    {canEditFull && (
                      <>
                        <Button variant="outline" size="sm" onClick={() => openEdit(listing)}>
                          <Pencil className="w-4 h-4 mr-2" />
                          {listing.status === "rejected" ? "Edit & resubmit" : "Edit"}
                        </Button>
                        <Button
                          size="sm"
                          onClick={() =>
                            runAction(listing.id, () => submitForReview(listing.id), "Submitted for review")
                          }
                          disabled={busy}
                        >
                          {busy ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <Send className="w-4 h-4 mr-2" />
                          )}
                          Submit for review
                        </Button>
                      </>
                    )}

                    {canEditEarlyAccess && (
                      <Button variant="outline" size="sm" onClick={() => openEdit(listing)}>
                        <Pencil className="w-4 h-4 mr-2" />
                        Edit early access
                      </Button>
                    )}

                    {listing.status === "published" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          runAction(listing.id, () => pauseListing(listing.id), "Listing paused")
                        }
                        disabled={busy}
                      >
                        {busy ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Pause className="w-4 h-4 mr-2" />
                        )}
                        Pause
                      </Button>
                    )}

                    {listing.status === "paused" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          runAction(listing.id, () => resumeListing(listing.id), "Listing resumed")
                        }
                        disabled={busy}
                      >
                        {busy ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Play className="w-4 h-4 mr-2" />
                        )}
                        Resume
                      </Button>
                    )}

                    {(listing.status === "published" || listing.status === "paused") && (
                      <Button variant="ghost" size="sm" onClick={() => openGift(listing)}>
                        <Gift className="w-4 h-4 mr-2" />
                        Gift
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <ListingFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        listing={editing}
        rituals={rituals}
        onSaved={upsertListing}
      />
      <GiftDialog open={giftOpen} onOpenChange={setGiftOpen} listing={gifting} />
    </div>
  )
}

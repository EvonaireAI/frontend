"use client"

import { useCallback, useEffect, useState } from "react"
import { format } from "date-fns"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import { Check, Loader2, Music, RefreshCw, X } from "lucide-react"
import { fetchReviewQueue, submitReviewDecision, formatPrice, CommonsApiError, type MyListing } from "@/lib/commons"
import { LicenseChip } from "@/components/commons/listing-chips"

// The Commons listing queue. Guardians reach it from the Sacred Library tab and
// stewards from The Commons tab — one component, so the two never drift.

export function ReviewQueuePanel({ onCountChange }: { onCountChange?: (count: number) => void }) {
  const [queue, setQueue] = useState<MyListing[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [approvingId, setApprovingId] = useState<number | null>(null)

  const [rejectFor, setRejectFor] = useState<MyListing | null>(null)
  const [note, setNote] = useState("")
  const [rejecting, setRejecting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const listings = await fetchReviewQueue()
      setQueue(listings)
      onCountChange?.(listings.length)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [onCountChange])

  useEffect(() => {
    load()
  }, [load])

  const removeFromQueue = (id: number) =>
    setQueue((prev) => {
      const next = prev.filter((listing) => listing.id !== id)
      onCountChange?.(next.length)
      return next
    })

  const handleApprove = async (listing: MyListing) => {
    setApprovingId(listing.id)
    try {
      await submitReviewDecision(listing.id, { decision: "approve" })
      toast.success("Listing approved")
      removeFromQueue(listing.id)
    } catch (err) {
      if (err instanceof CommonsApiError && err.code === "connect_not_ready") {
        // Leave it pending — the creator's payout account isn't ready.
        toast.error("Creator's payout account isn't ready — leaving it pending.")
      } else {
        toast.error(err instanceof Error ? err.message : "Failed to approve")
      }
    } finally {
      setApprovingId(null)
    }
  }

  const handleReject = async () => {
    if (!rejectFor) return
    if (!note.trim()) {
      toast.error("A note is required to reject.")
      return
    }
    setRejecting(true)
    try {
      await submitReviewDecision(rejectFor.id, { decision: "reject", note: note.trim() })
      toast.success("Listing sent back with your note")
      removeFromQueue(rejectFor.id)
      setRejectFor(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reject")
    } finally {
      setRejecting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Listings awaiting review, oldest first. Approve to publish, or send back with a note.
        </p>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            <span>We couldn&apos;t load the review queue.</span>
            <Button variant="outline" size="sm" onClick={load}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, index) => (
            <Skeleton key={index} className="h-32 w-full" />
          ))}
        </div>
      ) : !error && queue.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-12 text-center">
          <Check className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="font-medium text-foreground">Queue is clear</p>
          <p className="mt-1 text-sm text-muted-foreground">No listings are waiting for review right now.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {queue.map((listing) => {
            const busy = approvingId === listing.id
            return (
              <Card key={listing.id} className="bg-card border-border">
                <CardContent className="space-y-4 p-4 sm:p-5">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <LicenseChip level={listing.license_level} />
                      <span className="text-sm font-medium text-foreground">
                        {formatPrice(listing.price_cents, listing.currency)}
                      </span>
                      {listing.created_at && (
                        <span className="text-xs text-muted-foreground">
                          Submitted {format(new Date(listing.updated_at || listing.created_at), "MMM d, yyyy")}
                        </span>
                      )}
                    </div>
                    <h3 className="break-words text-lg font-semibold text-foreground">{listing.title}</h3>
                    <p className="break-all text-sm text-muted-foreground">by {listing.creator.display_name}</p>
                    <p className="break-words text-sm text-foreground/90">{listing.summary}</p>
                    {listing.ritual && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Music className="h-3.5 w-3.5" />
                        <span className="break-words">{listing.ritual.title}</span>
                      </div>
                    )}
                    {listing.early_access_until && (
                      <p className="text-xs text-muted-foreground">
                        Requested Scholar early access until{" "}
                        {format(new Date(listing.early_access_until), "MMM d, yyyy")}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button size="sm" onClick={() => handleApprove(listing)} disabled={busy}>
                      {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                      Approve
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setRejectFor(listing)
                        setNote("")
                      }}
                      disabled={busy}
                    >
                      <X className="mr-2 h-4 w-4" />
                      Reject
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Reject dialog — note is mandatory. */}
      <Dialog open={!!rejectFor} onOpenChange={(open) => !open && setRejectFor(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Send back for changes</DialogTitle>
            <DialogDescription>
              Your note is shown to the creator verbatim. Be specific and constructive.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="reject-note">Note to creator</Label>
            <Textarea
              id="reject-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={4}
              placeholder="Summary overpromises clinical outcomes — please reword."
            />
          </div>
          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => setRejectFor(null)} disabled={rejecting}>
              Cancel
            </Button>
            <Button onClick={handleReject} disabled={rejecting || !note.trim()}>
              {rejecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Send back
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
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
import { Shield, Music, Check, X, RefreshCw, Loader2 } from "lucide-react"
import { authService } from "@/lib/auth"
import {
  fetchReviewQueue,
  submitReviewDecision,
  formatPrice,
  CommonsApiError,
  type MyListing,
} from "@/lib/commons"
import { LicenseChip } from "@/components/commons/listing-chips"

export default function ReviewQueuePage() {
  const router = useRouter()
  const [authChecked, setAuthChecked] = useState(false)
  const [queue, setQueue] = useState<MyListing[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const [approvingId, setApprovingId] = useState<number | null>(null)

  // Reject dialog
  const [rejectFor, setRejectFor] = useState<MyListing | null>(null)
  const [note, setNote] = useState("")
  const [rejecting, setRejecting] = useState(false)

  useEffect(() => {
    const check = async () => {
      try {
        if (!authService.isAuthenticated()) {
          router.push("/auth/login")
          return
        }
        const user = await authService.getProfile()
        if (!["moderator", "admin", "superadmin"].includes(user.role)) {
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
      setQueue(await fetchReviewQueue())
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (authChecked) load()
  }, [authChecked, load])

  const removeFromQueue = (id: number) =>
    setQueue((prev) => prev.filter((l) => l.id !== id))

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

  const openReject = (listing: MyListing) => {
    setRejectFor(listing)
    setNote("")
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
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Shield className="w-5 h-5 text-primary" />
            <h1 className="text-3xl font-bold text-foreground">Commons review queue</h1>
          </div>
          <p className="text-muted-foreground">
            Listings awaiting review, oldest first. Approve to publish, or send back with a note.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription className="flex items-center justify-between gap-4 flex-wrap">
            <span>We couldn&apos;t load the review queue.</span>
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
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-6 w-1/2" />
                <Skeleton className="h-9 w-48" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : queue.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-border rounded-2xl">
          <Check className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-foreground font-medium">Queue is clear</p>
          <p className="text-sm text-muted-foreground mt-1">
            No listings are waiting for review right now.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {queue.map((listing) => {
            const busy = approvingId === listing.id
            return (
              <Card key={listing.id} className="bg-card border-border">
                <CardContent className="p-5 space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
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
                    <h3 className="text-lg font-semibold text-foreground">{listing.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      by {listing.creator.display_name}
                    </p>
                    <p className="text-sm text-foreground/90">{listing.summary}</p>
                    {listing.ritual && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Music className="w-3.5 h-3.5" />
                        <span>{listing.ritual.title}</span>
                      </div>
                    )}
                    {listing.early_access_until && (
                      <p className="text-xs text-muted-foreground">
                        Requested Scholar early access until{" "}
                        {format(new Date(listing.early_access_until), "MMM d, yyyy")}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Button size="sm" onClick={() => handleApprove(listing)} disabled={busy}>
                      {busy ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Check className="w-4 h-4 mr-2" />
                      )}
                      Approve
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openReject(listing)}
                      disabled={busy}
                    >
                      <X className="w-4 h-4 mr-2" />
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
      <Dialog open={!!rejectFor} onOpenChange={(o) => !o && setRejectFor(null)}>
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectFor(null)} disabled={rejecting}>
              Cancel
            </Button>
            <Button onClick={handleReject} disabled={rejecting || !note.trim()}>
              {rejecting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Send back
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

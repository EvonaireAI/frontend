"use client"

import { useEffect, useState } from "react"
import { AlertTriangle, Loader2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  ClaimChainError,
  REVOKE_REASON_MIN_LENGTH,
  licenseLevelLabel,
  refetchLicense,
  revokeLicense,
  type LicenseRecord,
} from "@/lib/claimchain"

// The one destructive action in this feature, so: a confirmation dialog that
// names the consequences in the order they happen, a reason the holder may
// read, and no way to dismiss it by clicking past it.
//
// The 180-second note is not a disclaimer, it is the truth about how presigned
// stream URLs expire. A creator who is told this up front reads a few more
// minutes of audio as expected behaviour; a creator who is not reports it as a
// bug, or worse, concludes the revocation did not work.

export function RevokeLicenseDialog({
  license,
  ritualId,
  ritualTitle,
  open,
  onOpenChange,
  onRevoked,
}: {
  license: LicenseRecord | null
  ritualId: number
  ritualTitle: string
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Receives the updated record so the caller can patch one row in place. */
  onRevoked: (updated: LicenseRecord) => void
}) {
  const [reason, setReason] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Never carry a half-typed reason from one license into another.
  useEffect(() => {
    if (open) {
      setReason("")
      setError(null)
      setSubmitting(false)
    }
  }, [open, license?.id])

  if (!license) return null

  const trimmed = reason.trim()
  const remaining = REVOKE_REASON_MIN_LENGTH - trimmed.length
  const longEnough = remaining <= 0
  const holder = license.holder?.email ?? "the holder"

  const submit = async () => {
    if (!longEnough || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const updated = await revokeLicense(license.id, trimmed)
      onRevoked(updated)
      onOpenChange(false)
    } catch (err) {
      if (err instanceof ClaimChainError && err.status === 403) {
        setError("Only the creator of this content or a Steward can revoke this license.")
      } else if (err instanceof ClaimChainError && err.status === 400) {
        // Almost always "already revoked" — someone else got there first, or a
        // refund did. Re-read the row so the table tells the truth, and close
        // rather than showing the raw message.
        const fresh = await refetchLicense(license.id, ritualId).catch(() => null)
        if (fresh && fresh.status === "revoked") {
          onRevoked(fresh)
          onOpenChange(false)
          return
        }
        setError(err.detail || "That reason wasn't accepted. Please add a little more detail.")
      } else if (err instanceof ClaimChainError && err.status === 404) {
        setError("This license no longer exists. Reload the page to see the current record.")
      } else {
        setError("We couldn't withdraw this license just now. Please try again.")
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!submitting) onOpenChange(next) }}>
      <DialogContent
        className="sm:max-w-lg"
        // Not dismissible by clicking past it: this ends someone's access, and
        // a stray click on the backdrop is not a decision.
        onPointerDownOutside={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
        // Escape still works — until a request is in flight, when closing would
        // leave the creator unsure whether it went through.
        onEscapeKeyDown={(event) => { if (submitting) event.preventDefault() }}
      >
        <DialogHeader>
          <DialogTitle>Withdraw this license?</DialogTitle>
          <DialogDescription>
            {licenseLevelLabel(license.level)} · {holder} · {ritualTitle}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="text-sm text-foreground">
            <p className="mb-2">Three things happen, in this order:</p>
            <ol className="list-decimal pl-5 space-y-1 text-muted-foreground">
              <li>The license is recorded as withdrawn, with your reason and the time.</li>
              <li>Their access to this content is withdrawn.</li>
              <li>Any playback they have open right now stops.</li>
            </ol>
          </div>

          <div className="space-y-2">
            <Label htmlFor="revoke-reason">Reason for withdrawing</Label>
            {/* Said before they type, not as a validation error afterwards. */}
            <p className="text-xs text-muted-foreground">
              Required, at least {REVOKE_REASON_MIN_LENGTH} characters. Write it as though it
              will be read: <strong className="font-medium text-foreground">the person who
              bought this may be shown this reason</strong>.
            </p>
            <Textarea
              id="revoke-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
              disabled={submitting}
              placeholder="Withdrawn at the request of the community this ritual came from."
              aria-describedby="revoke-reason-count"
            />
            <p id="revoke-reason-count" className="text-xs text-muted-foreground">
              {longEnough
                ? `${trimmed.length} characters`
                : `${remaining} more character${remaining === 1 ? "" : "s"} needed`}
            </p>
          </div>

          <p className="text-xs text-muted-foreground border-l-2 border-border pl-3">
            Their access stops immediately. A stream already loading in their player may finish
            the next few minutes of audio.
          </p>

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="w-4 h-4" aria-hidden />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
            className="bg-transparent"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={submit}
            disabled={!longEnough || submitting}
          >
            {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden />}
            Withdraw license
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { sanctuariesService, SanctuaryRemovalError } from "@/lib/sanctuaries"
import { Loader2, Trash2, AlertTriangle } from "lucide-react"

/**
 * Remove Sanctuary (owner-only).
 *
 * Renders nothing unless the viewer owns the sanctuary — Stewards remove
 * sanctuaries from their own console, which is a separate surface.
 *
 * The confirm button stays disabled until the acknowledgment box is ticked, so
 * the server's 400-without-acknowledgment path should be unreachable from
 * here; it's still surfaced verbatim if the server disagrees.
 */
export function RemoveSanctuary({
  sanctuaryId,
  sanctuaryTitle,
  isOwner,
  /** Where to land after a successful removal — the sanctuaries list. */
  redirectTo = "/creator",
}: {
  sanctuaryId: number
  sanctuaryTitle: string
  isOwner: boolean
  redirectTo?: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [acknowledged, setAcknowledged] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOwner) return null

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) {
      // Reset the gate each time, so a reopened dialog never starts armed.
      setAcknowledged(false)
      setError(null)
    }
  }

  const handleRemove = async () => {
    setRemoving(true)
    setError(null)
    try {
      await sanctuariesService.removeSanctuary(sanctuaryId)
      setOpen(false)
      toast.success("Sanctuary removed", {
        description: `"${sanctuaryTitle}" has been removed from the platform.`,
      })
      router.push(redirectTo)
      router.refresh()
    } catch (err) {
      if (err instanceof SanctuaryRemovalError) {
        setError(err.message)
      } else {
        setError(err instanceof Error ? err.message : "Failed to remove sanctuary")
      }
    } finally {
      setRemoving(false)
    }
  }

  return (
    <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-5 sm:p-6">
      <div className="flex items-start gap-3 mb-4">
        <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
        <div>
          <h2 className="text-base font-semibold text-foreground">Remove Sanctuary</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Permanently remove this sanctuary from Evonaire. Members lose access and circles are
            archived. This cannot be undone from your account.
          </p>
        </div>
      </div>

      {/* h-11 on phones: a destructive action deserves a full 44px touch
          target, which the default h-9 button doesn't give. */}
      <Button
        variant="destructive"
        onClick={() => setOpen(true)}
        className="w-full sm:w-auto h-11 sm:h-9"
      >
        <Trash2 className="w-4 h-4 mr-2" />
        Remove Sanctuary
      </Button>

      <AlertDialog open={open} onOpenChange={handleOpenChange}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove &ldquo;{sanctuaryTitle}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-left">
                <p>Removing this sanctuary means:</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Its members lose access to the sanctuary and its circles.</li>
                  <li>Every circle in the sanctuary is archived.</li>
                  <li>The sanctuary disappears from the platform and can no longer be joined.</li>
                  <li>Its content and settings are permanently removed from view.</li>
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>

          <label className="flex items-start gap-3 rounded-lg border border-border bg-secondary/50 p-3 cursor-pointer">
            <Checkbox
              checked={acknowledged}
              onCheckedChange={(checked) => setAcknowledged(checked === true)}
              disabled={removing}
              aria-describedby="remove-sanctuary-ack"
              className="mt-0.5"
            />
            <span id="remove-sanctuary-ack" className="text-sm text-foreground">
              I understand this cannot be undone from my account.
            </span>
          </label>

          {error && (
            <p role="alert" className="text-sm text-destructive bg-destructive/10 rounded-md p-3">
              {error}
            </p>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={removing}>Keep sanctuary</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                // Keep the dialog open on failure so the error stays visible.
                e.preventDefault()
                handleRemove()
              }}
              disabled={!acknowledged || removing}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {removing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Remove Sanctuary
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

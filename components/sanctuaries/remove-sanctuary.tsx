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

// Shown only if the preflight can't reach the server. The real copy is
// server-owned (API_CONTRACTS Session 10) and fetched when the dialog opens —
// this exists so a network blip doesn't leave the dialog empty.
const FALLBACK_CONSEQUENCES = [
  "The sanctuary is permanently hidden from members and from discovery.",
  "All current members lose access and every pending join request is closed.",
  "Its Agora circles are archived.",
  "Its settings (capacity, privacy, open join) stop applying.",
  "Rituals are not deleted; they stay owned by their creators and remain usable elsewhere.",
]

/**
 * Remove Sanctuary.
 *
 * Two-step by contract: opening the dialog POSTs an empty body to
 * `/sanctuaries/<id>/remove/`, which answers 400 `acknowledgment_required`
 * carrying the consequence copy; confirming re-sends with `acknowledge: true`.
 *
 * Rendered for the sanctuary owner *or* a steward — the backend admits both,
 * and a 403 here means the control shouldn't have been shown.
 */
export function RemoveSanctuary({
  sanctuaryId,
  sanctuaryTitle,
  canRemove,
  /** Where to land after a successful removal — the sanctuaries list. */
  redirectTo = "/creator",
}: {
  sanctuaryId: number
  sanctuaryTitle: string
  canRemove: boolean
  redirectTo?: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [acknowledged, setAcknowledged] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [consequences, setConsequences] = useState<string[] | null>(null)
  const [loadingCopy, setLoadingCopy] = useState(false)

  if (!canRemove) return null

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) {
      // Reset the gate each time, so a reopened dialog never starts armed.
      setAcknowledged(false)
      setError(null)
      return
    }

    // Step 1 — fetch the server's consequence copy for this sanctuary.
    setLoadingCopy(true)
    sanctuariesService
      .getRemovalConsequences(sanctuaryId)
      .then((preflight) => {
        setConsequences(preflight.consequences.length ? preflight.consequences : FALLBACK_CONSEQUENCES)
      })
      .catch((err) => {
        setConsequences(FALLBACK_CONSEQUENCES)
        // An already-removed or forbidden sanctuary is worth saying up front
        // rather than waiting for the user to confirm.
        if (err instanceof SanctuaryRemovalError && (err.alreadyRemoved || err.status === 403)) {
          setError(err.message)
        }
      })
      .finally(() => setLoadingCopy(false))
  }

  const handleRemove = async () => {
    setRemoving(true)
    setError(null)
    try {
      const result = await sanctuariesService.removeSanctuary(sanctuaryId)
      setOpen(false)
      // The server owns the wording of the confirmation too.
      toast.success(result.detail, {
        description: `${result.membershipsRevoked} ${
          result.membershipsRevoked === 1 ? "member" : "members"
        } notified · ${result.circlesArchived} ${
          result.circlesArchived === 1 ? "circle" : "circles"
        } archived · rituals kept.`,
      })
      router.push(redirectTo)
      router.refresh()
    } catch (err) {
      if (err instanceof SanctuaryRemovalError && err.alreadyRemoved) {
        // Someone else removed it first — the goal state is already true.
        setOpen(false)
        toast.info(err.message)
        router.push(redirectTo)
        router.refresh()
        return
      }
      setError(err instanceof Error ? err.message : "Failed to remove sanctuary")
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
            Remove this sanctuary from Evonaire. Members lose access and circles are archived.
            You cannot undo this yourself — only platform staff can restore it, and restoring
            does not bring members or circles back. Your rituals are not deleted.
          </p>
        </div>
      </div>

      {/* h-11 on phones: a destructive action deserves a full 44px touch
          target, which the default h-9 button doesn't give. */}
      <Button
        variant="destructive"
        onClick={() => handleOpenChange(true)}
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
                {loadingCopy && consequences === null ? (
                  <p className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Checking what this will affect…
                  </p>
                ) : (
                  <ul className="list-disc pl-5 space-y-1">
                    {(consequences ?? FALLBACK_CONSEQUENCES).map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                )}
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

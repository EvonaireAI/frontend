"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { ModerationApiError, moderationService, type ModerationCase } from "@/lib/moderation"

// The five workflow transitions — Assign (take / delegate / release), Resolve,
// Archive — plus Care Escalation, in one place.
//
// Every one of them refetches the list afterwards, success or failure. A `400`
// from a transition almost always means the row the guardian clicked is stale
// (someone else took the case, or it moved stage), so the honest response is to
// show the server's own wording and pull fresh rows.

export interface CaseActionResult {
  ok: boolean
  code?: string
}

/** Runs a transition, toasts the server's `detail` verbatim on failure, and
 *  always calls `onSettled` so the caller can refetch. */
export function useCaseAction(onSettled: () => void) {
  const [busy, setBusy] = useState(false)

  const run = async (
    action: () => Promise<unknown>,
    successMessage: string,
  ): Promise<CaseActionResult> => {
    setBusy(true)
    try {
      await action()
      toast.success(successMessage)
      return { ok: true }
    } catch (error) {
      if (error instanceof ModerationApiError) {
        toast.error(error.message)
        return { ok: false, code: error.code }
      }
      toast.error(error instanceof Error ? error.message : "Something went wrong")
      return { ok: false }
    } finally {
      setBusy(false)
      onSettled()
    }
  }

  return { busy, run }
}

// ── Take (assign to me) ─────────────────────────────────────────────────────

export function TakeCaseButton({
  caseId,
  onSettled,
  size = "sm",
}: {
  caseId: number
  onSettled: () => void
  size?: "sm" | "default"
}) {
  const { busy, run } = useCaseAction(onSettled)

  return (
    <Button
      size={size}
      disabled={busy}
      onClick={() => run(() => moderationService.assignCase(caseId), "Case is yours — it's in Active Cases now")}
    >
      {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
      Take this case
    </Button>
  )
}

// ── Release ─────────────────────────────────────────────────────────────────

export function ReleaseCaseDialog({
  moderationCase,
  open,
  onOpenChange,
  onSettled,
}: {
  moderationCase: ModerationCase | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSettled: () => void
}) {
  const { busy, run } = useCaseAction(onSettled)

  const handleRelease = async () => {
    if (!moderationCase) return
    const result = await run(
      () => moderationService.assignCase(moderationCase.id, { release: true }),
      "Case returned to Pending Reviews",
    )
    if (result.ok) onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Release case #{moderationCase?.id}?</DialogTitle>
          <DialogDescription>
            This returns the case to Pending Reviews, where any guardian can pick it up.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={handleRelease} disabled={busy}>
            {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Release
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Delegate ────────────────────────────────────────────────────────────────

export interface GuardianOption {
  id: number
  email: string
}

export function DelegateCaseDialog({
  moderationCase,
  guardians,
  open,
  onOpenChange,
  onSettled,
  onNotAGuardian,
}: {
  moderationCase: ModerationCase | null
  guardians: GuardianOption[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onSettled: () => void
  /** `400 not_a_guardian` means the picker offered someone who isn't one —
   *  drop them from the list rather than offering them again. */
  onNotAGuardian?: (guardianId: number) => void
}) {
  const { busy, run } = useCaseAction(onSettled)
  const [target, setTarget] = useState<string>("")
  const [note, setNote] = useState("")

  const handleDelegate = async () => {
    if (!moderationCase || !target) return
    const guardianId = Number(target)
    const result = await run(
      () =>
        moderationService.assignCase(moderationCase.id, {
          moderator_id: guardianId,
          note: note.trim() || undefined,
        }),
      "Case delegated",
    )
    if (result.ok) {
      onOpenChange(false)
      setTarget("")
      setNote("")
    } else if (result.code === "not_a_guardian") {
      onNotAGuardian?.(guardianId)
      setTarget("")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Delegate case #{moderationCase?.id}</DialogTitle>
          <DialogDescription>Hand this case to another guardian. They&apos;ll see it in their Active Cases.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="delegate-target">Guardian</Label>
            {guardians.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No other guardians are visible from here. Stewards see the full roster on the Trust &amp; Care tab.
              </p>
            ) : (
              <Select value={target} onValueChange={setTarget}>
                <SelectTrigger id="delegate-target">
                  <SelectValue placeholder="Choose a guardian" />
                </SelectTrigger>
                <SelectContent>
                  {guardians.map((guardian) => (
                    <SelectItem key={guardian.id} value={String(guardian.id)}>
                      {guardian.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="delegate-note">Note (optional)</Label>
            <Textarea
              id="delegate-note"
              rows={3}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Context for whoever picks this up…"
            />
          </div>
        </div>
        <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={handleDelegate} disabled={busy || !target}>
            {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Delegate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Resolve ─────────────────────────────────────────────────────────────────

export function ResolveCaseDialog({
  moderationCase,
  open,
  onOpenChange,
  onSettled,
}: {
  moderationCase: ModerationCase | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSettled: () => void
}) {
  const { busy, run } = useCaseAction(onSettled)
  const [note, setNote] = useState("")

  const handleResolve = async () => {
    if (!moderationCase || !note.trim()) return
    const result = await run(
      () => moderationService.resolveCase(moderationCase.id, note.trim()),
      "Case resolved — it's in Care History now",
    )
    if (result.ok) {
      onOpenChange(false)
      setNote("")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Resolve case #{moderationCase?.id}</DialogTitle>
          <DialogDescription>
            Your note becomes the Care History record for this case — it&apos;s what the next guardian or steward
            reads to understand what happened.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="resolution-note">Resolution note</Label>
          <Textarea
            id="resolution-note"
            rows={4}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Spoke with the creator; framing corrected."
          />
        </div>
        <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={handleResolve} disabled={busy || !note.trim()}>
            {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Resolve
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Archive ─────────────────────────────────────────────────────────────────

export function ArchiveCaseDialog({
  moderationCase,
  open,
  onOpenChange,
  onSettled,
}: {
  moderationCase: ModerationCase | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSettled: () => void
}) {
  const { busy, run } = useCaseAction(onSettled)
  const [note, setNote] = useState("")

  const handleArchive = async () => {
    if (!moderationCase) return
    const result = await run(
      () => moderationService.archiveCase(moderationCase.id, note.trim() || undefined),
      "Case archived",
    )
    if (result.ok) {
      onOpenChange(false)
      setNote("")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Archive case #{moderationCase?.id}</DialogTitle>
          <DialogDescription>
            Nothing is deleted. The case leaves the working queues and stays readable in Care History and The
            Archive.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="archive-note">Note (optional)</Label>
          <Textarea
            id="archive-note"
            rows={3}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="No further action."
          />
        </div>
        <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={handleArchive} disabled={busy}>
            {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Archive
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Care Escalation ─────────────────────────────────────────────────────────

export function EscalateCaseDialog({
  moderationCase,
  open,
  onOpenChange,
  onSettled,
}: {
  moderationCase: ModerationCase | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSettled: () => void
}) {
  const { busy, run } = useCaseAction(onSettled)
  const [notes, setNotes] = useState("")

  const handleEscalate = async () => {
    if (!moderationCase || !notes.trim()) return
    const result = await run(
      () => moderationService.escalateCase(moderationCase.id, notes.trim()),
      "Case escalated to the crisis team",
    )
    if (result.ok) {
      onOpenChange(false)
      setNotes("")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-red-600 dark:text-red-400">
            Care Escalation — case #{moderationCase?.id}
          </DialogTitle>
          <DialogDescription>
            For immediate danger or urgent distress. This alerts the crisis team and cannot be undone. The case
            still moves through assign, resolve and archive as normal.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="escalation-notes">Why this needs urgent attention</Label>
          <Textarea
            id="escalation-notes"
            rows={4}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Describe the risk you're seeing…"
          />
        </div>
        <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleEscalate} disabled={busy || !notes.trim()}>
            {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Escalate now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

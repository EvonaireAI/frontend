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
import { tr, trNode } from "@/lib/i18n"


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
      toast.error(error instanceof Error ? error.message : tr("Something went wrong"))
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
      onClick={() => run(() => moderationService.assignCase(caseId), tr("Case is yours — it's in Active Cases now"))}
    >
      {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
      {tr("Take this case")}
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
      tr("Case returned to Pending Reviews"),
    )
    if (result.ok) onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{trNode("Release case #{p0}?", { p0: moderationCase?.id })}</DialogTitle>
          <DialogDescription>
            {tr("This returns the case to Pending Reviews, where any guardian can pick it up.")}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            {tr("Cancel")}
          </Button>
          <Button onClick={handleRelease} disabled={busy}>
            {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {tr("Release")}
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
      tr("Case delegated"),
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
          <DialogTitle>{trNode("Delegate case #{p0}", { p0: moderationCase?.id })}</DialogTitle>
          <DialogDescription>{tr("Hand this case to another guardian. They'll see it in their Active Cases.")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="delegate-target">{tr("Guardian")}</Label>
            {guardians.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {tr("No other guardians are visible from here. Stewards see the full roster on the Trust & Care tab.")}
              </p>
            ) : (
              <Select value={target} onValueChange={setTarget}>
                <SelectTrigger id="delegate-target">
                  <SelectValue placeholder={tr("Choose a guardian")} />
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
            <Label htmlFor="delegate-note">{tr("Note (optional)")}</Label>
            <Textarea
              id="delegate-note"
              rows={3}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder={tr("Context for whoever picks this up…")}
            />
          </div>
        </div>
        <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            {tr("Cancel")}
          </Button>
          <Button onClick={handleDelegate} disabled={busy || !target}>
            {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {tr("Delegate")}
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
      tr("Case resolved — it's in Care History now"),
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
          <DialogTitle>{trNode("Resolve case #{p0}", { p0: moderationCase?.id })}</DialogTitle>
          <DialogDescription>
            {tr("Your note becomes the Care History record for this case — it's what the next guardian or steward reads to understand what happened.")}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="resolution-note">{tr("Resolution note")}</Label>
          <Textarea
            id="resolution-note"
            rows={4}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder={tr("Spoke with the creator; framing corrected.")}
          />
        </div>
        <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            {tr("Cancel")}
          </Button>
          <Button onClick={handleResolve} disabled={busy || !note.trim()}>
            {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {tr("Resolve")}
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
      tr("Case archived"),
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
          <DialogTitle>{trNode("Archive case #{p0}", { p0: moderationCase?.id })}</DialogTitle>
          <DialogDescription>
            {tr("Nothing is deleted. The case leaves the working queues and stays readable in Care History and The Archive.")}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="archive-note">{tr("Note (optional)")}</Label>
          <Textarea
            id="archive-note"
            rows={3}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder={tr("No further action.")}
          />
        </div>
        <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            {tr("Cancel")}
          </Button>
          <Button onClick={handleArchive} disabled={busy}>
            {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {tr("Archive")}
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
      tr("Case escalated to the crisis team"),
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
            {trNode("Care Escalation — case #{p0}", { p0: moderationCase?.id })}
          </DialogTitle>
          <DialogDescription>
            {tr("For immediate danger or urgent distress. This alerts the crisis team and cannot be undone. The case still moves through assign, resolve and archive as normal.")}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="escalation-notes">{tr("Why this needs urgent attention")}</Label>
          <Textarea
            id="escalation-notes"
            rows={4}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder={tr("Describe the risk you're seeing…")}
          />
        </div>
        <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            {tr("Cancel")}
          </Button>
          <Button variant="destructive" onClick={handleEscalate} disabled={busy || !notes.trim()}>
            {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {tr("Escalate now")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

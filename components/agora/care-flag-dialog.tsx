"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Textarea } from "@/components/ui/textarea"
import { agoraService, FLAG_REASON_LABELS, ThrottledError, type FlagReason } from "@/lib/agora"
import { Loader2, HandHeart } from "lucide-react"

export interface CareFlagTarget {
  type: "post" | "reply"
  id: number
}

// Care flags are available to every member regardless of plan — safety is
// never paywalled, so this dialog must never show upgrade UI.
export function CareFlagDialog({
  target,
  onClose,
}: {
  target: CareFlagTarget | null
  onClose: () => void
}) {
  const [reason, setReason] = useState<FlagReason>("emotional_harm")
  const [note, setNote] = useState("")
  const [submitting, setSubmitting] = useState(false)

  // Reset the form each time the dialog opens for a new target
  useEffect(() => {
    if (target) {
      setReason("emotional_harm")
      setNote("")
    }
  }, [target])

  const handleSubmit = async () => {
    if (!target) return
    setSubmitting(true)
    try {
      const payload = { reason, note: note.trim() || undefined }
      if (target.type === "post") {
        await agoraService.flagPost(target.id, payload)
      } else {
        await agoraService.flagReply(target.id, payload)
      }
      toast("Thank you. A guardian will look at this with care.")
      onClose()
    } catch (err) {
      if (err instanceof ThrottledError) {
        toast(err.message)
      } else if (err instanceof Error && err.message.includes("already flagged")) {
        toast("You've already raised a care flag here. Our guardians will review it.")
        onClose()
      } else {
        toast.error(err instanceof Error ? err.message : "Failed to raise a care flag")
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={!!target} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <HandHeart className="w-4 h-4 text-primary" />
            Raise a care flag
          </DialogTitle>
          <DialogDescription>
            A guardian will look at this with care. The author isn&apos;t notified.
          </DialogDescription>
        </DialogHeader>

        <RadioGroup value={reason} onValueChange={(v) => setReason(v as FlagReason)} className="space-y-1">
          {(Object.keys(FLAG_REASON_LABELS) as FlagReason[]).map((key) => (
            <div key={key} className="flex items-center space-x-2">
              <RadioGroupItem value={key} id={`care-flag-${key}`} />
              <Label htmlFor={`care-flag-${key}`} className="font-normal text-foreground">
                {FLAG_REASON_LABELS[key]}
              </Label>
            </div>
          ))}
        </RadioGroup>

        <div className="space-y-2">
          <Label htmlFor="care-flag-note" className="text-muted-foreground">
            Anything you&apos;d like the guardian to know? (optional)
          </Label>
          <Textarea
            id="care-flag-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            className="bg-secondary border-border"
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={submitting}
            className="bg-transparent border-border text-muted-foreground hover:bg-secondary"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="bg-primary text-primary-foreground hover:bg-gold-muted"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Sending…
              </>
            ) : (
              "Send to a guardian"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

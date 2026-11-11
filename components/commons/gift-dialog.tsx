"use client"

import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Gift } from "lucide-react"
import { toast } from "sonner"
import { giftListing, type MyListing } from "@/lib/commons"
import { tr, trNode } from "@/lib/i18n"


interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  listing: MyListing | null
}

export function GiftDialog({ open, onOpenChange, listing }: Props) {
  const [email, setEmail] = useState("")
  const [expiresAt, setExpiresAt] = useState("")
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (open) {
      setEmail("")
      setExpiresAt("")
    }
  }, [open])

  const handleSend = async () => {
    if (!listing) return
    if (!email.trim()) {
      toast.error(tr("Enter the recipient's email."))
      return
    }
    if (!expiresAt) {
      toast.error(tr("Choose an expiry date for the gift."))
      return
    }
    setSending(true)
    try {
      await giftListing(listing.id, {
        email: email.trim(),
        expires_at: `${expiresAt}T00:00:00Z`,
      })
      toast.success(tr("Gift sent"))
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tr("Failed to send the gift"))
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gift className="w-4 h-4 text-primary" />
            {tr("Gift this offering")}
          </DialogTitle>
          <DialogDescription>
            {listing ? trNode("Give someone access to “{p0}”. ", { p0: listing.title }) : null}
            {tr("Up to 10 active gifts per listing.")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="gift-email">{tr("Recipient email")}</Label>
            <Input
              id="gift-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={tr("friend@example.com")}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gift-expiry">{tr("Access expires")}</Label>
            <Input
              id="gift-expiry"
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            {tr("Cancel")}
          </Button>
          <Button onClick={handleSend} disabled={sending}>
            {sending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {tr("Send gift")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

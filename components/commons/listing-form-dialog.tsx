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
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import type { Ritual } from "@/lib/auth"
import {
  createListing,
  updateListing,
  CommonsApiError,
  type LicenseLevel,
  type ListingDraftInput,
  type MyListing,
} from "@/lib/commons"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  // Edit an existing listing, or create a new draft when undefined.
  listing?: MyListing | null
  rituals: Ritual[]
  onSaved: (listing: MyListing) => void
}

const NONE = "__none__"

// Convert a datetime to the value an <input type="date"> expects (UTC day).
function toDateInput(iso: string | null | undefined): string {
  if (!iso) return ""
  return iso.slice(0, 10)
}

// A date input holds a calendar day; send it as start-of-day UTC.
function fromDateInput(value: string): string | null {
  if (!value) return null
  return `${value}T00:00:00Z`
}

export function ListingFormDialog({ open, onOpenChange, listing, rituals, onSaved }: Props) {
  const isEdit = !!listing
  // After publish, only the early-access date stays editable.
  const earlyAccessOnly = isEdit && listing.status !== "draft" && listing.status !== "rejected"

  const [title, setTitle] = useState("")
  const [summary, setSummary] = useState("")
  const [ritualId, setRitualId] = useState<string>(NONE)
  const [license, setLicense] = useState<LicenseLevel>("L1_open")
  const [priceDollars, setPriceDollars] = useState("")
  const [earlyAccess, setEarlyAccess] = useState("")
  const [saving, setSaving] = useState(false)
  const [priceError, setPriceError] = useState<string | null>(null)

  // Reset the form each time it opens.
  useEffect(() => {
    if (!open) return
    setTitle(listing?.title ?? "")
    setSummary(listing?.summary ?? "")
    setRitualId(listing?.ritual ? String(listing.ritual.id) : NONE)
    setLicense(listing?.license_level ?? "L1_open")
    setPriceDollars(
      listing ? (listing.price_cents === 0 ? "0" : (listing.price_cents / 100).toFixed(2)) : "",
    )
    setEarlyAccess(toDateInput(listing?.early_access_until))
    setPriceError(null)
  }, [open, listing])

  const priceCents = Math.round(parseFloat(priceDollars || "0") * 100)
  // Free is only valid for L1_open offerings.
  const freeOnGuided = priceCents === 0 && license === "L2_guided"

  const handleSubmit = async () => {
    setPriceError(null)
    if (!earlyAccessOnly) {
      if (!title.trim() || !summary.trim()) {
        toast.error("Title and summary are required.")
        return
      }
      if (Number.isNaN(priceCents) || priceCents < 0) {
        setPriceError("Enter a valid price.")
        return
      }
      if (freeOnGuided) {
        setPriceError("Free offerings must use the L1 · Open license.")
        return
      }
    }

    setSaving(true)
    try {
      let saved: MyListing
      if (isEdit && earlyAccessOnly) {
        // Only the early-access window may change post-publish.
        saved = await updateListing(listing.id, {
          early_access_until: fromDateInput(earlyAccess),
        })
      } else {
        const payload: ListingDraftInput = {
          title: title.trim(),
          summary: summary.trim(),
          ritual_id: ritualId === NONE ? null : Number(ritualId),
          license_level: license,
          price_cents: priceCents,
          early_access_until: fromDateInput(earlyAccess),
        }
        saved = isEdit ? await updateListing(listing.id, payload) : await createListing(payload)
      }
      toast.success(isEdit ? "Listing updated" : "Draft created")
      onSaved(saved)
      onOpenChange(false)
    } catch (err) {
      if (err instanceof CommonsApiError && /price/i.test(err.message)) {
        setPriceError(err.message)
      } else {
        toast.error(err instanceof Error ? err.message : "Failed to save the listing")
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit listing" : "New listing"}</DialogTitle>
          <DialogDescription>
            {earlyAccessOnly
              ? "This listing is live — only the early-access window can be changed."
              : "Offerings start as a draft. Submit for review when you're ready to publish."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="listing-title">Title</Label>
            <Input
              id="listing-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={earlyAccessOnly}
              placeholder="Grief Tending — Guided Series"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="listing-summary">Summary</Label>
            <Textarea
              id="listing-summary"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              disabled={earlyAccessOnly}
              rows={3}
              placeholder="Four-part guided practice for early grief."
            />
          </div>

          <div className="space-y-1.5">
            <Label>Linked ritual (optional)</Label>
            <Select value={ritualId} onValueChange={setRitualId} disabled={earlyAccessOnly}>
              <SelectTrigger>
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>None</SelectItem>
                {rituals.map((r) => (
                  <SelectItem key={r.id} value={String(r.id)}>
                    {r.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>License level</Label>
              <Select
                value={license}
                onValueChange={(v) => setLicense(v as LicenseLevel)}
                disabled={earlyAccessOnly}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="L1_open">L1 · Open</SelectItem>
                  <SelectItem value="L2_guided">L2 · Guided</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="listing-price">Price (USD)</Label>
              <Input
                id="listing-price"
                type="number"
                min="0"
                step="0.01"
                value={priceDollars}
                onChange={(e) => setPriceDollars(e.target.value)}
                disabled={earlyAccessOnly}
                placeholder="19.00"
              />
            </div>
          </div>
          {freeOnGuided && !earlyAccessOnly && (
            <p className="text-xs text-destructive">
              Free offerings must use the L1 · Open license.
            </p>
          )}
          {priceError && <p className="text-xs text-destructive">{priceError}</p>}

          <div className="space-y-1.5">
            <Label htmlFor="listing-early">Early access until (optional)</Label>
            <Input
              id="listing-early"
              type="date"
              value={earlyAccess}
              onChange={(e) => setEarlyAccess(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Scholars get this offering first, up to 7 days before it opens to everyone.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving || (freeOnGuided && !earlyAccessOnly)}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {isEdit ? "Save changes" : "Create draft"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

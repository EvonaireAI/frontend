"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { authService } from "@/lib/auth"
import { Flag, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"
import { GaiaInfoTip } from "@/components/gaia/info-tip"
import { tr, trNode } from "@/lib/i18n"


type ViolationType = "cultural_harm" | "safety_risk" | "misinformation" | "inappropriate_content" | "spam" | "other"
type ContentType = "ritual" | "sanctuary" | "user"

const VIOLATION_LABELS: Record<ViolationType, string> = {
  cultural_harm: "Cultural Harm",
  safety_risk: "Safety Risk",
  misinformation: "Misinformation",
  inappropriate_content: "Inappropriate Content",
  spam: "Spam",
  other: "Other",
}

interface ReportModalProps {
  contentType: ContentType
  contentId: number
  contentTitle?: string
  trigger?: React.ReactNode
}

export function ReportModal({ contentType, contentId, contentTitle, trigger }: ReportModalProps) {
  const [open, setOpen] = useState(false)
  const [violationType, setViolationType] = useState<ViolationType | "">("")
  const [description, setDescription] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = async () => {
    if (!violationType) {
      toast.error(tr("Please select a violation type"))
      return
    }
    if (!description.trim()) {
      toast.error(tr("Please provide a description"))
      return
    }

    setSubmitting(true)
    try {
      await authService.submitReport({
        content_type: contentType,
        content_id: contentId,
        violation_type: violationType,
        description: description.trim(),
      })
      setSubmitted(true)
      toast.success(tr("Report submitted successfully"))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : tr("Failed to submit report"))
    } finally {
      setSubmitting(false)
    }
  }

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen)
    if (!isOpen) {
      // Reset form when closing
      setTimeout(() => {
        setViolationType("")
        setDescription("")
        setSubmitted(false)
      }, 300)
    }
  }

  const getContentLabel = () => {
    switch (contentType) {
      case "ritual":
        return "Ritual"
      case "sanctuary":
        return "Sanctuary"
      case "user":
        return "User"
      default:
        return "Content"
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger || (
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            title={`Report ${getContentLabel()}`}
          >
            <Flag className="w-4 h-4" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            {trNode("Report {p0}", { p0: getContentLabel() })}
            <GaiaInfoTip
              infoKey={contentType === "sanctuary" ? "sanctuary.report" : "ritual.report"}
              ariaLabel={tr("About reporting")}
              side="bottom"
            />
          </DialogTitle>
          <DialogDescription>
            {contentTitle ? (
              <>{tr("Report concern about: ")}<span className="font-medium text-foreground">{contentTitle}</span></>
            ) : (
              <>{tr("Help us keep Evonaire safe by reporting content that violates our guidelines.")}</>
            )}
          </DialogDescription>
        </DialogHeader>

        {submitted ? (
          <div className="py-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/10 mb-4">
              <CheckCircle2 className="w-8 h-8 text-green-500" />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-2">{tr("Report Submitted")}</h3>
            <p className="text-muted-foreground text-sm mb-6">
              {tr("Thank you for helping keep Evonaire safe. Our moderation team will review your report.")}
            </p>
            <Button onClick={() => handleOpenChange(false)} className="bg-primary text-primary-foreground">
              {tr("Close")}
            </Button>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="violation-type">{tr("Type of Violation")}</Label>
              <Select value={violationType} onValueChange={(v) => setViolationType(v as ViolationType)}>
                <SelectTrigger id="violation-type" className="bg-input border-border">
                  <SelectValue placeholder={tr("Select violation type...")} />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {Object.entries(VIOLATION_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">{tr("Description")}</Label>
              <Textarea
                id="description"
                placeholder={tr("Please describe the issue in detail...")}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="bg-input border-border resize-none"
              />
              <p className="text-xs text-muted-foreground">
                {tr("Provide as much detail as possible to help our moderation team review this report.")}
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => handleOpenChange(false)}
                className="flex-1 bg-transparent border-border"
              >
                {tr("Cancel")}
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={submitting || !violationType || !description.trim()}
                className="flex-1 bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {tr("Submitting...")}
                  </>
                ) : (
                  <>
                    <Flag className="w-4 h-4 mr-2" />
                    {tr("Submit Report")}
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

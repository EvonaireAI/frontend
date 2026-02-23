"use client"

import type React from "react"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { rtsService, type RTSFlag } from "@/lib/rts"
import { Loader2, Flag } from "lucide-react"
import { toast } from "sonner"

interface FlagFormProps {
  userId: number
  ritualId?: number
  onSubmitSuccess?: () => void
}

export function FlagForm({ userId, ritualId, onSubmitSuccess }: FlagFormProps) {
  const [submitting, setSubmitting] = useState(false)
  const [flag, setFlag] = useState<RTSFlag>({
    user_id: userId,
    ritual_id: ritualId,
    flag_type: "other",
    description: "",
    severity: "medium",
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!flag.description.trim()) {
      toast.error("Please provide a description")
      return
    }

    setSubmitting(true)

    try {
      await rtsService.createFlag(flag)
      toast.success("Care flag created successfully")
      setFlag({
        user_id: userId,
        ritual_id: ritualId,
        flag_type: "other",
        description: "",
        severity: "medium",
      })
      if (onSubmitSuccess) {
        onSubmitSuccess()
      }
    } catch (error) {
      console.error("Failed to create flag:", error)
      toast.error("Failed to create care flag")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Flag className="w-5 h-5 text-orange-600" />
          Create Care Flag
        </CardTitle>
        <CardDescription>Flag a concern that may impact the creator's RTS score</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="flag_type">Flag Type</Label>
            <Select value={flag.flag_type} onValueChange={(value: any) => setFlag({ ...flag, flag_type: value })}>
              <SelectTrigger id="flag_type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cultural_concern">Cultural Concern</SelectItem>
                <SelectItem value="emotional_safety">Emotional Safety</SelectItem>
                <SelectItem value="quality_issue">Quality Issue</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="severity">Severity</Label>
            <Select value={flag.severity} onValueChange={(value: any) => setFlag({ ...flag, severity: value })}>
              <SelectTrigger id="severity">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Describe the concern..."
              value={flag.description}
              onChange={(e) => setFlag({ ...flag, description: e.target.value })}
              rows={4}
            />
          </div>

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating Flag...
              </>
            ) : (
              "Create Flag"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

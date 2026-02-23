"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { authService, type ModerationCase } from "@/lib/auth"
import { ArrowLeft, FileText, Clock, CheckCircle } from "lucide-react"
import { toast } from "sonner"

interface CaseDetailProps {
  case: ModerationCase
  onBack: () => void
  onUpdate: () => void
}

export function CaseDetail({ case: moderationCase, onBack, onUpdate }: CaseDetailProps) {
  const [newStatus, setNewStatus] = useState(moderationCase.status)
  const [resolutionNotes, setResolutionNotes] = useState("")
  const [updating, setUpdating] = useState(false)

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "high":
        return "bg-red-100 text-red-800 border-red-200"
      case "medium":
        return "bg-yellow-100 text-yellow-800 border-yellow-200"
      case "low":
        return "bg-green-100 text-green-800 border-green-200"
      default:
        return "bg-muted text-muted-foreground border-border"
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open":
        return "bg-blue-100 text-blue-800"
      case "assigned":
        return "bg-yellow-100 text-yellow-800"
      case "resolved":
        return "bg-green-100 text-green-800"
      case "closed":
        return "bg-muted text-muted-foreground"
      default:
        return "bg-muted text-muted-foreground"
    }
  }

  const handleUpdateStatus = async () => {
    setUpdating(true)
    try {
      await authService.updateCaseStatus(moderationCase.id, newStatus, resolutionNotes)
      toast.success("Case status updated successfully")
      onUpdate()
    } catch (error) {
      console.error("Failed to update case status:", error)
      toast.error("Failed to update case status")
    } finally {
      setUpdating(false)
    }
  }

  const handleAssignToMe = async () => {
    setUpdating(true)
    try {
      await authService.assignCase(moderationCase.id)
      toast.success("Case assigned to you")
      onUpdate()
    } catch (error) {
      console.error("Failed to assign case:", error)
      toast.error("Failed to assign case")
    } finally {
      setUpdating(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-accent/5">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Button onClick={onBack} variant="outline" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Cases
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Case #{moderationCase.id}</h1>
            <p className="text-muted-foreground">Moderation case details and actions</p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Case Details */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="flex items-center gap-2 mb-2">
                      <FileText className="w-5 h-5" />
                      Case Information
                    </CardTitle>
                    <div className="flex gap-2">
                      <Badge className={getSeverityColor(moderationCase.severity)}>
                        {moderationCase.severity?.toUpperCase() || "UNKNOWN"}
                      </Badge>
                      <Badge className={getStatusColor(moderationCase.status)}>
                        {moderationCase.status?.replace("_", " ").toUpperCase() || "UNKNOWN"}
                      </Badge>
                      {moderationCase.flagged_by_ai && (
                        <Badge className="bg-purple-100 text-purple-800 border-purple-200">
                          AI FLAGGED
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {moderationCase.ritual_title && (
                  <div>
                    <h4 className="font-medium mb-2">Related Ritual</h4>
                    <p className="text-foreground bg-muted p-3 rounded">
                      {moderationCase.ritual_title}
                      {moderationCase.ritual && (
                        <span className="text-muted-foreground ml-2">(ID: {moderationCase.ritual})</span>
                      )}
                    </p>
                  </div>
                )}

                {moderationCase.flagged_reason && (
                  <div>
                    <h4 className="font-medium mb-2">Flagged Reason</h4>
                    <p className="text-muted-foreground bg-muted p-3 rounded">{moderationCase.flagged_reason}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Severity:</span>
                    <p className="text-muted-foreground capitalize">{moderationCase.severity || "N/A"}</p>
                  </div>
                  <div>
                    <span className="font-medium">Created:</span>
                    <p className="text-muted-foreground">{new Date(moderationCase.created_at).toLocaleString()}</p>
                  </div>
                  <div>
                    <span className="font-medium">Last Updated:</span>
                    <p className="text-muted-foreground">{new Date(moderationCase.updated_at).toLocaleString()}</p>
                  </div>
                  <div>
                    <span className="font-medium">Assigned Moderator:</span>
                    <p className="text-muted-foreground">
                      {moderationCase.assigned_moderator_email || "Unassigned"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Case History */}
            {moderationCase.history && moderationCase.history.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="w-5 h-5" />
                    Case History
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {moderationCase.history.map((entry, index) => (
                      <div key={index} className="flex items-start gap-3 text-sm border-b border-border pb-3 last:border-0 last:pb-0">
                        <div className="w-2 h-2 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                        <div className="flex-1">
                          <p className="font-medium text-foreground">{entry.event}</p>
                          <div className="flex items-center gap-2 text-muted-foreground mt-1">
                            <span>By: {entry.by}</span>
                            <span>-</span>
                            <span>{new Date(entry.at).toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Actions Panel */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5" />
                  Case Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {!moderationCase.assigned_moderator && (
                  <Button onClick={handleAssignToMe} disabled={updating} className="w-full">
                    Assign to Me
                  </Button>
                )}

                <div>
                  <label className="text-sm font-medium mb-2 block">Update Status</label>
                  <Select value={newStatus} onValueChange={setNewStatus}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="assigned">Assigned</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Notes</label>
                  <Textarea
                    placeholder="Add notes about this case..."
                    value={resolutionNotes}
                    onChange={(e) => setResolutionNotes(e.target.value)}
                    rows={4}
                  />
                </div>

                <Button
                  onClick={handleUpdateStatus}
                  disabled={updating || newStatus === moderationCase.status}
                  className="w-full"
                >
                  {updating ? "Updating..." : "Update Case"}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}

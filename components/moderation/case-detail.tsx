"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { authService, type ModerationCase } from "@/lib/auth"
import { ArrowLeft, User, FileText, Clock, AlertTriangle, CheckCircle, Play, Pause } from "lucide-react"
import { toast } from "sonner"

interface CaseDetailProps {
  case: ModerationCase
  onBack: () => void
  onUpdate: () => void
}

export function CaseDetail({ case: moderationCase, onBack, onUpdate }: CaseDetailProps) {
  const [newStatus, setNewStatus] = useState(moderationCase.status)
  const [resolutionNotes, setResolutionNotes] = useState(moderationCase.resolution_notes || "")
  const [updating, setUpdating] = useState(false)
  const [audioPlaying, setAudioPlaying] = useState(false)

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "urgent":
        return "bg-red-100 text-red-800 border-red-200"
      case "high":
        return "bg-orange-100 text-orange-800 border-orange-200"
      case "medium":
        return "bg-yellow-100 text-yellow-800 border-yellow-200"
      case "low":
        return "bg-green-100 text-green-800 border-green-200"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open":
        return "bg-blue-100 text-blue-800"
      case "in_progress":
        return "bg-yellow-100 text-yellow-800"
      case "resolved":
        return "bg-green-100 text-green-800"
      case "closed":
        return "bg-gray-100 text-gray-800"
      default:
        return "bg-gray-100 text-gray-800"
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

  const toggleAudio = () => {
    setAudioPlaying(!audioPlaying)
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
                        {moderationCase.severity.toUpperCase()}
                      </Badge>
                      <Badge className={getStatusColor(moderationCase.status)}>
                        {moderationCase.status.replace("_", " ").toUpperCase()}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Description</h4>
                  <p className="text-muted-foreground bg-muted p-3 rounded">{moderationCase.description}</p>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Case Type:</span>
                    <p className="text-muted-foreground">{moderationCase.case_type.replace("_", " ")}</p>
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
                      {moderationCase.assigned_moderator
                        ? `${moderationCase.assigned_moderator.first_name} ${moderationCase.assigned_moderator.last_name}`
                        : "Unassigned"}
                    </p>
                  </div>
                </div>

                {moderationCase.resolution_notes && (
                  <div>
                    <h4 className="font-medium mb-2">Resolution Notes</h4>
                    <p className="text-muted-foreground bg-muted p-3 rounded">{moderationCase.resolution_notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Ritual Details */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  Related Ritual
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold text-lg mb-2">{moderationCase.ritual.title}</h4>
                  <p className="text-muted-foreground mb-3">{moderationCase.ritual.description}</p>

                  <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                    <div className="flex items-center gap-1">
                      <User className="w-4 h-4" />
                      {moderationCase.ritual.creator.first_name} {moderationCase.ritual.creator.last_name}
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {moderationCase.ritual.duration_seconds
                        ? `${Math.floor(moderationCase.ritual.duration_seconds / 60)}:${(moderationCase.ritual.duration_seconds % 60).toString().padStart(2, "0")}`
                        : "Unknown duration"}
                    </div>
                  </div>

                  <div className="flex gap-2 mb-4">
                    <Badge
                      className={
                        moderationCase.ritual.care_level === "level3"
                          ? "bg-red-100 text-red-800"
                          : moderationCase.ritual.care_level === "level2"
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-green-100 text-green-800"
                      }
                    >
                      {moderationCase.ritual.care_level.replace("level", "Level ")}
                    </Badge>
                    {moderationCase.ritual.tags.map((tag) => (
                      <Badge key={tag.id} variant="secondary">
                        {tag.name}
                      </Badge>
                    ))}
                  </div>

                  {moderationCase.ritual.cultural_declaration && (
                    <div>
                      <h5 className="font-medium mb-2">Cultural Declaration</h5>
                      <p className="text-sm text-muted-foreground bg-muted p-3 rounded">
                        {moderationCase.ritual.cultural_declaration}
                      </p>
                    </div>
                  )}
                </div>

                {moderationCase.ritual.audio_file && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Button variant="outline" size="sm" onClick={toggleAudio}>
                        {audioPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      </Button>
                      <span className="text-sm font-medium">Audio Preview</span>
                    </div>

                    {audioPlaying && (
                      <audio
                        controls
                        className="w-full"
                        src={authService.getRitualStreamUrl(moderationCase.ritual.id)}
                        onEnded={() => setAudioPlaying(false)}
                      >
                        Your browser does not support the audio element.
                      </audio>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
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
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Resolution Notes</label>
                  <Textarea
                    placeholder="Add notes about the resolution or current status..."
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

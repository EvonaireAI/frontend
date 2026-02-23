"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { authService, type PendingRitual } from "@/lib/auth"
import { Clock, User, Tag, AlertTriangle, CheckCircle, XCircle, Play, Pause } from "lucide-react"
import { toast } from "sonner"

interface PendingReviewsProps {
  onReviewComplete?: () => void
}

export function PendingReviews({ onReviewComplete }: PendingReviewsProps) {
  const [pendingRituals, setPendingRituals] = useState<PendingRitual[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedRitual, setSelectedRitual] = useState<PendingRitual | null>(null)
  const [reviewNotes, setReviewNotes] = useState("")
  const [creatorFeedback, setCreatorFeedback] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [audioPlaying, setAudioPlaying] = useState<number | null>(null)

  useEffect(() => {
    loadPendingRituals()
  }, [])

  const loadPendingRituals = async () => {
    try {
      const rituals = await authService.getPendingRituals()
      setPendingRituals(rituals)
    } catch (error) {
      console.error("Failed to load pending rituals:", error)
      toast.error("Failed to load pending rituals")
    } finally {
      setLoading(false)
    }
  }

  const handleReview = async (decision: "approve" | "reject") => {
    if (!selectedRitual) return

    setSubmitting(true)
    try {
      await authService.reviewRitual(selectedRitual.id, decision, reviewNotes || undefined)

      toast.success(`Ritual ${decision === "approve" ? "approved" : "rejected"} successfully`)

      // Remove the reviewed ritual from the list
      setPendingRituals((prev) => prev.filter((r) => r.id !== selectedRitual.id))

      // Reset form
      setSelectedRitual(null)
      setReviewNotes("")
      setCreatorFeedback("")

      // Notify parent component
      onReviewComplete?.()
    } catch (error) {
      console.error("Failed to review ritual:", error)
      toast.error("Failed to submit review")
    } finally {
      setSubmitting(false)
    }
  }

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "Unknown"
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`
  }

  const getCareLevel = (level: string) => {
    switch (level) {
      case "level1":
        return { label: "Level 1", color: "bg-green-100 text-green-800" }
      case "level2":
        return { label: "Level 2", color: "bg-yellow-100 text-yellow-800" }
      case "level3":
        return { label: "Level 3", color: "bg-red-100 text-red-800" }
      default:
        return { label: level, color: "bg-gray-100 text-gray-800" }
    }
  }

  const toggleAudio = (ritualId: number) => {
    if (audioPlaying === ritualId) {
      setAudioPlaying(null)
    } else {
      setAudioPlaying(ritualId)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-600" />
            Pending Reviews
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <div className="animate-pulse">Loading pending reviews...</div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-600" />
            Pending Reviews ({pendingRituals.length})
          </CardTitle>
          <CardDescription>Rituals awaiting cultural and emotional safety review</CardDescription>
        </CardHeader>
        <CardContent>
          {pendingRituals.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
              <p className="text-lg font-medium mb-2">All caught up!</p>
              <p className="text-muted-foreground">No rituals pending review at this time.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingRituals.map((ritual) => {
                const careLevel = getCareLevel(ritual.care_level)
                return (
                  <Card key={ritual.id} className="border-l-4 border-l-yellow-500">
                    <CardContent className="pt-6">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg mb-2">{ritual.title}</h3>
                          <p className="text-muted-foreground mb-3 line-clamp-2">{ritual.description}</p>

                          <div className="flex flex-wrap gap-2 mb-3">
                            <Badge className={careLevel.color}>{careLevel.label}</Badge>
                            {ritual.tags.map((tag) => (
                              <Badge key={tag.id} variant="secondary">
                                <Tag className="w-3 h-3 mr-1" />
                                {tag.name}
                              </Badge>
                            ))}
                          </div>

                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <User className="w-4 h-4" />
                              {ritual.creator.first_name} {ritual.creator.last_name}
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="w-4 h-4" />
                              {formatDuration(ritual.duration_seconds)}
                            </div>
                            <div className="flex items-center gap-1">
                              <AlertTriangle className="w-4 h-4" />
                              Submitted {new Date(ritual.submitted_at).toLocaleDateString()}
                            </div>
                          </div>
                        </div>

                        <div className="flex gap-2 ml-4">
                          {ritual.audio_file && (
                            <Button variant="outline" size="sm" onClick={() => toggleAudio(ritual.id)}>
                              {audioPlaying === ritual.id ? (
                                <Pause className="w-4 h-4" />
                              ) : (
                                <Play className="w-4 h-4" />
                              )}
                            </Button>
                          )}

                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="default" size="sm" onClick={() => setSelectedRitual(ritual)}>
                                Review
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                              <DialogHeader>
                                <DialogTitle>Review Ritual: {ritual.title}</DialogTitle>
                                <DialogDescription>
                                  Carefully review this ritual for cultural sensitivity and emotional safety
                                </DialogDescription>
                              </DialogHeader>

                              <div className="space-y-6">
                                <div>
                                  <h4 className="font-medium mb-2">Description</h4>
                                  <p className="text-sm text-muted-foreground bg-muted p-3 rounded">
                                    {ritual.description}
                                  </p>
                                </div>

                                <div>
                                  <h4 className="font-medium mb-2">Cultural Declaration</h4>
                                  <p className="text-sm text-muted-foreground bg-muted p-3 rounded">
                                    {ritual.cultural_declaration}
                                  </p>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <Label htmlFor="review-notes">Internal Notes (Optional)</Label>
                                    <Textarea
                                      id="review-notes"
                                      placeholder="Add internal notes about your review decision..."
                                      value={reviewNotes}
                                      onChange={(e) => setReviewNotes(e.target.value)}
                                      className="mt-1"
                                    />
                                  </div>
                                  <div>
                                    <Label htmlFor="creator-feedback">Feedback to Creator (Optional)</Label>
                                    <Textarea
                                      id="creator-feedback"
                                      placeholder="Provide constructive feedback to the creator..."
                                      value={creatorFeedback}
                                      onChange={(e) => setCreatorFeedback(e.target.value)}
                                      className="mt-1"
                                    />
                                  </div>
                                </div>

                                <div className="flex gap-3 pt-4">
                                  <Button
                                    onClick={() => handleReview("approve")}
                                    disabled={submitting}
                                    className="flex-1 bg-green-600 hover:bg-green-700"
                                  >
                                    <CheckCircle className="w-4 h-4 mr-2" />
                                    Approve Ritual
                                  </Button>
                                  <Button
                                    onClick={() => handleReview("reject")}
                                    disabled={submitting}
                                    variant="destructive"
                                    className="flex-1"
                                  >
                                    <XCircle className="w-4 h-4 mr-2" />
                                    Reject Ritual
                                  </Button>
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </div>

                      {audioPlaying === ritual.id && ritual.audio_file && (
                        <div className="mt-4 p-4 bg-muted rounded-lg">
                          <audio
                            controls
                            className="w-full"
                            src={authService.getRitualStreamUrl(ritual.id)}
                            onEnded={() => setAudioPlaying(null)}
                          >
                            Your browser does not support the audio element.
                          </audio>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

"use client"

import type React from "react"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { rtsService, type RTSSelfAssessment } from "@/lib/rts"
import { Loader2, Heart } from "lucide-react"
import { toast } from "sonner"

interface SelfAssessmentFormProps {
  onSubmitSuccess?: (newScore: number) => void
}

export function SelfAssessmentForm({ onSubmitSuccess }: SelfAssessmentFormProps) {
  const [submitting, setSubmitting] = useState(false)
  const [assessment, setAssessment] = useState<RTSSelfAssessment>({
    physical_health: 3,
    emotional_state: 3,
    spiritual_connection: 3,
    community_engagement: 3,
    creative_energy: 3,
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      const result = await rtsService.submitSelfAssessment(assessment)
      toast.success(`Self-assessment submitted! New score: ${result.new_score}`)
      if (onSubmitSuccess) {
        onSubmitSuccess(result.new_score)
      }
    } catch (error) {
      console.error("Failed to submit assessment:", error)
      toast.error("Failed to submit self-assessment")
    } finally {
      setSubmitting(false)
    }
  }

  const assessmentFields: Array<{ key: keyof RTSSelfAssessment; label: string; description: string }> = [
    {
      key: "physical_health",
      label: "Physical Health",
      description: "How are you feeling physically?",
    },
    {
      key: "emotional_state",
      label: "Emotional State",
      description: "How are you feeling emotionally?",
    },
    {
      key: "spiritual_connection",
      label: "Spiritual Connection",
      description: "How connected do you feel spiritually?",
    },
    {
      key: "community_engagement",
      label: "Community Engagement",
      description: "How engaged are you with the community?",
    },
    {
      key: "creative_energy",
      label: "Creative Energy",
      description: "How is your creative energy?",
    },
  ]

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-foreground">
          <Heart className="w-5 h-5 text-primary" />
          Self-Assessment
        </CardTitle>
        <CardDescription>Rate your current state on a scale of 1-5</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {assessmentFields.map((field) => (
            <div key={field.key} className="space-y-2">
              <div className="flex justify-between items-center">
                <Label htmlFor={field.key} className="text-foreground">{field.label}</Label>
                <span className="text-sm font-medium text-primary">{assessment[field.key]}</span>
              </div>
              <p className="text-xs text-muted-foreground">{field.description}</p>
              <Slider
                id={field.key}
                min={1}
                max={5}
                step={1}
                value={[assessment[field.key]]}
                onValueChange={(value) =>
                  setAssessment((prev) => ({
                    ...prev,
                    [field.key]: value[0],
                  }))
                }
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Low</span>
                <span>High</span>
              </div>
            </div>
          ))}

          <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-gold-muted" disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              "Submit Assessment"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

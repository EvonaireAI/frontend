"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Loader2, Check } from "lucide-react"
import {
  gatewayQuizService,
  emitGatewayProgress,
  GatewayAnswerError,
  cleanNarration,
  type GatewayQuizQuestion,
  type GatewayQuizOptionKey,
  type GatewayQuizAnswerResult,
} from "@/lib/gateway-quiz"

const OPTION_KEYS: GatewayQuizOptionKey[] = ["A", "B", "C", "D"]

interface GatewayQuestionCardProps {
  question: GatewayQuizQuestion
  // Fired after the user reviews the (quiet) result and taps continue.
  onComplete: (result: GatewayQuizAnswerResult) => void
  // Fired on a 409 already-answered — the parent should refetch /next/.
  onStale: () => void
  continueLabel?: string
}

// Renders a single Gateway question with its options, submits the answer, and
// shows a brief, un-gamified reveal of the intended answer. Shared by the gentle
// nudge and the finish-your-Gateway modal.
export function GatewayQuestionCard({
  question,
  onComplete,
  onStale,
  continueLabel = "Continue",
}: GatewayQuestionCardProps) {
  const [selected, setSelected] = useState<GatewayQuizOptionKey | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<GatewayQuizAnswerResult | null>(null)
  const [error, setError] = useState<string>("")

  const optionKeys = OPTION_KEYS.filter((key) => key in question.options)

  const handleSubmit = async () => {
    if (!selected || submitting) return
    setSubmitting(true)
    setError("")
    try {
      const answer = await gatewayQuizService.submitAnswer(question.question_number, selected)
      emitGatewayProgress(answer)
      setResult(answer)
    } catch (err) {
      if (err instanceof GatewayAnswerError && err.status === 409) {
        // Already answered elsewhere — benign; let the parent move on.
        onStale()
        return
      }
      setError(err instanceof Error ? err.message : "Couldn't record your answer")
    } finally {
      setSubmitting(false)
    }
  }

  // Reveal stage — quiet acknowledgement, no score, no streak.
  if (result) {
    return (
      <div className="space-y-4">
        {result.is_correct ? (
          <div className="flex items-start gap-2 text-sm text-foreground">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>That resonates.</span>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            The intended reflection was{" "}
            <span className="font-medium text-foreground">{result.correct_option}</span>
            {result.correct_option_text ? ` — ${cleanNarration(result.correct_option_text)}` : ""}.
          </p>
        )}
        {result.completion_message && (
          <p className="rounded-lg bg-primary/10 px-3 py-2 text-sm text-foreground">
            {cleanNarration(result.completion_message)}
          </p>
        )}
        <Button
          onClick={() => onComplete(result)}
          className="w-full bg-primary text-primary-foreground hover:bg-gold-muted"
        >
          {continueLabel}
        </Button>
      </div>
    )
  }

  // Question stage.
  return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed text-foreground">
        {cleanNarration(question.question_text)}
      </p>
      <div className="space-y-2">
        {optionKeys.map((key) => {
          const active = selected === key
          return (
            <button
              key={key}
              type="button"
              onClick={() => setSelected(key)}
              className={`flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
                active
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border bg-transparent text-muted-foreground hover:bg-secondary/60"
              }`}
            >
              <span className={`font-medium ${active ? "text-primary" : "text-muted-foreground"}`}>
                {key}
              </span>
              <span>{cleanNarration(question.options[key])}</span>
            </button>
          )
        })}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button
        onClick={handleSubmit}
        disabled={!selected || submitting}
        className="w-full bg-primary text-primary-foreground hover:bg-gold-muted"
      >
        {submitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Saving…
          </>
        ) : (
          "Answer"
        )}
      </Button>
    </div>
  )
}

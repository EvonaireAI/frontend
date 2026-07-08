"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Loader2, Compass } from "lucide-react"
import { GatewayQuestionCard } from "@/components/gateway/gateway-question-card"
import {
  gatewayQuizService,
  onGatewayCompletionRequest,
  setGatewayModalOpen,
  toProgress,
  GatewayCancelledError,
  type GatewayCompletionRequest,
  type GatewayProgress,
  type GatewayQuizQuestion,
} from "@/lib/gateway-quiz"

// Opened by a gateway_incomplete 403 on a consequential action (checkout, join,
// withdraw). Lets the user answer the remaining questions inline; on completion
// it resolves the pending request so runGatedAction retries the original action.
export function GatewayCompletionModalHost() {
  const [open, setOpen] = useState(false)
  const [queue, setQueue] = useState<GatewayQuizQuestion[]>([])
  const [progress, setProgress] = useState<GatewayProgress | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const pendingRef = useRef<GatewayCompletionRequest | null>(null)

  const close = useCallback(() => {
    setOpen(false)
    setGatewayModalOpen(false)
    setQueue([])
    setProgress(null)
    setError("")
    setLoading(false)
  }, [])

  const settleSuccess = useCallback(() => {
    pendingRef.current?.resolve()
    pendingRef.current = null
    close()
  }, [close])

  const settleCancel = useCallback(() => {
    pendingRef.current?.reject(new GatewayCancelledError())
    pendingRef.current = null
    close()
  }, [close])

  const loadBatch = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const next = await gatewayQuizService.getNext(5)
      setProgress(toProgress(next))
      if (next.completed || next.questions.length === 0) {
        settleSuccess()
        return
      }
      setQueue(next.questions)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load your questions")
    } finally {
      setLoading(false)
    }
  }, [settleSuccess])

  useEffect(
    () =>
      onGatewayCompletionRequest((request) => {
        pendingRef.current = request
        setProgress({
          answered_count: request.denial.answered,
          total: request.denial.total,
          remaining: request.denial.remaining,
          completed: false,
        })
        setQueue([])
        setError("")
        setOpen(true)
        setGatewayModalOpen(true)
        void loadBatch()
      }),
    [loadBatch],
  )

  const handleAnswered = (result: GatewayProgress) => {
    setProgress(toProgress(result))
    if (result.completed) {
      settleSuccess()
      return
    }
    setQueue((prev) => {
      const rest = prev.slice(1)
      if (rest.length === 0) void loadBatch()
      return rest
    })
  }

  const current = queue[0]
  const remaining = progress?.remaining ?? 0
  const total = progress?.total ?? 0
  const answered = progress?.answered_count ?? 0

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? undefined : settleCancel())}>
      <DialogContent className="max-w-md bg-card border-border">
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Compass className="h-5 w-5 text-primary" />
          </div>
          <DialogTitle className="text-center text-foreground">
            Finish your Gateway questions to continue
          </DialogTitle>
          <DialogDescription className="text-center">
            {remaining > 0
              ? `Just ${remaining} more to go. Your answers help us shape your journey — then we'll pick up right where you left off.`
              : "Almost there — one moment."}
          </DialogDescription>
        </DialogHeader>

        {total > 0 && (
          <p className="text-center text-xs uppercase tracking-widest text-muted-foreground">
            Gateway · {answered} / {total}
          </p>
        )}

        {loading && !current ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : error ? (
          <div className="space-y-3 py-2">
            <p className="text-center text-sm text-destructive">{error}</p>
            <Button
              onClick={() => void loadBatch()}
              className="w-full bg-primary text-primary-foreground hover:bg-gold-muted"
            >
              Try again
            </Button>
          </div>
        ) : current ? (
          <GatewayQuestionCard
            key={current.question_number}
            question={current}
            onComplete={handleAnswered}
            onStale={() => void loadBatch()}
            continueLabel="Continue"
          />
        ) : (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

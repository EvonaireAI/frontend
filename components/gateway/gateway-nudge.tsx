"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import { X, Sparkles } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { useGateway } from "@/lib/gateway-context"
import { GatewayQuestionCard } from "@/components/gateway/gateway-question-card"
import {
  gatewayQuizService,
  emitGatewayProgress,
  isGatewayModalOpen,
  type GatewayQuizQuestion,
} from "@/lib/gateway-quiz"

// One prompt per this window at most; persisted so it survives reloads.
const CADENCE_MS = 10 * 60 * 1000
// Fire on only a fraction of eligible route changes — a nudge, never a nag.
const SHOW_PROBABILITY = 0.25
const LAST_SHOWN_KEY = "evonaire_gateway_nudge_last"

// Routes where the nudge must stay out of the way: auth/onboarding, the full
// Gateway page itself, the ritual player (never interrupt playback), and the
// checkout/upgrade surfaces.
const SUPPRESSED_PREFIXES = [
  "/auth",
  "/consent",
  "/gateway-quiz",
  "/member/ritual",
  "/member/upgrade",
  "/member/payment",
]

function isSuppressedRoute(pathname: string | null): boolean {
  if (!pathname) return true
  if (pathname === "/" || pathname === "/activate") return true
  return SUPPRESSED_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

function withinCadence(): boolean {
  try {
    const last = localStorage.getItem(LAST_SHOWN_KEY)
    if (!last) return true
    return Date.now() - Number(last) >= CADENCE_MS
  } catch {
    return true
  }
}

function markShown(): void {
  try {
    localStorage.setItem(LAST_SHOWN_KEY, Date.now().toString())
  } catch {
    // Non-fatal — worst case the cadence cap isn't persisted this once.
  }
}

// A small, always-dismissible card that surfaces one Gateway question at a time.
// It never blocks browsing and holds back during playback, checkout, or an open
// modal.
export function GatewayNudge() {
  const pathname = usePathname()
  const { user, consentsAccepted } = useAuth()
  const { progress } = useGateway()
  const [question, setQuestion] = useState<GatewayQuizQuestion | null>(null)
  const [visible, setVisible] = useState(false)
  const busyRef = useRef(false)

  const dismiss = useCallback(() => {
    setVisible(false)
    setQuestion(null)
  }, [])

  const tryFetchAndShow = useCallback(async () => {
    if (busyRef.current) return
    busyRef.current = true
    try {
      const next = await gatewayQuizService.getNext(1)
      emitGatewayProgress(next)
      if (next.completed || next.questions.length === 0) return
      setQuestion(next.questions[0])
      setVisible(true)
      markShown()
    } catch {
      // Silent — a nudge that can't load simply doesn't appear.
    } finally {
      busyRef.current = false
    }
  }, [])

  useEffect(() => {
    // Step out of the way on suppressed routes (e.g. entering the player).
    if (isSuppressedRoute(pathname)) {
      if (visible) dismiss()
      return
    }
    if (!user || !consentsAccepted) return
    if (progress?.completed) return
    if (visible || isGatewayModalOpen()) return
    if (!withinCadence()) return
    if (Math.random() > SHOW_PROBABILITY) return
    void tryFetchAndShow()
    // Only re-evaluate on navigation / auth changes — not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, user, consentsAccepted, progress?.completed])

  if (!visible || !question) return null

  const answered = progress?.answered_count
  const total = progress?.total

  return (
    <div className="fixed bottom-4 left-4 z-40 w-[calc(100%-2rem)] max-w-sm">
      <div className="rounded-2xl border border-border bg-card shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <div>
              <p className="text-sm font-medium text-foreground">A gentle question</p>
              {typeof answered === "number" && typeof total === "number" && total > 0 && (
                <p className="text-xs text-muted-foreground">
                  Gateway · {answered} / {total}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss"
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-4 py-4">
          <GatewayQuestionCard
            key={question.question_number}
            question={question}
            onComplete={dismiss}
            onStale={dismiss}
            continueLabel="Done"
          />
        </div>
      </div>
    </div>
  )
}

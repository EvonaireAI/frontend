"use client"

import type { ReactNode } from "react"
import { useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { authService, type Ritual } from "@/lib/auth"
import { GLOSSARY } from "@/lib/glossary"
import { Compass, Play, Users, ScrollText, Landmark, ArrowRight } from "lucide-react"

interface PlayHistoryItem {
  id: number
  ritual: number
  ritual_title: string
  progress_seconds: number
  is_completed: boolean
  started_at: string
}

/**
 * The seeker's starting point on the Sacred Library home. Answers the CEO's
 * five questions ("Where do I begin? What next? Which sanctuary? How is my
 * practice growing? Where can I participate?") from data the page already has
 * plus the existing play-history endpoint — no new backend.
 *
 * Deliberately calm per the charter: it suggests, it never scolds. There are
 * no streaks, no comparisons and no "you haven't practised in N days".
 */
export function BeginHere({ rituals }: { rituals: Ritual[] }) {
  const [history, setHistory] = useState<PlayHistoryItem[] | null>(null)

  useEffect(() => {
    let cancelled = false
    authService
      .getMyPlayHistory()
      .then((data) => {
        if (!cancelled) setHistory(data)
      })
      .catch(() => {
        // History is a nicety here — fall back to the first-visit copy.
        if (!cancelled) setHistory([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Wait for history before choosing copy, so the card doesn't flip from
  // "Begin here" to "Continue" under the reader.
  if (history === null) return null

  const unlocked = rituals.filter((r) => !r.locked)
  if (unlocked.length === 0) return null

  // Most recent unfinished session, if the ritual is still available.
  const inProgress = history
    .filter((p) => !p.is_completed && p.progress_seconds > 0)
    .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())
    .find((p) => unlocked.some((r) => r.id === p.ritual))

  const playedIds = new Set(history.map((p) => p.ritual))
  // Something new; gentlest first for a first-time seeker.
  const next =
    unlocked.find((r) => !playedIds.has(r.id) && r.care_level === "level1") ??
    unlocked.find((r) => !playedIds.has(r.id))

  const firstVisit = history.length === 0

  const suggestion = inProgress
    ? {
        eyebrow: "Continue your practice",
        title: inProgress.ritual_title,
        body: "You left this one partway through. It will pick up where you paused.",
        href: `/member/ritual/${inProgress.ritual}`,
        cta: "Continue",
      }
    : next
    ? {
        eyebrow: firstVisit ? "Begin here" : "What to experience next",
        title: next.title,
        body: firstVisit
          ? "A gentle place to start. Find somewhere quiet, and take it at your own pace."
          : "Chosen from practices you haven't experienced yet.",
        href: `/member/ritual/${next.id}`,
        cta: firstVisit ? "Begin" : "Experience",
      }
    : null

  if (!suggestion) return null

  return (
    <Card className="bg-card border-primary/30 mb-8">
      <CardContent className="p-5 sm:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-gold-muted mb-2">
              <Compass className="w-3.5 h-3.5" />
              {suggestion.eyebrow}
            </p>
            <h2 className="text-xl font-semibold text-foreground mb-1 text-balance">{suggestion.title}</h2>
            <p className="text-sm text-muted-foreground max-w-prose">{suggestion.body}</p>
          </div>
          <Button
            asChild
            size="lg"
            className="w-full sm:w-auto flex-shrink-0 bg-primary text-primary-foreground hover:bg-gold-muted"
          >
            <Link href={suggestion.href}>
              <Play className="w-4 h-4 mr-2" />
              {suggestion.cta}
            </Link>
          </Button>
        </div>

        {/* The other three questions, answered as quiet doors rather than tasks. */}
        <div className="grid gap-2 sm:grid-cols-3 mt-5 pt-5 border-t border-border">
          <QuietLink href="/member/my-sanctuary" icon={<Users className="w-4 h-4" />}>
            Find your sanctuary
          </QuietLink>
          <QuietLink href="/member/ledger" icon={<ScrollText className="w-4 h-4" />}>
            See how your practice is growing
          </QuietLink>
          <QuietLink href="/member/agora" icon={<Landmark className="w-4 h-4" />}>
            Take part in {GLOSSARY.agora}
          </QuietLink>
        </div>
      </CardContent>
    </Card>
  )
}

function QuietLink({
  href,
  icon,
  children,
}: {
  href: string
  icon: ReactNode
  children: ReactNode
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-2 rounded-md px-2 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
    >
      <span className="text-primary">{icon}</span>
      <span className="min-w-0 flex-1">{children}</span>
      <ArrowRight className="w-3.5 h-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
    </Link>
  )
}

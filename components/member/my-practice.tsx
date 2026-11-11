"use client"

import { useEffect, useState } from "react"
import { fetchPracticeSummary, type PracticePeriod, type PracticeSummary } from "@/lib/practice"
import { Loader2, Sparkles } from "lucide-react"
import { fmtLocale, tr, trNode } from "@/lib/i18n"


interface FallbackCounts {
  /** Locally derived all-time figures, used until the endpoint answers. */
  allTime: PracticePeriod
  currentMonth: PracticePeriod
}

/**
 * "My Practice" — the personal section of The Ledger.
 *
 * Charter: calm and personal. No comparisons to other seekers, no leaderboard,
 * no streaks, and no language that implies falling behind. A month with one
 * session reads exactly as neutrally as a month with thirty.
 */
export function MyPractice({
  fallback,
  isCreator,
}: {
  fallback: FallbackCounts
  /** `blessings_received` is always 0 for non-creators — hide it rather than
   *  showing a permanent zero (API_CONTRACTS Session 10, frontend notes). */
  isCreator: boolean
}) {
  const [summary, setSummary] = useState<PracticeSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetchPracticeSummary()
      .then((data) => {
        if (!cancelled) setSummary(data)
      })
      .catch(() => {
        // Endpoint not live yet (or offline) — the locally derived counts below
        // are already accurate for everything except blessings received.
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const allTime: PracticePeriod = summary ?? fallback.allTime
  const month: PracticePeriod = summary?.current_month ?? fallback.currentMonth
  const tiles = [
    { label: tr("Sessions"), value: allTime.sessions_count },
    { label: tr("Rituals completed"), value: allTime.rituals_completed },
    // Server-side this is already whole minutes — never divide it again.
    { label: tr("Minutes listening"), value: allTime.listening_minutes },
    { label: tr("Blessings given"), value: allTime.blessings_given },
    ...(isCreator && summary !== null
      ? [{ label: tr("Blessings received"), value: allTime.blessings_received }]
      : []),
  ]

  return (
    <section className="mb-8" aria-labelledby="my-practice-heading">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-4 h-4 text-primary" />
        <h2 id="my-practice-heading" className="text-base font-semibold text-foreground">
          {tr("My Practice")}
        </h2>
        {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {tiles.map((tile) => (
          <div key={tile.label} className="bg-card border border-border rounded-xl p-4 flex flex-col gap-1">
            <p className="text-2xl font-bold text-foreground tabular-nums">{tile.value.toLocaleString(fmtLocale())}</p>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">{tile.label}</p>
          </div>
        ))}
      </div>

      <p className="text-sm text-muted-foreground mt-3">
        <span className="text-foreground">{tr("This month:")}</span>{trNode(" {p0} {p1} · {p2} {p3} of listening · {p4} {p5} given.", { p0: month.sessions_count.toLocaleString(fmtLocale()), p1: month.sessions_count === 1 ? "session" : "sessions", p2: month.listening_minutes.toLocaleString(fmtLocale()), p3: month.listening_minutes === 1 ? "minute" : "minutes", p4: month.blessings_given.toLocaleString(fmtLocale()), p5: month.blessings_given === 1 ? "blessing" : "blessings" })}
      </p>
      <p className="text-xs text-muted-foreground/80 mt-1">
        {tr("A record of your own practice — nothing here is compared to anyone else's.")}
      </p>
    </section>
  )
}

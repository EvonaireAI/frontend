"use client"

import type { ReactNode } from "react"
import { useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import type { Ritual } from "@/lib/auth"
import { rtsService, type RTSScore } from "@/lib/rts"
import { royaltiesService, type CreatorEarnings } from "@/lib/royalties"
import { sanctuariesService, type Sanctuary } from "@/lib/sanctuaries"
import { centsToDollarString } from "@/lib/metrics"
import { GLOSSARY } from "@/lib/glossary"
import { Activity, Coins, Users, Upload, ArrowRight, Loader2 } from "lucide-react"

/**
 * The compact status strip on the Creator Studio home: what's ready to
 * publish, my RTS, what I earned, what's happening in my sanctuary, and the
 * single next step. Composed entirely from endpoints the creator surfaces
 * already use — no new backend.
 *
 * Every panel degrades to "—" on failure rather than blocking the page; a
 * creator should still reach their rituals if, say, payouts is down.
 */
export function StudioStatusStrip({ rituals, ritualsLoading }: { rituals: Ritual[]; ritualsLoading: boolean }) {
  const [rts, setRts] = useState<RTSScore | null>(null)
  const [earnings, setEarnings] = useState<CreatorEarnings | null>(null)
  const [sanctuaries, setSanctuaries] = useState<Sanctuary[] | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      rtsService.getMyScore().catch(() => null),
      royaltiesService.getEarnings().catch(() => null),
      sanctuariesService.getOwnedSanctuaries().catch(() => null),
    ])
      .then(([score, earned, owned]) => {
        if (cancelled) return
        setRts(score)
        setEarnings(earned)
        setSanctuaries(owned)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const approved = rituals.filter((r) => r.status === "approved").length
  const inReview = rituals.filter((r) => r.status === "pending_review" || r.status === "submitted").length
  const draft = rituals.length - approved - inReview

  const members = (sanctuaries ?? []).reduce((acc, s) => acc + (s.active_members_count ?? 0), 0)
  const sanctuaryCount = sanctuaries?.length ?? 0

  // The single most useful next step, in order of what actually unblocks them.
  const nextStep =
    rituals.length === 0
      ? { label: `Upload your first ritual`, href: "/creator/upload" }
      : inReview > 0
      ? { label: `${inReview} awaiting review — check status`, href: "/creator" }
      : sanctuaryCount === 0
      ? { label: "Create a sanctuary for your practice", href: "/creator/sanctuaries/create" }
      : earnings?.payouts_ready
      ? { label: "You have a payout ready", href: "/creator/payouts" }
      : { label: `Upload another ritual`, href: "/creator/upload" }

  return (
    <div className="mb-8">
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Panel
          icon={<Upload className="w-4 h-4" />}
          label="Ready to publish"
          value={ritualsLoading ? null : `${approved}`}
          hint={ritualsLoading ? "" : `${inReview} in review · ${draft > 0 ? `${draft} draft` : "no drafts"}`}
          href="/creator"
        />
        <Panel
          icon={<Activity className="w-4 h-4" />}
          label={GLOSSARY.rtsShort}
          value={loading ? null : rts ? `${rts.current_score}` : "—"}
          hint={rts ? rtsService.getScoreBand(rts.current_score).replace("_", " ") : "Not yet calculated"}
          href="/creator"
        />
        <Panel
          icon={<Coins className="w-4 h-4" />}
          label="Lifetime earned"
          value={loading ? null : earnings ? centsToDollarString(earnings.lifetime_earned_cents) : "—"}
          hint={
            earnings
              ? `${centsToDollarString(earnings.payable_balance_cents)} payable`
              : "No statements yet"
          }
          href="/creator/earnings"
        />
        <Panel
          icon={<Users className="w-4 h-4" />}
          label="In your sanctuaries"
          value={loading ? null : `${members}`}
          hint={sanctuaryCount === 1 ? "1 sanctuary" : `${sanctuaryCount} sanctuaries`}
          href="/creator"
        />
      </div>

      <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-xl border border-primary/30 bg-card px-4 py-3">
        <p className="text-sm text-muted-foreground">
          <span className="text-xs uppercase tracking-widest text-gold-muted mr-2">Next step</span>
          {nextStep.label}
        </p>
        <Button asChild size="sm" variant="ghost" className="text-primary hover:text-gold-muted self-start sm:self-auto">
          <Link href={nextStep.href}>
            Go
            <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </Link>
        </Button>
      </div>
    </div>
  )
}

function Panel({
  icon,
  label,
  value,
  hint,
  href,
}: {
  icon: ReactNode
  label: string
  value: string | null
  hint: string
  href: string
}) {
  return (
    <Link
      href={href}
      className="bg-card border border-border rounded-xl p-4 flex flex-col gap-1 transition-colors hover:border-primary/40"
    >
      <span className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
        <span className="text-primary">{icon}</span>
        {label}
      </span>
      <span className="text-2xl font-bold text-foreground tabular-nums">
        {value === null ? <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /> : value}
      </span>
      {hint && <span className="text-xs text-muted-foreground capitalize">{hint}</span>}
    </Link>
  )
}

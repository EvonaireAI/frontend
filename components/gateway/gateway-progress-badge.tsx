"use client"

import Link from "next/link"
import { Compass } from "lucide-react"
import { useGateway } from "@/lib/gateway-context"
import { tr } from "@/lib/i18n"


// A quiet, informational progress indicator for the chrome. Not a pressure
// device — it simply links to the full Gateway page and hides once completed.
export function GatewayProgressBadge() {
  const { progress } = useGateway()

  if (!progress || progress.completed || progress.total <= 0) return null

  return (
    <Link
      href="/gateway-quiz"
      title={tr("Your Gateway progress")}
      aria-label={tr("Gateway progress: {p0} of {p1}", { p0: progress.answered_count, p1: progress.total })}
      // Visible at every breakpoint / orientation. The label collapses to just
      // the count on narrow (portrait) widths so it never gets clipped or hidden.
      className="inline-flex items-center gap-1.5 rounded-full border border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
    >
      <Compass className="h-3.5 w-3.5 shrink-0" />
      <span>
        <span className="hidden sm:inline">{tr("Gateway ")}</span>
        {progress.answered_count}/{progress.total}
      </span>
    </Link>
  )
}

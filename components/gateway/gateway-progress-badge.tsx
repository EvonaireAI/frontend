"use client"

import Link from "next/link"
import { Compass } from "lucide-react"
import { useGateway } from "@/lib/gateway-context"

// A quiet, informational progress indicator for the chrome. Not a pressure
// device — it simply links to the full Gateway page and hides once completed.
export function GatewayProgressBadge() {
  const { progress } = useGateway()

  if (!progress || progress.completed || progress.total <= 0) return null

  return (
    <Link
      href="/gateway-quiz"
      title="Your Gateway progress"
      className="hidden items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
    >
      <Compass className="h-3.5 w-3.5" />
      <span>
        Gateway {progress.answered_count} / {progress.total}
      </span>
    </Link>
  )
}

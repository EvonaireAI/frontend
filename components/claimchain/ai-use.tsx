import { Ban, Check } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { AI_USE_ROWS, type AiUse } from "@/lib/claimchain"

// All four flags are false today. Rendering them as *explicitly denied* rather
// than omitting them is the entire reason they are stored: for an AI company
// doing diligence, "no record" and "not permitted" are very different answers,
// and the absence of a permission must never be read as one.
//
// Both renderers read the flags at runtime, so a license that one day does
// carry a machine-use right will say so instead of lying.

function state(granted: boolean) {
  return granted
    ? { label: "Permitted", className: "bg-primary/10 text-primary border-primary/30" }
    : { label: "Not permitted", className: "bg-secondary text-muted-foreground border-border" }
}

/**
 * Compact form for a table row or a card.
 *
 * The denial is in the chip's own text — "No AI training", not "AI training"
 * with the refusal hidden in a tooltip. A chip you have to hover to understand
 * is a chip that reads as a permission at a glance, which is the exact wrong
 * answer for these four.
 */
export function AiUseChips({ aiUse, className }: { aiUse: AiUse; className?: string }) {
  return (
    <div className={className}>
      <div className="flex flex-wrap gap-1.5">
        {AI_USE_ROWS.map(({ key, label, deniedLabel }) => {
          const granted = !!aiUse?.[key]
          const { label: stateLabel, className: chipClass } = state(granted)
          return (
            <Badge
              key={key}
              variant="outline"
              className={`text-xs gap-1 font-normal ${chipClass}`}
              title={`${label}: ${stateLabel}`}
            >
              {granted ? (
                <Check className="w-3 h-3" aria-hidden />
              ) : (
                <Ban className="w-3 h-3" aria-hidden />
              )}
              {granted ? label : deniedLabel}
            </Badge>
          )
        })}
      </div>
    </div>
  )
}

/** Explicit rows, for the public verification page where this is load-bearing. */
export function AiUseRows({ aiUse }: { aiUse: AiUse }) {
  return (
    <dl className="divide-y divide-border rounded-lg border border-border overflow-hidden">
      {AI_USE_ROWS.map(({ key, label }) => {
        const granted = !!aiUse?.[key]
        return (
          <div key={key} className="flex items-center justify-between gap-4 px-4 py-2.5 bg-card">
            <dt className="text-sm text-foreground">{label}</dt>
            <dd
              className={`text-sm font-medium inline-flex items-center gap-1.5 ${
                granted ? "text-primary" : "text-muted-foreground"
              }`}
            >
              {granted ? (
                <Check className="w-4 h-4" aria-hidden />
              ) : (
                <Ban className="w-4 h-4" aria-hidden />
              )}
              {state(granted).label}
            </dd>
          </div>
        )
      })}
    </dl>
  )
}

import { Badge } from "@/components/ui/badge"
import { anchorStatusLabel, type Anchoring, type AnchorStatus } from "@/lib/claimchain"

// The backend's `anchoring.note` is rendered verbatim, in plain type, with no
// icon and no emphasis. Paraphrasing it into something more impressive is the
// single easiest way to turn an honest feature into a misleading one, and the
// note already says exactly what is true: the roots exist, they are not
// published anywhere external, and they can be published later without any
// hash changing.

export function AnchoringNote({ anchoring }: { anchoring: Anchoring | null | undefined }) {
  if (!anchoring?.note) return null

  return (
    <p className="text-xs text-muted-foreground leading-relaxed max-w-prose">{anchoring.note}</p>
  )
}

/**
 * The publication state of one batch.
 *
 * `pending` is not work in flight — anchoring is switched off, so every batch
 * sits here and will until it ships. No spinner, no "…", nothing that suggests
 * the state is about to change on its own.
 */
export function AnchorStatusBadge({
  status,
  anchoring,
}: {
  status: AnchorStatus | null | undefined
  anchoring?: Anchoring | null
}) {
  const label = anchorStatusLabel(status, anchoring)
  const className =
    status === "failed"
      ? "bg-destructive/10 text-destructive border-destructive/30"
      : status === "anchored"
        ? "bg-primary/10 text-primary border-primary/30"
        : "bg-secondary text-muted-foreground border-border"

  return (
    <Badge variant="outline" className={`text-xs font-normal ${className}`}>
      {label}
    </Badge>
  )
}

import { Badge } from "@/components/ui/badge"
import { Sparkles } from "lucide-react"
import { format } from "date-fns"
import { licenseLabel, type EarlyAccess, type LicenseLevel } from "@/lib/commons"

// Neutral informational chip — "L1 · Open" / "L2 · Guided". Not a tier lock.
export function LicenseChip({ level }: { level: LicenseLevel }) {
  return (
    <Badge variant="outline" className="bg-secondary text-secondary-foreground border-border text-xs">
      {licenseLabel(level)}
    </Badge>
  )
}

// Early access is framed as a Scholar perk, never as scarcity.
export function EarlyAccessBadge({ earlyAccess }: { earlyAccess: EarlyAccess }) {
  if (!earlyAccess.active) return null
  return (
    <Badge
      variant="outline"
      className="bg-primary/10 text-primary border-primary/30 text-xs gap-1"
      title={`Everyone else on ${format(new Date(earlyAccess.until), "MMM d, yyyy")}`}
    >
      <Sparkles className="w-3 h-3" />
      Early access · Scholars
    </Badge>
  )
}

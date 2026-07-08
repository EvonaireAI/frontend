import { EyeOff } from "lucide-react"

// Shown whenever a royalty payload carries shadow_mode: true — periods
// compute (and can be approved as a drill) but no money moves.
export function ShadowModeBanner() {
  return (
    <div className="mb-6 flex items-center gap-3 bg-yellow-900/20 border border-yellow-500/30 rounded-xl px-4 py-3">
      <EyeOff className="w-4 h-4 text-yellow-400 flex-shrink-0" />
      <p className="text-sm text-yellow-200">
        <span className="font-semibold tracking-wide">SHADOW MODE</span> — no transfers execute.
        Periods compute and can be reviewed, but no money moves.
      </p>
    </div>
  )
}

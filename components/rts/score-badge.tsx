import { Badge } from "@/components/ui/badge"
import { rtsService } from "@/lib/rts"
import { TrendingUp, TrendingDown, Minus } from "lucide-react"

interface ScoreBadgeProps {
  score: number
  band: string
  size?: "sm" | "md" | "lg"
  showTrend?: boolean
  previousScore?: number
}

export function ScoreBadge({ score, band, size = "md", showTrend = false, previousScore }: ScoreBadgeProps) {
  const colorClass = rtsService.getBandColor(band)
  const label = rtsService.getBandLabel(band)
  const displayScore = Math.round(score)

  const sizeClasses = {
    sm: "text-xs px-2 py-1",
    md: "text-sm px-3 py-1.5",
    lg: "text-lg px-4 py-2",
  }

  const scoreSizeClasses = {
    sm: "text-lg",
    md: "text-2xl",
    lg: "text-4xl",
  }

  const getTrend = () => {
    if (!showTrend || previousScore === undefined) return null
    if (score > previousScore) return <TrendingUp className="w-4 h-4 text-green-600" />
    if (score < previousScore) return <TrendingDown className="w-4 h-4 text-red-600" />
    return <Minus className="w-4 h-4 text-gray-400" />
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="w-20 h-20 rounded-full bg-secondary border-2 border-primary/30 flex items-center justify-center">
        <div className={`font-bold text-primary ${scoreSizeClasses[size]}`}>{displayScore}</div>
      </div>
      <Badge variant="outline" className={`${colorClass} ${sizeClasses[size]} border-2`}>
        {label}
      </Badge>
      {showTrend && getTrend()}
    </div>
  )
}

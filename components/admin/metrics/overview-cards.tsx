"use client"

import type { ReactNode } from "react"
import { format } from "date-fns"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { centsToDollarString, type MetricsOverview } from "@/lib/metrics"
import { AlertTriangle, Clock } from "lucide-react"

function StatCard({
  label,
  value,
  caption,
  warning,
  warningIcon,
  hero,
}: {
  label: string
  value: string
  caption?: ReactNode
  warning?: boolean
  warningIcon?: ReactNode
  hero?: boolean
}) {
  return (
    <Card className={warning ? "border-destructive/50 bg-destructive/5" : undefined}>
      <CardContent className="pt-6">
        <p className="text-sm text-muted-foreground flex items-center gap-1.5">
          {warning && warningIcon}
          {label}
        </p>
        <p className={`font-semibold text-foreground mt-1 ${hero ? "text-4xl" : "text-2xl"}`}>
          {value}
        </p>
        {caption && <p className="text-xs text-muted-foreground mt-1">{caption}</p>}
      </CardContent>
    </Card>
  )
}

export function OverviewCardsSkeleton() {
  return (
    <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="pt-6 space-y-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-16" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export function OverviewCards({ overview }: { overview: MetricsOverview }) {
  const updated = format(new Date(overview.as_of), "MMM d, yyyy h:mm a")

  return (
    <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
      <StatCard
        hero
        label="Monthly recurring revenue"
        value={centsToDollarString(overview.mrr_cents)}
        caption={`Updated ${updated}`}
      />
      <StatCard label="Active paid subscriptions" value={overview.active_subscriptions.toLocaleString()} />
      <StatCard
        label="ARPU"
        value={centsToDollarString(overview.arpu_cents)}
        caption={`${centsToDollarString(overview.arpa_all_actives_cents)} across all actives (free included)`}
      />
      <StatCard
        label="Scheduled to cancel"
        value={overview.scheduled_to_cancel.toLocaleString()}
        caption={overview.scheduled_to_cancel > 0 ? "Paid subs lapsing at period end" : undefined}
        warning={overview.scheduled_to_cancel > 0}
        warningIcon={<Clock className="w-4 h-4 text-destructive" />}
      />
      <StatCard
        label="Past due"
        value={overview.past_due.toLocaleString()}
        caption={overview.past_due > 0 ? "Payment failed — needs attention" : undefined}
        warning={overview.past_due > 0}
        warningIcon={<AlertTriangle className="w-4 h-4 text-destructive" />}
      />
    </div>
  )
}

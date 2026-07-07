"use client"

import { useMemo, useState } from "react"
import { Cell, Label, Pie, PieChart } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import type { MetricsOverview, PlanCount } from "@/lib/metrics"

// Ordinal ramp of the brand gold, light→dark by tier (validated against the
// app surface). Unknown future plan keys fall back to the darkest step.
const TIER_COLORS: Record<string, string> = {
  free: "var(--chart-3)",
  evocore: "var(--chart-1)",
  evobloom: "var(--chart-2)",
  evoluxe: "var(--chart-5)",
}
const TIER_FALLBACK_COLOR = "var(--chart-4)"

function tierColor(plan: string): string {
  return TIER_COLORS[plan] ?? TIER_FALLBACK_COLOR
}

export function TierDonutSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-56" />
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4">
        <Skeleton className="h-44 w-44 rounded-full" />
        <div className="w-full space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
        </div>
      </CardContent>
    </Card>
  )
}

export function TierDonut({ overview }: { overview: MetricsOverview }) {
  // Wanderer dwarfs the paid tiers, so a paid-only view keeps Seeker/Scholar
  // readable. Default to it when there are paying subscribers.
  const hasPaid = overview.by_plan.some((p) => p.plan !== "free" && p.count > 0)
  const [view, setView] = useState<"all" | "paid">(hasPaid ? "paid" : "all")

  const segments = useMemo<PlanCount[]>(() => {
    const entries = view === "paid" ? overview.by_plan.filter((p) => p.plan !== "free") : overview.by_plan
    return entries.filter((p) => p.count > 0)
  }, [overview.by_plan, view])

  const total = segments.reduce((sum, p) => sum + p.count, 0)

  const chartConfig = useMemo(() => {
    const config: ChartConfig = {}
    for (const p of overview.by_plan) {
      config[p.plan] = { label: p.display_name, color: tierColor(p.plan) }
    }
    return config
  }, [overview.by_plan])

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <CardTitle>Subscribers by tier</CardTitle>
            <CardDescription>Active accounts on each plan</CardDescription>
          </div>
          <ToggleGroup
            type="single"
            size="sm"
            variant="outline"
            value={view}
            onValueChange={(v) => v && setView(v as "all" | "paid")}
          >
            <ToggleGroupItem value="paid">Paid only</ToggleGroupItem>
            <ToggleGroupItem value="all">All tiers</ToggleGroupItem>
          </ToggleGroup>
        </div>
      </CardHeader>
      <CardContent>
        {segments.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">
            {view === "paid" ? "No paying subscribers yet" : "No subscribers yet"}
          </p>
        ) : (
          <>
            <ChartContainer config={chartConfig} className="mx-auto aspect-square max-h-[220px]">
              <PieChart>
                <ChartTooltip cursor={false} content={<ChartTooltipContent nameKey="plan" hideLabel />} />
                <Pie
                  data={segments}
                  dataKey="count"
                  nameKey="plan"
                  innerRadius={62}
                  outerRadius={88}
                  stroke="var(--card)"
                  strokeWidth={2}
                >
                  {segments.map((p) => (
                    <Cell key={p.plan} fill={tierColor(p.plan)} />
                  ))}
                  <Label
                    content={({ viewBox }) => {
                      if (!viewBox || !("cx" in viewBox) || !("cy" in viewBox)) return null
                      return (
                        <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                          <tspan x={viewBox.cx} y={viewBox.cy} className="fill-foreground text-2xl font-semibold">
                            {total.toLocaleString()}
                          </tspan>
                          <tspan x={viewBox.cx} y={(viewBox.cy ?? 0) + 20} className="fill-muted-foreground text-xs">
                            {view === "paid" ? "paid subscribers" : "subscribers"}
                          </tspan>
                        </text>
                      )
                    }}
                  />
                </Pie>
              </PieChart>
            </ChartContainer>
            <div className="mt-4 space-y-2">
              {segments.map((p) => (
                <div key={p.plan} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-foreground">
                    <span
                      className="inline-block h-3 w-3 rounded-sm"
                      style={{ backgroundColor: tierColor(p.plan) }}
                      aria-hidden
                    />
                    {p.display_name}
                  </span>
                  <span className="text-muted-foreground tabular-nums">{p.count.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

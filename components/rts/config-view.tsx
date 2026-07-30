"use client"

import { useCallback, useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Settings } from "lucide-react"
import { rtsService, type RTSConfig } from "@/lib/rts"

// Guardians may READ the resonance weights they're measured against
// (`GET /api/rts/config/`) but `PATCH` is steward-only since Session 11 — so
// this view carries no edit affordance at all. The editable form lives in the
// Steward Console's Resonance Configuration tab.

export function ConfigView() {
  const [config, setConfig] = useState<RTSConfig | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setConfig(await rtsService.getConfig())
    } catch {
      setConfig(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (loading) {
    return <Skeleton className="h-64 w-full" />
  }

  if (!config) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          The resonance configuration isn&apos;t available right now.
        </CardContent>
      </Card>
    )
  }

  const thresholds: Array<[string, number]> = [
    ["Expand (≥)", config.threshold_expand],
    ["Clear (≥)", config.threshold_clear],
    ["Check-in (≥)", config.threshold_caution],
    ["Caution (≥)", config.threshold_pause],
  ]

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Settings className="h-5 w-5 text-primary" />
              Resonance Configuration
            </CardTitle>
            <CardDescription>The weights and thresholds every creator score is computed against.</CardDescription>
          </div>
          <Badge variant="outline">Read-only</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <h4 className="mb-2 text-sm font-semibold text-foreground">Signal weights</h4>
          <div className="grid gap-2 sm:grid-cols-2">
            {Object.entries(config.weights ?? {}).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                <span className="text-sm capitalize text-muted-foreground">{key.replace(/_/g, " ")}</span>
                <span className="text-sm font-medium tabular-nums text-foreground">{value}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h4 className="mb-2 text-sm font-semibold text-foreground">Thresholds</h4>
          <div className="grid gap-2 sm:grid-cols-2">
            {thresholds.map(([label, value]) => (
              <div key={label} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                <span className="text-sm text-muted-foreground">{label}</span>
                <span className="text-sm font-medium tabular-nums text-foreground">{value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>Decay half-life: {config.decay_half_life_hours} hours</span>
          <span>Last changed {new Date(config.updated_at).toLocaleString()}</span>
        </div>

        <p className="text-xs text-muted-foreground">
          Stewards change these values in the Steward Console.
        </p>
      </CardContent>
    </Card>
  )
}

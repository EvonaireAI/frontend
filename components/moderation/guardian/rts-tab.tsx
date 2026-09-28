"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Bell, Eye, RefreshCw } from "lucide-react"
import { CreatorScoreTable } from "@/components/rts/creator-score-table"
import { ConfigView } from "@/components/rts/config-view"
import { rtsService, type RTSAlert, type RTSCreatorSummary } from "@/lib/rts"

// RTS Monitoring is read-only for guardians: alerts first, then the creator
// score list, drilling into one creator at /moderate/rts/<id>. The weights are
// shown but not editable — `PATCH /api/rts/config/` is steward-only.

interface RtsTabProps {
  /** Base path for creator detail links, e.g. `/moderate/rts` or `/steward/rts`. */
  rtsDetailBasePath?: string
  /** Hide the read-only config summary (stewards edit config on the Resonance tab). */
  showConfigView?: boolean
}

export function RtsTab({ rtsDetailBasePath = "/moderate/rts", showConfigView = true }: RtsTabProps) {
  const [creators, setCreators] = useState<RTSCreatorSummary[]>([])
  const [alerts, setAlerts] = useState<RTSAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [creatorsData, alertsData] = await Promise.all([rtsService.getAllCreators(), rtsService.getAlerts()])
      setCreators(creatorsData)
      setAlerts(alertsData)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load RTS data")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Resonance Trust Synthesis across every creator. Read-only — care flags are raised from a creator&apos;s
          detail view.
        </p>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : (
        <>
          <Card className={alerts.length > 0 ? "border-2 border-red-200 dark:border-red-900/40" : undefined}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Bell className={`h-5 w-5 ${alerts.length > 0 ? "text-red-600" : "text-muted-foreground"}`} />
                Critical alerts ({alerts.length})
              </CardTitle>
              <CardDescription>Creators under an active critical intervention.</CardDescription>
            </CardHeader>
            <CardContent>
              {alerts.length === 0 ? (
                <p className="py-2 text-sm text-muted-foreground">No creator is under critical intervention.</p>
              ) : (
                <div className="space-y-2">
                  {alerts.map((alert) => {
                    const name = [alert.first_name, alert.last_name].filter(Boolean).join(" ")
                    return (
                      <div
                        key={alert.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-red-200 p-3 dark:border-red-900/40"
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-foreground">{name || alert.email}</p>
                          {name && <p className="break-all text-xs text-muted-foreground">{alert.email}</p>}
                        </div>
                        <Button asChild variant="outline" size="sm">
                          <Link href={`${rtsDetailBasePath}/${alert.id}`}>
                            <Eye className="mr-2 h-4 w-4" />
                            Open
                          </Link>
                        </Button>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <CreatorScoreTable creators={creators} rtsDetailBasePath={rtsDetailBasePath} />

          {showConfigView && <ConfigView />}
        </>
      )}
    </div>
  )
}

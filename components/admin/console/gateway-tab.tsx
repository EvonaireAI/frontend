"use client"

// Gateway tab — the steward side of the /admin-api/v1/ surface. Lists
// gateway applications by entry status and applies steward decisions.
// Per the Holding Garden doc every decision needs a written reason.

import { useCallback, useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { RefreshCw, ShieldCheck } from "lucide-react"
import { toast } from "sonner"
import { v1Admin, V1Error, type GatewayApplication, type OpsSummary } from "@/lib/v1"

const ENTRY_STATUSES = [
  "ready_for_review",
  "holding_garden_waiting",
  "manual_review",
  "paused",
  "rejected",
] as const

export function GatewayTab() {
  const [summary, setSummary] = useState<OpsSummary | null>(null)
  const [applications, setApplications] = useState<GatewayApplication[]>([])
  const [filter, setFilter] = useState<string>("ready_for_review")
  const [reasons, setReasons] = useState<Record<number, string>>({})
  const [loading, setLoading] = useState(true)
  const [unavailable, setUnavailable] = useState(false)
  const [busyId, setBusyId] = useState<number | null>(null)

  const load = useCallback(async (status = filter) => {
    setLoading(true)
    try {
      const [ops, apps] = await Promise.all([
        v1Admin.opsSummary(),
        v1Admin.gatewayApplications(status),
      ])
      setSummary(ops)
      setApplications(apps.results)
    } catch (error) {
      if (error instanceof V1Error && (error.status === 403 || error.status === 404)) {
        setUnavailable(true)
      }
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const decide = async (app: GatewayApplication, decision: string) => {
    const reason = (reasons[app.id] ?? "").trim()
    if (reason.length < 20) {
      toast.error("A written reason of at least 20 characters is required.")
      return
    }
    setBusyId(app.id)
    try {
      await v1Admin.decideApplication(app.id, decision, reason)
      toast.success(`Application ${decision}`)
      await load()
    } catch (error) {
      toast.error(error instanceof V1Error ? error.message : "Decision failed")
    } finally {
      setBusyId(null)
    }
  }

  if (unavailable) return null

  return (
    <div className="space-y-6">
      {summary && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Object.entries(summary.gateway).map(([status, count]) => (
            <Card key={status} className="bg-card border-border">
              <CardContent className="pt-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  {status.replace(/_/g, " ")}
                </p>
                <p className="text-2xl font-bold text-foreground">{count}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card className="bg-card border-border">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <ShieldCheck className="w-5 h-5 text-primary" />
                Gateway applications
              </CardTitle>
              <CardDescription>
                Holding Garden entries awaiting a steward decision
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select
                value={filter}
                onValueChange={(value) => {
                  setFilter(value)
                  void load(value)
                }}
              >
                <SelectTrigger className="w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ENTRY_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="ghost" size="sm" onClick={() => void load()} disabled={loading}>
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <Skeleton className="h-24 w-full" />
          ) : applications.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No applications in this state.
            </p>
          ) : (
            applications.map((app) => (
              <div key={app.id} className="rounded-lg border border-border p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      Application #{app.id} · {app.selected_role}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {app.country} · score {app.entry_score} · {app.entry_status.replace(/_/g, " ")}
                    </p>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {app.status}
                  </Badge>
                </div>
                <Input
                  placeholder="Decision reason (at least 20 characters)"
                  value={reasons[app.id] ?? ""}
                  onChange={(e) =>
                    setReasons((prev) => ({ ...prev, [app.id]: e.target.value }))
                  }
                />
                <div className="flex gap-2">
                  {(["approved", "paused", "rejected"] as const).map((d) => (
                    <Button
                      key={d}
                      size="sm"
                      variant={d === "approved" ? "default" : "outline"}
                      onClick={() => void decide(app, d)}
                      disabled={busyId === app.id}
                    >
                      {d}
                    </Button>
                  ))}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}

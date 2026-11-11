"use client"

// Assignments tab — the /api/v1/guardian/ surface. Pending assignment
// offers and unclaimed open cases appear in "Available work"; accepted
// assignments appear in "My cases". Accepting an assignment binds the
// case to this guardian; access stays assignment-bounded server-side.

import { useCallback, useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { CheckCircle2, ClipboardList, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { v1Ops, V1Error, type GuardianAssignment, type GuardianCase } from "@/lib/v1"
import { tr, trNode } from "@/lib/i18n"


const SEVERITY_CLASS: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-yellow-900/40 text-yellow-300",
  high: "bg-orange-900/40 text-orange-300",
  critical: "bg-red-900/40 text-red-300",
}

function SeverityChip({ severity }: { severity: string }) {
  return (
    <Badge className={`text-xs ${SEVERITY_CLASS[severity] ?? SEVERITY_CLASS.low}`}>
      {severity}
    </Badge>
  )
}

export function AssignmentsTab() {
  const [pending, setPending] = useState<GuardianAssignment[]>([])
  const [openCases, setOpenCases] = useState<GuardianCase[]>([])
  const [myCases, setMyCases] = useState<GuardianCase[]>([])
  const [loading, setLoading] = useState(true)
  const [unavailable, setUnavailable] = useState(false)
  const [busyId, setBusyId] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [work, mine] = await Promise.all([
        v1Ops.availableWork(),
        v1Ops.myCases(),
      ])
      setPending(work.pending_assignments)
      setOpenCases(work.open_cases)
      setMyCases(mine.results)
    } catch (error) {
      if (error instanceof V1Error && (error.status === 403 || error.status === 404)) {
        setUnavailable(true)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const accept = async (id: number) => {
    setBusyId(id)
    try {
      await v1Ops.acceptAssignment(id)
      toast.success(tr("Assignment accepted"))
      await load()
    } catch (error) {
      toast.error(error instanceof V1Error ? error.message : tr("Could not accept"))
    } finally {
      setBusyId(null)
    }
  }

  if (unavailable) return null

  return (
    <div className="space-y-6">
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <ClipboardList className="w-5 h-5 text-primary" />
            {tr("My cases")}
          </CardTitle>
          <CardDescription>{tr("Cases assigned to you under /api/v1/guardian/")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <Skeleton className="h-20 w-full" />
          ) : myCases.length === 0 ? (
            <p className="text-sm text-muted-foreground">{tr("No active assignments.")}</p>
          ) : (
            myCases.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {trNode("Case #{p0} · {p1}", { p0: c.id, p1: c.violation_type.replace(/_/g, " ") })}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{c.flagged_reason}</p>
                </div>
                <SeverityChip severity={c.severity} />
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <CheckCircle2 className="w-5 h-5 text-primary" />
                {tr("Available work")}
              </CardTitle>
              <CardDescription>{tr("Pending offers and unclaimed cases")}</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <Skeleton className="h-20 w-full" />
          ) : pending.length === 0 && openCases.length === 0 ? (
            <p className="text-sm text-muted-foreground">{tr("Nothing needs attention right now.")}</p>
          ) : (
            <>
              {pending.map((a) => (
                <div
                  key={`a-${a.id}`}
                  className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {trNode("Case #{p0} · {p1}", { p0: a.case.id, p1: a.case.violation_type.replace(/_/g, " ") })}
                    </p>
                    <p className="text-xs text-muted-foreground">{tr("Offered to you")}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <SeverityChip severity={a.case.severity} />
                    <Button size="sm" onClick={() => void accept(a.id)} disabled={busyId === a.id}>
                      {tr("Accept")}
                    </Button>
                  </div>
                </div>
              ))}
              {openCases.map((c) => (
                <div
                  key={`c-${c.id}`}
                  className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {trNode("Case #{p0} · {p1}", { p0: c.id, p1: c.violation_type.replace(/_/g, " ") })}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{c.flagged_reason}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <SeverityChip severity={c.severity} />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void accept(c.id)}
                      disabled={busyId === c.id}
                    >
                      {tr("Claim")}
                    </Button>
                  </div>
                </div>
              ))}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

"use client"

import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { authService, type User } from "@/lib/auth"
import { rtsService, type RTSScore, type RTSHistoryEntry, type RTSAuditResponse } from "@/lib/rts"
import { ScoreBadge } from "@/components/rts/score-badge"
import { ScoreHistory } from "@/components/rts/score-history"
import { FlagForm } from "@/components/rts/flag-form"
import { Loader2, ArrowLeft, FileText, Activity, Flag, TrendingUp } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function CreatorRTSDetail() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [score, setScore] = useState<RTSScore | null>(null)
  const [history, setHistory] = useState<RTSHistoryEntry[]>([])
  const [audit, setAudit] = useState<RTSAuditResponse | null>(null)
  const router = useRouter()
  const params = useParams()
  const userId = Number.parseInt(params.userId as string)

  useEffect(() => {
    const loadData = async () => {
      try {
        if (!authService.isAuthenticated()) {
          router.push("/auth/login")
          return
        }

        const userData = await authService.getProfile()
        if (!["moderator", "admin", "superadmin"].includes(userData.role)) {
          router.push("/dashboard")
          return
        }

        setUser(userData)
        await loadRTSData()
      } catch (err) {
        console.error("Failed to load data:", err)
        router.push("/auth/login")
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [router, userId])

  const loadRTSData = async () => {
    try {
      const [scoreData, historyData, auditData] = await Promise.all([
        rtsService.getCreatorScore(userId),
        rtsService.getCreatorHistory(userId),
        rtsService.getCreatorAudit(userId),
      ])
      setScore(scoreData)
      setHistory(historyData)
      setAudit(auditData)
    } catch (error) {
      console.error("Failed to load RTS data:", error)
      toast.error("Failed to load creator RTS data")
    }
  }

  const handleFlagSuccess = () => {
    loadRTSData()
    toast.success("Care flag created and RTS updated")
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!user) {
    return null
  }

  const currentBand = score ? rtsService.getScoreBand(score.current_score) : "critical"

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-accent/5">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Button asChild variant="outline">
            <Link href="/moderate">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Link>
          </Button>
          <div>
            <h1 className="text-4xl font-bold text-foreground">Creator RTS Details</h1>
            {score && (
              <p className="text-muted-foreground">
                {score.user.first_name} {score.user.last_name} ({score.user.email})
              </p>
            )}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Current Score */}
          <Card>
            <CardHeader>
              <CardTitle>Current RTS Score</CardTitle>
              <CardDescription>Real-time Resonance Trust Score</CardDescription>
            </CardHeader>
            <CardContent>
              {score ? (
                <div className="flex flex-col items-center py-6">
                  <ScoreBadge score={score.current_score} band={currentBand} size="lg" />
                  <p className="text-sm text-muted-foreground mt-4">
                    Last updated: {new Date(score.last_calculated_at).toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Version: {score.score_version}</p>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p className="text-sm">No score available</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Create Flag */}
          <FlagForm userId={userId} onSubmitSuccess={handleFlagSuccess} />
        </div>

        {/* Score History */}
        <div className="mt-6">
          <ScoreHistory history={history} />
        </div>

        {/* Audit Trail with Tabs */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Complete Audit Trail
            </CardTitle>
            <CardDescription>All inputs, history, and interventions for this creator</CardDescription>
          </CardHeader>
          <CardContent>
            {!audit ? (
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-sm">No audit data available</p>
              </div>
            ) : (
              <Tabs defaultValue="history" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="history">
                    <TrendingUp className="w-4 h-4 mr-2" />
                    History ({audit.history.length})
                  </TabsTrigger>
                  <TabsTrigger value="inputs">
                    <Activity className="w-4 h-4 mr-2" />
                    Inputs ({audit.inputs.length})
                  </TabsTrigger>
                  <TabsTrigger value="interventions">
                    <Flag className="w-4 h-4 mr-2" />
                    Interventions ({audit.interventions.length})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="history" className="space-y-2 max-h-96 overflow-y-auto mt-4">
                  {audit.history.length === 0 ? (
                    <p className="text-center text-sm text-muted-foreground py-4">No history entries</p>
                  ) : (
                    audit.history.map((entry) => (
                      <div key={entry.id} className="p-3 border rounded-lg">
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-medium text-sm capitalize">
                            {entry.trigger_type.replace(/_/g, " ")}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(entry.created_at).toLocaleString()}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-sm mb-2">
                          <span>{entry.score_before.toFixed(0)}</span>
                          <span>→</span>
                          <span className={entry.score_after > entry.score_before ? "text-green-600" : "text-red-600"}>
                            {entry.score_after.toFixed(0)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            ({entry.score_after > entry.score_before ? "+" : ""}
                            {(entry.score_after - entry.score_before).toFixed(0)})
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          <p>Present signals: {entry.explanation.present_signals.join(", ")}</p>
                        </div>
                      </div>
                    ))
                  )}
                </TabsContent>

                <TabsContent value="inputs" className="space-y-2 max-h-96 overflow-y-auto mt-4">
                  {audit.inputs.length === 0 ? (
                    <p className="text-center text-sm text-muted-foreground py-4">No input signals</p>
                  ) : (
                    audit.inputs.map((input) => (
                      <div key={input.id} className="p-3 border rounded-lg">
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-medium text-sm capitalize">{input.input_type.replace(/_/g, " ")}</span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(input.created_at).toLocaleString()}
                          </span>
                        </div>
                        <div className="text-sm mb-2">
                          <span className="text-muted-foreground">Value: </span>
                          <span className="font-medium">{input.value.toFixed(2)}</span>
                          <span className="text-muted-foreground ml-2">Source: </span>
                          <span>{input.source}</span>
                        </div>
                        {Object.keys(input.value_json).length > 0 && (
                          <pre className="text-xs text-muted-foreground bg-muted p-2 rounded overflow-x-auto">
                            {JSON.stringify(input.value_json, null, 2)}
                          </pre>
                        )}
                      </div>
                    ))
                  )}
                </TabsContent>

                <TabsContent value="interventions" className="space-y-2 max-h-96 overflow-y-auto mt-4">
                  {audit.interventions.length === 0 ? (
                    <p className="text-center text-sm text-muted-foreground py-4">No interventions</p>
                  ) : (
                    audit.interventions.map((intervention) => (
                      <div key={intervention.id} className="p-3 border rounded-lg">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm capitalize">
                              {intervention.type.replace(/_/g, " ")}
                            </span>
                            <span
                              className={`text-xs px-2 py-0.5 rounded ${
                                intervention.resolved ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                              }`}
                            >
                              {intervention.resolved ? "Resolved" : "Open"}
                            </span>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {new Date(intervention.created_at).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">{intervention.notes}</p>
                        {intervention.resolved_at && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Resolved: {new Date(intervention.resolved_at).toLocaleString()}
                          </p>
                        )}
                      </div>
                    ))
                  )}
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

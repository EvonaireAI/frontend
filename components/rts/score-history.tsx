"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { rtsService, type RTSHistoryEntry } from "@/lib/rts"
import { Clock, Info } from "lucide-react"
import { fmtLocale, tr, trNode } from "@/lib/i18n"


interface ScoreHistoryProps {
  history: RTSHistoryEntry[]
}

export function ScoreHistory({ history }: ScoreHistoryProps) {
  const [selectedEntry, setSelectedEntry] = useState<RTSHistoryEntry | null>(null)

  if (history.length === 0) {
    return (
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">{tr("Score History")}</CardTitle>
          <CardDescription>{tr("Your RTS score changes over time")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">{tr("No history available yet")}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-foreground">{tr("Score History")}</CardTitle>
        <CardDescription>{tr("Track your RTS score changes over time")}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {history.map((entry) => {
            const band = rtsService.getScoreBand(entry.score_after)
            const colorClass = rtsService.getBandColor(band)

            return (
              <div key={entry.id} className="flex items-center justify-between p-3 border border-border rounded-lg hover:bg-secondary/50">
                <div className="flex items-center gap-3">
                  <div className="text-2xl font-bold">{entry.score_after.toFixed(0)}</div>
                  <div>
                    <Badge variant="outline" className={`${colorClass} text-xs`}>
                      {rtsService.getBandLabel(band)}
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">{new Date(entry.created_at).toLocaleString(fmtLocale())}</p>
                  </div>
                </div>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedEntry(entry)}>
                      <Info className="w-4 h-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{tr("Score Breakdown")}</DialogTitle>
                      <DialogDescription>
                        {trNode("Score changed from {p0} to {p1} on {p2}", { p0: entry.score_before.toFixed(0), p1: entry.score_after.toFixed(0), p2: new Date(entry.created_at).toLocaleString(fmtLocale()) })}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center p-2 bg-muted rounded">
                        <span className="text-sm font-medium">{tr("Trigger Type")}</span>
                        <span className="text-sm capitalize">{entry.trigger_type.replace(/_/g, " ")}</span>
                      </div>

                      <div className="border-t pt-3">
                        <h4 className="text-sm font-semibold mb-2">{tr("Signal Contributions")}</h4>
                        {Object.entries(entry.explanation.contrib).map(([signal, data]) => (
                          <div key={signal} className="flex justify-between items-center p-2 bg-muted rounded mb-2">
                            <div className="flex-1">
                              <span className="text-sm font-medium capitalize">{signal.replace(/_/g, " ")}</span>
                              <p className="text-xs text-muted-foreground">
                                {trNode("Value: {p0} × Weight: {p1}", { p0: data.value.toFixed(1), p1: data.weight.toFixed(2) })}
                              </p>
                            </div>
                            <span className="text-sm font-bold">{data.contribution.toFixed(1)}</span>
                          </div>
                        ))}
                      </div>

                      {entry.explanation.missing_signals.length > 0 && (
                        <div className="border-t pt-3">
                          <h4 className="text-sm font-semibold mb-2">{tr("Missing Signals")}</h4>
                          <div className="flex flex-wrap gap-2">
                            {entry.explanation.missing_signals.map((signal) => (
                              <Badge key={signal} variant="outline" className="text-xs">
                                {signal.replace(/_/g, " ")}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

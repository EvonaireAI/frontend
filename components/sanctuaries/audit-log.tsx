"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { AuditLogEntry } from "@/lib/sanctuaries"
import { Loader2 } from "lucide-react"

interface AuditLogProps {
  entries: AuditLogEntry[]
  loading?: boolean
}

export function AuditLog({ entries, loading = false }: AuditLogProps) {
  const getActionColor = (action: string) => {
    switch (action) {
      case "created":
        return "bg-primary/10 text-primary border-primary/20"
      case "updated":
        return "bg-gold-light/10 text-gold-light border-gold-light/20"
      case "join_requested":
        return "bg-gold-muted/10 text-gold-muted border-gold-muted/20"
      case "join_approved":
        return "bg-primary/10 text-primary border-primary/20"
      case "join_rejected":
        return "bg-destructive/10 text-destructive border-destructive/20"
      case "membership_revoked":
        return "bg-destructive/10 text-destructive border-destructive/20"
      default:
        return "bg-muted text-muted-foreground border-border"
    }
  }

  const getActionLabel = (action: string) => {
    return action
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ")
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-foreground">Audit Log</CardTitle>
        <CardDescription>Track all sanctuary activities</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-sm">No audit entries yet</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {entries.map((entry) => (
              <Card key={entry.id} className="border-l-4 border-l-primary/30 bg-secondary border-border">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <Badge variant="outline" className={getActionColor(entry.action)}>
                      {getActionLabel(entry.action)}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{new Date(entry.created_at).toLocaleString()}</span>
                  </div>
                  <p className="text-sm font-medium mb-1 text-foreground">
                    {entry.actor.first_name} {entry.actor.last_name}
                  </p>
                  <p className="text-xs text-muted-foreground">{entry.actor.email}</p>
                  {Object.keys(entry.context).length > 0 && (
                    <div className="text-xs text-muted-foreground mt-2 bg-muted p-2 rounded">
                      {JSON.stringify(entry.context, null, 2)}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

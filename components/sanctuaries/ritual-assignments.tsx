"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { RitualAssignment } from "@/lib/sanctuaries"
import { AddRitualsModal } from "./add-rituals-modal"
import { Loader2, Trash2, Plus } from "lucide-react"

interface RitualAssignmentsProps {
  rituals: RitualAssignment[]
  loading?: boolean
  onRemove: (ritualId: number) => Promise<void>
  onRefresh?: () => Promise<void>
  sanctuaryId?: number
  isCreatorView?: boolean
}

export function RitualAssignments({
  rituals,
  loading = false,
  onRemove,
  onRefresh,
  sanctuaryId,
  isCreatorView = false,
}: RitualAssignmentsProps) {
  const [processingId, setProcessingId] = useState<number | null>(null)
  const [addRitualsOpen, setAddRitualsOpen] = useState(false)

  const handleRemove = async (ritualId: number) => {
    if (!confirm("Are you sure you want to remove this ritual?")) return

    setProcessingId(ritualId)
    try {
      await onRemove(ritualId)
      await onRefresh?.()
    } finally {
      setProcessingId(null)
    }
  }

  const getCareLevelColor = (level: string) => {
    switch (level) {
      case "level1":
        return "bg-primary/10 text-primary border-primary/20"
      case "level2":
        return "bg-gold-muted/10 text-gold-muted border-gold-muted/20"
      case "level3":
        return "bg-destructive/10 text-destructive border-destructive/20"
      default:
        return "bg-muted text-muted-foreground border-border"
    }
  }

  return (
    <>
      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-foreground">Assigned Rituals</CardTitle>
            <CardDescription>Rituals available in this sanctuary</CardDescription>
          </div>
          {isCreatorView && sanctuaryId && (
            <Button size="sm" onClick={() => setAddRitualsOpen(true)} className="bg-primary text-primary-foreground hover:bg-gold-muted">
              <Plus className="w-4 h-4 mr-2" />
              Add Ritual
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : rituals.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-sm">No rituals assigned yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {rituals.map((ritual) => (
                <Card key={ritual.id} className="border-l-4 border-l-primary bg-secondary border-border">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h4 className="font-medium text-foreground">{ritual.ritual_title}</h4>
                        <div className="flex gap-2 mt-2">
                          <Badge variant="outline" className={getCareLevelColor(ritual.care_level)}>
                            {ritual.care_level}
                          </Badge>
                          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                            {ritual.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          Assigned {new Date(ritual.assigned_at).toLocaleDateString()}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive hover:text-destructive bg-transparent"
                        onClick={() => handleRemove(ritual.ritual_id)}
                        disabled={processingId === ritual.ritual_id}
                      >
                        {processingId === ritual.ritual_id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {sanctuaryId && (
        <AddRitualsModal
          open={addRitualsOpen}
          onOpenChange={setAddRitualsOpen}
          sanctuaryId={sanctuaryId}
          assignedRitualIds={rituals.map((r) => r.ritual_id)}
          onRitualAdded={onRefresh || (() => Promise.resolve())}
        />
      )}
    </>
  )
}

"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { authService, type Ritual } from "@/lib/auth"
import { sanctuariesService } from "@/lib/sanctuaries"
import { Loader2, Plus, Search } from "lucide-react"

interface AddRitualsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sanctuaryId: number
  assignedRitualIds: number[]
  onRitualAdded: () => Promise<void>
}

export function AddRitualsModal({
  open,
  onOpenChange,
  sanctuaryId,
  assignedRitualIds,
  onRitualAdded,
}: AddRitualsModalProps) {
  const [rituals, setRituals] = useState<Ritual[]>([])
  const [filteredRituals, setFilteredRituals] = useState<Ritual[]>([])
  const [loading, setLoading] = useState(false)
  const [assigning, setAssigning] = useState<number | null>(null)
  const [searchTerm, setSearchTerm] = useState("")

  useEffect(() => {
    if (open) {
      loadRituals()
    }
  }, [open])

  useEffect(() => {
    // Filter rituals: only level2 and level3, not already assigned
    const filtered = rituals.filter(
      (ritual) =>
        (ritual.care_level === "level2" || ritual.care_level === "level3") &&
        !assignedRitualIds.includes(ritual.id) &&
        ritual.status === "approved" &&
        (ritual.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          ritual.description.toLowerCase().includes(searchTerm.toLowerCase())),
    )
    setFilteredRituals(filtered)
  }, [rituals, searchTerm, assignedRitualIds])

  const loadRituals = async () => {
    setLoading(true)
    try {
      const data = await authService.getMyRituals()
      setRituals(data)
    } catch (err) {
      console.error("Failed to load rituals:", err)
    } finally {
      setLoading(false)
    }
  }

  const handleAssignRitual = async (ritualId: number) => {
    setAssigning(ritualId)
    try {
      await sanctuariesService.assignRitual(sanctuaryId, ritualId)
      await onRitualAdded()
      // Remove from list after successful assignment
      setRituals(rituals.filter((r) => r.id !== ritualId))
    } catch (err) {
      console.error("Failed to assign ritual:", err)
    } finally {
      setAssigning(null)
    }
  }

  const getCareLevelColor = (level: string) => {
    switch (level) {
      case "level2":
        return "bg-gold-muted/10 text-gold-muted border-gold-muted/20"
      case "level3":
        return "bg-destructive/10 text-destructive border-destructive/20"
      default:
        return "bg-muted text-muted-foreground border-border"
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground">Add Rituals to Sanctuary</DialogTitle>
          <DialogDescription>Select level 2 or level 3 rituals to add to this sanctuary</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search rituals..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : filteredRituals.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-sm">
                {rituals.length === 0 ? "No rituals available" : "No level 2 or level 3 rituals available to add"}
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[400px] border border-border rounded-lg p-4">
              <div className="space-y-3">
                {filteredRituals.map((ritual) => (
                  <div
                    key={ritual.id}
                    className="flex items-start justify-between p-3 border border-border rounded-lg hover:bg-secondary/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium truncate text-foreground">{ritual.title}</h4>
                      <p className="text-sm text-muted-foreground line-clamp-2">{ritual.description}</p>
                      <div className="flex gap-2 mt-2">
                        <Badge variant="outline" className={getCareLevelColor(ritual.care_level)}>
                          {ritual.care_level}
                        </Badge>
                        {ritual.duration_seconds && (
                          <Badge variant="outline" className="text-xs">
                            {Math.round(ritual.duration_seconds / 60)} min
                          </Badge>
                        )}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleAssignRitual(ritual.id)}
                      disabled={assigning === ritual.id}
                      className="ml-2 flex-shrink-0"
                    >
                      {assigning === ritual.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <Plus className="w-4 h-4 mr-1" />
                          Add
                        </>
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

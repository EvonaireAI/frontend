"use client"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { Sanctuary } from "@/lib/sanctuaries"
import { Users, Lock, Globe, Calendar } from "lucide-react"

interface SanctuaryDetailModalProps {
  sanctuary: Sanctuary | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onJoin?: (id: number) => void
  onLeave?: (id: number) => void
  showActionButtons?: boolean
}

export function SanctuaryDetailModal({
  sanctuary,
  open,
  onOpenChange,
  onJoin,
  onLeave,
  showActionButtons = false,
}: SanctuaryDetailModalProps) {
  if (!sanctuary) return null

  const getPrivacyIcon = () => {
    return sanctuary.privacy === "invite_only" ? <Lock className="w-4 h-4" /> : <Globe className="w-4 h-4" />
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-primary/10 text-primary border-primary/20"
      case "paused":
        return "bg-gold-muted/10 text-gold-muted border-gold-muted/20"
      case "archived":
        return "bg-muted text-muted-foreground border-border"
      default:
        return "bg-muted text-muted-foreground border-border"
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-card border-border">
        <DialogHeader>
          <div className="flex gap-2 mb-2">
            <Badge variant="outline" className={getStatusColor(sanctuary.status)}>
              {sanctuary.status}
            </Badge>
            <Badge variant="outline" className="flex items-center gap-1 border-border text-muted-foreground">
              {getPrivacyIcon()}
              {sanctuary.privacy === "invite_only" ? "Invite Only" : "Public"}
            </Badge>
          </div>
          <DialogTitle className="text-2xl text-foreground">{sanctuary.title}</DialogTitle>
          <DialogDescription>{sanctuary.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {sanctuary.welcome_message && (
            <Card className="border-l-4 border-l-primary bg-secondary border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Welcome Message</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{sanctuary.welcome_message}</p>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Card className="bg-secondary border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Membership
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-primary">
                  {sanctuary.active_members_count}/{sanctuary.capacity}
                </p>
                <p className="text-xs text-muted-foreground">Active members</p>
              </CardContent>
            </Card>

            <Card className="bg-secondary border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Join Policy</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm font-medium text-foreground">{sanctuary.allow_open_join ? "Open Join" : "Request Required"}</p>
                <p className="text-xs text-muted-foreground">
                  {sanctuary.allow_open_join ? "Anyone can join" : "Creator approval needed"}
                </p>
              </CardContent>
            </Card>
          </div>

          {sanctuary.tags.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-2 text-foreground">Practice Types</h4>
              <div className="flex flex-wrap gap-2">
                {sanctuary.tags.map((tag) => (
                  <Badge key={tag.id} className="bg-secondary text-secondary-foreground border-0">
                    {tag.name}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <Card className="bg-secondary border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Created
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-foreground">{new Date(sanctuary.created_at).toLocaleDateString()}</p>
            </CardContent>
          </Card>

          {showActionButtons && (
            <div className="flex gap-2 pt-4">
              {sanctuary.membership_status === "approved" ? (
                <Button variant="destructive" className="flex-1" onClick={() => onLeave?.(sanctuary.id)}>
                  Leave Sanctuary
                </Button>
              ) : sanctuary.membership_status === "pending" ? (
                <Button disabled className="flex-1 bg-secondary text-muted-foreground">
                  Request Pending
                </Button>
              ) : (
                <Button className="flex-1 bg-primary text-primary-foreground hover:bg-gold-muted" onClick={() => onJoin?.(sanctuary.id)}>
                  Request to Join
                </Button>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

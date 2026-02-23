"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { Sanctuary } from "@/lib/sanctuaries"
import { Users, Lock, Globe } from "lucide-react"
import Link from "next/link"

interface SanctuaryCardProps {
  sanctuary: Sanctuary
  onViewDetail?: (id: number) => void
  onJoin?: (id: number) => void
  showJoinButton?: boolean
  isCreatorView?: boolean
}

export function SanctuaryCard({
  sanctuary,
  onViewDetail,
  onJoin,
  showJoinButton = false,
  isCreatorView = false,
}: SanctuaryCardProps) {
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

  const cardContent = (
    <>
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start mb-2">
          <div className="flex gap-2">
            <Badge variant="outline" className={getStatusColor(sanctuary.status)}>
              {sanctuary.status}
            </Badge>
            <Badge variant="outline" className="flex items-center gap-1 border-border text-muted-foreground">
              {getPrivacyIcon()}
              {sanctuary.privacy === "invite_only" ? "Invite Only" : "Public"}
            </Badge>
          </div>
        </div>
        <CardTitle className="text-lg group-hover:text-primary transition-colors text-foreground">{sanctuary.title}</CardTitle>
        <CardDescription className="line-clamp-2">{sanctuary.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-1">
          {sanctuary.tags.slice(0, 3).map((tag) => (
            <Badge key={tag.id} className="bg-secondary text-secondary-foreground text-xs border-0">
              {tag.name}
            </Badge>
          ))}
          {sanctuary.tags.length > 3 && (
            <Badge className="bg-secondary text-secondary-foreground text-xs border-0">
              +{sanctuary.tags.length - 3}
            </Badge>
          )}
        </div>

        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Users className="w-4 h-4" />
            <span>
              {sanctuary.active_members_count}/{sanctuary.capacity} members
            </span>
          </div>
        </div>

        <div className="flex gap-2">
          {isCreatorView ? (
            <Button variant="outline" className="flex-1 bg-transparent border-border text-foreground hover:bg-secondary hover:text-secondary-foreground" asChild>
              <Link href={`/creator/sanctuaries/${sanctuary.id}`}>View Details</Link>
            </Button>
          ) : (
            <Button variant="outline" className="flex-1 bg-transparent border-border text-foreground hover:bg-secondary hover:text-secondary-foreground" onClick={() => onViewDetail?.(sanctuary.id)}>
              View Details
            </Button>
          )}
          {showJoinButton && sanctuary.membership_status !== "approved" && (
            <Button className="flex-1 bg-primary text-primary-foreground hover:bg-gold-muted" onClick={() => onJoin?.(sanctuary.id)}>
              Request Join
            </Button>
          )}
        </div>
      </CardContent>
    </>
  )

  return (
    <Card className="bg-card border border-border hover:border-primary/40 transition-all duration-300 group">
      {cardContent}
    </Card>
  )
}

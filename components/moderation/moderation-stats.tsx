"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { ModerationStats } from "@/lib/auth"
import { AlertTriangle, FileText, TrendingUp, Shield } from "lucide-react"

interface ModerationStatsProps {
  stats: ModerationStats | null
}

export function ModerationStatsCards({ stats }: ModerationStatsProps) {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
      <Card className="border-2 hover:border-primary/30 transition-colors">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <AlertTriangle className="w-4 h-4 text-yellow-600" />
            Pending Reviews
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-primary">{stats?.pending_reviews ?? 0}</div>
          <p className="text-xs text-muted-foreground mt-1">Rituals awaiting review</p>
        </CardContent>
      </Card>

      <Card className="border-2 hover:border-primary/30 transition-colors">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <FileText className="w-4 h-4 text-orange-600" />
            Open Cases
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-orange-600">{stats?.open_cases ?? 0}</div>
          <p className="text-xs text-muted-foreground mt-1">Active moderation cases</p>
        </CardContent>
      </Card>

      <Card className="border-2 hover:border-primary/30 transition-colors">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <TrendingUp className="w-4 h-4 text-green-600" />
            Today's Reviews
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">{stats?.reviews_completed_today ?? 0}</div>
          <p className="text-xs text-muted-foreground mt-1">Reviews completed today</p>
        </CardContent>
      </Card>

      <Card className="border-2 hover:border-primary/30 transition-colors">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Shield className="w-4 h-4 text-blue-600" />
            Cases Resolved
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-blue-600">{stats?.cases_resolved_today ?? 0}</div>
          <p className="text-xs text-muted-foreground mt-1">Cases resolved today</p>
        </CardContent>
      </Card>
    </div>
  )
}

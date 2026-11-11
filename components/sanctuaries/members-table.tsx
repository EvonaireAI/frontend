"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { Membership } from "@/lib/sanctuaries"
import { Loader2, Trash2 } from "lucide-react"
import { fmtLocale, tr, trNode } from "@/lib/i18n"


interface MembersTableProps {
  members: Membership[]
  loading?: boolean
  onRevoke: (membershipId: number, reason?: string) => Promise<void>
  onRefresh?: () => Promise<void>
}

export function MembersTable({ members, loading = false, onRevoke, onRefresh }: MembersTableProps) {
  const [processingId, setProcessingId] = useState<number | null>(null)

  const handleRevoke = async (membershipId: number) => {
    if (!confirm(tr("Are you sure you want to revoke this membership?"))) return

    setProcessingId(membershipId)
    try {
      await onRevoke(membershipId)
      await onRefresh?.()
    } finally {
      setProcessingId(null)
    }
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-foreground">{tr("Active Members")}</CardTitle>
        <CardDescription>{tr("Manage your sanctuary members")}</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : members.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-sm">{tr("No approved members yet")}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {members.map((member) => (
              <Card key={member.id} className="border-l-4 border-l-primary bg-secondary border-border">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h4 className="font-medium text-foreground">
                        {member.member.first_name} {member.member.last_name}
                      </h4>
                      <p className="text-sm text-muted-foreground">{member.member.email}</p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {trNode("Joined {p0}", { p0: new Date(member.acted_at || member.requested_at).toLocaleDateString(fmtLocale()) })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                        {tr("Approved")}
                      </Badge>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive hover:text-destructive bg-transparent"
                        onClick={() => handleRevoke(member.id)}
                        disabled={processingId === member.id}
                      >
                        {processingId === member.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

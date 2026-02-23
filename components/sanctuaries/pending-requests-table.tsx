"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { Membership } from "@/lib/sanctuaries"
import { Loader2, Check, X } from "lucide-react"

interface PendingRequestsTableProps {
  requests: Membership[]
  loading?: boolean
  onApprove: (membershipId: number, note?: string) => Promise<void>
  onReject: (membershipId: number, note?: string) => Promise<void>
  onRefresh?: () => Promise<void>
}

export function PendingRequestsTable({
  requests,
  loading = false,
  onApprove,
  onReject,
  onRefresh,
}: PendingRequestsTableProps) {
  const [processingId, setProcessingId] = useState<number | null>(null)

  const handleApprove = async (membershipId: number) => {
    setProcessingId(membershipId)
    try {
      await onApprove(membershipId)
      await onRefresh?.()
    } finally {
      setProcessingId(null)
    }
  }

  const handleReject = async (membershipId: number) => {
    setProcessingId(membershipId)
    try {
      await onReject(membershipId)
      await onRefresh?.()
    } finally {
      setProcessingId(null)
    }
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-foreground">Pending Join Requests</CardTitle>
        <CardDescription>Review and manage membership requests</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : requests.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-sm">No pending requests</p>
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map((request) => (
              <Card key={request.id} className="border-l-4 border-l-gold-muted bg-secondary border-border">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <h4 className="font-medium text-foreground">
                        {request.member.first_name} {request.member.last_name}
                      </h4>
                      <p className="text-sm text-muted-foreground">{request.member.email}</p>
                      {request.note && <p className="text-sm mt-2 italic text-muted-foreground">"{request.note}"</p>}
                      <p className="text-xs text-muted-foreground mt-2">
                        Requested {new Date(request.requested_at).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge variant="outline" className="bg-gold-muted/10 text-gold-muted border-gold-muted/20">
                      Pending
                    </Badge>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 text-primary hover:text-primary border-primary/30 hover:bg-primary/10 bg-transparent"
                      onClick={() => handleApprove(request.id)}
                      disabled={processingId === request.id}
                    >
                      {processingId === request.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Check className="w-4 h-4 mr-2" />
                      )}
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/10 bg-transparent"
                      onClick={() => handleReject(request.id)}
                      disabled={processingId === request.id}
                    >
                      {processingId === request.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <X className="w-4 h-4 mr-2" />
                      )}
                      Reject
                    </Button>
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

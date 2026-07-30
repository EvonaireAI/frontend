"use client"

import { useCallback, useEffect, useState } from "react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Check, Loader2, RefreshCw, X } from "lucide-react"
import { toast } from "sonner"
import { authService, type RoleRequest } from "@/lib/auth"
import { roleShortLabel } from "@/lib/roles"

// Requests for elevated roles. Unchanged behaviour from Session 10 — the only
// Session 11 difference is that a `role="superadmin"` steward can now reach it,
// because `IsAdminUser` finally honours that role.

export function StewardRequestsTab() {
  const [requests, setRequests] = useState<RoleRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionId, setActionId] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setRequests(await authService.getRoleRequests())
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load steward requests")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const decide = async (id: number, decision: "approve" | "reject") => {
    setActionId(id)
    try {
      if (decision === "approve") {
        await authService.approveRoleRequest(id)
        toast.success("Request approved")
      } else {
        await authService.rejectRoleRequest(id)
        toast.success("Request rejected")
      }
      setRequests((prev) => prev.filter((request) => request.id !== id))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Failed to ${decision} the request`)
      load()
    } finally {
      setActionId(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base">Pending steward requests</CardTitle>
            <CardDescription>Review and approve or reject requests for elevated roles.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{requests.length} pending</Badge>
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 2 }).map((_, index) => (
              <Skeleton key={index} className="h-28 w-full" />
            ))}
          </div>
        ) : requests.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No pending role requests.</p>
        ) : (
          <div className="space-y-4">
            {requests.map((request) => (
              <div key={request.id} className="space-y-3 rounded-lg border border-border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar>
                      <AvatarImage src={request.user.profile_picture || "/placeholder.svg"} />
                      <AvatarFallback>
                        {request.user.first_name?.[0]}
                        {request.user.last_name?.[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-foreground">
                        {request.user.first_name} {request.user.last_name}
                      </h3>
                      <p className="break-all text-sm text-muted-foreground">{request.user.email}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <Badge variant="outline">Current: {roleShortLabel(request.user.role)}</Badge>
                        <Badge>Requesting: {roleShortLabel(request.requested_role)}</Badge>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => decide(request.id, "approve")} disabled={actionId === request.id}>
                      {actionId === request.id ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="mr-2 h-4 w-4" />
                      )}
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => decide(request.id, "reject")}
                      disabled={actionId === request.id}
                    >
                      {actionId === request.id ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <X className="mr-2 h-4 w-4" />
                      )}
                      Reject
                    </Button>
                  </div>
                </div>
                <div>
                  <h4 className="mb-1 text-sm font-medium">Reason</h4>
                  <p className="break-words rounded bg-muted p-3 text-sm text-muted-foreground">{request.reason}</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Requested on {new Date(request.created_at).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

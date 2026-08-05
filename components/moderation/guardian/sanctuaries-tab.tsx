"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Eye, RefreshCw, Users } from "lucide-react"
import { sanctuariesService, type Sanctuary } from "@/lib/sanctuaries"

// The guardian view of sanctuaries. Audits, status changes and the Session 10
// removal flow all live on the per-sanctuary page at
// /moderate/sanctuaries/<id> — this tab is the way in, not a second copy.

export function SanctuariesTab() {
  const [sanctuaries, setSanctuaries] = useState<Sanctuary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setSanctuaries(await sanctuariesService.listSanctuaries())
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load sanctuaries")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Every sanctuary on the platform. Open one to review its members, ritual assignments and audit log.
        </p>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-28 w-full" />
          ))}
        </div>
      ) : sanctuaries.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-16 text-center">
          <Users className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="font-medium text-foreground">No sanctuaries yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sanctuaries.map((sanctuary) => (
            <Card key={sanctuary.id} className="border-l-4 border-l-primary">
              <CardContent className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-2">
                    <h4 className="break-words text-base font-medium text-foreground">{sanctuary.title}</h4>
                    <p className="line-clamp-2 break-words text-sm text-muted-foreground">{sanctuary.description}</p>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline" className="capitalize">
                        {sanctuary.status}
                      </Badge>
                      <Badge variant="outline" className="capitalize">
                        {sanctuary.privacy}
                      </Badge>
                      <Badge variant="secondary">
                        {sanctuary.active_members_count}/{sanctuary.capacity} members
                      </Badge>
                    </div>
                    <p className="break-all text-xs text-muted-foreground">
                      Owner: {sanctuary.owner.first_name} {sanctuary.owner.last_name}
                    </p>
                  </div>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/moderate/sanctuaries/${sanctuary.id}`}>
                      <Eye className="mr-2 h-4 w-4" />
                      Audit
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

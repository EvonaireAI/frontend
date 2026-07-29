"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Clock, Heart, MessageSquare, RefreshCw, ShieldAlert, User as UserIcon } from "lucide-react"
import { moderationService, SEVERITY_CHIPS, type CareFeedItem } from "@/lib/moderation"

// The Care Feed is a record of care *extended* — the blessings and feedback
// guardians have given, merged with the live cases they're holding. It is not a
// second queue, so nothing here asks to be actioned.

const TYPE_META: Record<CareFeedItem["type"], { icon: React.ReactNode; label: string }> = {
  blessing: { icon: <Heart className="h-4 w-4 text-pink-500" />, label: "Blessing given" },
  feedback: { icon: <MessageSquare className="h-4 w-4 text-blue-500" />, label: "Feedback given" },
  case: { icon: <ShieldAlert className="h-4 w-4 text-orange-500" />, label: "Care case" },
}

function BlessingRow({ item }: { item: CareFeedItem }) {
  return (
    <p className="text-sm text-muted-foreground">
      A blessing was offered{item.ritual_title ? ` on “${item.ritual_title}”` : ""}.
    </p>
  )
}

function FeedbackRow({ item }: { item: CareFeedItem }) {
  return (
    <p className="break-words text-sm text-foreground">
      {item.feedback_text || "Feedback was left without a note."}
    </p>
  )
}

function CaseRow({ item }: { item: CareFeedItem }) {
  return (
    <div className="space-y-1">
      <p className="break-words text-sm text-muted-foreground">{item.flagged_reason || "No reason recorded."}</p>
      {item.assigned_moderator_email && (
        <p className="text-xs text-muted-foreground">Held by {item.assigned_moderator_email}</p>
      )}
    </div>
  )
}

export function CareFeedTab() {
  const [items, setItems] = useState<CareFeedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setItems(await moderationService.getCareFeed(50))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load the Care Feed")
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
          Care extended across the community — blessings and feedback given by guardians, alongside the cases
          currently being held. Nothing here needs action.
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
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-24 w-full" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-16 text-center">
          <Heart className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="font-medium text-foreground">No care recorded yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Blessings and feedback appear here as they&apos;re given.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const meta = TYPE_META[item.type] ?? TYPE_META.case
            const chip = item.severity ? SEVERITY_CHIPS[item.severity] : null
            return (
              <Card key={`${item.type}-${item.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex-shrink-0">{meta.icon}</div>
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary" className="text-xs">
                          {meta.label}
                        </Badge>
                        {chip && (
                          <Badge variant="outline" className={`${chip.className} text-xs`}>
                            {chip.label}
                          </Badge>
                        )}
                        {item.is_anonymous && (
                          <Badge variant="outline" className="text-xs">
                            Anonymous
                          </Badge>
                        )}
                      </div>

                      {item.ritual_title && item.type !== "blessing" && (
                        <p className="text-sm font-medium text-primary break-words">{item.ritual_title}</p>
                      )}

                      {item.type === "blessing" && <BlessingRow item={item} />}
                      {item.type === "feedback" && <FeedbackRow item={item} />}
                      {item.type === "case" && <CaseRow item={item} />}

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        {item.giver_email && !item.is_anonymous && (
                          <span className="flex items-center gap-1 break-all">
                            <UserIcon className="h-3.5 w-3.5" />
                            {item.giver_email}
                          </span>
                        )}
                        {item.created_at && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            {new Date(item.created_at).toLocaleDateString()}
                          </span>
                        )}
                        {item.ritual && (
                          <Link href={`/member/ritual/${item.ritual}`} className="text-primary hover:underline">
                            View ritual
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

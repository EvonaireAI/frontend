"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  agoraService,
  CircleTitleError,
  NotMemberError,
  ThrottledError,
  type Circle,
  type CirclesResponse,
} from "@/lib/agora"
import { EntitlementDeniedError, openUpgradeModal } from "@/lib/entitlements"
import { useEntitlements } from "@/lib/entitlements-context"
import { Loader2, Landmark, ChevronDown, Sparkles, MessageCircle } from "lucide-react"

function CircleCard({ sanctuaryId, circle }: { sanctuaryId: number; circle: Circle }) {
  return (
    <Link href={`/member/sanctuaries/${sanctuaryId}/circles/${circle.id}`} className="block">
      <Card className="bg-card border border-border hover:border-primary/40 transition-all duration-200 group">
        <CardHeader className="pb-3">
          <div className="flex justify-between items-start gap-2">
            <CardTitle className="text-base text-foreground group-hover:text-primary transition-colors">
              {circle.title}
            </CardTitle>
            {circle.status === "archived" && (
              <Badge variant="outline" className="border-border text-muted-foreground text-xs shrink-0">
                archived
              </Badge>
            )}
          </div>
          {circle.description && (
            <CardDescription className="line-clamp-2 text-sm">{circle.description}</CardDescription>
          )}
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>Hosted by {circle.host.display_name}</span>
            <span className="flex items-center gap-1">
              <MessageCircle className="w-3 h-3" />
              {circle.post_count}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

// The Agora section of a sanctuary page: discussion circles for approved
// members. CTAs are driven by the server-provided capabilities flags.
export function AgoraCircles({ sanctuaryId }: { sanctuaryId: number }) {
  const { plan } = useEntitlements()
  const [data, setData] = useState<CirclesResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [notMember, setNotMember] = useState(false)

  const [createOpen, setCreateOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [titleError, setTitleError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    agoraService
      .getCircles(sanctuaryId)
      .then(setData)
      .catch((err) => {
        if (err instanceof NotMemberError) {
          setNotMember(true)
        } else {
          console.error("Failed to load circles:", err)
        }
      })
      .finally(() => setLoading(false))
  }, [sanctuaryId])

  const handleCreate = async () => {
    const trimmed = title.trim()
    if (!trimmed) {
      setTitleError("Give your circle a title.")
      return
    }
    setCreating(true)
    setTitleError(null)
    try {
      const circle = await agoraService.createCircle(sanctuaryId, {
        title: trimmed,
        description: description.trim() || undefined,
      })
      setData((prev) => (prev ? { ...prev, circles: [circle, ...prev.circles] } : prev))
      setCreateOpen(false)
      setTitle("")
      setDescription("")
      toast.success("Your circle is open.")
    } catch (err) {
      if (err instanceof EntitlementDeniedError) {
        setCreateOpen(false)
      } else if (err instanceof CircleTitleError) {
        setTitleError(err.message)
      } else if (err instanceof ThrottledError) {
        toast(err.message)
      } else {
        toast.error(err instanceof Error ? err.message : "Failed to start the circle")
      }
    } finally {
      setCreating(false)
    }
  }

  const sectionHeader = (
    <div className="flex items-center gap-2">
      <Landmark className="w-4 h-4 text-primary" />
      <CardTitle>The Agora</CardTitle>
    </div>
  )

  if (loading) {
    return (
      <Card className="bg-card border-border">
        <CardHeader>{sectionHeader}</CardHeader>
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    )
  }

  // Plain 403 — not an approved member. Never show upgrade UI for this.
  if (notMember) {
    return (
      <Card className="bg-card border-border">
        <CardHeader>
          {sectionHeader}
          <CardDescription>Discussion circles for this sanctuary&apos;s members</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Join this sanctuary first to take part in its circles.
          </p>
        </CardContent>
      </Card>
    )
  }

  if (!data) return null

  const active = data.circles.filter((c) => c.status !== "archived")
  const archived = data.circles.filter((c) => c.status === "archived")

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            {sectionHeader}
            <CardDescription className="mt-1.5">
              Discussion circles for this sanctuary&apos;s members
            </CardDescription>
          </div>
          {data.capabilities.can_host ? (
            <Button
              size="sm"
              onClick={() => setCreateOpen(true)}
              className="bg-primary text-primary-foreground hover:bg-gold-muted shrink-0"
            >
              Start a circle
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                openUpgradeModal({ reason: "agora_tier", current_plan: plan, required_plan: "evobloom" })
              }
              className="text-gold-muted hover:text-primary shrink-0 gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Host your own circles with Scholar
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {active.length === 0 && archived.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No circles yet — this sanctuary&apos;s agora is quiet for now.
          </p>
        ) : (
          <>
            <div className="grid gap-3 md:grid-cols-2">
              {active.map((circle) => (
                <CircleCard key={circle.id} sanctuaryId={sanctuaryId} circle={circle} />
              ))}
            </div>

            {archived.length > 0 && (
              <Collapsible>
                <CollapsibleTrigger className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                  <ChevronDown className="w-4 h-4" />
                  Archived ({archived.length})
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-3">
                  <div className="grid gap-3 md:grid-cols-2">
                    {archived.map((circle) => (
                      <CircleCard key={circle.id} sanctuaryId={sanctuaryId} circle={circle} />
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}
          </>
        )}
      </CardContent>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle>Start a circle</DialogTitle>
            <DialogDescription>
              Open a calm space for this sanctuary&apos;s members to gather around a theme.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="circle-title">Title</Label>
              <Input
                id="circle-title"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value)
                  setTitleError(null)
                }}
                maxLength={255}
                placeholder="Morning Reflections"
                className="bg-secondary border-border"
              />
              {titleError && <p className="text-sm text-destructive">{titleError}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="circle-description">Description (optional)</Label>
              <Textarea
                id="circle-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="What is this circle for?"
                className="bg-secondary border-border"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setCreateOpen(false)}
                disabled={creating}
                className="bg-transparent border-border text-muted-foreground hover:bg-secondary"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                disabled={creating || !title.trim()}
                className="bg-primary text-primary-foreground hover:bg-gold-muted"
              >
                {creating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Starting…
                  </>
                ) : (
                  "Start circle"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

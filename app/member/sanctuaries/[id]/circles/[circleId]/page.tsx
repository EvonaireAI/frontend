"use client"

import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { useAuth } from "@/lib/auth-context"
import { useEntitlements } from "@/lib/entitlements-context"
import { EntitlementDeniedError, openUpgradeModal } from "@/lib/entitlements"
import {
  agoraService,
  NotMemberError,
  ThrottledError,
  type AgoraCapabilities,
  type AgoraPost,
  type AgoraReply,
  type Circle,
} from "@/lib/agora"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { CareFlagDialog, type CareFlagTarget } from "@/components/agora/care-flag-dialog"
import { Loader2, ArrowLeft, HandHeart, MoreHorizontal, Sparkles, Archive, Send } from "lucide-react"

const POST_MAX_LENGTH = 5000

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
}

// Overflow menu for a post or reply. The care flag is available to every
// member; removal only to the author (own content) or a moderator —
// moderation affordances stay completely hidden from regular members.
function ItemMenu({
  own,
  isModerator,
  onFlag,
  onRemove,
}: {
  own: boolean
  isModerator: boolean
  onFlag: () => void
  onRemove: () => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground">
          <MoreHorizontal className="w-4 h-4" />
          <span className="sr-only">More</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-card border-border">
        <DropdownMenuItem onClick={onFlag}>
          <HandHeart className="w-4 h-4 mr-2 text-primary" />
          Raise a care flag
        </DropdownMenuItem>
        {own ? (
          <DropdownMenuItem onClick={onRemove} className="text-destructive focus:text-destructive">
            Remove
          </DropdownMenuItem>
        ) : (
          isModerator && (
            <DropdownMenuItem onClick={onRemove} className="text-destructive focus:text-destructive">
              Remove (moderation)
            </DropdownMenuItem>
          )
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default function CircleViewPage() {
  const { user, loading: authLoading } = useAuth()
  const { plan } = useEntitlements()
  const router = useRouter()
  const params = useParams()
  const sanctuaryId = Number.parseInt(params.id as string)
  const circleId = Number.parseInt(params.circleId as string)

  const [circle, setCircle] = useState<Circle | null>(null)
  const [posts, setPosts] = useState<AgoraPost[]>([])
  const [capabilities, setCapabilities] = useState<AgoraCapabilities | null>(null)
  const [nextBefore, setNextBefore] = useState<number | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [notMember, setNotMember] = useState(false)

  const [composerBody, setComposerBody] = useState("")
  const [posting, setPosting] = useState(false)
  const [replyDrafts, setReplyDrafts] = useState<Record<number, string>>({})
  const [replyingTo, setReplyingTo] = useState<number | null>(null)
  const [flagTarget, setFlagTarget] = useState<CareFlagTarget | null>(null)

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.push("/auth/login")
      return
    }

    agoraService
      .getPosts(circleId)
      .then((page) => {
        setCircle(page.circle)
        setPosts(page.posts)
        setCapabilities(page.capabilities)
        setNextBefore(page.next_before)
        setHasMore(page.has_more)
      })
      .catch((err) => {
        if (err instanceof NotMemberError) {
          setNotMember(true)
        } else {
          console.error("Failed to load circle:", err)
        }
      })
      .finally(() => setLoading(false))
  }, [user, authLoading, router, circleId])

  const updatePost = (postId: number, updater: (post: AgoraPost) => AgoraPost) => {
    setPosts((prev) => prev.map((p) => (p.id === postId ? updater(p) : p)))
  }

  const seekerUpsell = () =>
    openUpgradeModal({ reason: "agora_tier", current_plan: plan, required_plan: "evocore" })

  const showError = (err: unknown, fallback: string) => {
    if (err instanceof EntitlementDeniedError) return
    if (err instanceof ThrottledError) {
      toast(err.message)
      return
    }
    toast.error(err instanceof Error ? err.message : fallback)
  }

  const handleLoadOlder = async () => {
    setLoadingOlder(true)
    try {
      const page = await agoraService.getPosts(circleId, nextBefore)
      setPosts((prev) => [...prev, ...page.posts])
      setNextBefore(page.next_before)
      setHasMore(page.has_more)
    } catch (err) {
      showError(err, "Failed to load older posts")
    } finally {
      setLoadingOlder(false)
    }
  }

  const handleShare = async () => {
    const body = composerBody.trim()
    if (!body) return
    setPosting(true)
    try {
      const post = await agoraService.createPost(circleId, body)
      setPosts((prev) => [post, ...prev])
      setComposerBody("")
    } catch (err) {
      showError(err, "Failed to share your post")
    } finally {
      setPosting(false)
    }
  }

  const handleReply = async (postId: number) => {
    const body = (replyDrafts[postId] || "").trim()
    if (!body) return
    setReplyingTo(postId)
    try {
      const reply = await agoraService.createReply(postId, body)
      updatePost(postId, (p) => ({ ...p, replies: [...p.replies, reply] }))
      setReplyDrafts((prev) => ({ ...prev, [postId]: "" }))
    } catch (err) {
      showError(err, "Failed to reply")
    } finally {
      setReplyingTo(null)
    }
  }

  // Optimistic toggle, reconciled with the server's response. Never used
  // for ordering — posts stay strictly chronological.
  const handleBless = async (post: AgoraPost) => {
    if (!capabilities?.can_post) {
      seekerUpsell()
      return
    }
    const previous = { blessed: post.caller_blessed, count: post.blessing_count }
    updatePost(post.id, (p) => ({
      ...p,
      caller_blessed: !p.caller_blessed,
      blessing_count: p.blessing_count + (p.caller_blessed ? -1 : 1),
    }))
    try {
      const result = await agoraService.blessPost(post.id)
      updatePost(post.id, (p) => ({
        ...p,
        caller_blessed: result.blessed,
        blessing_count: result.blessing_count,
      }))
    } catch (err) {
      updatePost(post.id, (p) => ({
        ...p,
        caller_blessed: previous.blessed,
        blessing_count: previous.count,
      }))
      showError(err, "Failed to bless this post")
    }
  }

  const handleRemovePost = async (post: AgoraPost) => {
    const own = user?.id != null && post.author.id === user.id
    const message = own
      ? "Remove your post? It will no longer be visible to the circle."
      : "Remove this post from the circle? (moderation action)"
    if (!confirm(message)) return
    try {
      await agoraService.removePost(post.id)
      setPosts((prev) => prev.filter((p) => p.id !== post.id))
    } catch (err) {
      showError(err, "Failed to remove the post")
    }
  }

  const handleRemoveReply = async (postId: number, reply: AgoraReply) => {
    const own = user?.id != null && reply.author.id === user.id
    const message = own
      ? "Remove your reply? It will no longer be visible to the circle."
      : "Remove this reply from the circle? (moderation action)"
    if (!confirm(message)) return
    try {
      await agoraService.removeReply(reply.id)
      updatePost(postId, (p) => ({ ...p, replies: p.replies.filter((r) => r.id !== reply.id) }))
    } catch (err) {
      showError(err, "Failed to remove the reply")
    }
  }

  const handleArchive = async () => {
    if (!confirm("Archive this circle? Conversations stay readable, but new posts close.")) return
    try {
      const updated = await agoraService.archiveCircle(circleId)
      setCircle(updated)
      toast("This circle is now archived.")
    } catch (err) {
      showError(err, "Failed to archive the circle")
    }
  }

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (notMember) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="bg-card border-border">
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground mb-4">Join this sanctuary first to take part in its circles.</p>
            <Button asChild>
              <Link href={`/member/sanctuaries/${sanctuaryId}`}>Back to Sanctuary</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!circle || !capabilities) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="bg-card border-border">
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground mb-4">Circle not found</p>
            <Button asChild>
              <Link href={`/member/sanctuaries/${sanctuaryId}`}>Back to Sanctuary</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const isArchived = circle.status === "archived"
  const isHost = user?.id != null && circle.host.id === user.id && capabilities.can_host
  const canArchive = !isArchived && (isHost || capabilities.is_moderator)

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <Button asChild variant="outline" className="mb-4 bg-transparent">
          <Link href={`/member/sanctuaries/${sanctuaryId}`}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Sanctuary
          </Link>
        </Button>

        {/* Circle header */}
        <div className="mb-8">
          <div className="flex justify-between items-start gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-3xl font-serif text-foreground">{circle.title}</h1>
                {isArchived && (
                  <Badge variant="outline" className="border-border text-muted-foreground">
                    archived
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">Hosted by {circle.host.display_name}</p>
              {circle.description && <p className="text-muted-foreground mt-2">{circle.description}</p>}
            </div>
            {canArchive && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleArchive}
                className="bg-transparent border-border text-muted-foreground hover:bg-secondary shrink-0"
              >
                <Archive className="w-4 h-4 mr-2" />
                Archive circle
              </Button>
            )}
          </div>
        </div>

        {/* Composer — driven entirely by capabilities and circle status */}
        <div className="mb-8">
          {isArchived ? (
            <Card className="bg-secondary border-border">
              <CardContent className="py-4 text-center">
                <p className="text-sm text-muted-foreground">
                  This circle is archived — conversations stay readable, but new posts are closed.
                </p>
              </CardContent>
            </Card>
          ) : capabilities.can_post ? (
            <Card className="bg-card border-border">
              <CardContent className="pt-6 space-y-3">
                <Textarea
                  value={composerBody}
                  onChange={(e) => setComposerBody(e.target.value)}
                  maxLength={POST_MAX_LENGTH}
                  rows={3}
                  placeholder="Share what's on your heart…"
                  className="bg-secondary border-border resize-y"
                />
                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs ${
                      composerBody.length >= POST_MAX_LENGTH ? "text-destructive" : "text-muted-foreground"
                    }`}
                  >
                    {composerBody.length >= POST_MAX_LENGTH - 500
                      ? `${composerBody.length}/${POST_MAX_LENGTH}`
                      : ""}
                  </span>
                  <Button
                    onClick={handleShare}
                    disabled={posting || !composerBody.trim()}
                    className="bg-primary text-primary-foreground hover:bg-gold-muted"
                  >
                    {posting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Sharing…
                      </>
                    ) : (
                      "Share"
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-card border-border border-primary/20">
              <CardContent className="py-6 text-center space-y-3">
                <p className="text-sm text-muted-foreground">
                  Reading is open to every member — posting is part of the Seeker tier.
                </p>
                <Button onClick={seekerUpsell} className="bg-primary text-primary-foreground hover:bg-gold-muted">
                  <Sparkles className="w-4 h-4 mr-2" />
                  Join discussions with Seeker
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Post stream — always chronological, rendered exactly as returned */}
        {posts.length === 0 ? (
          <Card className="bg-card border-border">
            <CardContent className="py-10 text-center">
              <p className="text-sm text-muted-foreground">No posts yet. This circle is waiting for its first voice.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => {
              const ownPost = user?.id != null && post.author.id === user.id
              return (
                <Card key={post.id} className="bg-card border-border">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <CardTitle className="text-sm text-foreground">{post.author.display_name}</CardTitle>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {formatTimestamp(post.created_at)}
                          {post.edited_at && " · edited"}
                        </p>
                      </div>
                      <ItemMenu
                        own={ownPost}
                        isModerator={capabilities.is_moderator}
                        onFlag={() => setFlagTarget({ type: "post", id: post.id })}
                        onRemove={() => handleRemovePost(post)}
                      />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-foreground whitespace-pre-wrap">{post.body}</p>

                    {/* Blessing — a quiet acknowledgment, never a ranking */}
                    <button
                      type="button"
                      onClick={() => handleBless(post)}
                      className={`flex items-center gap-1.5 text-xs transition-colors ${
                        post.caller_blessed
                          ? "text-primary"
                          : "text-muted-foreground hover:text-primary"
                      }`}
                    >
                      <HandHeart
                        className={`w-4 h-4 ${post.caller_blessed ? "fill-primary/20" : ""}`}
                      />
                      {post.caller_blessed ? "Blessed" : "Bless"}
                      {post.blessing_count > 0 && (
                        <span className="text-muted-foreground">· {post.blessing_count}</span>
                      )}
                    </button>

                    {/* Replies — one level deep, oldest first, no nesting */}
                    {(post.replies.length > 0 || !isArchived) && (
                      <div className="border-l-2 border-border pl-4 space-y-3">
                        {post.replies.map((reply) => {
                          const ownReply = user?.id != null && reply.author.id === user.id
                          return (
                            <div key={reply.id} className="flex justify-between items-start gap-2">
                              <div>
                                <p className="text-xs text-muted-foreground">
                                  <span className="text-foreground font-medium">{reply.author.display_name}</span>
                                  {" · "}
                                  {formatTimestamp(reply.created_at)}
                                  {reply.edited_at && " · edited"}
                                </p>
                                <p className="text-sm text-foreground whitespace-pre-wrap mt-1">{reply.body}</p>
                              </div>
                              <ItemMenu
                                own={ownReply}
                                isModerator={capabilities.is_moderator}
                                onFlag={() => setFlagTarget({ type: "reply", id: reply.id })}
                                onRemove={() => handleRemoveReply(post.id, reply)}
                              />
                            </div>
                          )
                        })}

                        {!isArchived &&
                          (capabilities.can_post ? (
                            <div className="flex items-center gap-2">
                              <Input
                                value={replyDrafts[post.id] || ""}
                                onChange={(e) =>
                                  setReplyDrafts((prev) => ({ ...prev, [post.id]: e.target.value }))
                                }
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" && !e.shiftKey) {
                                    e.preventDefault()
                                    handleReply(post.id)
                                  }
                                }}
                                maxLength={POST_MAX_LENGTH}
                                placeholder="Reply gently…"
                                className="h-8 text-sm bg-secondary border-border"
                              />
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleReply(post.id)}
                                disabled={replyingTo === post.id || !(replyDrafts[post.id] || "").trim()}
                                className="h-8 px-2 text-primary hover:text-gold-muted shrink-0"
                              >
                                {replyingTo === post.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Send className="w-4 h-4" />
                                )}
                                <span className="sr-only">Send reply</span>
                              </Button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={seekerUpsell}
                              className="text-xs text-gold-muted hover:text-primary transition-colors"
                            >
                              Join discussions with Seeker
                            </button>
                          ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}

            {hasMore && (
              <div className="flex justify-center pt-2">
                <Button
                  variant="outline"
                  onClick={handleLoadOlder}
                  disabled={loadingOlder}
                  className="bg-transparent border-border text-muted-foreground hover:bg-secondary"
                >
                  {loadingOlder ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Loading…
                    </>
                  ) : (
                    "Load older"
                  )}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      <CareFlagDialog target={flagTarget} onClose={() => setFlagTarget(null)} />
    </div>
  )
}

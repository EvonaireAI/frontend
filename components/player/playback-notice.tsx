"use client"

// Enforcement UX (Session 12, CEO framework area 5).
//
// Charter rules for every string in this file: no accusation, no shaming, no
// countdown, no urgency engineering, no implication that access has been taken
// away when it has not. Automation may warn and pause a session; only a human
// Guardian can restrict an account, and these cards say so.

import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { MonitorSmartphone, PauseCircle, ShieldQuestion } from "lucide-react"

interface PlaybackMovedNoticeProps {
  detail?: string | null
  onPlayHere: () => void
  busy?: boolean
}

/**
 * The user's one playback session moved to another device. Calm and factual:
 * nothing is wrong, they just have two devices and we play in one place.
 */
export function PlaybackMovedNotice({ detail, onPlayHere, busy }: PlaybackMovedNoticeProps) {
  // The server's detail for this reason is the same sentence as our heading;
  // repeating it reads like a stutter, so fall through to the friendlier line.
  const body =
    detail && detail.replace(/[.\s]/g, "").toLowerCase() !== "playbackmovedtoyourotherdevice"
      ? detail
      : "Your listening continues there. You can bring it back here whenever you like."

  return (
    <div
      role="status"
      className="rounded-lg border border-border bg-secondary/40 p-4 text-left flex items-start gap-3"
    >
      <MonitorSmartphone className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" aria-hidden="true" />
      <div className="space-y-2 flex-1">
        <p className="text-sm text-foreground">Playback moved to your other device</p>
        <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
        <Button size="sm" variant="outline" onClick={onPlayHere} disabled={busy}>
          {busy ? "Starting…" : "Play here instead"}
        </Button>
      </div>
    </div>
  )
}

interface PlaybackLockedCardProps {
  detail: string
  flagId?: number | null
}

/**
 * Score crossed the lock threshold: this one session is paused pending a
 * Guardian's review. Membership, plan and other devices are untouched, and the
 * copy has to say that plainly — an unexplained stop reads as punishment.
 */
export function PlaybackLockedCard({ detail, flagId }: PlaybackLockedCardProps) {
  return (
    <Card className="bg-card border-border text-left">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary shrink-0">
            <PauseCircle className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          </div>
          <div>
            <CardTitle className="text-base text-foreground">Playback is paused for now</CardTitle>
            <CardDescription>A Guardian will take a look.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground leading-relaxed">{detail}</p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          If this doesn&apos;t look right to you, we&apos;d like to hear about it.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href="/member/reflection-room">Reflection Room</Link>
          </Button>
          <Button asChild size="sm" variant="ghost">
            <Link href="/profile">Contact support</Link>
          </Button>
        </div>
        {flagId ? (
          <p className="text-xs text-muted-foreground">Reference #{flagId}</p>
        ) : null}
      </CardContent>
    </Card>
  )
}

interface PlaybackRestrictedCardProps {
  detail?: string | null
}

/**
 * A named human decided this, with a written reason, via the flag-resolve
 * endpoint. Never presented as automatic.
 */
export function PlaybackRestrictedCard({ detail }: PlaybackRestrictedCardProps) {
  return (
    <Card className="bg-card border-border text-left">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary shrink-0">
            <ShieldQuestion className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          </div>
          <div>
            <CardTitle className="text-base text-foreground">Playback is on hold</CardTitle>
            <CardDescription>A Guardian has paused playback on this account.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground leading-relaxed">
          {detail || "Playback is paused on this account while we work something out together."}
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Reach out and a person will walk you through it — this is a conversation, not a
          closed door.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href="/member/reflection-room">Reflection Room</Link>
          </Button>
          <Button asChild size="sm" variant="ghost">
            <Link href="/profile">Contact support</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

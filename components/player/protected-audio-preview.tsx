"use client"

// A watermarked, hardened <audio> surface for review contexts (Session 12).
//
// Used where someone other than the listener plays a creator's audio — the
// moderation queue today, any document or image viewer we add later. The
// protections are the same deterrents the member player uses: no context menu,
// no download affordance, no Picture-in-Picture, no URL in the markup, and a
// drifting watermark carrying the reviewer's pseudonym so a leak from inside
// the review queue is as traceable as one from a member session.
//
// Review playback is not metered and holds no PlaybackSession, so there is no
// session-bound stream token here — the URL comes from the legacy unbound
// stream endpoint. That is a documented gap, not an oversight: binding it would
// mean opening a listening session for a moderator and crediting royalties for
// review work.

import { useEffect, useRef, useState } from "react"
import { useAuth } from "@/lib/auth-context"
import {
  assignStreamSource,
  clearStreamSource,
  hardenMediaElement,
  protectSurface,
} from "@/lib/screen-protection"
import { derivePseudonym } from "@/lib/watermark"
import { DynamicWatermark } from "./dynamic-watermark"

interface ProtectedAudioPreviewProps {
  /** Resolved lazily so the URL never sits in a prop for longer than this call. */
  getSourceUrl: () => string
  /** Short label identifying what is being reviewed, e.g. "R91". */
  contextLabel: string
  onEnded?: () => void
  className?: string
}

export function ProtectedAudioPreview({
  getSourceUrl,
  contextLabel,
  onEnded,
  className,
}: ProtectedAudioPreviewProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const surfaceRef = useRef<HTMLDivElement | null>(null)
  const { user } = useAuth()
  const [pseudonym, setPseudonym] = useState("————————")

  useEffect(() => {
    let cancelled = false
    derivePseudonym(user?.id).then((value) => {
      if (!cancelled) setPseudonym(value)
    })
    return () => {
      cancelled = true
    }
  }, [user?.id])

  useEffect(() => {
    const audio = audioRef.current
    hardenMediaElement(audio)
    assignStreamSource(audio, getSourceUrl())
    const releaseSurface = protectSurface(surfaceRef.current)
    return () => {
      releaseSurface()
      clearStreamSource(audio)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div ref={surfaceRef} className={`relative ${className ?? ""}`}>
      <DynamicWatermark identity={{ pseudonym, sessionLabel: contextLabel }} />
      <audio
        ref={audioRef}
        controls
        className="w-full"
        onEnded={onEnded}
        preload="none"
        controlsList="nodownload"
        disablePictureInPicture
      >
        Your browser does not support the audio element.
      </audio>
    </div>
  )
}

export default ProtectedAudioPreview

"use client"

import { useCallback, useEffect, useState, useRef } from "react"
import { useRouter, useParams } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Slider } from "@/components/ui/slider"
import { authService, type User, type Ritual } from "@/lib/auth"
import {
  PlaybackMeter,
  PlaybackLockedError,
  StreamDeniedError,
  type Enforcement,
} from "@/lib/playback-metering"
import {
  applySecureScreen,
  assignStreamSource,
  clearStreamSource,
  getScreenProtectionCapabilities,
  hardenMediaElement,
  protectSurface,
  watchCaptureSignal,
  watchSurfaceVisibility,
} from "@/lib/screen-protection"
import { derivePseudonym, shortSessionLabel } from "@/lib/watermark"
import { DynamicWatermark } from "@/components/player/dynamic-watermark"
import {
  PlaybackLockedCard,
  PlaybackMovedNotice,
  PlaybackRestrictedCard,
} from "@/components/player/playback-notice"
import { EntitlementDeniedError, openUpgradeModal } from "@/lib/entitlements"
import { useEntitlements } from "@/lib/entitlements-context"
import { planDisplayName } from "@/lib/plans"
import { QuotaMeter } from "@/components/payments/quota-meter"
import { Loader2, Play, Pause, Heart, ArrowLeft, Volume2, MessageSquare, Send, CheckCircle, Flag, Lock, Sparkles } from "lucide-react"
import { ReportModal } from "@/components/report-modal"
import { GaiaInfoTip } from "@/components/gaia/info-tip"

// Audio is acquired through the Session 12 session-bound stream token, not by
// downloading a blob: the URL is short-lived, tied to one live playback session,
// and assigned straight to the element in JS so it never appears in the markup.
// Reconnects re-acquire; a re-acquire may return a different URL, so the
// position is restored by hand.
const MAX_RECONNECT_ATTEMPTS = 2

export default function RitualPlayer() {
  const [user, setUser] = useState<User | null>(null)
  const [ritual, setRitual] = useState<Ritual | null>(null)
  const [loading, setLoading] = useState(true)
  const [audioLoading, setAudioLoading] = useState(false)
  const [audioError, setAudioError] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState([1])
  const [isBlessed, setIsBlessed] = useState(false)
  const [blessError, setBlessError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState("")
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false)
  const [submittingFeedback, setSubmittingFeedback] = useState(false)

  // Session 12 protection state
  const [sessionId, setSessionId] = useState<number | null>(null)
  const [pseudonym, setPseudonym] = useState("————————")
  const [moved, setMoved] = useState<{ detail: string | null } | null>(null)
  const [locked, setLocked] = useState<{ detail: string; flagId: number | null } | null>(null)
  const [restricted, setRestricted] = useState<{ detail: string | null } | null>(null)
  const [reclaiming, setReclaiming] = useState(false)
  const [obscured, setObscured] = useState(false)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const surfaceRef = useRef<HTMLDivElement | null>(null)
  const hasSourceRef = useRef(false)
  const reconnectsRef = useRef(0)
  // Set while the surface-obscured handler paused audio, so returning to the
  // tab resumes exactly what it interrupted — and nothing else.
  const autoPausedRef = useRef(false)

  // Reports listening time for creator royalties and owns the playback session
  // that stream tokens are bound to. Metering failures never interrupt audio;
  // stream denials do, and arrive through these callbacks.
  const meterRef = useRef<PlaybackMeter | null>(null)
  if (!meterRef.current) {
    meterRef.current = new PlaybackMeter(() => audioRef.current?.currentTime ?? 0, {
      onSessionChange: (id) => setSessionId(id),
      onWarning: (enforcement: Enforcement) => {
        // Once per session, quiet, and explicitly not a change to their access.
        toast("Unusual playback activity was detected on your account.", {
          description:
            "Nothing about your membership or access has changed. If this looks unfamiliar to you, the Reflection Room is open.",
          duration: 9000,
        })
        void enforcement
      },
      onLocked: (error) => {
        setLocked({ detail: error.detail, flagId: error.flagId })
        setMoved(null)
      },
      onSuperseded: (detail) => {
        setMoved({ detail })
      },
      onRestricted: (detail) => {
        setRestricted({ detail })
      },
    })
  }
  const meter = meterRef.current
  const router = useRouter()
  const params = useParams()
  const ritualId = Number.parseInt(params.id as string)
  const { plan } = useEntitlements()

  const stopAudio = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.pause()
    setIsPlaying(false)
  }, [])

  // Any state that means "this surface must not be sounding" — locked,
  // restricted, or moved to another device — stops audio immediately.
  useEffect(() => {
    if (locked || restricted || moved) {
      stopAudio()
      if (locked || restricted) {
        clearStreamSource(audioRef.current)
        hasSourceRef.current = false
      }
    }
  }, [locked, restricted, moved, stopAudio])

  const describeDenial = (err: StreamDeniedError): string => {
    switch (err.reason) {
      case "session_superseded":
      case "playback_restricted":
      case "session_flagged":
        // Rendered as a card by the callbacks; no duplicate inline error
        return ""
      default:
        return err.detail || "Audio is unavailable right now. Please try again."
    }
  }

  // Acquires a grant and hands the URL to the element. Never returns the URL to
  // React state — it must not end up in a prop, an attribute, or the DOM.
  const loadStreamIntoElement = useCallback(
    async (eventType?: "RECONNECT"): Promise<boolean> => {
      const audio = audioRef.current
      if (!audio) return false
      setAudioLoading(true)
      setAudioError(null)
      try {
        const url = await meter.acquireStreamUrl(eventType)
        assignStreamSource(audio, url)
        hardenMediaElement(audio)
        hasSourceRef.current = true
        return true
      } catch (err) {
        hasSourceRef.current = false
        if (err instanceof PlaybackLockedError) return false
        if (err instanceof StreamDeniedError) {
          const message = describeDenial(err)
          if (message) setAudioError(message)
          return false
        }
        if (err instanceof EntitlementDeniedError) {
          setAudioError(`This ritual is part of the ${planDisplayName(err.denial.required_plan)} tier.`)
          return false
        }
        setAudioError("Failed to load audio")
        return false
      } finally {
        setAudioLoading(false)
      }
    },
    [meter],
  )

  useEffect(() => {
    const loadData = async () => {
      try {
        if (!authService.isAuthenticated()) {
          router.push("/auth/login")
          return
        }

        const userData = await authService.getProfile()
        if (userData.role !== "member") {
          router.push("/dashboard")
          return
        }

        setUser(userData)
        // Watermark identity: an opaque 8-char pseudonym, never the email or
        // the raw user id — the mark is visible to anyone looking at the screen.
        setPseudonym(await derivePseudonym(userData.id))

        const rituals = await authService.getPublicRituals()
        const currentRitual = rituals.find((r) => r.id === ritualId && r.status === "approved")

        if (!currentRitual) {
          router.push("/member")
          return
        }

        setRitual(currentRitual)
        // Audio is acquired lazily on Play, after the session is registered, so
        // any entitlement or enforcement denial arrives before the player opens
      } catch (err) {
        console.error("Failed to load data:", err)
        router.push("/auth/login")
      } finally {
        setLoading(false)
      }
    }

    loadData()

    return () => {
      clearStreamSource(audioRef.current)
      // Navigating to another ritual/page ends the playback session
      meter.end()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, ritualId])

  // Credit listening up to the moment the tab is hidden (the user may come
  // back — don't end); end the session when the page actually goes away,
  // since a normal request wouldn't survive unload.
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        meter.onHidden()
      }
    }
    const handlePageHide = () => {
      meter.end()
    }
    document.addEventListener("visibilitychange", handleVisibilityChange)
    window.addEventListener("pagehide", handlePageHide)
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      window.removeEventListener("pagehide", handlePageHide)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Session 12: screen protection on the player surface ─────────────────────

  useEffect(() => {
    // No-op on the web by design; a native wrapper implements the bridge and
    // this becomes FLAG_SECURE / an iOS secure view without touching this file.
    const releaseSecureScreen = applySecureScreen()
    const releaseSurface = protectSurface(surfaceRef.current)
    hardenMediaElement(audioRef.current)
    return () => {
      releaseSurface()
      releaseSecureScreen()
    }
  }, [loading, ritual])

  // Hide the artwork and pause when the surface is not in front of the user.
  // A deterrent against "start recording, walk away" — not a capture defence.
  //
  // These pauses deliberately do NOT emit PAUSE/RESUME transport events or
  // rotate the token. They are ours, not the listener's, and feeding them to
  // the detector would let ordinary alt-tabbing trip `rapid_transport` and
  // warn someone who did nothing.
  useEffect(() => {
    return watchSurfaceVisibility(
      () => {
        setObscured(true)
        const audio = audioRef.current
        if (audio && !audio.paused) {
          autoPausedRef.current = true
          audio.pause()
          setIsPlaying(false)
        }
      },
      () => {
        setObscured(false)
        if (!autoPausedRef.current) return
        autoPausedRef.current = false
        const audio = audioRef.current
        if (!audio || !hasSourceRef.current) return
        audio.play().then(
          () => setIsPlaying(true),
          () => {
            // Autoplay policy refused the resume; the play button still works
          },
        )
      },
    )
  }, [])

  // Capture signal, where the platform actually has one. On the web today it
  // subscribes to nothing and reports nothing — see docs/CONTENT-PROTECTION.md.
  // The backend weights this at zero: context for a reviewing human, never
  // grounds for enforcement on its own.
  useEffect(() => {
    const capabilities = getScreenProtectionCapabilities()
    if (!capabilities.canDetectRecording) return
    return watchCaptureSignal(() => {
      void meter.reportEvent("CAPTURE_SUSPECTED", { platform: capabilities.platform })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Transport ───────────────────────────────────────────────────────────────

  const startAudio = async (resuming: boolean) => {
    const audio = audioRef.current
    if (!audio) return
    try {
      await audio.play()
      setIsPlaying(true)
      meter.onPlaying()
      if (resuming) {
        meter.rotateFor("RESUME")
        void meter.reportEvent("RESUME")
      }
    } catch (err) {
      console.error("Failed to play audio:", err)
      setAudioError("Failed to play audio. Please try again.")
    }
  }

  const handlePlay = async () => {
    if (!ritual || locked || restricted || moved) return

    if (isPlaying) {
      audioRef.current?.pause()
      setIsPlaying(false)
      meter.onPause()
      // A transport event: the previous token dies and the detector sees the
      // shape of the request.
      meter.rotateFor("PAUSE")
      void meter.reportEvent("PAUSE")
      return
    }

    // Register the playback session BEFORE acquiring audio so quota/care-level
    // denials arrive before the player opens. Resuming a pause keeps the same
    // session; only a listen that ended needs a fresh start.
    const resuming = meter.listening && hasSourceRef.current
    if (!meter.listening) {
      try {
        await meter.start(ritual.id)
      } catch (err) {
        if (err instanceof EntitlementDeniedError) {
          // Upgrade modal is already open
          return
        }
        if (err instanceof StreamDeniedError) {
          // A restriction refused the session outright; the card is rendered
          return
        }
        // Any other metering failure is swallowed — we still try for a grant
      }
    }

    if (!hasSourceRef.current) {
      reconnectsRef.current = 0
      if (!(await loadStreamIntoElement())) return
    }

    await startAudio(resuming)
  }

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime)
    }
  }

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration)
    }
  }

  const handleEnded = () => {
    setIsPlaying(false)
    hasSourceRef.current = false
    clearStreamSource(audioRef.current)
    // Close the playback session with the final position; replaying after
    // this starts a brand-new session
    meter.end()
  }

  const handleSeek = (value: number[]) => {
    if (audioRef.current) {
      audioRef.current.currentTime = value[0]
      setCurrentTime(value[0])
    }
  }

  // Fires once when the user lets go of the handle, not on every pixel of a
  // drag — one SEEK per seek, which is what the detector expects to see.
  const handleSeekCommit = () => {
    if (!meter.listening) return
    meter.rotateFor("SEEK")
    void meter.reportEvent("SEEK")
  }

  // A dead media element usually means the grant behind it expired or the
  // network dropped. Re-acquire, restore the position, and carry on.
  const handleMediaError = async () => {
    const audio = audioRef.current
    if (!audio || locked || restricted || moved) return
    if (!meter.listening) return
    if (reconnectsRef.current >= MAX_RECONNECT_ATTEMPTS) {
      setAudioError("Audio is unavailable right now. Please try again.")
      return
    }
    reconnectsRef.current += 1

    const resumeAt = audio.currentTime
    const wasPlaying = isPlaying
    void meter.reportEvent("ERROR", { player_state: audio.networkState })
    if (!(await loadStreamIntoElement("RECONNECT"))) return
    void meter.reportEvent("RECONNECT")

    const restore = () => {
      audio.removeEventListener("loadedmetadata", restore)
      if (Number.isFinite(resumeAt) && resumeAt > 0) audio.currentTime = resumeAt
      if (wasPlaying) void startAudio(false)
    }
    audio.addEventListener("loadedmetadata", restore)
  }

  // "Play here instead" — the user's one session is currently on another
  // device. Opening a fresh session moves it back, calmly and on request.
  const handleReclaim = async () => {
    if (!ritual || reclaiming) return
    setReclaiming(true)
    setAudioError(null)
    try {
      const url = await meter.reclaimPlayback()
      const audio = audioRef.current
      if (audio) {
        assignStreamSource(audio, url)
        hardenMediaElement(audio)
        hasSourceRef.current = true
      }
      setMoved(null)
      await startAudio(false)
    } catch (err) {
      if (err instanceof StreamDeniedError) {
        const message = describeDenial(err)
        if (message) setAudioError(message)
      } else if (!(err instanceof PlaybackLockedError)) {
        setAudioError("Couldn't move playback back here. Please try again.")
      }
    } finally {
      setReclaiming(false)
    }
  }

  const handleVolumeChange = (value: number[]) => {
    setVolume(value)
    if (audioRef.current) {
      audioRef.current.volume = value[0]
    }
  }

  const handleBless = async () => {
    if (!ritual || isBlessed) return

    setBlessError(null)
    try {
      await authService.blessRitual(ritual.id)
      setIsBlessed(true)
    } catch (err) {
      console.error("Failed to bless ritual:", err)
      if (err instanceof Error && err.message.includes("already blessed")) {
        setBlessError("You have already blessed this ritual")
        setIsBlessed(true)
      } else {
        setBlessError("Failed to bless ritual. Please try again.")
      }
    }
  }

  const handleSubmitFeedback = async () => {
    if (!ritual || !feedback.trim()) return

    setSubmittingFeedback(true)
    try {
      await authService.submitFeedback({
        ritual: ritual.id,
        feedback_text: feedback.trim(),
        is_anonymous: isAnonymous,
      })
      setFeedbackSubmitted(true)
      setFeedback("")
    } catch (err) {
      console.error("Failed to submit feedback:", err)
    } finally {
      setSubmittingFeedback(false)
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const getCareLevel = (level: string) => {
    switch (level) {
      case "level1":
        return "Gentle"
      case "level2":
        return "Moderate"
      case "level3":
        return "Intensive"
      default:
        return level
    }
  }

  const getCareLevelColor = (level: string) => {
    switch (level) {
      case "level1":
        return "bg-green-100 text-green-800 border-green-200 dark:bg-green-900 dark:text-green-200"
      case "level2":
        return "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900 dark:text-yellow-200"
      case "level3":
        return "bg-red-100 text-red-800 border-red-200 dark:bg-red-900 dark:text-red-200"
      default:
        return "bg-muted text-muted-foreground border-border"
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!ritual) {
    return null
  }

  // Locked rituals show an upsell instead of the player
  if (ritual.locked) {
    const requiredPlan = ritual.required_plan ?? "evocore"
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8 lg:py-12 max-w-2xl">
          <Button variant="outline" onClick={() => router.back()} className="mb-8 bg-transparent border-border text-foreground hover:bg-secondary">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Library
          </Button>
          <Card className="bg-card border-border text-center">
            <CardHeader className="pb-4">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                <Lock className="h-6 w-6 text-primary" />
              </div>
              <CardTitle className="text-2xl text-foreground">{ritual.title}</CardTitle>
              <CardDescription>
                This ritual is part of the {planDisplayName(requiredPlan)} tier.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() =>
                  openUpgradeModal({
                    reason: "care_level",
                    current_plan: plan,
                    required_plan: requiredPlan,
                  })
                }
                className="bg-primary text-primary-foreground hover:bg-gold-muted"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Unlock with {planDisplayName(requiredPlan)}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const transportDisabled = Boolean(locked || restricted || moved)

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 lg:py-12 max-w-4xl">
        <div className="flex items-center justify-between mb-8">
          <Button variant="outline" onClick={() => router.back()} className="bg-transparent border-border text-foreground hover:bg-secondary">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Library
          </Button>
          <ReportModal
            contentType="ritual"
            contentId={ritualId}
            contentTitle={ritual.title}
            trigger={
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive">
                <Flag className="w-4 h-4 mr-2" />
                Report
              </Button>
            }
          />
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Main Player */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="bg-card border-border">
              <CardHeader className="text-center pb-6">
                <div className="flex justify-center items-center gap-2 mb-4">
                  <Badge variant="outline" className={getCareLevelColor(ritual.care_level)}>
                    {getCareLevel(ritual.care_level)} Practice
                  </Badge>
                  <GaiaInfoTip infoKey="ritual.care_level" ariaLabel="About care level" />
                </div>
                <CardTitle className="text-3xl mb-2 text-foreground">{ritual.title}</CardTitle>
                <CardDescription className="text-base">
                  by {ritual.creator.first_name} {ritual.creator.last_name}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/*
                  The protected surface. The watermark overlays everything inside
                  it, so a recording of the player carries the mark wherever the
                  frame is cropped.
                */}
                <div ref={surfaceRef} className="relative">
                  <DynamicWatermark
                    identity={{ pseudonym, sessionLabel: shortSessionLabel(sessionId) }}
                    active={!transportDisabled}
                  />

                  {/* Audio Player - Dark circle design */}
                  <div className="flex justify-center">
                    <div
                      className={`w-48 h-48 rounded-full bg-secondary border-2 border-border flex items-center justify-center transition-[filter,opacity] duration-200 ${
                        obscured ? "blur-md opacity-40" : ""
                      }`}
                    >
                      <div className="w-40 h-40 rounded-full bg-muted border border-border/50" />
                    </div>
                  </div>
                  <div className="rounded-lg p-4 text-center">
                    {/*
                      Always mounted and never given a `src` prop: the presigned
                      URL is assigned through the element property so it stays in
                      JS memory and out of the rendered markup.
                    */}
                    <audio
                      ref={audioRef}
                      onTimeUpdate={handleTimeUpdate}
                      onLoadedMetadata={handleLoadedMetadata}
                      onEnded={handleEnded}
                      onError={handleMediaError}
                      preload="none"
                      controlsList="nodownload"
                      disablePictureInPicture
                    />

                    {locked && <PlaybackLockedCard detail={locked.detail} flagId={locked.flagId} />}

                    {!locked && restricted && <PlaybackRestrictedCard detail={restricted.detail} />}

                    {!locked && !restricted && moved && (
                      <PlaybackMovedNotice
                        detail={moved.detail}
                        onPlayHere={handleReclaim}
                        busy={reclaiming}
                      />
                    )}

                    {!transportDisabled && audioLoading && (
                      <div className="py-8">
                        <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
                        <p className="text-muted-foreground">Loading sacred audio...</p>
                      </div>
                    )}

                    {!transportDisabled && audioError && !audioLoading && (
                      <div className="py-8">
                        <p className="text-destructive mb-4">Error: {audioError}</p>
                        <Button onClick={handlePlay} variant="outline">
                          Try Again
                        </Button>
                      </div>
                    )}

                    {!transportDisabled && !audioLoading && !audioError && (
                      <>
                        <Button onClick={handlePlay} size="lg" className="w-20 h-20 rounded-full mb-6 bg-primary text-primary-foreground hover:bg-gold-muted">
                          {isPlaying ? <Pause className="w-8 h-8" /> : <Play className="w-8 h-8 ml-1" />}
                        </Button>

                        {/* Progress Bar */}
                        <div className="space-y-2">
                          <Slider
                            value={[currentTime]}
                            max={duration || 100}
                            step={1}
                            onValueChange={handleSeek}
                            onValueCommit={handleSeekCommit}
                            className="w-full"
                          />
                          <div className="flex justify-between text-sm text-muted-foreground">
                            <span>{formatTime(currentTime)}</span>
                            <span>{formatTime(duration)}</span>
                          </div>
                        </div>

                        {/* Volume Control */}
                        <div className="flex items-center gap-3 mt-4 max-w-xs mx-auto">
                          <Volume2 className="w-4 h-4 text-muted-foreground" />
                          <Slider
                            value={volume}
                            max={1}
                            step={0.1}
                            onValueChange={handleVolumeChange}
                            className="flex-1"
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-4 items-center">
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={handleBless}
                      variant={isBlessed ? "default" : "outline"}
                      disabled={isBlessed}
                      className="flex items-center gap-2"
                    >
                      <Heart className={`w-4 h-4 ${isBlessed ? "fill-current" : ""}`} />
                      {isBlessed ? "Blessed" : "Bless This Ritual"}
                    </Button>
                    <GaiaInfoTip infoKey="ritual.bless" ariaLabel="About blessing a creator" />
                  </div>
                  {blessError && <p className="text-sm text-muted-foreground text-center">{blessError}</p>}
                </div>
              </CardContent>
            </Card>

            {/* Feedback Section */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-foreground">
                  <MessageSquare className="w-5 h-5 text-primary" />
                  Share Your Reflection
                  <GaiaInfoTip infoKey="ritual.feedback" ariaLabel="About leaving feedback" />
                </CardTitle>
                <CardDescription>Your thoughts help creators understand the impact of their work</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {feedbackSubmitted ? (
                  <div className="text-center py-6">
                    <CheckCircle className="w-12 h-12 text-primary mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Thank you for your reflection</h3>
                    <p className="text-muted-foreground">Your feedback has been shared with the creator</p>
                  </div>
                ) : (
                  <>
                    <Textarea
                      placeholder="Share how this ritual affected you, what insights you gained, or how it made you feel..."
                      value={feedback}
                      onChange={(e) => setFeedback(e.target.value)}
                      rows={4}
                    />
                    <div className="flex items-center space-x-2">
                      <Checkbox id="anonymous" checked={isAnonymous} onCheckedChange={setIsAnonymous} />
                      <label htmlFor="anonymous" className="text-sm inline-flex items-center gap-1.5">
                        Submit anonymously
                        <GaiaInfoTip infoKey="ritual.feedback_anonymous" ariaLabel="About anonymous feedback" />
                      </label>
                    </div>
                    <Button
                      onClick={handleSubmitFeedback}
                      disabled={!feedback.trim() || submittingFeedback}
                      className="w-full"
                    >
                      {submittingFeedback ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4 mr-2" />
                          Share Reflection
                        </>
                      )}
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <QuotaMeter />
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-foreground">About This Ritual</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm leading-relaxed">{ritual.description}</p>

                {ritual.tags.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Practice Types</h4>
                    <div className="flex flex-wrap gap-2">
                      {ritual.tags.map((tag) => (
                        <Badge key={typeof tag === "string" ? tag : tag.id} variant="secondary" className="text-xs">
                          {typeof tag === "string" ? tag : tag.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {ritual.cultural_declaration && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Cultural Context</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed">{ritual.cultural_declaration}</p>
                  </div>
                )}

                <div className="text-xs text-muted-foreground pt-2 border-t">
                  Shared on {new Date(ritual.created_at).toLocaleDateString()}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}

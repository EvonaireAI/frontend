"use client"

import { useEffect, useState, useRef } from "react"
import { useRouter, useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Slider } from "@/components/ui/slider"
import { authService, type User, type Ritual } from "@/lib/auth"
import { PlaybackMeter } from "@/lib/playback-metering"
import { EntitlementDeniedError, throwIfEntitlementDenied, openUpgradeModal } from "@/lib/entitlements"
import { useEntitlements } from "@/lib/entitlements-context"
import { planDisplayName } from "@/lib/plans"
import { QuotaMeter } from "@/components/payments/quota-meter"
import { Loader2, Play, Pause, Heart, ArrowLeft, Volume2, MessageSquare, Send, CheckCircle, Flag, Lock, Sparkles } from "lucide-react"
import { ReportModal } from "@/components/report-modal"
import { GaiaInfoTip } from "@/components/gaia/info-tip"

export default function RitualPlayer() {
  const [user, setUser] = useState<User | null>(null)
  const [ritual, setRitual] = useState<Ritual | null>(null)
  const [loading, setLoading] = useState(true)
  const [audioSrc, setAudioSrc] = useState<string | null>(null)
  const [audioLoading, setAudioLoading] = useState(false)
  const [audioError, setAudioError] = useState<string | null>(null)
  const [pendingPlay, setPendingPlay] = useState(false)
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

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const audioSrcRef = useRef<string | null>(null)
  // Reports listening time for creator royalties; telemetry only — meter
  // failures never block or interrupt playback
  const meterRef = useRef<PlaybackMeter | null>(null)
  if (!meterRef.current) {
    meterRef.current = new PlaybackMeter(() => audioRef.current?.currentTime ?? 0)
  }
  const meter = meterRef.current
  const router = useRouter()
  const params = useParams()
  const ritualId = Number.parseInt(params.id as string)
  const { plan } = useEntitlements()

  const fetchAuthenticatedAudio = async (ritualId: number): Promise<string | null> => {
    if (audioSrcRef.current) return audioSrcRef.current

    setAudioLoading(true)
    setAudioError(null)

    try {
      const token = authService.getToken()
      if (!token) {
        throw new Error("User is not authenticated.")
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/rituals/${ritualId}/stream/`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        // Structured care_level 403 opens the upgrade modal
        await throwIfEntitlementDenied(response)
        throw new Error(`Failed to fetch audio: ${response.status} ${response.statusText}`)
      }

      const audioBlob = await response.blob()
      const objectUrl = URL.createObjectURL(audioBlob)
      audioSrcRef.current = objectUrl
      setAudioSrc(objectUrl)
      return objectUrl
    } catch (err) {
      console.error("Error fetching ritual audio:", err)
      if (err instanceof EntitlementDeniedError) {
        setAudioError(`This ritual is part of the ${planDisplayName(err.denial.required_plan)} tier.`)
      } else {
        setAudioError(err instanceof Error ? err.message : "Failed to load audio")
      }
      return null
    } finally {
      setAudioLoading(false)
    }
  }

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

        const rituals = await authService.getPublicRituals()
        const currentRitual = rituals.find((r) => r.id === ritualId && r.status === "approved")

        if (!currentRitual) {
          router.push("/member")
          return
        }

        setRitual(currentRitual)
        // Audio is fetched lazily on Play, after the play is registered, so
        // any entitlement denial arrives before the player opens
      } catch (err) {
        console.error("Failed to load data:", err)
        router.push("/auth/login")
      } finally {
        setLoading(false)
      }
    }

    loadData()

    return () => {
      if (audioSrcRef.current) {
        URL.revokeObjectURL(audioSrcRef.current)
      }
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

  const startAudio = async () => {
    if (!audioRef.current) return
    try {
      await audioRef.current.play()
      setIsPlaying(true)
      meter.onPlaying()
    } catch (err) {
      console.error("Failed to play audio:", err)
      setAudioError("Failed to play audio. Please try again.")
    }
  }

  // Plays as soon as the <audio> element mounts with the freshly fetched source
  useEffect(() => {
    if (pendingPlay && audioSrc && audioRef.current) {
      setPendingPlay(false)
      startAudio()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingPlay, audioSrc])

  const handlePlay = async () => {
    if (!ritual) return

    if (isPlaying) {
      audioRef.current?.pause()
      setIsPlaying(false)
      meter.onPause()
      return
    }

    // Register the playback session BEFORE starting audio so quota/care-level
    // denials arrive before the player opens. Resuming a pause keeps the same
    // session; only a listen that ended needs a fresh start.
    if (!meter.listening) {
      try {
        await meter.start(ritual.id)
      } catch (err) {
        if (err instanceof EntitlementDeniedError) {
          // Upgrade modal is already open
          return
        }
        // Any other metering failure is swallowed — audio plays regardless
      }
    }

    if (!audioSrc) {
      const url = await fetchAuthenticatedAudio(ritual.id)
      if (!url) return
      setPendingPlay(true)
      return
    }

    await startAudio()
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
                {/* Audio Player - Dark circle design */}
                <div className="flex justify-center">
                  <div className="w-48 h-48 rounded-full bg-secondary border-2 border-border flex items-center justify-center">
                    <div className="w-40 h-40 rounded-full bg-muted border border-border/50" />
                  </div>
                </div>
                <div className="rounded-lg p-4 text-center">
                  {audioLoading && (
                    <div className="py-8">
                      <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
                      <p className="text-muted-foreground">Loading sacred audio...</p>
                    </div>
                  )}

                  {audioError && !audioLoading && (
                    <div className="py-8">
                      <p className="text-destructive mb-4">Error: {audioError}</p>
                      <Button onClick={handlePlay} variant="outline">
                        Try Again
                      </Button>
                    </div>
                  )}

                  {!audioLoading && !audioError && (
                    <>
                      {audioSrc && (
                        <audio
                          ref={audioRef}
                          src={audioSrc}
                          onTimeUpdate={handleTimeUpdate}
                          onLoadedMetadata={handleLoadedMetadata}
                          onEnded={handleEnded}
                          preload="metadata"
                        />
                      )}

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

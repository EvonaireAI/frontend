"use client"

import { useEffect, useState, useRef } from "react"
import { useRouter, useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Slider } from "@/components/ui/slider"
import { authService, type User, type Ritual, type PlaySession } from "@/lib/auth"
import { Loader2, Play, Pause, Heart, ArrowLeft, Volume2, MessageSquare, Send, CheckCircle } from "lucide-react"

export default function RitualPlayer() {
  const [user, setUser] = useState<User | null>(null)
  const [ritual, setRitual] = useState<Ritual | null>(null)
  const [loading, setLoading] = useState(true)
  const [audioSrc, setAudioSrc] = useState<string | null>(null)
  const [audioLoading, setAudioLoading] = useState(false)
  const [audioError, setAudioError] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState([1])
  const [playSession, setPlaySession] = useState<PlaySession | null>(null)
  const [isBlessed, setIsBlessed] = useState(false)
  const [blessError, setBlessError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState("")
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false)
  const [submittingFeedback, setSubmittingFeedback] = useState(false)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const router = useRouter()
  const params = useParams()
  const ritualId = Number.parseInt(params.id as string)

  const fetchAuthenticatedAudio = async (ritualId: number) => {
    if (audioSrc) return // Don't re-fetch if we already have the source

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
        throw new Error(`Failed to fetch audio: ${response.status} ${response.statusText}`)
      }

      const audioBlob = await response.blob()
      const objectUrl = URL.createObjectURL(audioBlob)
      setAudioSrc(objectUrl)
    } catch (err) {
      console.error("Error fetching ritual audio:", err)
      setAudioError(err instanceof Error ? err.message : "Failed to load audio")
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
        await fetchAuthenticatedAudio(ritualId)
      } catch (err) {
        console.error("Failed to load data:", err)
        router.push("/auth/login")
      } finally {
        setLoading(false)
      }
    }

    loadData()

    return () => {
      if (audioSrc) {
        URL.revokeObjectURL(audioSrc)
      }
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current)
      }
    }
  }, [router, ritualId, audioSrc])

  const handlePlay = async () => {
    if (!ritual || !audioRef.current || !audioSrc) return

    try {
      if (!isPlaying) {
        // Start play session if not already started
        if (!playSession) {
          const session = await authService.startPlaySession(ritual.id)
          setPlaySession(session)
        }

        await audioRef.current.play()
        setIsPlaying(true)

        progressIntervalRef.current = setInterval(async () => {
          if (audioRef.current) {
            const currentPos = audioRef.current.currentTime
            setCurrentTime(currentPos)

            // Track progress every 30 seconds
            if (Math.floor(currentPos) > 0 && Math.floor(currentPos) % 30 === 0) {
              try {
                const currentSession = playSession || (await authService.startPlaySession(ritual.id))
                await authService.updatePlayProgress(currentSession.id, currentPos)
              } catch (err) {
                console.error("Failed to update progress:", err)
              }
            }
          }
        }, 1000)
      } else {
        audioRef.current.pause()
        setIsPlaying(false)
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current)
        }
      }
    } catch (err) {
      console.error("Failed to play audio:", err)
      setAudioError("Failed to play audio. Please try again.")
    }
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

  const handleEnded = async () => {
    setIsPlaying(false)
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current)
    }

    // Mark session as complete
    if (playSession) {
      try {
        await authService.completePlaySession(playSession.id)
      } catch (err) {
        console.error("Failed to complete session:", err)
      }
    }
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

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 lg:py-12 max-w-4xl">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="outline" onClick={() => router.back()} className="bg-transparent border-border text-foreground hover:bg-secondary">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Library
          </Button>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Main Player */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="bg-card border-border">
              <CardHeader className="text-center pb-6">
                <div className="flex justify-center mb-4">
                  <Badge variant="outline" className={getCareLevelColor(ritual.care_level)}>
                    {getCareLevel(ritual.care_level)} Practice
                  </Badge>
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

                  {audioError && (
                    <div className="py-8">
                      <p className="text-destructive mb-4">Error: {audioError}</p>
                      <Button onClick={() => fetchAuthenticatedAudio(ritualId)} variant="outline">
                        Try Again
                      </Button>
                    </div>
                  )}

                  {audioSrc && !audioLoading && !audioError && (
                    <>
                      <audio
                        ref={audioRef}
                        src={audioSrc}
                        onTimeUpdate={handleTimeUpdate}
                        onLoadedMetadata={handleLoadedMetadata}
                        onEnded={handleEnded}
                        preload="metadata"
                      />

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
                  <Button
                    onClick={handleBless}
                    variant={isBlessed ? "default" : "outline"}
                    disabled={isBlessed}
                    className="flex items-center gap-2"
                  >
                    <Heart className={`w-4 h-4 ${isBlessed ? "fill-current" : ""}`} />
                    {isBlessed ? "Blessed" : "Bless This Ritual"}
                  </Button>
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
                      <label htmlFor="anonymous" className="text-sm">
                        Submit anonymously
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

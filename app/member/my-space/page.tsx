"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { authService } from "@/lib/auth"
import { useAuth } from "@/lib/auth-context"
import {
  Loader2,
  Heart,
  Play,
  Users,
  Clock,
  CheckCircle2,
  Calendar,
  Music,
  ArrowRight,
} from "lucide-react"

interface PlayHistoryItem {
  id: number
  ritual: number
  ritual_title: string
  ritual_care_level: string
  started_at: string
  completed_at: string | null
  progress_seconds: number
  is_completed: boolean
}

interface BlessingItem {
  id: number
  ritual: number
  ritual_title: string
  ritual_care_level: string
  created_at: string
}

interface JoinedSanctuary {
  id: number
  sanctuary_id: number
  title: string
  description: string
  privacy: string
  sanctuary_status: string
  active_members_count: number
  status: string
  member_since: string
  requested_at: string
}

export default function MySpacePage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState("sanctuaries")
  const [loading, setLoading] = useState(true)
  const [playHistory, setPlayHistory] = useState<PlayHistoryItem[]>([])
  const [blessings, setBlessings] = useState<BlessingItem[]>([])
  const [sanctuaries, setSanctuaries] = useState<JoinedSanctuary[]>([])

  useEffect(() => {
    if (authLoading) return

    if (!user) {
      router.push("/auth/login")
      return
    }

    const loadData = async () => {
      try {
        const [playsData, blessingsData, sanctuariesData] = await Promise.all([
          authService.getMyPlayHistory(),
          authService.getMyBlessings(),
          authService.getJoinedSanctuaries(),
        ])
        setPlayHistory(playsData)
        setBlessings(blessingsData)
        setSanctuaries(sanctuariesData)
      } catch (err) {
        console.error("Failed to load data:", err)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [user, authLoading, router])

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
        return "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300"
      case "level2":
        return "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300"
      case "level3":
        return "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300"
      default:
        return "bg-muted text-muted-foreground border-border"
    }
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!user) {
    return null
  }

  const completedRituals = playHistory.filter((p) => p.is_completed).length
  const totalListenTime = playHistory.reduce((acc, p) => acc + p.progress_seconds, 0)

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 lg:py-12">
        {/* Header */}
        <div className="mb-8">
          <p className="text-sm uppercase tracking-widest text-gold-muted mb-2">My Space</p>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
            Welcome back, {user.first_name}
          </h1>
          <p className="text-muted-foreground">
            Your personal dashboard for tracking your spiritual journey
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-4 mb-8">
          <Card className="bg-card border-border">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-gold/10">
                  <Users className="w-6 h-6 text-gold" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{sanctuaries.length}</p>
                  <p className="text-sm text-muted-foreground">Sanctuaries Joined</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-primary/10">
                  <Heart className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{blessings.length}</p>
                  <p className="text-sm text-muted-foreground">Rituals Blessed</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-green-500/10">
                  <CheckCircle2 className="w-6 h-6 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{completedRituals}</p>
                  <p className="text-sm text-muted-foreground">Rituals Completed</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-blue-500/10">
                  <Clock className="w-6 h-6 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">
                    {Math.floor(totalListenTime / 60)}m
                  </p>
                  <p className="text-sm text-muted-foreground">Total Listen Time</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 max-w-lg bg-secondary border border-border">
            <TabsTrigger
              value="sanctuaries"
              className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">Sanctuaries</span>
            </TabsTrigger>
            <TabsTrigger
              value="blessings"
              className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <Heart className="w-4 h-4" />
              <span className="hidden sm:inline">Blessed</span>
            </TabsTrigger>
            <TabsTrigger
              value="history"
              className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <Play className="w-4 h-4" />
              <span className="hidden sm:inline">History</span>
            </TabsTrigger>
          </TabsList>

          {/* Joined Sanctuaries */}
          <TabsContent value="sanctuaries" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-foreground">
                My Sanctuaries ({sanctuaries.length})
              </h2>
              <Button asChild variant="outline" size="sm" className="bg-transparent border-border">
                <Link href="/member">
                  Discover More
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Link>
              </Button>
            </div>

            {sanctuaries.length === 0 ? (
              <Card className="bg-card border-border">
                <CardContent className="py-12 text-center">
                  <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">No sanctuaries yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Join a sanctuary to connect with like-minded practitioners
                  </p>
                  <Button asChild>
                    <Link href="/member">Browse Sanctuaries</Link>
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {sanctuaries.map((sanctuary) => (
                  <Card
                    key={sanctuary.id}
                    className="bg-card border-border hover:border-primary/40 transition-colors"
                  >
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start">
                        <Badge
                          variant="outline"
                          className="capitalize border-primary/30 text-primary"
                        >
                          {sanctuary.sanctuary_status}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {sanctuary.privacy === "invite_only" ? "Invite Only" : "Public"}
                        </Badge>
                      </div>
                      <CardTitle className="text-lg text-foreground">{sanctuary.title}</CardTitle>
                      <CardDescription className="line-clamp-2">
                        {sanctuary.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          {sanctuary.active_members_count} members
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          Joined {new Date(sanctuary.member_since).toLocaleDateString()}
                        </div>
                      </div>
                      <Button asChild className="w-full" size="sm">
                        <Link href={`/member/sanctuaries/${sanctuary.sanctuary_id}`}>
                          Enter Sanctuary
                        </Link>
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Blessed Rituals */}
          <TabsContent value="blessings" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-foreground">
                Blessed Rituals ({blessings.length})
              </h2>
              <Button asChild variant="outline" size="sm" className="bg-transparent border-border">
                <Link href="/member">
                  Discover More
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Link>
              </Button>
            </div>

            {blessings.length === 0 ? (
              <Card className="bg-card border-border">
                <CardContent className="py-12 text-center">
                  <Heart className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">No blessed rituals</h3>
                  <p className="text-muted-foreground mb-4">
                    Bless rituals that resonate with you to save them here
                  </p>
                  <Button asChild>
                    <Link href="/member">Explore Rituals</Link>
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {blessings.map((blessing) => (
                  <Card
                    key={blessing.id}
                    className="bg-card border-border hover:border-primary/40 transition-colors"
                  >
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start mb-2">
                        <Badge variant="outline" className={getCareLevelColor(blessing.ritual_care_level)}>
                          {getCareLevel(blessing.ritual_care_level)}
                        </Badge>
                        <Heart className="w-4 h-4 text-primary fill-current" />
                      </div>
                      <CardTitle className="text-lg text-foreground">{blessing.ritual_title}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Calendar className="w-4 h-4" />
                        Blessed {new Date(blessing.created_at).toLocaleDateString()}
                      </div>
                      <Button asChild className="w-full" size="sm">
                        <Link href={`/member/ritual/${blessing.ritual}`}>
                          <Play className="w-4 h-4 mr-2" />
                          Experience Again
                        </Link>
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Play History */}
          <TabsContent value="history" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-foreground">
                Play History ({playHistory.length})
              </h2>
            </div>

            {playHistory.length === 0 ? (
              <Card className="bg-card border-border">
                <CardContent className="py-12 text-center">
                  <Music className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">No play history</h3>
                  <p className="text-muted-foreground mb-4">
                    Your ritual experiences will appear here
                  </p>
                  <Button asChild>
                    <Link href="/member">Start Exploring</Link>
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {playHistory.map((play) => (
                  <Card key={play.id} className="bg-card border-border">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div
                            className={`p-2 rounded-full ${
                              play.is_completed ? "bg-green-500/10" : "bg-yellow-500/10"
                            }`}
                          >
                            {play.is_completed ? (
                              <CheckCircle2 className="w-5 h-5 text-green-500" />
                            ) : (
                              <Clock className="w-5 h-5 text-yellow-500" />
                            )}
                          </div>
                          <div>
                            <h4 className="font-medium text-foreground">{play.ritual_title}</h4>
                            <div className="flex items-center gap-3 text-sm text-muted-foreground">
                              <Badge
                                variant="outline"
                                className={`text-xs ${getCareLevelColor(play.ritual_care_level)}`}
                              >
                                {getCareLevel(play.ritual_care_level)}
                              </Badge>
                              <span>{formatDuration(play.progress_seconds)} listened</span>
                              <span>
                                {new Date(play.started_at).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        </div>
                        <Button asChild variant="outline" size="sm" className="bg-transparent border-border">
                          <Link href={`/member/ritual/${play.ritual}`}>
                            <Play className="w-4 h-4 mr-1" />
                            {play.is_completed ? "Replay" : "Continue"}
                          </Link>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

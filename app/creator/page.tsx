"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { authService, type User, type Ritual, type CreatorDashboardMetrics, type CreatorFeedbackItem } from "@/lib/auth"
import { rtsService, type RTSScore, type RTSHistoryEntry } from "@/lib/rts"
import { ScoreBadge } from "@/components/rts/score-badge"
import { ScoreHistory } from "@/components/rts/score-history"
import { SelfAssessmentForm } from "@/components/rts/self-assessment-form"
import { sanctuariesService, type Sanctuary } from "@/lib/sanctuaries"
import { SanctuaryCard } from "@/components/sanctuaries/sanctuary-card"
import {
  Loader2,
  Upload,
  Music,
  BarChart3,
  Plus,
  Edit,
  Trash2,
  Eye,
  Heart,
  Play,
  MessageSquare,
  Users,
  Activity,
} from "lucide-react"
import Link from "next/link"

export default function CreatorDashboard() {
  const [user, setUser] = useState<User | null>(null)
  const [rituals, setRituals] = useState<Ritual[]>([])
  const [loading, setLoading] = useState(true)
  const [ritualsLoading, setRitualsLoading] = useState(false)
  const [dashboardMetrics, setDashboardMetrics] = useState<CreatorDashboardMetrics | null>(null)
  const [creatorFeedback, setCreatorFeedback] = useState<CreatorFeedbackItem[]>([])
  const [analyticsLoading, setAnalyticsLoading] = useState(false)
  const [rtsScore, setRtsScore] = useState<RTSScore | null>(null)
  const [rtsHistory, setRtsHistory] = useState<RTSHistoryEntry[]>([])
  const [rtsLoading, setRtsLoading] = useState(false)
  const [activeTab, setActiveTab] = useState("rituals")
  const [sanctuaries, setSanctuaries] = useState<Sanctuary[]>([])
  const [sanctuariesLoading, setSanctuariesLoading] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const loadData = async () => {
      try {
        if (!authService.isAuthenticated()) {
          router.push("/auth/login")
          return
        }

        const userData = await authService.getProfile()
        if (userData.role !== "creator") {
          router.push("/dashboard")
          return
        }

        setUser(userData)
        await loadRituals()
      } catch (err) {
        console.error("Failed to load data:", err)
        router.push("/auth/login")
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [router])

  useEffect(() => {
    if (activeTab === "analytics" && !dashboardMetrics && !analyticsLoading) {
      loadAnalytics()
    }
    if (activeTab === "rts" && !rtsScore && !rtsLoading) {
      loadRTSData()
    }
  }, [activeTab, dashboardMetrics, analyticsLoading, rtsScore, rtsLoading])

  useEffect(() => {
    if (activeTab === "sanctuaries" && sanctuaries.length === 0 && !sanctuariesLoading) {
      loadSanctuaries()
    }
  }, [activeTab, sanctuaries.length, sanctuariesLoading])

  const loadRituals = async () => {
    setRitualsLoading(true)
    try {
      const ritualsData = await authService.getMyRituals()
      setRituals(ritualsData)
    } catch (err) {
      console.error("Failed to load rituals:", err)
    } finally {
      setRitualsLoading(false)
    }
  }

  const loadAnalytics = async () => {
    setAnalyticsLoading(true)
    try {
      const [metricsData, feedbackData] = await Promise.all([
        authService.getCreatorDashboardMetrics(),
        authService.getCreatorFeedback(),
      ])
      setDashboardMetrics(metricsData)
      setCreatorFeedback(feedbackData)
    } catch (err) {
      console.error("Failed to load analytics:", err)
    } finally {
      setAnalyticsLoading(false)
    }
  }

  const loadRTSData = async () => {
    setRtsLoading(true)
    try {
      const [scoreData, historyData] = await Promise.all([rtsService.getMyScore(), rtsService.getMyHistory()])
      setRtsScore(scoreData)
      setRtsHistory(historyData)
    } catch (err) {
      console.error("Failed to load RTS data:", err)
    } finally {
      setRtsLoading(false)
    }
  }

  const loadSanctuaries = async () => {
    setSanctuariesLoading(true)
    try {
      const data = await sanctuariesService.getOwnedSanctuaries()
      setSanctuaries(data)
    } catch (err) {
      console.error("Failed to load sanctuaries:", err)
    } finally {
      setSanctuariesLoading(false)
    }
  }

  const handleViewSanctuaryDetail = (id: number) => {
    router.push(`/creator/sanctuaries/${id}`)
  }

  const handleDeleteRitual = async (id: number) => {
    if (!confirm("Are you sure you want to archive this ritual?")) return

    try {
      await authService.deleteRitual(id)
      await loadRituals()
    } catch (err) {
      console.error("Failed to delete ritual:", err)
    }
  }

  const handleAssessmentSuccess = (newScore: number) => {
    loadRTSData()
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved":
        return "bg-primary/10 text-primary border-primary/20"
      case "pending_review":
        return "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900 dark:text-yellow-200"
      case "submitted":
        return "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900 dark:text-blue-200"
      default:
        return "bg-muted text-muted-foreground border-border"
    }
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

  const approvedRituals = rituals.filter((ritual) => ritual.status === "approved")
  const totalAnalytics = dashboardMetrics || { plays: 0, completions: 0, blessings: 0 }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 lg:py-12">
        {/* Hero header section */}
        <div className="text-center mb-10">
          <p className="text-sm uppercase tracking-widest text-gold-muted mb-3">Welcome To Your Sanctuary</p>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2 text-balance">
            {user ? `Hi, ${user.first_name}` : "Creator Studio"}
          </h1>
          <p className="text-muted-foreground max-w-md mx-auto">
            This is a protected space for your voice, rituals, and creative offerings.
          </p>
          <div className="flex gap-3 justify-center mt-6">
            <Button asChild variant="outline" className="border-border bg-transparent text-foreground hover:bg-secondary hover:text-secondary-foreground">
              <Link href="/dashboard">
                <Eye className="w-4 h-4 mr-2" />
                Dashboard
              </Link>
            </Button>
            <Button asChild className="bg-primary text-primary-foreground hover:bg-gold-muted">
              <Link href="/creator/upload">
                <Plus className="w-4 h-4 mr-2" />
                New Ritual
              </Link>
            </Button>
          </div>
        </div>

        <Tabs defaultValue="rituals" value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-5 max-w-3xl mx-auto bg-secondary border border-border">
            <TabsTrigger value="rituals" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Music className="w-4 h-4" />
              <span className="hidden sm:inline">My Rituals</span>
            </TabsTrigger>
            <TabsTrigger value="upload" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Upload className="w-4 h-4" />
              <span className="hidden sm:inline">Upload</span>
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <BarChart3 className="w-4 h-4" />
              <span className="hidden sm:inline">Analytics</span>
            </TabsTrigger>
            <TabsTrigger value="rts" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Activity className="w-4 h-4" />
              <span className="hidden sm:inline">RTS Score</span>
            </TabsTrigger>
            <TabsTrigger value="sanctuaries" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">Sanctuaries</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="rituals" className="space-y-6">
            <div className="text-center mb-2">
              <h2 className="text-xl font-semibold text-foreground">Your Sacred Offerings</h2>
              <p className="text-sm text-muted-foreground">
                Manage your uploaded rituals and track their journey through the community
              </p>
            </div>
            {ritualsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : rituals.length === 0 ? (
              <div className="text-center py-12">
                <Music className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2 text-foreground">No rituals yet</h3>
                <p className="text-muted-foreground mb-4">Start sharing your sacred practices with the community</p>
                <Button asChild className="bg-primary text-primary-foreground hover:bg-gold-muted">
                  <Link href="/creator/upload">Upload Your First Ritual</Link>
                </Button>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {rituals.map((ritual) => (
                  <Card key={ritual.id} className="bg-card border border-border hover:border-primary/40 transition-all duration-300 group">
                    <CardContent className="p-5">
                      <h3 className="text-base font-semibold mb-2 text-foreground group-hover:text-primary transition-colors line-clamp-1">{ritual.title}</h3>
                      <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{ritual.description}</p>
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        <Badge variant="outline" className={`${getStatusColor(ritual.status)} text-xs`}>
                          {ritual.status.replace("_", " ")}
                        </Badge>
                        <Badge className="bg-secondary text-secondary-foreground text-xs border-0">{getCareLevel(ritual.care_level)}</Badge>
                        {ritual.tags.slice(0, 2).map((tag) => (
                          <Badge key={tag.id || tag.name} variant="outline" className="text-xs border-border text-muted-foreground">
                            {typeof tag === "string" ? tag : tag.name}
                          </Badge>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground mb-3">
                        {new Date(ritual.created_at).toLocaleDateString()}
                      </p>
                      <div className="flex gap-2">
                        <Button asChild variant="outline" size="sm" className="flex-1 bg-transparent border-border text-foreground hover:bg-secondary hover:text-secondary-foreground" title="Analytics">
                          <Link href={`/creator/analytics/${ritual.id}`}>
                            <BarChart3 className="w-3.5 h-3.5" />
                          </Link>
                        </Button>
                        <Button asChild variant="outline" size="sm" className="flex-1 bg-transparent border-border text-foreground hover:bg-secondary hover:text-secondary-foreground" title="Edit">
                          <Link href={`/creator/rituals/${ritual.id}/edit`}>
                            <Edit className="w-3.5 h-3.5" />
                          </Link>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteRitual(ritual.id)}
                          className="flex-1 bg-transparent border-border text-destructive hover:bg-destructive/10"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="upload">
            <Card className="bg-card border-border">
              <CardContent className="py-12">
                <div className="text-center">
                  <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-5">
                    <Upload className="w-7 h-7 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2 text-foreground">Ready to share your practice?</h3>
                  <p className="text-muted-foreground mb-6 max-w-sm mx-auto">Upload audio files or record directly in your browser</p>
                  <Button asChild size="lg" className="bg-primary text-primary-foreground hover:bg-gold-muted">
                    <Link href="/creator/upload">Start Upload Process</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            {approvedRituals.length === 0 ? (
              <Card className="bg-card border-border">
                <CardContent className="py-12">
                  <div className="text-center">
                    <BarChart3 className="w-12 h-12 text-primary mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2 text-foreground">No approved rituals yet</h3>
                    <p className="text-muted-foreground max-w-sm mx-auto">
                      Analytics will appear here once your rituals are approved and being experienced by the community
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="grid gap-4 md:grid-cols-4">
                  <Card className="bg-card border-border">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Total Experiences</CardTitle>
                      <Play className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-primary">
                        {analyticsLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : dashboardMetrics?.total_plays || 0}
                      </div>
                      <p className="text-xs text-muted-foreground">Times your rituals were played</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-card border-border">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Completions</CardTitle>
                      <Users className="h-4 w-4 text-gold-light" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-gold-light">
                        {analyticsLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : dashboardMetrics?.total_completions || 0}
                      </div>
                      <p className="text-xs text-muted-foreground">Full ritual experiences</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-card border-border">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Completion Rate</CardTitle>
                      <BarChart3 className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-primary">
                        {analyticsLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : `${dashboardMetrics?.completion_rate?.toFixed(1) || 0}%`}
                      </div>
                      <p className="text-xs text-muted-foreground">Percentage of plays completed</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-card border-border">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Blessings</CardTitle>
                      <Heart className="h-4 w-4 text-gold-muted" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-gold-muted">
                        {analyticsLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : dashboardMetrics?.total_blessings || 0}
                      </div>
                      <p className="text-xs text-muted-foreground">Hearts received from community</p>
                    </CardContent>
                  </Card>
                </div>

                <Card className="bg-card border-border">
                  <CardHeader>
                    <CardTitle className="text-foreground">Community Feedback</CardTitle>
                    <CardDescription>Recent reflections from members experiencing your rituals</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {analyticsLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
                        <span>Loading community feedback...</span>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {creatorFeedback.length > 0 ? (
                          <div className="space-y-3 max-h-96 overflow-y-auto">
                            {creatorFeedback.map((item) => (
                              <Card key={item.id} className="border-l-4 border-l-primary/30 bg-secondary border-border">
                                <CardContent className="p-4">
                                  <div className="flex justify-between items-start mb-2">
                                    <h4 className="font-medium text-sm text-primary">{item.ritual.title}</h4>
                                    <span className="text-xs text-muted-foreground">
                                      {new Date(item.created_at).toLocaleDateString()}
                                    </span>
                                  </div>
                                  <p className="text-sm mb-2">{item.feedback_text}</p>
                                  <div className="text-xs text-muted-foreground">
                                    {item.is_anonymous || !item.user
                                      ? "Anonymous reflection"
                                      : `${item.user.first_name} ${item.user.last_name}`}
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-8 text-muted-foreground">
                            <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">No community reflections yet</p>
                            <p className="text-xs mt-1">Feedback will appear here as members experience your rituals</p>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          <TabsContent value="rts" className="space-y-6">
            {rtsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
                <span>Loading RTS data...</span>
              </div>
            ) : (
              <>
                <Card className="bg-card border-border">
                  <CardHeader>
                    <CardTitle className="text-foreground">Your Resonance Trust Score</CardTitle>
                    <CardDescription>
                      A real-time measure of your holistic health and readiness to expand your reach
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {rtsScore ? (
                      <div className="flex flex-col items-center py-6">
                        <ScoreBadge
                          score={rtsScore.current_score}
                          band={rtsService.getScoreBand(rtsScore.current_score)}
                          size="lg"
                        />
                        <p className="text-sm text-muted-foreground mt-4">
                          Last updated:{" "}
                          {rtsScore.last_calculated_at
                            ? new Date(rtsScore.last_calculated_at).toLocaleString()
                            : "Not yet calculated"}
                        </p>
                        {rtsService.getScoreBand(rtsScore.current_score) === "expand" && (
                          <Badge variant="outline" className="mt-4 text-primary bg-primary/10 border-primary/20">
                            You can expand your member reach!
                          </Badge>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <p className="text-sm">No RTS score available yet</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <ScoreHistory history={rtsHistory} />

                <SelfAssessmentForm onSubmitSuccess={handleAssessmentSuccess} />
              </>
            )}
          </TabsContent>

          <TabsContent value="sanctuaries" className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2">
              <div>
                <h2 className="text-xl font-semibold text-foreground">Your Sanctuaries</h2>
                <p className="text-sm text-muted-foreground">Manage your creator-owned communities</p>
              </div>
              <Button asChild className="bg-primary text-primary-foreground hover:bg-gold-muted">
                <Link href="/creator/sanctuaries/create">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Sanctuary
                </Link>
              </Button>
            </div>
            {sanctuariesLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : sanctuaries.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2 text-foreground">No sanctuaries yet</h3>
                <p className="text-muted-foreground mb-4">Create your first sanctuary to build a community</p>
                <Button asChild className="bg-primary text-primary-foreground hover:bg-gold-muted">
                  <Link href="/creator/sanctuaries/create">Create Your First Sanctuary</Link>
                </Button>
              </div>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {sanctuaries.map((sanctuary) => (
                  <SanctuaryCard
                    key={sanctuary.id}
                    sanctuary={sanctuary}
                    isCreatorView={true}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>


      </div>
    </div>
  )
}

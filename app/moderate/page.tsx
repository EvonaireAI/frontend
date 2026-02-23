"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { authService, type User, type ModerationStats } from "@/lib/auth"
import { rtsService, type RTSCreatorSummary, type RTSAlert } from "@/lib/rts"
import { sanctuariesService, type Sanctuary } from "@/lib/sanctuaries"
import { CreatorScoreTable } from "@/components/rts/creator-score-table"
import { Badge } from "@/components/ui/badge"
import { Loader2, Shield, Eye, AlertTriangle, FileText, TrendingUp, Bell, Users } from "lucide-react"
import Link from "next/link"
import { PendingReviews } from "@/components/moderation/pending-reviews"
import { toast } from "sonner"

export default function ModerateDashboard() {
  const [user, setUser] = useState<User | null>(null)
  const [stats, setStats] = useState<ModerationStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [creators, setCreators] = useState<RTSCreatorSummary[]>([])
  const [alerts, setAlerts] = useState<RTSAlert[]>([])
  const [rtsLoading, setRtsLoading] = useState(false)
  const [sanctuaries, setSanctuaries] = useState<Sanctuary[]>([])
  const [sanctuariesLoading, setSanctuariesLoading] = useState(false)
  const [activeTab, setActiveTab] = useState("overview")
  const router = useRouter()

  useEffect(() => {
    const loadUser = async () => {
      try {
        if (!authService.isAuthenticated()) {
          router.push("/auth/login")
          return
        }

        const userData = await authService.getProfile()
        if (!["moderator", "admin", "superadmin"].includes(userData.role)) {
          router.push("/dashboard")
          return
        }

        setUser(userData)
        await loadModerationStats()
        await loadRTSData()
      } catch (err) {
        console.error("Failed to load user:", err)
        router.push("/auth/login")
      } finally {
        setLoading(false)
      }
    }

    loadUser()
  }, [router])

  useEffect(() => {
    if (activeTab === "sanctuaries" && sanctuaries.length === 0 && !sanctuariesLoading) {
      loadSanctuaries()
    }
  }, [activeTab, sanctuaries.length, sanctuariesLoading])

  const loadModerationStats = async () => {
    try {
      const moderationStats = await authService.getModerationStats()
      setStats(moderationStats)
    } catch (error) {
      console.error("Failed to load moderation stats:", error)
      toast.error("Failed to load moderation statistics")
    }
  }

  const loadRTSData = async () => {
    setRtsLoading(true)
    try {
      const [creatorsData, alertsData] = await Promise.all([rtsService.getAllCreators(), rtsService.getAlerts()])
      setCreators(creatorsData)
      setAlerts(alertsData)
    } catch (error) {
      console.error("Failed to load RTS data:", error)
      toast.error("Failed to load RTS data")
    } finally {
      setRtsLoading(false)
    }
  }

  const loadSanctuaries = async () => {
    setSanctuariesLoading(true)
    try {
      const data = await sanctuariesService.listSanctuaries()
      setSanctuaries(data)
    } catch (error) {
      console.error("Failed to load sanctuaries:", error)
      toast.error("Failed to load sanctuaries")
    } finally {
      setSanctuariesLoading(false)
    }
  }

  const handleReviewComplete = () => {
    loadModerationStats()
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-accent/5">
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-foreground mb-2">Guardian Dashboard</h1>
            <p className="text-muted-foreground">Protecting cultural safety and emotional wellbeing</p>
          </div>
          <div className="flex gap-3">
            <Button asChild variant="outline">
              <Link href="/member">
                <Eye className="w-4 h-4 mr-2" />
                Sacred Library
              </Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
          <Card className="border-2 hover:border-primary/30 transition-colors">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <AlertTriangle className="w-4 h-4 text-yellow-600" />
                Pending Reviews
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{stats?.pending_reviews ?? 0}</div>
              <p className="text-xs text-muted-foreground mt-1">Rituals awaiting review</p>
            </CardContent>
          </Card>

          <Card className="border-2 hover:border-primary/30 transition-colors">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <FileText className="w-4 h-4 text-orange-600" />
                Open Cases
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{stats?.open_cases ?? 0}</div>
              <p className="text-xs text-muted-foreground mt-1">Active moderation cases</p>
            </CardContent>
          </Card>

          <Card className="border-2 hover:border-primary/30 transition-colors">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <TrendingUp className="w-4 h-4 text-green-600" />
                Today's Reviews
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats?.reviews_completed_today ?? 0}</div>
              <p className="text-xs text-muted-foreground mt-1">Reviews completed today</p>
            </CardContent>
          </Card>

          <Card className="border-2 hover:border-primary/30 transition-colors">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <Shield className="w-4 h-4 text-blue-600" />
                Cases Resolved
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats?.cases_resolved_today ?? 0}</div>
              <p className="text-xs text-muted-foreground mt-1">Cases resolved today</p>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 max-w-md">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="rts">RTS Monitoring</TabsTrigger>
            <TabsTrigger value="sanctuaries">Sanctuaries</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="mb-8">
              <PendingReviews onReviewComplete={handleReviewComplete} />
            </div>

            {alerts.length > 0 && (
              <Card className="mb-8 border-2 border-red-200 bg-red-50/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-red-600">
                    <Bell className="w-5 h-5" />
                    Critical RTS Alerts ({alerts.length})
                  </CardTitle>
                  <CardDescription>Creators requiring immediate attention</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {alerts.slice(0, 5).map((alert) => (
                      <div
                        key={alert.id}
                        className="flex items-center justify-between p-3 bg-white border border-red-200 rounded-lg"
                      >
                        <div>
                          <p className="font-medium">{alert.name}</p>
                          <p className="text-xs text-muted-foreground">{alert.email}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className="text-red-600 bg-red-50 border-red-200">
                            Score: {alert.score}
                          </Badge>
                          <Button asChild variant="outline" size="sm">
                            <Link href={`/moderate/rts/${alert.user_id}`}>
                              <Eye className="w-4 h-4" />
                            </Link>
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <Card className="border-2 hover:border-primary/30 transition-colors">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-orange-600" />
                    Moderation Cases
                  </CardTitle>
                  <CardDescription>Manage active moderation cases and reports</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-6">
                    <Button asChild className="w-full">
                      <Link href="/moderate/cases">View Cases ({stats?.open_cases ?? 0})</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-2 hover:border-primary/30 transition-colors">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="w-5 h-5 text-primary" />
                    Community Guidelines
                  </CardTitle>
                  <CardDescription>Review and update safety protocols</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-6">
                    <Button variant="outline" className="w-full bg-transparent">
                      View Guidelines
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-2 hover:border-primary/30 transition-colors">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-accent" />
                    Care Feed
                  </CardTitle>
                  <CardDescription>Monitor community signals and feedback</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-6">
                    <Button asChild variant="outline" className="w-full bg-transparent">
                      <Link href="/moderate/care-feed">View Care Feed</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="rts" className="space-y-6">
            {rtsLoading ? (
              <Card>
                <CardContent className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
                  <span>Loading RTS data...</span>
                </CardContent>
              </Card>
            ) : (
              <CreatorScoreTable creators={creators} />
            )}
          </TabsContent>

          <TabsContent value="sanctuaries" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Sanctuary Audit
                </CardTitle>
                <CardDescription>Monitor and audit all sanctuaries for compliance</CardDescription>
              </CardHeader>
              <CardContent>
                {sanctuariesLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
                    <span>Loading sanctuaries...</span>
                  </div>
                ) : sanctuaries.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p className="text-sm">No sanctuaries found</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {sanctuaries.map((sanctuary) => (
                      <Card key={sanctuary.id} className="border-l-4 border-l-primary">
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <h4 className="font-medium text-lg">{sanctuary.title}</h4>
                              <p className="text-sm text-muted-foreground mb-2">{sanctuary.description}</p>
                              <div className="flex gap-2 flex-wrap mb-2">
                                <Badge variant="outline" className="capitalize">
                                  {sanctuary.status}
                                </Badge>
                                <Badge variant="outline" className="capitalize">
                                  {sanctuary.privacy}
                                </Badge>
                                <Badge variant="secondary">
                                  {sanctuary.active_members_count}/{sanctuary.capacity} members
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                Owner: {sanctuary.owner.first_name} {sanctuary.owner.last_name}
                              </p>
                            </div>
                            <Button asChild variant="outline" size="sm">
                              <Link href={`/moderate/sanctuaries/${sanctuary.id}`}>
                                <Eye className="w-4 h-4 mr-2" />
                                Audit
                              </Link>
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

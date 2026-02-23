"use client"

import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { authService, type User, type Ritual, type RitualAnalytics, type RitualFeedback } from "@/lib/auth"
import { Loader2, ArrowLeft, Play, Heart, Users, MessageSquare, BarChart3 } from "lucide-react"
import Link from "next/link"

export default function RitualAnalyticsPage() {
  const [user, setUser] = useState<User | null>(null)
  const [ritual, setRitual] = useState<Ritual | null>(null)
  const [analytics, setAnalytics] = useState<RitualAnalytics | null>(null)
  const [feedback, setFeedback] = useState<RitualFeedback[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const params = useParams()
  const ritualId = Number.parseInt(params.id as string)

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

        const rituals = await authService.getMyRituals()
        const found = rituals.find((r) => r.id === ritualId)

        if (!found) {
          setError("Ritual not found or you do not have permission to view its analytics.")
          setLoading(false)
          return
        }

        setRitual(found)

        const [analyticsData, feedbackData] = await Promise.all([
          authService.getRitualAnalytics(ritualId),
          authService.getRitualFeedback(ritualId),
        ])

        setAnalytics(analyticsData)
        setFeedback(feedbackData)
      } catch (err) {
        console.error("Failed to load analytics:", err)
        setError("Failed to load analytics data.")
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [router, ritualId])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error || !ritual) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <Button asChild variant="outline" className="mb-4 bg-transparent border-border text-foreground hover:bg-secondary">
            <Link href="/creator">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Creator Studio
            </Link>
          </Button>
          <Card className="bg-card border-border">
            <CardContent className="p-8 text-center">
              <BarChart3 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">{error || "Ritual not found"}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const completionRate =
    analytics && analytics.total_plays > 0
      ? ((analytics.total_completions / analytics.total_plays) * 100).toFixed(1)
      : "0.0"

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 lg:py-12">
        <div className="flex items-center gap-4 mb-8">
          <Button asChild variant="outline" className="bg-transparent border-border text-foreground hover:bg-secondary">
            <Link href="/creator">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Creator Studio
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">{ritual.title}</h1>
            <p className="text-muted-foreground">Detailed analytics for this ritual</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-8">
          <Badge variant="outline" className="border-primary/30 text-primary">
            {ritual.care_level === "level1" ? "Gentle" : ritual.care_level === "level2" ? "Moderate" : "Intensive"}
          </Badge>
          <Badge variant="outline" className="capitalize border-border text-muted-foreground">
            {ritual.status.replace("_", " ")}
          </Badge>
          {ritual.tags.map((tag) => (
            <Badge key={typeof tag === "string" ? tag : tag.id} className="bg-secondary text-secondary-foreground border-0">
              {typeof tag === "string" ? tag : tag.name}
            </Badge>
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-4 mb-8">
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Plays</CardTitle>
              <Play className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{analytics?.total_plays || 0}</div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Completions</CardTitle>
              <Users className="h-4 w-4 text-gold-light" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gold-light">{analytics?.total_completions || 0}</div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Completion Rate</CardTitle>
              <BarChart3 className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{completionRate}%</div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Blessings</CardTitle>
              <Heart className="h-4 w-4 text-gold-muted" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gold-muted">{analytics?.total_blessings || 0}</div>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <MessageSquare className="w-5 h-5" />
              Community Feedback
            </CardTitle>
            <CardDescription>Reflections from members who experienced this ritual</CardDescription>
          </CardHeader>
          <CardContent>
            {feedback.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No feedback received yet</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {feedback.map((item) => (
                  <Card key={item.id} className="border-l-4 border-l-primary/30">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-xs text-muted-foreground">
                          {new Date(item.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-sm mb-2">{item.content}</p>
                      <div className="text-xs text-muted-foreground">
                        {item.is_anonymous || !item.user
                          ? "Anonymous reflection"
                          : `${item.user.first_name} ${item.user.last_name}`}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

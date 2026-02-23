"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { authService, type User, type CareFeedItem } from "@/lib/auth"
import { Loader2, ArrowLeft, Heart, MessageSquare, AlertTriangle, Clock, UserIcon } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"

export default function CareFeed() {
  const [user, setUser] = useState<User | null>(null)
  const [feedItems, setFeedItems] = useState<CareFeedItem[]>([])
  const [loading, setLoading] = useState(true)
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
        await loadCareFeed()
      } catch (err) {
        console.error("Failed to load user:", err)
        router.push("/auth/login")
      } finally {
        setLoading(false)
      }
    }

    loadUser()
  }, [router])

  const loadCareFeed = async () => {
    try {
      const feed = await authService.getCareFeed()
      setFeedItems(feed)
    } catch (error) {
      console.error("Failed to load care feed:", error)
      toast.error("Failed to load care feed")
    }
  }

  const getItemIcon = (type: string) => {
    switch (type) {
      case "blessing":
        return <Heart className="w-4 h-4 text-pink-500" />
      case "feedback":
        return <MessageSquare className="w-4 h-4 text-blue-500" />
      case "case":
        return <AlertTriangle className="w-4 h-4 text-orange-500" />
      default:
        return <MessageSquare className="w-4 h-4 text-muted-foreground" />
    }
  }

  const getSeverityBorderColor = (severity?: string) => {
    if (!severity) return ""
    switch (severity) {
      case "high":
        return "border-l-red-500"
      case "medium":
        return "border-l-yellow-500"
      case "low":
        return "border-l-green-500"
      default:
        return ""
    }
  }

  const getItemContent = (item: CareFeedItem): string => {
    if (item.type === "feedback" && item.feedback_text) {
      return item.feedback_text
    }
    if (item.type === "case" && item.flagged_reason) {
      return item.flagged_reason
    }
    if (item.type === "blessing") {
      return "A blessing was given to this ritual"
    }
    return "No additional details"
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
        <div className="flex items-center gap-4 mb-8">
          <Button asChild variant="outline" size="sm">
            <Link href="/moderate">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Care Feed</h1>
            <p className="text-muted-foreground">Monitor community signals and feedback that need attention</p>
          </div>
        </div>

        <div className="space-y-4">
          {feedItems.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <Heart className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">All quiet in the community</h3>
                <p className="text-muted-foreground">
                  No new signals requiring attention. The community is in harmony.
                </p>
              </CardContent>
            </Card>
          ) : (
            feedItems.map((item) => (
              <Card
                key={`${item.type}-${item.id}`}
                className={`border-l-4 ${getSeverityBorderColor(item.severity)} hover:shadow-md transition-shadow`}
              >
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 mt-1">{getItemIcon(item.type)}</div>

                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <Badge variant="secondary" className="text-xs">
                          {item.type.toUpperCase()}
                        </Badge>
                        {item.severity && (
                          <Badge
                            className={
                              item.severity === "high"
                                ? "bg-red-100 text-red-800"
                                : item.severity === "medium"
                                  ? "bg-yellow-100 text-yellow-800"
                                  : "bg-green-100 text-green-800"
                            }
                          >
                            {item.severity.toUpperCase()}
                          </Badge>
                        )}
                        {item.status && (
                          <Badge variant="outline" className="text-xs">
                            {item.status.replace("_", " ").toUpperCase()}
                          </Badge>
                        )}
                        {item.is_anonymous && (
                          <Badge variant="outline" className="text-xs">
                            ANONYMOUS
                          </Badge>
                        )}
                        {item.flagged_by_ai && (
                          <Badge className="bg-purple-100 text-purple-800 text-xs">
                            AI FLAGGED
                          </Badge>
                        )}
                      </div>

                      {item.ritual_title && (
                        <h4 className="font-medium text-primary mb-2">{item.ritual_title}</h4>
                      )}

                      <p className="text-muted-foreground mb-3">{getItemContent(item)}</p>

                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        {item.giver_email && (
                          <div className="flex items-center gap-1">
                            <UserIcon className="w-4 h-4" />
                            {item.giver_email}
                          </div>
                        )}
                        {item.assigned_moderator_email && (
                          <div className="flex items-center gap-1">
                            <UserIcon className="w-4 h-4" />
                            Assigned: {item.assigned_moderator_email}
                          </div>
                        )}
                        {item.created_at && (
                          <div className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {new Date(item.created_at).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex-shrink-0">
                      <Button asChild variant="outline" size="sm">
                        <Link href={item.type === "case" ? "/moderate/cases" : `/member/ritual/${item.ritual}`}>
                          {item.type === "case" ? "View Case" : "View Ritual"}
                        </Link>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {feedItems.length > 0 && (
          <div className="text-center mt-8">
            <Button variant="outline" onClick={loadCareFeed}>
              Refresh Feed
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

"use client"

import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { authService, type User } from "@/lib/auth"
import { sanctuariesService, type Sanctuary, type RitualAssignment } from "@/lib/sanctuaries"
import { Loader2, ArrowLeft, Users, Lock, Globe, Calendar, Flag } from "lucide-react"
import { ReportModal } from "@/components/report-modal"
import { AgoraCircles } from "@/components/agora/agora-circles"
import Link from "next/link"

export default function MemberSanctuaryDetailPage() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [sanctuary, setSanctuary] = useState<Sanctuary | null>(null)
  const [rituals, setRituals] = useState<RitualAssignment[]>([])
  const [dataLoading, setDataLoading] = useState(false)
  const [membershipStatus, setMembershipStatus] = useState<string | null>(null)
  const router = useRouter()
  const params = useParams()
  const sanctuaryId = Number.parseInt(params.id as string)

  useEffect(() => {
    const loadData = async () => {
      try {
        if (!authService.isAuthenticated()) {
          router.push("/auth/login")
          return
        }

        const userData = await authService.getProfile()
        setUser(userData)
        await loadSanctuaryData()
      } catch (err) {
        console.error("Failed to load data:", err)
        router.push("/auth/login")
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [router])

  const loadSanctuaryData = async () => {
    setDataLoading(true)
    try {
      const [sanctuaryData, ritualsData] = await Promise.all([
        sanctuariesService.getSanctuaryDetail(sanctuaryId),
        sanctuariesService.getAssignedRituals(sanctuaryId),
      ])

      setSanctuary(sanctuaryData)
      setRituals(ritualsData)
      setMembershipStatus(sanctuaryData.membership_status ?? null)
    } catch (err) {
      console.error("Failed to load sanctuary data:", err)
    } finally {
      setDataLoading(false)
    }
  }

  const handleLeaveSanctuary = async () => {
    if (!confirm("Are you sure you want to leave this sanctuary?")) return

    try {
      await sanctuariesService.leaveSanctuary(sanctuaryId)
      router.push("/member")
    } catch (err) {
      console.error("Failed to leave sanctuary:", err)
    }
  }

  const getCareLevelColor = (level: string) => {
    switch (level) {
      case "level1":
        return "bg-green-100 text-green-800 border-green-200"
      case "level2":
        return "bg-yellow-100 text-yellow-800 border-yellow-200"
      case "level3":
        return "bg-red-100 text-red-800 border-red-200"
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

  if (!sanctuary) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground mb-4">Sanctuary not found</p>
            <Button asChild>
              <Link href="/member">Back to Sacred Library</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const getPrivacyIcon = () => {
    return sanctuary.privacy === "invite_only" ? <Lock className="w-4 h-4" /> : <Globe className="w-4 h-4" />
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800 border-green-200"
      case "paused":
        return "bg-yellow-100 text-yellow-800 border-yellow-200"
      case "archived":
        return "bg-gray-100 text-gray-800 border-gray-200"
      default:
        return "bg-muted text-muted-foreground border-border"
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <Button asChild variant="outline" className="mb-4 bg-transparent">
            <Link href="/member">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Sacred Library
            </Link>
          </Button>
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-4xl font-bold text-foreground mb-2">{sanctuary.title}</h1>
              <p className="text-muted-foreground">{sanctuary.description}</p>
            </div>
            <div className="flex items-center gap-2">
              <ReportModal
                contentType="sanctuary"
                contentId={sanctuaryId}
                contentTitle={sanctuary.title}
                trigger={
                  <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive">
                    <Flag className="w-4 h-4 mr-2" />
                    Report
                  </Button>
                }
              />
              {membershipStatus === "approved" && (
                <Button variant="destructive" onClick={handleLeaveSanctuary}>
                  Leave Sanctuary
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Status</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant="outline" className="border-primary/30 text-primary capitalize">
                {sanctuary.status}
              </Badge>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Privacy</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant="outline" className="flex items-center gap-1 w-fit border-border text-muted-foreground">
                {getPrivacyIcon()}
                {sanctuary.privacy === "invite_only" ? "Invite Only" : "Public"}
              </Badge>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                <Users className="w-4 h-4" />
                Members
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-foreground">
                {sanctuary.active_members_count}/{sanctuary.capacity}
              </p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Your Status</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant="outline" className="capitalize border-primary/30 text-primary">
                {membershipStatus || "Not a member"}
              </Badge>
            </CardContent>
          </Card>
        </div>

        {sanctuary.welcome_message && (
          <Card className="mb-8 border-l-4 border-l-primary bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Welcome Message</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{sanctuary.welcome_message}</p>
            </CardContent>
          </Card>
        )}

        {sanctuary.tags.length > 0 && (
          <Card className="mb-8 bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Practice Types</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {sanctuary.tags.map((tag) => (
                  <Badge key={tag.id} variant="secondary">
                    {tag.name}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {membershipStatus === "approved" && rituals.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Available Rituals</CardTitle>
              <CardDescription>Sacred practices available in this sanctuary</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {rituals.map((ritual) => (
                  <Card key={ritual.id} className="border-l-4 border-l-primary">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h4 className="font-medium">{ritual.ritual_title}</h4>
                          <div className="flex gap-2 mt-2">
                            <Badge variant="outline" className={getCareLevelColor(ritual.care_level)}>
                              {ritual.care_level}
                            </Badge>
                            <Badge variant="outline" className="bg-blue-50 text-blue-800 border-blue-200">
                              {ritual.status}
                            </Badge>
                          </div>
                        </div>
                        <Button asChild size="sm">
                          <Link href={`/member/ritual/${ritual.ritual_id}`}>Experience</Link>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="mt-8">
          <AgoraCircles sanctuaryId={sanctuaryId} />
        </div>

        <Card className="bg-secondary border-border mt-8">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Created
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{new Date(sanctuary.created_at).toLocaleDateString()}</p>
            <p className="text-xs text-muted-foreground mt-1">
              by {sanctuary.owner.first_name} {sanctuary.owner.last_name}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

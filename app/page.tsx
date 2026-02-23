"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { authService, type User } from "@/lib/auth"
import { Loader2, Shield, Eye, AlertTriangle } from "lucide-react"
import Link from "next/link"

export default function ModerateDashboard() {
  const [user, setUser] = useState<User | null>(null)
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
        if (userData.role !== "moderator") {
          router.push("/dashboard")
          return
        }

        setUser(userData)
      } catch (err) {
        console.error("Failed to load user:", err)
        router.push("/auth/login")
      } finally {
        setLoading(false)
      }
    }

    loadUser()
  }, [router])

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
            <h1 className="text-4xl font-bold text-foreground mb-2">Prism Circle</h1>
            <p className="text-muted-foreground">Guardian of cultural safety and emotional protection</p>
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

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card className="border-2 hover:border-primary/30 transition-colors">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-yellow-600" />
                Pending Reviews
              </CardTitle>
              <CardDescription>Rituals awaiting cultural and emotional safety review</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-6">
                <p className="text-2xl font-bold text-primary mb-2">0</p>
                <p className="text-sm text-muted-foreground">No pending reviews</p>
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
                <Eye className="w-5 h-5 text-accent" />
                Moderation History
              </CardTitle>
              <CardDescription>Track your moderation activities</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-6">
                <p className="text-2xl font-bold text-accent mb-2">0</p>
                <p className="text-sm text-muted-foreground">Reviews completed</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Moderation Tools</CardTitle>
            <CardDescription>Tools for maintaining our sacred community standards</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <Shield className="w-12 h-12 text-primary mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Moderation Features Coming Soon</h3>
              <p className="text-muted-foreground">
                Advanced moderation tools for reviewing sensitive rituals and ensuring cultural safety
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

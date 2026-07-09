"use client"

import Link from "next/link"
import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/lib/auth-context"
import { Loader2, LifeBuoy, Wind, Heart, ArrowLeft } from "lucide-react"

// The Reflection Room (formerly "Safety Room") — a calm surface a member can
// step into for grounding and to reach additional support. The primary action
// connects them with a Guardian.
//
// There is no live "available guardians" endpoint yet, so the CTA routes to the
// best existing support destination (the Agora, where Guardians are present).
// TODO(fitsum): point "Connect with a Guardian" at GET /api/guardians/available/
// when the backend adds it, so we can show real, on-call Guardians here.
export default function ReflectionRoomPage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) router.push("/auth/login")
  }, [loading, user, router])

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <Button asChild variant="ghost" size="sm" className="mb-6 text-muted-foreground">
          <Link href="/member/my-sanctuary">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to My Sanctuary
          </Link>
        </Button>

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 mb-4">
            <Wind className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-2xl md:text-3xl font-serif text-foreground tracking-wide mb-2">
            Reflection Room
          </h1>
          <p className="text-muted-foreground max-w-md mx-auto text-sm leading-relaxed">
            A quiet place to pause, breathe, and steady yourself. There is no rush here —
            stay as long as you need.
          </p>
        </div>

        <Card className="border-l-4 border-l-primary mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <LifeBuoy className="w-5 h-5 text-primary" />
              Would some support help right now?
            </CardTitle>
            <CardDescription>
              Guardians are members of the community trained to listen and help you find your
              footing. You can reach out anytime — no situation is too small.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row gap-3">
            <Button asChild className="flex-1">
              {/* TODO(fitsum): point at GET /api/guardians/available/ when it exists */}
              <Link href="/member/agora">
                <Heart className="w-4 h-4 mr-2" />
                Connect with a Guardian
              </Link>
            </Button>
            <Button asChild variant="outline" className="flex-1">
              <Link href="/member/agora">Visit the Agora</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">A moment to ground</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground leading-relaxed space-y-3">
            <p>Notice five things you can see. Four you can touch. Three you can hear.</p>
            <p>Breathe in slowly for four counts, hold for four, and release for six.</p>
            <p>You are safe here, and you are not alone.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

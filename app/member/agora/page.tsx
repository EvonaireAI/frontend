"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useAuth } from "@/lib/auth-context"
import { authService, type Ritual } from "@/lib/auth"
import { sanctuariesService, type Sanctuary } from "@/lib/sanctuaries"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Loader2, Landmark, Users, Play, ArrowRight, Sparkles } from "lucide-react"

export default function AgoraPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()

  const [rituals, setRituals] = useState<Ritual[]>([])
  const [sanctuaries, setSanctuaries] = useState<Sanctuary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (authLoading) return
    if (!user) { router.push("/auth/login"); return }

    Promise.all([
      authService.getAllRituals().catch(() => [] as Ritual[]),
      sanctuariesService.listSanctuaries().catch(() => [] as Sanctuary[]),
    ]).then(([r, s]) => {
      setRituals(r.filter((x) => x.status === "approved").slice(0, 6))
      setSanctuaries(s.slice(0, 6))
    }).finally(() => setLoading(false))
  }, [user, authLoading, router])

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 lg:py-12">

        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-2">
            <Landmark className="w-5 h-5 text-primary" />
            <p className="text-sm uppercase tracking-widest text-gold-muted">Community</p>
          </div>
          <h1 className="text-3xl md:text-4xl font-serif text-foreground tracking-wide mb-2">
            The Agora
          </h1>
          <p className="text-muted-foreground max-w-xl">
            The open gathering space — discover rituals, connect with sanctuaries, and explore what
            the Evonaire community is sharing.
          </p>
        </div>

        {/* Featured Sanctuaries */}
        <section className="mb-12">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              Active Sanctuaries
            </h2>
            <Button asChild variant="ghost" size="sm" className="text-primary hover:text-gold-muted gap-1">
              <Link href="/member">
                Browse all
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </Button>
          </div>

          {sanctuaries.length === 0 ? (
            <Card className="bg-card border-border">
              <CardContent className="py-10 text-center">
                <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
                <p className="text-sm text-muted-foreground">No sanctuaries available yet.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {sanctuaries.map((s) => (
                <Card
                  key={s.id}
                  className="bg-card border border-border hover:border-primary/40 transition-all duration-200 group"
                >
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start mb-1">
                      <Badge variant="outline" className="capitalize border-primary/30 text-primary text-xs">
                        {s.status ?? "active"}
                      </Badge>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {s.member_count ?? 0}
                      </span>
                    </div>
                    <CardTitle className="text-base text-foreground group-hover:text-primary transition-colors">
                      {s.title}
                    </CardTitle>
                    <CardDescription className="line-clamp-2 text-sm">{s.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button asChild size="sm" className="w-full bg-primary text-primary-foreground hover:bg-gold-muted">
                      <Link href={`/member/sanctuaries/${s.id}`}>Enter Sanctuary</Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* Featured Rituals */}
        <section>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              Latest Rituals
            </h2>
            <Button asChild variant="ghost" size="sm" className="text-primary hover:text-gold-muted gap-1">
              <Link href="/member?tab=rituals">
                Browse all
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </Button>
          </div>

          {rituals.length === 0 ? (
            <Card className="bg-card border-border">
              <CardContent className="py-10 text-center">
                <Play className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
                <p className="text-sm text-muted-foreground">No rituals available yet.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {rituals.map((r) => (
                <Card
                  key={r.id}
                  className="bg-card border border-border hover:border-primary/40 transition-all duration-200 group"
                >
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start mb-1">
                      <Badge variant="outline" className="text-xs border-border text-muted-foreground capitalize">
                        {r.care_level.replace("level", "Level ")}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(r.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <CardTitle className="text-base text-foreground group-hover:text-primary transition-colors">
                      {r.title}
                    </CardTitle>
                    <CardDescription className="line-clamp-2 text-sm">{r.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        by {r.creator.first_name} {r.creator.last_name}
                      </span>
                      <Button asChild size="sm" className="bg-primary text-primary-foreground hover:bg-gold-muted">
                        <Link href={`/member/ritual/${r.id}`}>
                          <Play className="w-3.5 h-3.5 mr-1.5" />
                          Experience
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

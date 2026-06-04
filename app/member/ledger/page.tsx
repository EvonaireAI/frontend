"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useAuth } from "@/lib/auth-context"
import { authService } from "@/lib/auth"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Loader2,
  ScrollText,
  Play,
  Heart,
  Clock,
  CheckCircle2,
  Calendar,
  Music,
  CreditCard,
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

export default function LedgerPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [playHistory, setPlayHistory] = useState<PlayHistoryItem[]>([])
  const [blessings, setBlessings] = useState<BlessingItem[]>([])
  const [activeTab, setActiveTab] = useState("history")

  useEffect(() => {
    if (authLoading) return
    if (!user) { router.push("/auth/login"); return }

    Promise.all([
      authService.getMyPlayHistory().catch(() => [] as PlayHistoryItem[]),
      authService.getMyBlessings().catch(() => [] as BlessingItem[]),
    ]).then(([plays, bless]) => {
      setPlayHistory(plays)
      setBlessings(bless)
    }).finally(() => setLoading(false))
  }, [user, authLoading, router])

  const getCareLevel = (level: string) => {
    switch (level) {
      case "level1": return "Gentle"
      case "level2": return "Moderate"
      case "level3": return "Intensive"
      default: return level
    }
  }

  const getCareLevelColor = (level: string) => {
    switch (level) {
      case "level1": return "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300"
      case "level2": return "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300"
      case "level3": return "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300"
      default: return "bg-muted text-muted-foreground border-border"
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

  if (!user) return null

  const completedCount = playHistory.filter((p) => p.is_completed).length
  const totalTime = playHistory.reduce((acc, p) => acc + p.progress_seconds, 0)

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 lg:py-12">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <ScrollText className="w-5 h-5 text-primary" />
            <p className="text-sm uppercase tracking-widest text-gold-muted">Records</p>
          </div>
          <h1 className="text-3xl md:text-4xl font-serif text-foreground tracking-wide mb-2">
            The Ledger
          </h1>
          <p className="text-muted-foreground">
            A record of your practice — every ritual experienced, every blessing given.
          </p>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-1">
            <p className="text-2xl font-bold text-foreground">{playHistory.length}</p>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Sessions</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-1">
            <p className="text-2xl font-bold text-foreground">{completedCount}</p>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Completed</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-1">
            <p className="text-2xl font-bold text-foreground">{blessings.length}</p>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Blessings</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-1">
            <p className="text-2xl font-bold text-foreground">{Math.floor(totalTime / 60)}m</p>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Listen Time</p>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 max-w-md bg-secondary border border-border">
            <TabsTrigger
              value="history"
              className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <Play className="w-4 h-4" />
              <span className="hidden sm:inline">Sessions</span>
            </TabsTrigger>
            <TabsTrigger
              value="blessings"
              className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <Heart className="w-4 h-4" />
              <span className="hidden sm:inline">Blessings</span>
            </TabsTrigger>
            <TabsTrigger
              value="billing"
              className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <CreditCard className="w-4 h-4" />
              <span className="hidden sm:inline">Billing</span>
            </TabsTrigger>
          </TabsList>

          {/* Play History */}
          <TabsContent value="history" className="space-y-3">
            <h2 className="text-base font-semibold text-foreground">
              Practice Sessions ({playHistory.length})
            </h2>

            {playHistory.length === 0 ? (
              <Card className="bg-card border-border">
                <CardContent className="py-12 text-center">
                  <Music className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-40" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">No sessions yet</h3>
                  <p className="text-muted-foreground mb-4 text-sm">
                    Your ritual experiences will appear here
                  </p>
                  <Button asChild>
                    <Link href="/member">Start Exploring</Link>
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {playHistory.map((play) => (
                  <div
                    key={play.id}
                    className="bg-card border border-border rounded-xl p-4 flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-full flex-shrink-0 ${play.is_completed ? "bg-green-500/10" : "bg-yellow-500/10"}`}>
                        {play.is_completed ? (
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                        ) : (
                          <Clock className="w-4 h-4 text-yellow-500" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-foreground text-sm truncate">{play.ritual_title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="outline" className={`text-xs py-0 ${getCareLevelColor(play.ritual_care_level)}`}>
                            {getCareLevel(play.ritual_care_level)}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {formatDuration(play.progress_seconds)}
                          </span>
                          <span className="text-xs text-muted-foreground hidden sm:inline">
                            {new Date(play.started_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                    <Button asChild variant="ghost" size="sm" className="flex-shrink-0 text-primary hover:text-gold-muted">
                      <Link href={`/member/ritual/${play.ritual}`}>
                        <Play className="w-3.5 h-3.5 mr-1" />
                        {play.is_completed ? "Replay" : "Continue"}
                      </Link>
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Blessings */}
          <TabsContent value="blessings" className="space-y-3">
            <h2 className="text-base font-semibold text-foreground">
              Blessings Given ({blessings.length})
            </h2>

            {blessings.length === 0 ? (
              <Card className="bg-card border-border">
                <CardContent className="py-12 text-center">
                  <Heart className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-40" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">No blessings yet</h3>
                  <p className="text-muted-foreground mb-4 text-sm">
                    Bless rituals that resonate with you
                  </p>
                  <Button asChild>
                    <Link href="/member">Explore Rituals</Link>
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {blessings.map((blessing) => (
                  <div
                    key={blessing.id}
                    className="bg-card border border-border rounded-xl p-4 flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3">
                      <Heart className="w-4 h-4 text-primary fill-current flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="font-medium text-foreground text-sm truncate">{blessing.ritual_title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="outline" className={`text-xs py-0 ${getCareLevelColor(blessing.ritual_care_level)}`}>
                            {getCareLevel(blessing.ritual_care_level)}
                          </Badge>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(blessing.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                    <Button asChild variant="ghost" size="sm" className="flex-shrink-0 text-primary hover:text-gold-muted">
                      <Link href={`/member/ritual/${blessing.ritual}`}>
                        <Play className="w-3.5 h-3.5 mr-1" />
                        Experience
                      </Link>
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Billing shortcut */}
          <TabsContent value="billing">
            <div className="bg-card border border-border rounded-xl p-8 text-center">
              <CreditCard className="w-10 h-10 text-primary mx-auto mb-4 opacity-60" />
              <h3 className="text-lg font-semibold text-foreground mb-2">Billing &amp; Invoices</h3>
              <p className="text-muted-foreground text-sm mb-6 max-w-sm mx-auto">
                View your subscription details, plan status, and invoice history issued by
                Evonaire, Inc.
              </p>
              <Button asChild className="bg-primary text-primary-foreground hover:bg-gold-muted">
                <Link href="/member/billing">Go to Billing</Link>
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

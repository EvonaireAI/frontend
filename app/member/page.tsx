"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { authService, type Ritual } from "@/lib/auth"
import { useAuth } from "@/lib/auth-context"
import { useEntitlements } from "@/lib/entitlements-context"
import { EntitlementDeniedError, openUpgradeModal } from "@/lib/entitlements"
import { runGatedAction, GatewayCancelledError } from "@/lib/gateway-quiz"
import { planDisplayName } from "@/lib/plans"
import { sanctuariesService, type Sanctuary } from "@/lib/sanctuaries"
import { SanctuaryCard } from "@/components/sanctuaries/sanctuary-card"
import { SanctuaryLimitBanner } from "@/components/sanctuaries/sanctuary-limit-banner"
import { JoinRequestForm } from "@/components/sanctuaries/join-request-form"
import { Loader2, Search, Heart, Play, Filter, Users, AlertTriangle, Lock } from "lucide-react"
import { ReportModal } from "@/components/report-modal"
import Link from "next/link"
import { PremiumCTABanner } from "@/components/payments/premium-cta-banner"
import { QuotaMeter } from "@/components/payments/quota-meter"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { GaiaInfoTip } from "@/components/gaia/info-tip"
import { BeginHere } from "@/components/member/begin-here"
import { AccountAccessCard } from "@/components/member/account-access-card"
import { isPaidActive } from "@/lib/subscription"
import { fmtLocale, tr, trNode } from "@/lib/i18n"


// ── Subscription badge ─────────────────────────────────────────────────────────
function SubscriptionBadge({
  plan,
  status,
}: {
  plan?: string
  status?: string
}) {
  const { planName } = useEntitlements()
  const p = plan ?? "free"
  const s = status ?? "active"
  const paid = isPaidActive(p, s)
  const pastDue = !paid && ["evocore", "evobloom", "evoluxe"].includes(p) && s === "past_due"
  const name = planName

  const glowClass =
    p === "evoluxe"
      ? "shadow-[0_0_10px_rgba(217,181,116,0.35)]"
      : p === "evobloom"
      ? "shadow-[0_0_7px_rgba(217,181,116,0.2)]"
      : ""

  return (
    <>
      <Link
        href="/member/billing"
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium transition-opacity hover:opacity-80 ${
          paid
            ? `border border-primary/50 text-primary bg-primary/10 ${glowClass}`
            : "border border-border text-muted-foreground bg-secondary"
        }`}
      >
        {name}
      </Link>
      {pastDue && (
        <Link
          href="/member/billing"
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border border-yellow-500/40 text-yellow-300 bg-yellow-900/20 hover:opacity-80 transition-opacity"
        >
          <AlertTriangle className="w-3 h-3" />
          {tr("Payment Issue")}
        </Link>
      )}
    </>
  )
}

// ── Dashboard ──────────────────────────────────────────────────────────────────
export default function MemberDashboard() {
  const { user, loading: authLoading } = useAuth()
  const { plan } = useEntitlements()
  const [rituals, setRituals] = useState<Ritual[]>([])
  const [filteredRituals, setFilteredRituals] = useState<Ritual[]>([])
  const [loading, setLoading] = useState(true)
  const [ritualsLoading, setRitualsLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [sanctuaries, setSanctuaries] = useState<Sanctuary[]>([])
  const [filteredSanctuaries, setFilteredSanctuaries] = useState<Sanctuary[]>([])
  const [sanctuariesLoading, setSanctuariesLoading] = useState(false)
  const [sanctuarySearchTerm, setSanctuarySearchTerm] = useState("")
  const [selectedSanctuary, setSelectedSanctuary] = useState<Sanctuary | null>(null)
  const [joinFormOpen, setJoinFormOpen] = useState(false)
  const [activeTab, setActiveTab] = useState("sanctuaries")
  const [selectedTone, setSelectedTone] = useState<string | null>(null)
  const [showAllRituals, setShowAllRituals] = useState(false)
  const router = useRouter()

  useEffect(() => {
    if (authLoading) return

    if (!user) {
      router.push("/auth/login")
      return
    }

    const loadData = async () => {
      try {
        await Promise.all([loadRituals(), loadSanctuaries()])
      } catch (err) {
        console.error("Failed to load data:", err)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [user, authLoading, router])

  const loadRituals = async () => {
    setRitualsLoading(true)
    try {
      const ritualsData = await authService.getAllRituals()
      const approvedRituals = ritualsData.filter((ritual) => ritual.status === "approved")
      setRituals(approvedRituals)
      setFilteredRituals(approvedRituals)

    } catch (err) {
      console.error("Failed to load rituals:", err)
    } finally {
      setRitualsLoading(false)
    }
  }

  const loadSanctuaries = async () => {
    setSanctuariesLoading(true)
    try {
      const data = await sanctuariesService.listSanctuaries()
      setSanctuaries(data)
      setFilteredSanctuaries(data)
    } catch (err) {
      console.error("Failed to load sanctuaries:", err)
    } finally {
      setSanctuariesLoading(false)
    }
  }

  useEffect(() => {
    let filtered = rituals

    if (searchTerm) {
      filtered = filtered.filter(
        (ritual) =>
          ritual.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          ritual.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
          ritual.creator.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          ritual.creator.last_name.toLowerCase().includes(searchTerm.toLowerCase()),
      )
    }

    if (selectedTone) {
      const tone = selectedTone.toLowerCase()
      filtered = filtered.filter((ritual) =>
        ritual.tags.some((tag) => (typeof tag === "string" ? tag : tag.name).toLowerCase() === tone)
      )
    }

    setFilteredRituals(filtered)
  }, [searchTerm, selectedTone, rituals])

  useEffect(() => {
    let filtered = sanctuaries

    if (sanctuarySearchTerm) {
      filtered = filtered.filter(
        (sanctuary) =>
          sanctuary.title.toLowerCase().includes(sanctuarySearchTerm.toLowerCase()) ||
          sanctuary.description.toLowerCase().includes(sanctuarySearchTerm.toLowerCase()) ||
          sanctuary.owner.first_name.toLowerCase().includes(sanctuarySearchTerm.toLowerCase()) ||
          sanctuary.owner.last_name.toLowerCase().includes(sanctuarySearchTerm.toLowerCase()),
      )
    }

    setFilteredSanctuaries(filtered)
  }, [sanctuarySearchTerm, sanctuaries])

  // Emotional-tone filters from the prototype: only tones that at least one
  // ritual is actually tagged with are offered, so a chip never dead-ends.
  const EMOTIONAL_TONES = ["Grounding", "Expansive", "Reflective", "Comforting", "Awakening"]
  const availableTones = EMOTIONAL_TONES.filter((tone) =>
    rituals.some((ritual) =>
      ritual.tags.some((tag) => (typeof tag === "string" ? tag : tag.name).toLowerCase() === tone.toLowerCase())
    )
  )

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
        return "bg-green-100 text-green-800 border-green-200 dark:bg-green-900 dark:text-green-200"
      case "level2":
        return "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900 dark:text-yellow-200"
      case "level3":
        return "bg-red-100 text-red-800 border-red-200 dark:bg-red-900 dark:text-red-200"
      default:
        return "bg-muted text-muted-foreground border-border"
    }
  }

  const handleViewSanctuaryDetail = (id: number) => {
    router.push(`/member/sanctuaries/${id}`)
  }

  const handleJoinSanctuary = async (id: number) => {
    const sanctuary = sanctuaries.find((s) => s.id === id)
    if (sanctuary) {
      setSelectedSanctuary(sanctuary)
      setJoinFormOpen(true)
    }
  }

  const handleSubmitJoinRequest = async (note?: string, inviteToken?: string) => {
    if (!selectedSanctuary) return

    try {
      // gateway_incomplete opens the finish-your-Gateway modal, then the join
      // is retried automatically once the user completes it.
      await runGatedAction(() =>
        sanctuariesService.requestJoin(selectedSanctuary.id, { note, invite_token: inviteToken }),
      )
      setJoinFormOpen(false)
      await loadSanctuaries()
    } catch (err) {
      if (err instanceof EntitlementDeniedError || err instanceof GatewayCancelledError) {
        // Either the upgrade modal is already open, or the user dismissed the
        // Gateway modal — close the join dialog quietly, no penalty.
        setJoinFormOpen(false)
        return
      }
      throw err
    }
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

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 lg:py-12">
        {/* Hero header */}
        <div className="text-center mb-10">
          <p className="text-sm uppercase tracking-widest text-gold-muted mb-3">
            {user ? trNode("Welcome back, {p0}", { p0: user.first_name }) : "Welcome Back"}
          </p>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2 text-balance">
            {tr("Your Sanctuary Awaits")}
          </h1>
          {/* Subscription badge */}
          {user && (
            <div className="flex items-center justify-center gap-2 mt-2 mb-3">
              <SubscriptionBadge
                plan={user.subscription_plan}
                status={user.subscription_status}
              />
            </div>
          )}
          <p className="text-muted-foreground max-w-md mx-auto">
            {tr("Choose what calls to you. There is no rush.")}
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 max-w-md mx-auto bg-secondary border border-border">
            <TabsTrigger value="sanctuaries" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Users className="w-4 h-4" />
              {tr("Sanctuaries")}
            </TabsTrigger>
            <TabsTrigger value="rituals" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Play className="w-4 h-4" />
              {tr("Rituals")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="sanctuaries" className="space-y-6">
            <SanctuaryLimitBanner />
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-foreground">
                  <Search className="w-5 h-5 text-primary" />
                  {tr("Discover Sanctuaries")}
                  <GaiaInfoTip infoKey="sanctuary.privacy" ariaLabel={tr("About sanctuary privacy")} />
                </CardTitle>
                <CardDescription>{tr("Find communities aligned with your spiritual practice")}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4">
                  <div className="flex-1">
                    <Input
                      placeholder={tr("Search sanctuaries, creators...")}
                      value={sanctuarySearchTerm}
                      onChange={(e) => setSanctuarySearchTerm(e.target.value)}
                      className="w-full bg-input border-border text-foreground placeholder:text-muted-foreground"
                    />
                  </div>
                  <Button variant="outline" className="flex items-center gap-2 bg-transparent border-border text-foreground hover:bg-secondary">
                    <Filter className="w-4 h-4" />
                    {tr("Filter")}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-semibold">
                  {trNode("{p0} {p1} Available", { p0: filteredSanctuaries.length, p1: filteredSanctuaries.length === 1 ? "Sanctuary" : "Sanctuaries" })}
                </h2>
              </div>

              {sanctuariesLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : filteredSanctuaries.length === 0 ? (
                <Card className="bg-card border-border">
                  <CardContent className="text-center py-12">
                    <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2 text-foreground">{tr("No sanctuaries found")}</h3>
                    <p className="text-muted-foreground">
                      {sanctuarySearchTerm ? "Try adjusting your search" : "Check back soon for new sanctuaries"}
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {filteredSanctuaries.map((sanctuary) => (
                    <SanctuaryCard
                      key={sanctuary.id}
                      sanctuary={sanctuary}
                      onViewDetail={handleViewSanctuaryDetail}
                      onJoin={handleJoinSanctuary}
                      showJoinButton={true}
                    />
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="rituals" className="space-y-6">
            <QuotaMeter />
            <Card className="mb-8 bg-card border-border">
              <CardContent className="pt-6 space-y-4">
                <div className="flex gap-4">
                  <div className="flex-1">
                    <Input
                      placeholder={tr("Search rituals, creators, or descriptions...")}
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full bg-input border-border text-foreground placeholder:text-muted-foreground"
                    />
                  </div>
                </div>

                {availableTones.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2 text-foreground inline-flex items-center gap-1.5">
                      {tr("Filter by emotional tone")}
                      <GaiaInfoTip infoKey="ritual.tags" ariaLabel={tr("About tag filters")} />
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Badge
                        variant={selectedTone === null ? "default" : "outline"}
                        className={`cursor-pointer ${selectedTone === null ? "bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:bg-secondary hover:text-secondary-foreground"}`}
                        onClick={() => setSelectedTone(null)}
                      >
                        {tr("All")}
                      </Badge>
                      {availableTones.map((tone) => (
                        <Badge
                          key={tone}
                          variant={selectedTone === tone ? "default" : "outline"}
                          className={`cursor-pointer ${selectedTone === tone ? "bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:bg-secondary hover:text-secondary-foreground"}`}
                          onClick={() => setSelectedTone(selectedTone === tone ? null : tone)}
                        >
                          {tone}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-semibold">
                  {trNode("{p0} Sacred {p1} Available", { p0: filteredRituals.length, p1: filteredRituals.length === 1 ? "Practice" : "Practices" })}
                </h2>
              </div>

              {ritualsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : filteredRituals.length === 0 ? (
                <Card className="bg-card border-border">
                  <CardContent className="text-center py-12">
                    <Heart className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2 text-foreground">{tr("No rituals found")}</h3>
                    <p className="text-muted-foreground">
                      {searchTerm || selectedTone
                        ? "Try adjusting your search or filters"
                        : "Check back soon for new sacred practices"}
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {(showAllRituals ? filteredRituals : filteredRituals.slice(0, 6)).map((ritual) => (
                    <Card
                      key={ritual.id}
                      className={`bg-card border transition-all duration-300 group ${
                        ritual.locked
                          ? "border-border/60 opacity-80 hover:opacity-100 hover:border-primary/30"
                          : "border-border hover:border-primary/40"
                      }`}
                    >
                      <CardContent className="py-5">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0 flex-1 space-y-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="outline" className={getCareLevelColor(ritual.care_level)}>
                                {getCareLevel(ritual.care_level)}
                              </Badge>
                              {ritual.locked && (
                                <Badge variant="outline" className="border-primary/40 text-primary bg-primary/10 flex items-center gap-1">
                                  <Lock className="w-3 h-3" />
                                  {tr("Locked")}
                                </Badge>
                              )}
                            </div>
                            <h3 className="text-lg font-semibold group-hover:text-primary transition-colors text-foreground">
                              {ritual.title}
                            </h3>
                            {ritual.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1.5">
                                {ritual.tags.slice(0, 2).map((tag) => {
                                  const tagName = typeof tag === "string" ? tag : tag.name
                                  const tagKey = typeof tag === "string" ? tag : tag.id
                                  return (
                                    <Badge key={tagKey} className="bg-secondary text-secondary-foreground text-xs border-0">
                                      {tagName}
                                    </Badge>
                                  )
                                })}
                              </div>
                            )}
                            <p className="text-sm text-muted-foreground">
                              {trNode("Created by {p0} {p1}", { p0: ritual.creator.first_name, p1: ritual.creator.last_name })}
                              {ritual.duration_seconds ? trNode(" · {p0} min", { p0: Math.round(ritual.duration_seconds / 60) }) : ""}
                            </p>
                            <CardDescription className="line-clamp-2">{ritual.description}</CardDescription>
                          </div>
                          <div className="flex shrink-0 items-center gap-2 sm:flex-col sm:items-end">
                            <ReportModal
                              contentType="ritual"
                              contentId={ritual.id}
                              contentTitle={ritual.title}
                            />
                            {ritual.locked ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-primary/40 text-primary bg-transparent hover:bg-primary/10"
                                onClick={() =>
                                  openUpgradeModal({
                                    reason: "care_level",
                                    current_plan: plan,
                                    required_plan: ritual.required_plan ?? "evocore",
                                  })
                                }
                              >
                                <Lock className="w-4 h-4 mr-2" />
                                {tr("Experience")}
                              </Button>
                            ) : (
                              <Button
                                asChild
                                size="sm"
                                className="bg-primary text-primary-foreground hover:bg-gold-muted"
                              >
                                <Link href={`/member/ritual/${ritual.id}`}>
                                  <Play className="w-4 h-4 mr-2" />
                                  {tr("Experience")}
                                </Link>
                              </Button>
                            )}
                          </div>
                        </div>
                        {ritual.locked && (
                          <p className="mt-3 text-xs text-primary/90">
                            {trNode("Unlocks with {p0}", { p0: planDisplayName(ritual.required_plan ?? "evocore") })}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                  {filteredRituals.length > 6 && (
                    <div className="space-y-2 pt-2 text-center">
                      <Button
                        variant="outline"
                        className="border-border bg-transparent text-foreground hover:bg-secondary"
                        onClick={() => setShowAllRituals((v) => !v)}
                      >
                        {showAllRituals ? tr("Show less") : tr("Show more rituals")}
                      </Button>
                      {!showAllRituals && (
                        <p className="text-sm text-muted-foreground">
                          {tr("Take your time exploring. More will appear when you need them.")}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        <BeginHere rituals={rituals} />

        <PremiumCTABanner />

        <div className="mx-auto max-w-md">
          <AccountAccessCard />
        </div>

        {selectedSanctuary && (
          <Dialog open={joinFormOpen} onOpenChange={setJoinFormOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{tr("Request to Join")}</DialogTitle>
                <DialogDescription>{selectedSanctuary.title}</DialogDescription>
              </DialogHeader>
              <JoinRequestForm
                sanctuaryId={selectedSanctuary.id}
                sanctuaryTitle={selectedSanctuary.title}
                onSubmit={handleSubmitJoinRequest}
                onSuccess={() => {
                  setJoinFormOpen(false)
                }}
              />
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  )
}

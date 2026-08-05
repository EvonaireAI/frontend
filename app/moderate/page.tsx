"use client"

import { Suspense, useCallback, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Loader2, Shield } from "lucide-react"
import { authService, type User } from "@/lib/auth"
import { isGuardian, isSteward } from "@/lib/roles"
import { GLOSSARY } from "@/lib/glossary"
import { moderationService } from "@/lib/moderation"
import { adminService } from "@/lib/admin"
import type { GuardianOption } from "@/components/moderation/case-actions"
import { DEFAULT_GUARDIAN_TAB, GUARDIAN_TABS, isGuardianTab, type GuardianTab } from "@/components/moderation/guardian/tabs"
import { OverviewTab } from "@/components/moderation/guardian/overview-tab"
import { PendingTab } from "@/components/moderation/guardian/pending-tab"
import { ActiveTab } from "@/components/moderation/guardian/active-tab"
import { CareFeedTab } from "@/components/moderation/guardian/care-feed-tab"
import { RtsTab } from "@/components/moderation/guardian/rts-tab"
import { SanctuariesTab } from "@/components/moderation/guardian/sanctuaries-tab"
import { SacredLibraryTab } from "@/components/moderation/guardian/sacred-library-tab"
import { HistoryTab } from "@/components/moderation/guardian/history-tab"

// The Guardian Dashboard: one tabbed workspace, every section deep-linkable as
// `/moderate?tab=<id>`. That matches how the Steward Console addresses its own
// tabs — one pattern across both consoles, not a third.

function GuardianWorkspace() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [guardians, setGuardians] = useState<GuardianOption[]>([])

  const requestedTab = searchParams.get("tab")
  const activeTab: GuardianTab = isGuardianTab(requestedTab) ? requestedTab : DEFAULT_GUARDIAN_TAB

  const setTab = useCallback(
    (tab: string) => {
      router.replace(tab === DEFAULT_GUARDIAN_TAB ? "/moderate" : `/moderate?tab=${tab}`, { scroll: false })
    },
    [router],
  )

  useEffect(() => {
    const load = async () => {
      try {
        if (!authService.isAuthenticated()) {
          router.push("/auth/login")
          return
        }

        const profile = await authService.getProfile()
        if (!isGuardian(profile.role)) {
          router.push("/dashboard")
          return
        }
        setUser(profile)
      } catch (error) {
        console.error("Failed to load the guardian profile:", error)
        router.push("/auth/login")
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [router])

  // There is no guardian-directory endpoint, so the delegate picker is
  // assembled from what the viewer can already see: the full roster for a
  // steward (Trust & Care reports it), or whoever currently holds an active
  // case for a guardian. `400 not_a_guardian` prunes anyone stale.
  useEffect(() => {
    if (!user) return
    let cancelled = false

    const loadGuardians = async () => {
      try {
        if (isSteward(user.role)) {
          const trustCare = await adminService.getTrustCare(30)
          if (cancelled) return
          setGuardians(
            trustCare.guardian_workload.map((row) => ({ id: row.guardian_id, email: row.guardian_email })),
          )
          return
        }

        const active = await moderationService.listCases({ stage: "active" })
        if (cancelled) return
        const seen = new Map<number, GuardianOption>()
        for (const item of active.results) {
          if (item.assigned_moderator && item.assigned_moderator_email) {
            seen.set(item.assigned_moderator, { id: item.assigned_moderator, email: item.assigned_moderator_email })
          }
        }
        setGuardians([...seen.values()])
      } catch {
        // Delegation is optional — a guardian can always take the case instead.
        if (!cancelled) setGuardians([])
      }
    }

    loadGuardians()
    return () => {
      cancelled = true
    }
  }, [user])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-accent/5">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-3xl font-bold text-foreground sm:text-4xl">
              <Shield className="h-7 w-7 text-primary" />
              {GLOSSARY.guardianDashboard}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Protecting cultural safety and emotional wellbeing.
            </p>
          </div>
          {isSteward(user.role) && <Badge variant="outline">Viewing as steward</Badge>}
        </div>

        <Tabs value={activeTab} onValueChange={setTab} className="space-y-6">
          {/* The tab bar scrolls sideways rather than wrapping or clipping on
              a 375px viewport. */}
          <div className="-mx-4 overflow-x-auto px-4 pb-1">
            <TabsList className="inline-flex w-max">
              {GUARDIAN_TABS.map((tab) => (
                <TabsTrigger key={tab.id} value={tab.id} className="whitespace-nowrap">
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <TabsContent value="overview">
            <OverviewTab onNavigate={setTab} />
          </TabsContent>
          <TabsContent value="pending">
            <PendingTab guardians={guardians} />
          </TabsContent>
          <TabsContent value="active">
            <ActiveTab guardians={guardians} />
          </TabsContent>
          <TabsContent value="care-feed">
            <CareFeedTab />
          </TabsContent>
          <TabsContent value="rts">
            <RtsTab />
          </TabsContent>
          <TabsContent value="sanctuaries">
            <SanctuariesTab />
          </TabsContent>
          <TabsContent value="library">
            <SacredLibraryTab />
          </TabsContent>
          <TabsContent value="history">
            <HistoryTab guardians={guardians} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

export default function GuardianDashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <GuardianWorkspace />
    </Suspense>
  )
}

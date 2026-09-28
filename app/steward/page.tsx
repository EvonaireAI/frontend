"use client"

import { Suspense, useCallback, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Loader2, Shield } from "lucide-react"
import { authService, type User } from "@/lib/auth"
import { isSteward } from "@/lib/roles"
import { GLOSSARY } from "@/lib/glossary"
import { ConfigForm } from "@/components/rts/config-form"
import {
  DEFAULT_STEWARD_CONSOLE_TAB,
  STEWARD_CONSOLE_TABS,
  normalizeStewardConsoleTab,
  type StewardConsoleTab,
} from "@/components/steward/console/tabs"
import { usePlatformOverview } from "@/components/admin/console/use-platform-overview"
import { PlatformOverviewTab } from "@/components/admin/console/platform-overview-tab"
import { StewardRequestsTab } from "@/components/admin/console/steward-requests-tab"
import { TrustCareTab } from "@/components/admin/console/trust-care-tab"
import { MembershipsTab } from "@/components/admin/console/memberships-tab"
import { EarningsTab } from "@/components/admin/console/earnings-tab"
import { CommonsTab } from "@/components/admin/console/commons-tab"
import { IntelligenceTab } from "@/components/admin/console/intelligence-tab"
import { ArchiveTab } from "@/components/admin/console/archive-tab"
import { PlatformConfigTab } from "@/components/admin/console/platform-config-tab"

function StewardWorkspace() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const requestedTab = searchParams.get("tab")
  const activeTab: StewardConsoleTab =
    normalizeStewardConsoleTab(requestedTab) ?? DEFAULT_STEWARD_CONSOLE_TAB

  const setTab = useCallback(
    (tab: string) => {
      const normalized = normalizeStewardConsoleTab(tab) ?? DEFAULT_STEWARD_CONSOLE_TAB
      router.replace(
        normalized === DEFAULT_STEWARD_CONSOLE_TAB ? "/steward" : `/steward?tab=${normalized}`,
        { scroll: false },
      )
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
        if (!isSteward(profile.role)) {
          router.push("/dashboard")
          return
        }
        setUser(profile)
      } catch (error) {
        console.error("Failed to load the steward profile:", error)
        router.push("/auth/login")
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [router])

  const overviewState = usePlatformOverview()
  const pendingTotal = overviewState.overview?.pending_reviews.total ?? null

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
            <h1 className="flex flex-wrap items-center gap-2 text-3xl font-bold text-foreground sm:text-4xl">
              <Shield className="h-7 w-7 text-primary" />
              {GLOSSARY.stewardDashboard}
              {pendingTotal !== null && pendingTotal > 0 && (
                <Badge className="text-sm">{pendingTotal.toLocaleString()} pending</Badge>
              )}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Platform health, trust, and the record of what happened.
            </p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setTab} className="space-y-10">
          <div className="-mx-4 overflow-x-auto px-4 pb-1">
            <TabsList className="w-full">
              {STEWARD_CONSOLE_TABS.map((tab) => (
                <TabsTrigger key={tab.id} value={tab.id} className="whitespace-nowrap">
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <TabsContent value="overview">
            <PlatformOverviewTab {...overviewState} onNavigate={setTab} />
          </TabsContent>
          <TabsContent value="requests">
            <StewardRequestsTab />
          </TabsContent>
          <TabsContent value="trust-care">
            <TrustCareTab consoleBasePath="/steward" />
          </TabsContent>
          <TabsContent value="resonance">
            <ConfigForm />
          </TabsContent>
          <TabsContent value="memberships">
            <MembershipsTab {...overviewState} />
          </TabsContent>
          <TabsContent value="earnings">
            <EarningsTab />
          </TabsContent>
          <TabsContent value="symposium">
            <CommonsTab />
          </TabsContent>
          <TabsContent value="intelligence">
            <IntelligenceTab />
          </TabsContent>
          <TabsContent value="archive">
            <ArchiveTab />
          </TabsContent>
          <TabsContent value="configuration">
            <PlatformConfigTab onNavigate={setTab} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

export default function StewardDashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <StewardWorkspace />
    </Suspense>
  )
}

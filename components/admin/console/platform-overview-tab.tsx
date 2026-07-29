"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Activity, ArrowRight, Coins, Heart, RefreshCw, Users } from "lucide-react"
import { centsToDollarString } from "@/lib/metrics"
import type { PlatformOverviewState } from "./use-platform-overview"
import type { StewardTab } from "./tabs"

// `GET /api/admin/overview/` answers the CEO's five questions in one request —
// so this tab makes exactly one call and maps the five payload keys to five
// card groups. Don't fan out to the per-domain endpoints here; `memberships`
// is verbatim the payments metrics overview.

interface PlatformOverviewTabProps extends PlatformOverviewState {
  onNavigate: (tab: StewardTab) => void
}

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums text-foreground">
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

export function PlatformOverviewTab({
  overview: data,
  loading,
  error,
  reload: load,
  onNavigate,
}: PlatformOverviewTabProps) {
  const router = useRouter()

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-56 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <Alert variant="destructive">
        <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
          <span>{error ?? "The platform overview is unavailable."}</span>
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  const health = data.platform_health
  const pending = data.pending_reviews
  const royalties = data.royalties
  const community = data.community
  const memberships = data.memberships

  // Each counter goes where the rows actually live — some of those are Guardian
  // tabs, because stewards oversee here and act there.
  const pendingRows: Array<{ label: string; value: number; go: () => void }> = [
    { label: "Steward requests", value: pending.role_requests, go: () => onNavigate("requests") },
    { label: "Care cases", value: pending.care_cases, go: () => router.push("/moderate?tab=pending") },
    { label: "Rituals", value: pending.rituals, go: () => router.push("/moderate?tab=library") },
    { label: "Commons listings", value: pending.commons_listings, go: () => onNavigate("commons") },
    { label: "Agora content", value: pending.agora_content, go: () => onNavigate("trust-care") },
    { label: "Royalty periods", value: pending.royalty_periods, go: () => onNavigate("earnings") },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">As of {new Date(data.as_of).toLocaleString()}</p>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-5 w-5 text-primary" />
            Platform health
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Members" value={health.members_total} hint={`${health.members_active.toLocaleString()} active · +${health.members_joined_7d.toLocaleString()} in 7d`} />
            <Stat label="Creators" value={health.creators_active} />
            <Stat label="Guardians" value={health.guardians_active} hint={`${health.stewards_active.toLocaleString()} stewards`} />
            <Stat label="Sanctuaries" value={health.sanctuaries_active} />
            <Stat label="Rituals approved" value={health.rituals_approved} />
            <Stat label="Listings published" value={health.listings_published} />
            <Stat label="Live care cases" value={health.care_cases_live} hint={`${health.escalations_open.toLocaleString()} open escalations`} />
            <Stat label="Open RTS interventions" value={health.rts_interventions_open} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base">Pending reviews</CardTitle>
              <CardDescription>Everything waiting on a human decision.</CardDescription>
            </div>
            <Badge variant={pending.total > 0 ? "default" : "outline"} className="text-sm">
              {pending.total.toLocaleString()} total
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {pendingRows.map((row) => (
              <button
                key={row.label}
                type="button"
                onClick={row.go}
                className="flex items-center justify-between rounded-lg border border-border p-3 text-left transition-colors hover:border-primary/40"
              >
                <span className="text-sm text-foreground">{row.label}</span>
                <span className="flex items-center gap-2 font-semibold tabular-nums">
                  {row.value.toLocaleString()}
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="h-5 w-5 text-primary" />
                Memberships
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => onNavigate("memberships")}>
                Details
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <Stat label="MRR" value={centsToDollarString(memberships.mrr_cents ?? 0)} />
              <Stat label="Active subscriptions" value={memberships.active_subscriptions ?? 0} />
              <Stat label="ARPU" value={centsToDollarString(memberships.arpu_cents ?? 0)} />
            </div>
            {Array.isArray(memberships.by_plan) && memberships.by_plan.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {memberships.by_plan.map((plan, index) => (
                  <Badge key={`${plan.plan ?? plan.plan_name ?? index}`} variant="outline" className="text-xs capitalize">
                    {(plan.plan_name ?? plan.plan ?? "plan").toString().replace(/_/g, " ")} · {plan.count.toLocaleString()}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Coins className="h-5 w-5 text-primary" />
                Royalties
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => onNavigate("earnings")}>
                Details
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {royalties.shadow_mode && (
              <Alert>
                <AlertDescription className="text-sm">
                  <strong>Shadow mode is on — no money is moving.</strong> Earnings are computed and recorded, but
                  nothing is paid out.
                </AlertDescription>
              </Alert>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <Stat
                label="Current period"
                value={
                  royalties.current_period
                    ? `${royalties.current_period.period} · ${royalties.current_period.status}`
                    : "Not yet computed"
                }
                hint={royalties.current_period ? undefined : `Period ${royalties.current_period_key ?? "—"} has no row yet`}
              />
              <Stat label="Awaiting approval" value={royalties.periods_awaiting_approval} />
              <Stat
                label="Outstanding to creators"
                value={centsToDollarString(royalties.outstanding_creator_balance_cents)}
                hint="Earned, not yet paid out"
              />
              <Stat label="Minimum payout" value={centsToDollarString(royalties.minimum_payout_cents)} />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Heart className="h-5 w-5 text-primary" />
            Community — last 7 days
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Stat label="Care cases opened" value={community.care_cases_opened_7d} />
            <Stat label="Care cases resolved" value={community.care_cases_resolved_7d} />
            <Stat label="Member reports" value={community.member_reports_7d} />
            <Stat label="Agora care flags" value={community.agora_care_flags_7d} />
            <Stat label="RTS care flags" value={community.rts_care_flags_7d} />
            <Stat label="Blessings" value={community.blessings_7d} />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Individual cases are worked in the{" "}
            <Link href="/moderate?tab=pending" className="text-primary hover:underline">
              Guardian Dashboard
            </Link>
            .
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

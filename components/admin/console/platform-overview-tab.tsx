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
import { fmtLocale, tr, trNode } from "@/lib/i18n"


// `GET /api/admin/overview/` answers the CEO's five questions in one request —
// so this tab makes exactly one call and maps the five payload keys to five
// card groups. Don't fan out to the per-domain endpoints here; `memberships`
// is verbatim the payments metrics overview.

interface PlatformOverviewTabProps extends PlatformOverviewState {
  onNavigate: (tab: StewardTab) => void
  /** When false, omit links into the Guardian Dashboard (steward workspace). */
  includeGuardianLinks?: boolean
}

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums text-foreground">
        {typeof value === "number" ? value.toLocaleString(fmtLocale()) : value}
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
  includeGuardianLinks = false,
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
            {tr("Retry")}
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
  // tabs, because stewards oversee here and act there. A counter with no `go`
  // has no review surface yet and must not pretend otherwise.
  const pendingRows: Array<{ label: string; value: number; go?: () => void; note?: string }> = [
    { label: tr("Steward requests"), value: pending.role_requests, go: () => onNavigate("requests") },
    {
      label: tr("Care cases"),
      value: pending.care_cases,
      go: includeGuardianLinks ? () => router.push("/moderate?tab=pending") : undefined,
    },
    {
      label: tr("Rituals"),
      value: pending.rituals,
      go: includeGuardianLinks ? () => router.push("/moderate?tab=library") : undefined,
    },
    { label: tr("Symposium listings"), value: pending.commons_listings, go: () => onNavigate("commons") },
    { label: tr("Agora content"), value: pending.agora_content, go: () => onNavigate("trust-care") },
    { label: tr("Royalty periods"), value: pending.royalty_periods, go: () => onNavigate("earnings") },
  ]

  // Session 12 counts warning-level abuse flags here. They carry no
  // `ModerationCase`, so they are NOT in the Guardian queues and there is no
  // review surface for them yet — counted honestly, linked nowhere.
  if (typeof pending.content_protection_flags === "number") {
    pendingRows.push({
      label: tr("Content protection flags"),
      value: pending.content_protection_flags,
      note: tr("Review queue ships with Content Protection"),
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{trNode("As of {p0}", { p0: new Date(data.as_of).toLocaleString(fmtLocale()) })}</p>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="mr-2 h-4 w-4" />
          {tr("Refresh")}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-5 w-5 text-primary" />
            {tr("Platform health")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label={tr("Members")} value={health.members_total} hint={`${health.members_active.toLocaleString(fmtLocale())} active · +${health.members_joined_7d.toLocaleString(fmtLocale())} in 7d`} />
            <Stat label={tr("Creators")} value={health.creators_active} />
            <Stat label={tr("Guardians")} value={health.guardians_active} hint={`${health.stewards_active.toLocaleString(fmtLocale())} stewards`} />
            <Stat label={tr("Sanctuaries")} value={health.sanctuaries_active} />
            <Stat label={tr("Rituals approved")} value={health.rituals_approved} />
            <Stat label={tr("Listings published")} value={health.listings_published} />
            <Stat label={tr("Live care cases")} value={health.care_cases_live} hint={tr("{p0} open escalations", { p0: health.escalations_open.toLocaleString(fmtLocale()) })} />
            <Stat label={tr("Open RTS interventions")} value={health.rts_interventions_open} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base">{tr("Pending reviews")}</CardTitle>
              <CardDescription>{tr("Everything waiting on a human decision.")}</CardDescription>
            </div>
            <Badge variant={pending.total > 0 ? "default" : "outline"} className="text-sm">
              {trNode("{p0} total", { p0: pending.total.toLocaleString(fmtLocale()) })}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {pendingRows.map((row) =>
              row.go ? (
                <button
                  key={row.label}
                  type="button"
                  onClick={row.go}
                  className="flex items-center justify-between rounded-lg border border-border p-3 text-left transition-colors hover:border-primary/40"
                >
                  <span className="text-sm text-foreground">{row.label}</span>
                  <span className="flex items-center gap-2 font-semibold tabular-nums">
                    {row.value.toLocaleString(fmtLocale())}
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </span>
                </button>
              ) : (
                <div
                  key={row.label}
                  className="flex items-center justify-between rounded-lg border border-dashed border-border p-3"
                >
                  <span className="min-w-0 text-sm text-foreground">
                    {row.label}
                    {row.note && <span className="block text-xs text-muted-foreground">{row.note}</span>}
                  </span>
                  <span className="font-semibold tabular-nums">{row.value.toLocaleString(fmtLocale())}</span>
                </div>
              ),
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="h-5 w-5 text-primary" />
                {tr("Memberships")}
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => onNavigate("memberships")}>
                {tr("Details")}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <Stat label={tr("MRR")} value={centsToDollarString(memberships.mrr_cents ?? 0)} />
              <Stat label={tr("Active subscriptions")} value={memberships.active_subscriptions ?? 0} />
              <Stat label="ARPU" value={centsToDollarString(memberships.arpu_cents ?? 0)} />
            </div>
            {Array.isArray(memberships.by_plan) && memberships.by_plan.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {memberships.by_plan.map((plan, index) => (
                  <Badge key={`${plan.plan ?? plan.plan_name ?? index}`} variant="outline" className="text-xs capitalize">
                    {(plan.plan_name ?? plan.plan ?? "plan").toString().replace(/_/g, " ")} · {plan.count.toLocaleString(fmtLocale())}
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
                {tr("Royalties")}
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => onNavigate("earnings")}>
                {tr("Details")}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {royalties.shadow_mode && (
              <Alert>
                <AlertDescription className="text-sm">
                  <strong>{tr("Shadow mode is on — no money is moving.")}</strong>{tr(" Earnings are computed and recorded, but nothing is paid out.")}
                </AlertDescription>
              </Alert>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <Stat
                label={tr("Current period")}
                value={
                  royalties.current_period
                    ? `${royalties.current_period.period} · ${royalties.current_period.status}`
                    : "Not yet computed"
                }
                hint={royalties.current_period ? undefined : tr("Period {p0} has no row yet", { p0: royalties.current_period_key ?? "—" })}
              />
              <Stat label={tr("Awaiting approval")} value={royalties.periods_awaiting_approval} />
              <Stat
                label={tr("Outstanding to creators")}
                value={centsToDollarString(royalties.outstanding_creator_balance_cents)}
                hint={tr("Earned, not yet paid out")}
              />
              <Stat label={tr("Minimum payout")} value={centsToDollarString(royalties.minimum_payout_cents)} />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Heart className="h-5 w-5 text-primary" />
            {tr("Community — last 7 days")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Stat label={tr("Care cases opened")} value={community.care_cases_opened_7d} />
            <Stat label={tr("Care cases resolved")} value={community.care_cases_resolved_7d} />
            <Stat label={tr("Member reports")} value={community.member_reports_7d} />
            <Stat label={tr("Agora care flags")} value={community.agora_care_flags_7d} />
            <Stat label={tr("RTS care flags")} value={community.rts_care_flags_7d} />
            <Stat label={tr("Blessings")} value={community.blessings_7d} />
          </div>
          {includeGuardianLinks ? (
            <p className="mt-3 text-xs text-muted-foreground">
              {tr("Individual cases are worked in the ")}
              <Link href="/moderate?tab=pending" className="text-primary hover:underline">
                {tr("Guardian Dashboard")}
              </Link>
              .
            </p>
          ) : (
            <p className="mt-3 text-xs text-muted-foreground">
              {tr("Care case counts reflect guardian queue activity; stewards review aggregates here in Trust & Care.")}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

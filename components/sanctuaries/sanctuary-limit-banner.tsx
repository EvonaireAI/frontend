"use client"

import { useEntitlements } from "@/lib/entitlements-context"
import { nextPlanUp, planDisplayName, getPlanEntitlements } from "@/lib/plans"
import { Sparkles } from "lucide-react"
import Link from "next/link"

// Shown on sanctuary browse/join surfaces when the user is at their plan's
// sanctuary cap. Join buttons stay enabled — the structured 403 from the
// backend drives the upgrade modal; this banner just sets expectations.
export function SanctuaryLimitBanner() {
  const { entitlements, plan, planName } = useEntitlements()
  const usage = entitlements?.usage

  if (!usage || usage.sanctuaries_limit === null || usage.sanctuaries_used < usage.sanctuaries_limit) {
    return null
  }

  const limit = usage.sanctuaries_limit
  const upgradePlan = nextPlanUp(plan)
  const upgradeName = planDisplayName(upgradePlan)
  const upgradeMax = getPlanEntitlements(upgradePlan).max_sanctuaries

  return (
    <div className="flex items-center justify-between gap-4 flex-wrap rounded-xl border border-primary/30 bg-primary/5 px-5 py-4 mb-6">
      <p className="text-sm text-foreground">
        Your {planName} plan includes {limit} {limit === 1 ? "sanctuary" : "sanctuaries"}. Upgrade
        to {upgradeName} to join{" "}
        {upgradeMax === null ? "unlimited sanctuaries" : `up to ${upgradeMax}`}.
      </p>
      <Link
        href="/member/upgrade"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-gold-muted transition-colors flex-shrink-0"
      >
        <Sparkles className="w-3.5 h-3.5" />
        View plans
      </Link>
    </div>
  )
}

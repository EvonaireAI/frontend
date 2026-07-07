"use client"

import { format } from "date-fns"
import { Progress } from "@/components/ui/progress"
import { useEntitlements } from "@/lib/entitlements-context"
import { openUpgradeModal } from "@/lib/entitlements"
import { nextPlanUp, planDisplayName } from "@/lib/plans"
import { Sparkles } from "lucide-react"

// Monthly Level-1 play quota meter. Only rendered for plans with a finite
// quota (paid plans have limit === null and show nothing).
export function QuotaMeter({ className = "" }: { className?: string }) {
  const { entitlements, plan } = useEntitlements()
  const usage = entitlements?.usage

  if (!usage || usage.level1_plays_limit === null) {
    return null
  }

  const used = usage.level1_plays_used
  const limit = usage.level1_plays_limit
  const atLimit = used >= limit
  const resets = usage.quota_resets_at
    ? format(new Date(usage.quota_resets_at), "MMMM d")
    : null
  const upgradeName = planDisplayName(nextPlanUp(plan))

  return (
    <div
      className={`rounded-xl border px-5 py-4 ${
        atLimit ? "border-primary/40 bg-primary/5" : "border-border bg-card"
      } ${className}`}
    >
      <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
        <p className="text-sm font-medium text-foreground">
          {used} of {limit} free rituals this month
        </p>
        {resets && <p className="text-xs text-muted-foreground">Resets {resets}</p>}
      </div>
      <Progress value={Math.min((used / limit) * 100, 100)} className="h-2" />
      {atLimit && (
        <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm text-muted-foreground">
            You&apos;ve used all {limit} free rituals this month — upgrade to {upgradeName} for
            unlimited.
          </p>
          <button
            onClick={() =>
              openUpgradeModal({
                reason: "quota_exceeded",
                current_plan: plan,
                required_plan: nextPlanUp(plan),
                quota: usage.quota_resets_at
                  ? { used, limit, resets_at: usage.quota_resets_at }
                  : undefined,
              })
            }
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-gold-muted transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Upgrade
          </button>
        </div>
      )}
    </div>
  )
}

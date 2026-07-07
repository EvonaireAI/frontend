"use client"

import { useEffect, useState } from "react"
import { format } from "date-fns"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { onEntitlementDenial, type EntitlementDenial } from "@/lib/entitlements"
import {
  planDisplayName,
  getPlanEntitlements,
  formatLimit,
  formatCareLevelAccess,
  PLAN_PRICES,
  type PlanKey,
} from "@/lib/plans"
import { paymentService } from "@/lib/payments"
import { Loader2, Lock, Sparkles } from "lucide-react"

function denialTitle(denial: EntitlementDenial): string {
  switch (denial.reason) {
    case "care_level":
      return `This ritual is part of the ${planDisplayName(denial.required_plan)} tier.`
    case "quota_exceeded":
      return "You've reached your monthly ritual limit"
    case "sanctuary_limit":
      return "You've reached your plan's sanctuary limit."
  }
}

function denialBody(denial: EntitlementDenial): string {
  const requiredName = planDisplayName(denial.required_plan)
  switch (denial.reason) {
    case "care_level":
      return `Upgrade to ${requiredName} to experience this ritual and everything else in the tier.`
    case "quota_exceeded": {
      if (denial.quota) {
        const resets = format(new Date(denial.quota.resets_at), "MMMM d, yyyy")
        return `You've used ${denial.quota.used} of ${denial.quota.limit} free rituals this month. Resets ${resets}.`
      }
      return `Upgrade to ${requiredName} for unlimited rituals.`
    }
    case "sanctuary_limit":
      return `Upgrade to ${requiredName} to join more sanctuaries.`
  }
}

// Compact current-vs-required comparison rows derived from the shared
// entitlements matrix.
function comparisonRows(currentPlan: string, requiredPlan: string) {
  const current = getPlanEntitlements(currentPlan)
  const required = getPlanEntitlements(requiredPlan)
  return [
    {
      label: "Ritual library",
      current: formatCareLevelAccess(current.max_care_level),
      required: formatCareLevelAccess(required.max_care_level),
    },
    {
      label: "Monthly plays",
      current:
        current.monthly_level1_play_quota === null
          ? "Unlimited"
          : `${current.monthly_level1_play_quota}/month`,
      required:
        required.monthly_level1_play_quota === null
          ? "Unlimited"
          : `${required.monthly_level1_play_quota}/month`,
    },
    {
      label: "Sanctuaries",
      current: formatLimit(current.max_sanctuaries),
      required: formatLimit(required.max_sanctuaries),
    },
  ]
}

export function UpgradeModalHost() {
  const [denial, setDenial] = useState<EntitlementDenial | null>(null)
  const [open, setOpen] = useState(false)
  const [checkoutLoading, setCheckoutLoading] = useState(false)

  useEffect(() => {
    return onEntitlementDenial((d) => {
      setDenial(d)
      setOpen(true)
    })
  }, [])

  if (!denial) return null

  const requiredPlan = denial.required_plan as PlanKey
  const requiredName = planDisplayName(requiredPlan)
  const currentName = planDisplayName(denial.current_plan)
  const rows = comparisonRows(denial.current_plan, denial.required_plan)
  const price = PLAN_PRICES[requiredPlan]

  const handleUpgrade = async () => {
    setCheckoutLoading(true)
    try {
      const session = await paymentService.createCheckoutSession(requiredPlan)
      if (session.session_url) {
        window.location.href = session.session_url
      } else {
        throw new Error("No checkout URL received")
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start checkout")
      setCheckoutLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md bg-card border-border">
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Lock className="h-5 w-5 text-primary" />
          </div>
          <DialogTitle className="text-center text-foreground">{denialTitle(denial)}</DialogTitle>
          <DialogDescription className="text-center">{denialBody(denial)}</DialogDescription>
        </DialogHeader>

        {/* Compact plan comparison */}
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/40">
                <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground" />
                <th className="px-3 py-2.5 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {currentName}
                </th>
                <th className="px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wider text-primary">
                  {requiredName}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row) => (
                <tr key={row.label}>
                  <td className="px-4 py-2.5 text-muted-foreground">{row.label}</td>
                  <td className="px-3 py-2.5 text-center text-muted-foreground">{row.current}</td>
                  <td className="px-3 py-2.5 text-center font-medium text-foreground">{row.required}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="space-y-2">
          <Button
            onClick={handleUpgrade}
            disabled={checkoutLoading}
            className="w-full h-11 bg-primary text-primary-foreground hover:bg-gold-muted font-semibold"
          >
            {checkoutLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Processing…
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Upgrade to {requiredName}{price !== undefined ? ` — $${price}/mo` : ""}
              </>
            )}
          </Button>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={checkoutLoading}
            className="w-full h-11 bg-transparent border-border text-muted-foreground hover:bg-secondary"
          >
            Maybe later
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

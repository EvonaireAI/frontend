"use client"

import { useEffect, useState } from "react"

import { toast } from "sonner"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { onEntitlementDenial, type EntitlementDenial } from "@/lib/entitlements"
import {
  planDisplayName,
  getPlanEntitlements,
  formatLimit,
  formatCareLevelAccess,
  formatAgoraAccess,
  PLAN_PRICES,
  type PlanKey,
} from "@/lib/plans"
import { paymentService } from "@/lib/payments"
import { isAllowedExternalUrl } from "@/lib/external-navigation"
import { runGatedAction, GatewayCancelledError } from "@/lib/gateway-quiz"
import { Loader2, Lock, Sparkles } from "lucide-react"
import { formatDate,tr, trNode  } from "@/lib/i18n"


function denialTitle(denial: EntitlementDenial): string {
  switch (denial.reason) {
    case "care_level":
      return tr("This ritual is part of the {p0} tier.", { p0: planDisplayName(denial.required_plan) })
    case "quota_exceeded":
      return tr("You've reached your monthly ritual limit")
    case "sanctuary_limit":
      return tr("You've reached your plan's sanctuary limit.")
    case "agora_tier":
      return denial.required_plan === "evobloom"
        ? tr("Hosting circles is part of the Scholar tier.")
        : tr("Joining discussions is part of the {p0} tier.", { p0: planDisplayName(denial.required_plan) })
  }
}

function denialBody(denial: EntitlementDenial): string {
  const requiredName = planDisplayName(denial.required_plan)
  switch (denial.reason) {
    case "care_level":
      return tr("Upgrade to {p0} to experience this ritual and everything else in the tier.", { p0: requiredName })
    case "quota_exceeded": {
      if (denial.quota) {
        const resets = formatDate(new Date(denial.quota.resets_at), "MMMM d, yyyy")
        return tr("You've used {p0} of {p1} free rituals this month. Resets {p2}.", { p0: denial.quota.used, p1: denial.quota.limit, p2: resets })
      }
      return tr("Upgrade to {p0} for unlimited rituals.", { p0: requiredName })
    }
    case "sanctuary_limit":
      return tr("Upgrade to {p0} to join more sanctuaries.", { p0: requiredName })
    case "agora_tier":
      return denial.required_plan === "evobloom"
        ? tr("Upgrade to {p0} to host your own discussion circles.", { p0: requiredName })
        : tr("Upgrade to {p0} to post and reply in sanctuary circles.", { p0: requiredName })
  }
}

// Compact current-vs-required comparison rows derived from the shared
// entitlements matrix.
function comparisonRows(currentPlan: string, requiredPlan: string) {
  const current = getPlanEntitlements(currentPlan)
  const required = getPlanEntitlements(requiredPlan)
  return [
    {
      label: tr("Ritual library"),
      current: formatCareLevelAccess(current.max_care_level),
      required: formatCareLevelAccess(required.max_care_level),
    },
    {
      label: tr("Monthly plays"),
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
      label: tr("Sanctuaries"),
      current: formatLimit(current.max_sanctuaries),
      required: formatLimit(required.max_sanctuaries),
    },
    {
      label: tr("Agora circles"),
      current: formatAgoraAccess(current.agora),
      required: formatAgoraAccess(required.agora),
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
      // gateway_incomplete finishes the Gateway inline, then retries checkout.
      const session = await runGatedAction(() => paymentService.createCheckoutSession(requiredPlan))
      if (isAllowedExternalUrl(session.session_url)) {
        window.location.href = session.session_url
      } else {
        throw new Error(tr("Checkout returned an unexpected URL"))
      }
    } catch (err) {
      if (err instanceof GatewayCancelledError) {
        // User dismissed the Gateway modal — no penalty, just stop.
        setCheckoutLoading(false)
        return
      }
      toast.error(err instanceof Error ? err.message : tr("Failed to start checkout"))
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
                {tr("Processing…")}
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                {trNode("Upgrade to {p0}{p1}", { p0: requiredName, p1: price !== undefined ? ` — $${price}/mo` : "" })}
              </>
            )}
          </Button>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={checkoutLoading}
            className="w-full h-11 bg-transparent border-border text-muted-foreground hover:bg-secondary"
          >
            {tr("Maybe later")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

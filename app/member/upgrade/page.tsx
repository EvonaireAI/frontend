"use client"

import { useState } from "react"
import Link from "next/link"
import { paymentService } from "@/lib/payments"
import { useEntitlements } from "@/lib/entitlements-context"
import {
  PRICING_PLANS,
  PLAN_PRICES,
  PLAN_ENTITLEMENTS,
  planDisplayName,
  formatLimit,
  formatCareLevelAccess,
  formatHistoryDays,
  type PlanKey,
  type PlanEntitlements,
} from "@/lib/plans"
import { Check, Loader2, ArrowLeft } from "lucide-react"
import { toast } from "sonner"

// Rows of the approved pricing matrix. Values derive from the shared
// entitlements table — no per-plan copy is hardcoded here.
const MATRIX_ROWS: Array<{
  label: string
  value: (e: PlanEntitlements) => string | boolean
}> = [
  { label: "Ritual library access", value: (e) => formatCareLevelAccess(e.max_care_level) },
  {
    label: "Monthly ritual plays",
    value: (e) =>
      e.monthly_level1_play_quota === null
        ? "Unlimited"
        : `${e.monthly_level1_play_quota} Level-1 rituals/month`,
  },
  { label: "Sanctuaries", value: (e) => formatLimit(e.max_sanctuaries) },
  {
    label: "Agora circles",
    value: (e) => e.agora.charAt(0).toUpperCase() + e.agora.slice(1),
  },
  { label: "Journal history", value: (e) => formatHistoryDays(e.journal_history_days) },
  { label: "Journal export", value: (e) => e.journal_export },
  {
    label: "AI insights",
    value: (e) =>
      e.ai_insights === "none" ? false : e.ai_insights === "monthly" ? "Monthly report" : "Full",
  },
  {
    label: "Timeline history",
    value: (e) => (e.timeline_history_days === null ? "Full" : `${e.timeline_history_days} days`),
  },
  { label: "Priority support", value: (e) => e.priority_support },
]

function MatrixCell({ value }: { value: string | boolean }) {
  if (value === true) {
    return (
      <div className="mx-auto flex h-5 w-5 items-center justify-center rounded-full bg-primary/20">
        <Check className="h-3 w-3 text-primary" />
      </div>
    )
  }
  if (value === false) {
    return <span className="text-muted-foreground">—</span>
  }
  return <span className="text-foreground">{value}</span>
}

const PLAN_SUBTITLES: Record<string, string> = {
  free: "Begin your journey",
  evocore: "Recommended for most members",
  evobloom: "The complete experience",
}

export default function UpgradePage() {
  const { plan: currentPlan } = useEntitlements()
  const [loadingId, setLoadingId] = useState<string | null>(null)

  const handleSelectPlan = async (planKey: PlanKey) => {
    setLoadingId(planKey)
    try {
      const session = await paymentService.createCheckoutSession(planKey)
      if (session.session_url) {
        window.location.href = session.session_url
      } else {
        throw new Error("No checkout URL received")
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start checkout")
      setLoadingId(null)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-10">

        {/* Back link + header */}
        <div className="mb-10">
          <Link
            href="/member/billing"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Billing
          </Link>
          <h1 className="text-3xl font-serif text-foreground tracking-wide mb-2">
            Choose Your Plan
          </h1>
          <p className="text-muted-foreground text-sm max-w-xl">
            Unlock deeper rituals, more sanctuaries, and richer insights. Cancel anytime.
          </p>
        </div>

        {/* ── Plan cards ──────────────────────────────────────────────────────── */}
        <div className="grid md:grid-cols-3 gap-5 mb-10">
          {PRICING_PLANS.map((planKey) => {
            const name = planDisplayName(planKey)
            const price = PLAN_PRICES[planKey]
            const recommended = planKey === "evocore"
            const isCurrent = planKey === currentPlan
            const isLoading = loadingId === planKey
            const anyLoading = loadingId !== null

            return (
              <div
                key={planKey}
                className={`relative flex flex-col rounded-2xl border transition-all ${
                  recommended
                    ? "border-primary/50 shadow-[0_0_32px_-8px_rgba(217,181,116,0.2)] bg-[#141f2a]"
                    : "border-border bg-card"
                }`}
              >
                {recommended && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-primary text-primary-foreground shadow-[0_0_12px_rgba(217,181,116,0.4)]">
                      Recommended
                    </span>
                  </div>
                )}

                <div className="px-6 pt-8 pb-5">
                  <p className={`text-sm font-semibold mb-1 ${recommended ? "text-primary" : "text-foreground"}`}>
                    {name}
                  </p>
                  <p className="text-xs text-muted-foreground mb-5">{PLAN_SUBTITLES[planKey]}</p>

                  <div className="flex items-baseline gap-1 mb-6">
                    <span className="text-4xl font-bold text-foreground">${price}</span>
                    <span className="text-sm text-muted-foreground">/mo</span>
                  </div>

                  <div className="h-px bg-border mb-5" />

                  {/* Key entitlements summary, derived from the shared table */}
                  <ul className="space-y-3">
                    {MATRIX_ROWS.slice(0, 4).map((row) => {
                      const value = row.value(PLAN_ENTITLEMENTS[planKey])
                      return (
                        <li key={row.label} className="flex items-center gap-2.5">
                          <div className="flex h-4 w-4 items-center justify-center rounded-full bg-primary/20 flex-shrink-0">
                            <Check className="h-2.5 w-2.5 text-primary" />
                          </div>
                          <span className="text-sm text-foreground">
                            {row.label}: {typeof value === "boolean" ? (value ? "Included" : "—") : value}
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                </div>

                {/* CTA */}
                <div className="px-6 pb-6 mt-auto">
                  {isCurrent ? (
                    <div className="w-full h-11 rounded-xl bg-secondary border border-border text-muted-foreground text-sm font-medium flex items-center justify-center cursor-default">
                      Current plan
                    </div>
                  ) : planKey === "free" ? (
                    <div className="w-full h-11" />
                  ) : (
                    <button
                      onClick={() => handleSelectPlan(planKey)}
                      disabled={anyLoading}
                      className={`w-full h-11 rounded-xl text-sm font-semibold transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
                        recommended
                          ? "bg-primary text-primary-foreground hover:bg-gold-muted shadow-[0_0_16px_rgba(217,181,116,0.25)]"
                          : "bg-transparent border border-border text-foreground hover:bg-secondary"
                      }`}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Processing…
                        </>
                      ) : currentPlan === "free" ? (
                        "Get started"
                      ) : (
                        "Upgrade"
                      )}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* ── Full matrix ─────────────────────────────────────────────────────── */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/40">
                  <th className="text-left px-5 py-3.5 text-xs text-muted-foreground font-medium uppercase tracking-wider w-1/3">
                    Feature
                  </th>
                  {PRICING_PLANS.map((planKey) => (
                    <th
                      key={planKey}
                      className={`px-3 py-3.5 text-xs font-medium uppercase tracking-wider text-center ${
                        planKey === "evocore" ? "text-primary font-semibold" : "text-muted-foreground"
                      }`}
                    >
                      {planDisplayName(planKey)}
                      <span className="block font-normal normal-case mt-0.5">
                        {planKey === "free" ? "Free" : `$${PLAN_PRICES[planKey]}/mo`}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {MATRIX_ROWS.map((row) => (
                  <tr key={row.label} className="hover:bg-secondary/20 transition-colors">
                    <td className="px-5 py-3 text-foreground">{row.label}</td>
                    {PRICING_PLANS.map((planKey) => (
                      <td key={planKey} className="px-3 py-3 text-center">
                        <MatrixCell value={row.value(PLAN_ENTITLEMENTS[planKey])} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <p className="text-xs text-muted-foreground text-center mt-8">
          All prices in USD · Cancel anytime from your{" "}
          <Link href="/member/billing" className="underline underline-offset-4 hover:text-foreground transition-colors">
            billing settings
          </Link>
        </p>
      </div>
    </div>
  )
}

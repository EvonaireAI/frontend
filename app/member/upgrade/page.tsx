"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useAuth } from "@/lib/auth-context"
import { paymentService } from "@/lib/payments"
import { isPaidActive, PLAN_DISPLAY } from "@/lib/subscription"
import { Check, X, Loader2, ChevronDown, ChevronUp, ArrowLeft } from "lucide-react"
import { toast } from "sonner"

// ── Plan definitions ────────────────────────────────────────────────────────────
const PLANS = [
  {
    id: "evocore",
    name: "EVOcore",
    price: 11,
    subtitle: "Best for newcomers",
    features: [
      "Access to all sanctuaries",
      "Monthly ritual recommendations",
      "Community support",
    ],
  },
  {
    id: "evobloom",
    name: "EVObloom",
    price: 22,
    subtitle: "Most popular",
    popular: true,
    features: [
      "Everything in EVOcore",
      "Advanced ritual tracking",
      "Personal wellness insights",
      "Priority support",
    ],
  },
  {
    id: "evoluxe",
    name: "EVOluxe",
    price: 33,
    subtitle: "Full access",
    label: "Full Access",
    features: [
      "Everything in EVObloom",
      "1-on-1 coaching sessions",
      "Custom ritual creation",
      "VIP community + reports",
    ],
  },
] as const

// ── Comparison table data ────────────────────────────────────────────────────────
const COMPARISON: Array<{
  label: string
  free: boolean
  evocore: boolean
  evobloom: boolean
  evoluxe: boolean
}> = [
  { label: "Access to all sanctuaries",        free: false, evocore: true,  evobloom: true,  evoluxe: true  },
  { label: "Monthly ritual recommendations",    free: false, evocore: true,  evobloom: true,  evoluxe: true  },
  { label: "Community support",                 free: false, evocore: true,  evobloom: true,  evoluxe: true  },
  { label: "Advanced ritual tracking",          free: false, evocore: false, evobloom: true,  evoluxe: true  },
  { label: "Personal wellness insights",        free: false, evocore: false, evobloom: true,  evoluxe: true  },
  { label: "Priority support",                  free: false, evocore: false, evobloom: true,  evoluxe: true  },
  { label: "1-on-1 coaching sessions",          free: false, evocore: false, evobloom: false, evoluxe: true  },
  { label: "Custom ritual creation",            free: false, evocore: false, evobloom: false, evoluxe: true  },
  { label: "VIP community access",              free: false, evocore: false, evobloom: false, evoluxe: true  },
  { label: "Quarterly wellness reports",        free: false, evocore: false, evobloom: false, evoluxe: true  },
]

function CellIcon({ included }: { included: boolean }) {
  if (included) {
    return (
      <div className="mx-auto flex h-5 w-5 items-center justify-center rounded-full bg-primary/20">
        <Check className="h-3 w-3 text-primary" />
      </div>
    )
  }
  return (
    <div className="mx-auto flex h-5 w-5 items-center justify-center rounded-full bg-secondary">
      <X className="h-3 w-3 text-muted-foreground" />
    </div>
  )
}

// ── Main page ───────────────────────────────────────────────────────────────────
export default function UpgradePage() {
  const { user } = useAuth()
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [tableOpen, setTableOpen] = useState(false)

  const currentPlan = user?.subscription_plan ?? "free"
  const currentStatus = user?.subscription_status ?? "active"
  const userIsPaid = isPaidActive(currentPlan, currentStatus)

  const handleSelectPlan = async (planId: string) => {
    setLoadingId(planId)
    try {
      const session = await paymentService.createCheckoutSession(planId)
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

  const isCurrentPlan = (planId: string) =>
    planId === currentPlan && userIsPaid

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
            Unlock deeper rituals, personal insights, and community features. Cancel anytime.
          </p>
        </div>

        {/* ── Plan cards ──────────────────────────────────────────────────────── */}
        <div className="grid md:grid-cols-3 gap-5 mb-10">
          {PLANS.map((plan) => {
            const isCurrent = isCurrentPlan(plan.id)
            const isLoading = loadingId === plan.id
            const anyLoading = loadingId !== null

            return (
              <div
                key={plan.id}
                className={`relative flex flex-col rounded-2xl border transition-all ${
                  plan.popular
                    ? "border-primary/50 shadow-[0_0_32px_-8px_rgba(217,181,116,0.2)] bg-[#141f2a]"
                    : "border-border bg-card"
                }`}
              >
                {/* Most Popular badge */}
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-primary text-primary-foreground shadow-[0_0_12px_rgba(217,181,116,0.4)]">
                      Most Popular
                    </span>
                  </div>
                )}

                {/* Full Access label */}
                {"label" in plan && plan.label && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-secondary text-muted-foreground border border-border">
                      {plan.label}
                    </span>
                  </div>
                )}

                <div className={`px-6 pt-8 pb-5 ${plan.popular || "label" in plan ? "pt-10" : ""}`}>
                  {/* Plan name + subtitle */}
                  <p className={`text-sm font-semibold mb-1 ${plan.popular ? "text-primary" : "text-foreground"}`}>
                    {plan.name}
                  </p>
                  <p className="text-xs text-muted-foreground mb-5">{plan.subtitle}</p>

                  {/* Price */}
                  <div className="flex items-baseline gap-1 mb-6">
                    <span className="text-4xl font-bold text-foreground">${plan.price}</span>
                    <span className="text-sm text-muted-foreground">/mo</span>
                  </div>

                  {/* Divider */}
                  <div className="h-px bg-border mb-5" />

                  {/* Features */}
                  <ul className="space-y-3 mb-6">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-center gap-2.5">
                        <div className="flex h-4 w-4 items-center justify-center rounded-full bg-primary/20 flex-shrink-0">
                          <Check className="h-2.5 w-2.5 text-primary" />
                        </div>
                        <span className="text-sm text-foreground">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* CTA */}
                <div className="px-6 pb-6 mt-auto">
                  {isCurrent ? (
                    <div className="w-full h-11 rounded-xl bg-secondary border border-border text-muted-foreground text-sm font-medium flex items-center justify-center cursor-default">
                      Current plan
                    </div>
                  ) : (
                    <button
                      onClick={() => handleSelectPlan(plan.id)}
                      disabled={anyLoading}
                      className={`w-full h-11 rounded-xl text-sm font-semibold transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
                        plan.popular
                          ? "bg-primary text-primary-foreground hover:bg-gold-muted shadow-[0_0_16px_rgba(217,181,116,0.25)]"
                          : "bg-transparent border border-border text-foreground hover:bg-secondary"
                      }`}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Processing…
                        </>
                      ) : (
                        `Get ${plan.name}`
                      )}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* ── Compare all features toggle ───────────────────────────────────── */}
        <div>
          <button
            onClick={() => setTableOpen((prev) => !prev)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4 mx-auto"
          >
            {tableOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            {tableOpen ? "Hide feature comparison" : "Compare all features ↓"}
          </button>

          {tableOpen && (
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/40">
                    <th className="text-left px-5 py-3.5 text-xs text-muted-foreground font-medium uppercase tracking-wider w-1/2">Feature</th>
                    <th className="px-3 py-3.5 text-xs text-muted-foreground font-medium uppercase tracking-wider text-center">Free</th>
                    <th className="px-3 py-3.5 text-xs text-muted-foreground font-medium uppercase tracking-wider text-center">EVOcore</th>
                    <th className="px-3 py-3.5 text-xs text-primary font-semibold uppercase tracking-wider text-center">EVObloom</th>
                    <th className="px-3 py-3.5 text-xs text-muted-foreground font-medium uppercase tracking-wider text-center">EVOluxe</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {COMPARISON.map((row, i) => (
                    <tr key={i} className="hover:bg-secondary/20 transition-colors">
                      <td className="px-5 py-3 text-foreground">{row.label}</td>
                      <td className="px-3 py-3 text-center"><CellIcon included={row.free} /></td>
                      <td className="px-3 py-3 text-center"><CellIcon included={row.evocore} /></td>
                      <td className="px-3 py-3 text-center"><CellIcon included={row.evobloom} /></td>
                      <td className="px-3 py-3 text-center"><CellIcon included={row.evoluxe} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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

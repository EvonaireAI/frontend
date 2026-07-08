"use client"

import Link from "next/link"
import { useAuth } from "@/lib/auth-context"
import { getSubscriptionAccess } from "@/lib/auth"
import { useEntitlements } from "@/lib/entitlements-context"
import { PLAN_PRICES, PRICING_PLANS, planDisplayName, type PlanKey } from "@/lib/plans"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle, CheckCircle, CreditCard, Loader2, Sparkles, XCircle } from "lucide-react"

const STATUS_DISPLAY: Record<string, string> = {
  active: "Active",
  trialing: "Trial",
  past_due: "Payment Due",
  canceled: "Canceled",
  incomplete: "Incomplete",
}

function StatusBadge({ status }: { status: string }) {
  if (status === "active" || status === "trialing") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-900/40 text-green-300 border border-green-500/30">
        <CheckCircle className="w-3 h-3" />
        {STATUS_DISPLAY[status] ?? status}
      </span>
    )
  }
  if (status === "past_due") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-900/40 text-yellow-300 border border-yellow-500/30">
        <AlertTriangle className="w-3 h-3" />
        {STATUS_DISPLAY[status]}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-900/30 text-red-300 border border-red-500/30">
      <XCircle className="w-3 h-3" />
      {STATUS_DISPLAY[status] ?? status}
    </span>
  )
}

export default function SubscriptionPage() {
  const { user } = useAuth()
  const { planName } = useEntitlements()

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    )
  }

  const plan = user.subscription_plan ?? "free"
  const status = user.subscription_status ?? "active"
  const { isPaidActive, isPastDue, isFree } = getSubscriptionAccess(plan, status)

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-10">
        {/* Page header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <CreditCard className="w-5 h-5 text-primary" />
            <h1 className="text-2xl font-serif text-foreground tracking-wide">Subscription</h1>
          </div>
          <p className="text-muted-foreground text-sm">Manage your Evonaire plan and billing.</p>
        </div>

        {/* Past-due banner */}
        {isPastDue && (
          <div className="mb-6 flex items-start gap-3 bg-yellow-900/20 border border-yellow-500/30 rounded-xl px-5 py-4">
            <AlertTriangle className="w-5 h-5 text-yellow-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-yellow-300 text-sm font-medium">Payment required</p>
              <p className="text-yellow-300/70 text-xs mt-0.5">
                Your last payment failed. Please update your payment method to keep premium access.
              </p>
            </div>
          </div>
        )}

        {/* Current plan card */}
        <div className="bg-card border border-border rounded-2xl p-6 mb-6">
          <p className="text-xs text-muted-foreground uppercase tracking-widest mb-4">Current Plan</p>

          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-xl font-semibold text-foreground">{planName}</p>
                <div className="flex items-center gap-2 mt-1">
                  <StatusBadge status={status} />
                  {plan !== "free" && (
                    <span className="text-xs text-muted-foreground">
                      ${PLAN_PRICES[plan as PlanKey] ?? PLAN_PRICES.evocore}/mo
                    </span>
                  )}
                </div>
              </div>
            </div>

            {plan !== "free" && (
              <Badge
                variant="outline"
                className="bg-primary/10 text-primary border-primary/30 text-xs px-3 py-1"
              >
                Premium
              </Badge>
            )}
          </div>

          {/* Feature summary */}
          <div className="mt-5 pt-5 border-t border-border">
            {isFree ? (
              <p className="text-sm text-muted-foreground">
                You&apos;re on the free plan. Upgrade to access Level 2 &amp; Level 3 rituals and
                premium sanctuary features.
              </p>
            ) : isPaidActive ? (
              <p className="text-sm text-muted-foreground">
                You have full access to all premium rituals and sanctuary features included in your
                plan.
              </p>
            ) : isPastDue ? (
              <p className="text-sm text-muted-foreground">
                Premium access is paused until your payment is resolved.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Your subscription has ended. Upgrade again to restore premium access.
              </p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          {isFree ? (
            <Link
              href="/member/upgrade"
              className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-gold-muted transition-all duration-300 flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(217,181,116,0.2)]"
            >
              <Sparkles className="w-4 h-4" />
              Upgrade Plan
            </Link>
          ) : (
            <>
              {!isPaidActive && (
                <Link
                  href="/member/upgrade"
                  className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-gold-muted transition-all duration-300 flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(217,181,116,0.2)]"
                >
                  <Sparkles className="w-4 h-4" />
                  Reactivate Plan
                </Link>
              )}
              <p className="text-xs text-muted-foreground text-center pt-1">
                To update your payment method or cancel, please contact support or manage your
                subscription through Stripe.
              </p>
            </>
          )}
        </div>

        {/* Plan comparison hint */}
        {isFree && (
          <p className="text-xs text-muted-foreground text-center mt-6">
            {PRICING_PLANS.filter((p) => p !== "free")
              .map((p) => `${planDisplayName(p)} · $${PLAN_PRICES[p]}/mo`)
              .join("  ·  ")}
          </p>
        )}
      </div>
    </div>
  )
}

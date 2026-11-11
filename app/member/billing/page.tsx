"use client"

import { useEffect, useState } from "react"
import Link from "next/link"

import { toast } from "sonner"
import { useAuth } from "@/lib/auth-context"
import {
  fetchSubscription,
  fetchInvoices,
  cancelSubscription,
  isPaidActive,
  isPastDue,
  PLAN_DISPLAY,
  type SubscriptionDetails,
  type Invoice,
} from "@/lib/subscription"
import { planDisplayName } from "@/lib/plans"
import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2,
  CreditCard,
  ExternalLink,
  FileDown,
  Sparkles,
  Receipt,
} from "lucide-react"
import { formatDate,tr, trNode  } from "@/lib/i18n"


// ── Status chip ────────────────────────────────────────────────────────────────
function StatusChip({ status }: { status: string }) {
  if (status === "active" || status === "trialing") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-900/40 text-green-300 border border-green-500/30">
        <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
        {status === "trialing" ? "Trial" : "Active"}
      </span>
    )
  }
  if (status === "past_due") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-900/40 text-yellow-300 border border-yellow-500/30">
        <AlertTriangle className="w-3 h-3" />
        {tr("Payment Due")}
      </span>
    )
  }
  if (status === "canceled") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-900/30 text-red-300 border border-red-500/30">
        <XCircle className="w-3 h-3" />
        {tr("Canceled")}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-secondary text-muted-foreground border border-border">
      {status}
    </span>
  )
}

// ── Cancel modal ───────────────────────────────────────────────────────────────
function CancelModal({
  planName,
  periodEnd,
  loading,
  onConfirm,
  onClose,
}: {
  planName: string
  periodEnd: string | null
  loading: boolean
  onConfirm: () => void
  onClose: () => void
}) {
  const endDate = periodEnd
    ? formatDate(new Date(periodEnd), "MMMM d, yyyy")
    : tr("the end of your billing period")

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Card */}
      <div className="relative z-10 w-full max-w-md bg-[#141f2a] border border-gold/20 rounded-2xl p-8 shadow-[0_24px_64px_rgba(0,0,0,0.6)]">
        <h2 className="text-xl font-serif text-cream mb-3">{tr("Cancel your subscription?")}</h2>
        <p className="text-cream/60 text-sm leading-relaxed mb-8">
          {tr("You'll keep full access to ")}<span className="text-cream font-medium">{planName}</span>{tr(" until ")}<span className="text-cream font-medium">{endDate}</span>{tr(". After that, your account reverts to the free plan.")}
        </p>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 h-11 rounded-xl bg-gold text-dark-navy font-semibold text-sm hover:bg-gold-muted transition-all duration-200 disabled:opacity-50"
          >
            {tr("Keep my plan")}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 h-11 rounded-xl bg-transparent border border-red-500/60 text-red-400 font-medium text-sm hover:bg-red-900/20 transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {tr("Yes, cancel")}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function BillingPage() {
  const { user } = useAuth()

  const [subscription, setSubscription] = useState<SubscriptionDetails | null>(null)
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [pageLoading, setPageLoading] = useState(true)
  const [pageError, setPageError] = useState("")
  const [cancelModalOpen, setCancelModalOpen] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  useEffect(() => {
    Promise.all([
      fetchSubscription().catch(() => null),
      fetchInvoices().catch(() => ({ invoices: [] })),
    ]).then(([sub, inv]) => {
      setSubscription(sub)
      setInvoices(inv?.invoices ?? [])
    }).catch((err) => {
      setPageError(err.message)
    }).finally(() => {
      setPageLoading(false)
    })
  }, [])

  const handleCancelConfirm = async () => {
    setCancelling(true)
    try {
      await cancelSubscription()
      setSubscription((prev) => prev ? { ...prev, cancel_at_period_end: true } : prev)
      const endDate = subscription?.current_period_end
        ? formatDate(new Date(subscription.current_period_end), "MMMM d, yyyy")
        : "the end of your billing period"
      toast.success(tr("Subscription cancelled. Access continues until {p0}.", { p0: endDate }))
      setCancelModalOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tr("Failed to cancel subscription"))
    } finally {
      setCancelling(false)
    }
  }

  if (pageLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    )
  }

  const plan = subscription?.plan ?? user?.subscription_plan ?? "free"
  const status = subscription?.status ?? user?.subscription_status ?? "active"
  const cancelAtPeriodEnd = subscription?.cancel_at_period_end ?? false
  const periodEnd = subscription?.current_period_end ?? null

  const planInfo = {
    name: subscription?.display_name ?? PLAN_DISPLAY[plan]?.name ?? planDisplayName(plan),
    price: PLAN_DISPLAY[plan]?.price ?? "$0/mo",
  }
  const paid = isPaidActive(plan, status)
  const pastDue = isPastDue(plan, status)
  const isFree = plan === "free" || (!paid && !pastDue && status !== "trialing")

  const periodEndFormatted = periodEnd
    ? formatDate(new Date(periodEnd), "MMMM d, yyyy")
    : null

  return (
    <>
      <div className="min-h-screen bg-background">
        <div className="max-w-3xl mx-auto px-4 py-10">

          {/* Page header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-1">
              <CreditCard className="w-5 h-5 text-primary" />
              <h1 className="text-2xl font-serif text-foreground tracking-wide">
                {tr("Billing & Subscription")}
              </h1>
            </div>
            <p className="text-muted-foreground text-sm">
              {tr("Manage your plan and view payment history.")}
            </p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              {tr("Charges appear as ")}<span className="font-medium text-muted-foreground">{tr("Evonaire, Inc.")}</span>{tr(" on your bank or card statement.")}
            </p>
          </div>

          {pageError && (
            <div className="mb-6 flex items-center gap-3 bg-red-900/20 border border-red-500/30 rounded-xl px-5 py-4">
              <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <p className="text-red-300 text-sm">{pageError}</p>
            </div>
          )}

          {/* ── Section 1: Current Plan ───────────────────────────────────────── */}
          <div
            className={`rounded-2xl p-6 mb-6 border ${
              paid || pastDue
                ? "bg-[#141f2a] border-gold/30 shadow-[0_0_24px_-8px_rgba(217,181,116,0.15)]"
                : "bg-card border-border"
            }`}
          >
            {isFree ? (
              /* Free plan state */
              <div className="flex flex-col items-center text-center py-4 gap-5">
                <div className="w-14 h-14 rounded-full bg-secondary flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-foreground font-semibold text-lg mb-1">{tr("You're on the Free plan")}</p>
                  <p className="text-muted-foreground text-sm">
                    {tr("Upgrade to access Level 2 & Level 3 rituals and all premium features.")}
                  </p>
                </div>
                <Link
                  href="/member/upgrade"
                  className="inline-flex items-center gap-2 h-11 px-8 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-gold-muted transition-all duration-200 shadow-[0_0_20px_rgba(217,181,116,0.2)]"
                >
                  <Sparkles className="w-4 h-4" />
                  {tr("Upgrade Plan")}
                </Link>
              </div>
            ) : (
              /* Paid / past-due state */
              <>
                {/* Top row: plan name + status */}
                <div className="flex items-start justify-between flex-wrap gap-3 mb-5">
                  <div>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-primary/15 text-primary border border-primary/30 mb-2">
                      {planInfo.name}
                    </span>
                    <p className="text-3xl font-bold text-foreground">
                      {planInfo.price.split("/")[0]}
                      <span className="text-base font-normal text-muted-foreground ml-1">{tr("/ month")}</span>
                    </p>
                  </div>
                  <StatusChip status={status} />
                </div>

                {/* Renewal / ends-on line */}
                {cancelAtPeriodEnd && periodEndFormatted ? (
                  <p className="text-sm text-yellow-300 flex items-center gap-2 mb-5">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    {trNode("Access ends on {p0}. You will not be charged again.", { p0: periodEndFormatted })}
                  </p>
                ) : periodEndFormatted ? (
                  <p className="text-sm text-muted-foreground mb-5">
                    {tr("Renews on ")}
                    <span className="text-foreground font-medium">{periodEndFormatted}</span>
                  </p>
                ) : null}

                {/* Past-due banner */}
                {pastDue && (
                  <div className="flex items-start gap-3 bg-yellow-900/20 border border-yellow-500/30 rounded-xl px-4 py-3 mb-5">
                    <AlertTriangle className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                    <p className="text-yellow-300 text-sm">
                      {tr("Your last payment failed. Please update your payment method to restore full access.")}
                    </p>
                  </div>
                )}

                {/* Bottom row: upgrade + cancel */}
                <div className="flex items-center justify-between flex-wrap gap-3 pt-4 border-t border-border">
                  <Link
                    href="/member/upgrade"
                    className="text-sm text-primary hover:text-gold-muted transition-colors font-medium"
                  >
                    {tr("Upgrade Plan →")}
                  </Link>
                  {paid && !cancelAtPeriodEnd && (
                    <button
                      onClick={() => setCancelModalOpen(true)}
                      className="text-xs text-muted-foreground hover:text-red-400 transition-colors"
                    >
                      {tr("Cancel subscription")}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>

          {/* ── Section 2: Billing History ───────────────────────────────────── */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Receipt className="w-4 h-4 text-primary" />
              <h2 className="text-base font-semibold text-foreground">{tr("Billing History")}</h2>
            </div>

            <p className="text-xs text-muted-foreground/50 mb-3">
              {tr("All invoices are issued by ")}<span className="text-muted-foreground">{tr("Evonaire, Inc.")}</span>
            </p>

            {invoices.length === 0 ? (
              <div className="bg-card border border-border rounded-xl px-6 py-10 text-center">
                <Receipt className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
                <p className="text-sm text-muted-foreground">
                  {tr("No invoices yet. Your billing history will appear here after your first payment.")}
                </p>
              </div>
            ) : (
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left px-5 py-3 text-xs text-muted-foreground font-medium uppercase tracking-wider">{tr("Date")}</th>
                      <th className="text-left px-5 py-3 text-xs text-muted-foreground font-medium uppercase tracking-wider hidden sm:table-cell">{tr("Period")}</th>
                      <th className="text-left px-5 py-3 text-xs text-muted-foreground font-medium uppercase tracking-wider">{tr("Amount")}</th>
                      <th className="text-left px-5 py-3 text-xs text-muted-foreground font-medium uppercase tracking-wider hidden md:table-cell">{tr("Status")}</th>
                      <th className="text-right px-5 py-3 text-xs text-muted-foreground font-medium uppercase tracking-wider">{tr("Actions")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {invoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-secondary/30 transition-colors">
                        <td className="px-5 py-3.5 text-foreground whitespace-nowrap">
                          {formatDate(new Date(inv.created * 1000), "MMM d, yyyy")}
                        </td>
                        <td className="px-5 py-3.5 text-muted-foreground whitespace-nowrap hidden sm:table-cell">
                          {trNode("until {p0}", { p0: formatDate(new Date(inv.period_end * 1000), "MMM d") })}
                        </td>
                        <td className="px-5 py-3.5 text-foreground font-medium whitespace-nowrap">
                          ${(inv.amount_paid / 100).toFixed(2)}
                        </td>
                        <td className="px-5 py-3.5 hidden md:table-cell">
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-green-900/40 text-green-300 border border-green-500/30">
                            <CheckCircle className="w-3 h-3" />
                            {tr("Paid")}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <div className="inline-flex items-center gap-2">
                            <a
                              href={inv.hosted_invoice_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-primary hover:text-gold-muted transition-colors"
                            >
                              <ExternalLink className="w-3 h-3" />
                              {tr("View")}
                            </a>
                            <a
                              href={inv.invoice_pdf}
                              target="_blank"
                              rel="noopener noreferrer"
                              title={tr("Download PDF")}
                              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <FileDown className="w-3.5 h-3.5" />
                              {tr("PDF")}
                            </a>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cancel modal */}
      {cancelModalOpen && (
        <CancelModal
          planName={planInfo.name}
          periodEnd={periodEnd}
          loading={cancelling}
          onConfirm={handleCancelConfirm}
          onClose={() => setCancelModalOpen(false)}
        />
      )}
    </>
  )
}

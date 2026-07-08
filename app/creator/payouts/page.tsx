"use client"

import { Suspense, useCallback, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import {
  createDashboardLink,
  createOnboardingLink,
  fetchConnectStatus,
  requirementLabel,
  PayoutsApiError,
  type ConnectStatus,
} from "@/lib/payouts"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { formatDistanceToNow } from "date-fns"
import {
  AlertTriangle,
  Banknote,
  CheckCircle,
  ExternalLink,
  Loader2,
  RefreshCw,
} from "lucide-react"

type Phase = "loading" | "reconnecting" | "error" | "loaded"

function PayoutsContent() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()

  // Stripe sends the browser back with ?refresh=1 when the onboarding link
  // expired mid-flow, and to ?return=1 when the user finished (or abandoned)
  // onboarding. Returning ≠ verified — always re-check status.
  const isRefresh = searchParams.get("refresh") === "1"
  const [returnedFromStripe] = useState(() => searchParams.get("return") === "1")

  const [phase, setPhase] = useState<Phase>("loading")
  const [status, setStatus] = useState<ConnectStatus | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [onboardingBusy, setOnboardingBusy] = useState(false)
  const [dashboardBusy, setDashboardBusy] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const loadStatus = useCallback(
    async (opts?: { background?: boolean }) => {
      if (!opts?.background) setPhase("loading")
      try {
        const data = await fetchConnectStatus()
        setStatus(data)
        setLoadError(null)
        setPhase("loaded")
        if (returnedFromStripe) {
          // Drop ?return=1 so a reload doesn't replay the return flow
          window.history.replaceState(null, "", "/creator/payouts")
        }
      } catch (err) {
        if (err instanceof PayoutsApiError && err.status === 403) {
          router.replace("/dashboard")
          return
        }
        const message = err instanceof Error ? err.message : "Failed to check payout status"
        if (opts?.background) {
          toast.error(message)
        } else {
          setLoadError(message)
          setPhase("error")
        }
      }
    },
    [router, returnedFromStripe],
  )

  // Expired onboarding link — get a fresh one and send the user straight back
  const reconnect = useCallback(async () => {
    setPhase("reconnecting")
    try {
      const { onboarding_url } = await createOnboardingLink()
      window.location.assign(onboarding_url)
    } catch (err) {
      if (err instanceof PayoutsApiError && err.status === 403) {
        router.replace("/dashboard")
        return
      }
      toast.error(err instanceof Error ? err.message : "Failed to reconnect to Stripe")
      window.history.replaceState(null, "", "/creator/payouts")
      loadStatus()
    }
  }, [router, loadStatus])

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.replace("/auth/login")
      return
    }
    if (user.role !== "creator") {
      router.replace("/dashboard")
      return
    }
    if (isRefresh) {
      reconnect()
      return
    }
    loadStatus()
  }, [authLoading, user, isRefresh, reconnect, loadStatus, router])

  const startOnboarding = async () => {
    setOnboardingBusy(true)
    try {
      const { onboarding_url } = await createOnboardingLink()
      // Full redirect — Stripe onboarding cannot run in an iframe.
      // Leave the button spinning while the browser navigates.
      window.location.assign(onboarding_url)
    } catch (err) {
      if (err instanceof PayoutsApiError && err.status === 403) {
        router.replace("/dashboard")
        return
      }
      toast.error(err instanceof Error ? err.message : "Failed to start Stripe onboarding")
      setOnboardingBusy(false)
    }
  }

  const openDashboard = async () => {
    setDashboardBusy(true)
    try {
      const { dashboard_url } = await createDashboardLink()
      window.open(dashboard_url, "_blank")
    } catch (err) {
      if (err instanceof PayoutsApiError && err.status === 403) {
        router.replace("/dashboard")
        return
      }
      toast.error(err instanceof Error ? err.message : "Failed to open the Stripe dashboard")
      if (err instanceof PayoutsApiError && err.status === 409) {
        // The button was shown from stale status — resync so it hides itself
        loadStatus({ background: true })
      }
    } finally {
      setDashboardBusy(false)
    }
  }

  const handleRefreshStatus = async () => {
    setRefreshing(true)
    await loadStatus({ background: true })
    setRefreshing(false)
  }

  if (authLoading || !user || user.role !== "creator") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    )
  }

  if (phase === "reconnecting") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-card border border-border rounded-2xl p-8 text-center">
          <div className="flex justify-center mb-5">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Loader2 className="w-7 h-7 text-primary animate-spin" />
            </div>
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-2">Reconnecting to Stripe…</h2>
          <p className="text-sm text-muted-foreground">
            Your setup link expired. We&apos;re creating a fresh one and sending you back.
          </p>
        </div>
      </div>
    )
  }

  const payoutsAllowed = status?.payouts_allowed === true
  const requirementsDue = status?.requirements_currently_due ?? []
  const showDashboardButton = status?.has_account && status.details_submitted === true

  const dashboardButton = showDashboardButton ? (
    <Button
      variant="outline"
      onClick={openDashboard}
      disabled={dashboardBusy}
      className="border-border text-foreground hover:bg-secondary bg-transparent"
    >
      {dashboardBusy ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <ExternalLink className="w-4 h-4" />
      )}
      Open Stripe dashboard
    </Button>
  ) : null

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-10">
        {/* Page header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <Banknote className="w-5 h-5 text-primary" />
            <h1 className="text-2xl font-serif text-foreground tracking-wide">Payouts</h1>
          </div>
          <p className="text-muted-foreground text-sm">
            Get paid for the royalties your rituals generate.
          </p>
        </div>

        {phase === "loading" && (
          <div className="bg-card border border-border rounded-2xl p-10 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              {returnedFromStripe ? "Checking your payout setup…" : "Loading payout status…"}
            </p>
          </div>
        )}

        {phase === "error" && (
          <div className="bg-card border border-border rounded-2xl p-8 text-center">
            <AlertTriangle className="w-8 h-8 text-yellow-400 mx-auto mb-3" />
            <p className="text-foreground font-medium mb-1">Couldn&apos;t check your payout setup</p>
            <p className="text-sm text-muted-foreground mb-6">{loadError}</p>
            <Button
              variant="outline"
              onClick={() => loadStatus()}
              className="border-border text-foreground hover:bg-secondary bg-transparent"
            >
              <RefreshCw className="w-4 h-4" />
              Try again
            </Button>
          </div>
        )}

        {phase === "loaded" && status && !status.has_account && (
          /* State 1 — not started */
          <div className="bg-card border border-border rounded-2xl p-6">
            <div className="flex items-center gap-4 mb-5">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Banknote className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-xl font-semibold text-foreground">Set up payouts</p>
                <p className="text-sm text-muted-foreground">
                  Earn 89% of member-generated royalties
                </p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-6">
              Evonaire pays creators 89% of the royalties their rituals generate from members,
              via Stripe. To receive payouts, complete a quick Stripe onboarding to verify your
              identity and connect a bank account.
            </p>
            <Button
              onClick={startOnboarding}
              disabled={onboardingBusy}
              className="bg-primary text-primary-foreground hover:bg-gold-muted"
            >
              {onboardingBusy ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ExternalLink className="w-4 h-4" />
              )}
              Set up payouts
            </Button>
          </div>
        )}

        {phase === "loaded" && status?.has_account && !payoutsAllowed && (
          /* State 2 — action needed */
          <div className="bg-card border border-yellow-500/30 rounded-2xl p-6">
            <div className="flex items-center gap-4 mb-5">
              <div className="w-12 h-12 rounded-full bg-yellow-900/30 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-yellow-400" />
              </div>
              <div>
                <p className="text-xl font-semibold text-foreground">Payout setup incomplete</p>
                <p className="text-sm text-muted-foreground">
                  Finish your Stripe setup to start receiving payouts.
                </p>
              </div>
            </div>

            {returnedFromStripe && (
              <div className="mb-5 bg-secondary/50 border border-border rounded-xl px-4 py-3">
                <p className="text-xs text-muted-foreground">
                  Just finished on Stripe? Verification can take a few minutes — use
                  &quot;Refresh status&quot; below to check again.
                </p>
              </div>
            )}

            {status.disabled_reason && (
              <div className="mb-5 flex items-start gap-3 bg-red-900/20 border border-red-500/30 rounded-xl px-4 py-3">
                <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-red-300">
                  Stripe has paused this account ({status.disabled_reason})
                </p>
              </div>
            )}

            {requirementsDue.length > 0 && (
              <div className="mb-6">
                <p className="text-xs text-muted-foreground uppercase tracking-widest mb-3">
                  Still needed
                </p>
                <ul className="space-y-2">
                  {requirementsDue.map((req) => (
                    <li key={req} className="flex items-center gap-2 text-sm text-foreground">
                      <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 flex-shrink-0" />
                      {requirementLabel(req)}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              <Button
                onClick={startOnboarding}
                disabled={onboardingBusy}
                className="bg-primary text-primary-foreground hover:bg-gold-muted"
              >
                {onboardingBusy ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ExternalLink className="w-4 h-4" />
                )}
                Continue setup
              </Button>
              {dashboardButton}
              <Button
                variant="ghost"
                onClick={handleRefreshStatus}
                disabled={refreshing}
                className="text-muted-foreground hover:text-foreground"
              >
                {refreshing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                Refresh status
              </Button>
            </div>
          </div>
        )}

        {phase === "loaded" && status?.has_account && payoutsAllowed && (
          /* State 3 — ready */
          <div className="bg-card border border-green-500/30 rounded-2xl p-6">
            <div className="flex items-center gap-4 mb-5">
              <div className="w-12 h-12 rounded-full bg-green-900/40 flex items-center justify-center flex-shrink-0">
                <CheckCircle className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="text-xl font-semibold text-foreground">Payouts active</p>
                <p className="text-sm text-muted-foreground">
                  Your Stripe account is verified and ready to receive payouts
                  {status.country ? ` (${status.country})` : ""}.
                </p>
              </div>
            </div>
            <div className="mb-6 pt-5 border-t border-border">
              <p className="text-sm text-muted-foreground">
                You earn 89% of the royalties your rituals generate from members. Earnings and
                royalty figures will appear here in a future release.
              </p>
            </div>
            {dashboardButton && <div className="flex flex-wrap gap-3">{dashboardButton}</div>}
          </div>
        )}

        {phase === "loaded" && status?.has_account && status.live === false && status.updated_at && (
          <p className="text-xs text-muted-foreground mt-3">
            Stripe is momentarily unreachable — last synced{" "}
            {formatDistanceToNow(new Date(status.updated_at), { addSuffix: true })}.
          </p>
        )}
      </div>
    </div>
  )
}

export default function PayoutsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      }
    >
      <PayoutsContent />
    </Suspense>
  )
}

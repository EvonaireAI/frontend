"use client"

import { useEffect, useRef, useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { CheckCircle, Loader2, Sparkles } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { useEntitlements } from "@/lib/entitlements-context"
import { fetchSubscription, PLAN_DISPLAY } from "@/lib/subscription"

function PaymentSuccessContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const sessionId = searchParams.get("session_id")
  const { refreshUser } = useAuth()
  const { refreshEntitlements } = useEntitlements()

  const [state, setState] = useState<"polling" | "success" | "pending">("polling")
  const [activePlan, setActivePlan] = useState<string | null>(null)
  const attemptRef = useRef(0)
  const MAX_ATTEMPTS = 5

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>

    async function poll() {
      attemptRef.current += 1
      try {
        const sub = await fetchSubscription()
        if (sub.plan !== "free" && sub.status === "active") {
          // Webhook fired — plan is active; refresh entitlements so locked
          // states re-render without a full reload
          await Promise.all([refreshUser(), refreshEntitlements()])
          setActivePlan(sub.plan)
          setState("success")

          // Auto-redirect after 6 seconds
          timer = setTimeout(() => router.push("/member"), 6000)
          return
        }
      } catch {
        // ignore individual poll errors
      }

      if (attemptRef.current >= MAX_ATTEMPTS) {
        setState("pending")
        return
      }

      // Retry in 2 seconds
      timer = setTimeout(poll, 2000)
    }

    // Start first poll after 2 seconds (give webhook time to fire)
    timer = setTimeout(poll, 2000)
    return () => clearTimeout(timer)
  }, [router, refreshUser, refreshEntitlements])

  const planName = activePlan ? (PLAN_DISPLAY[activePlan]?.name ?? activePlan) : null

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-card border border-border rounded-2xl p-8 shadow-[0_8px_40px_rgba(0,0,0,0.4)] text-center">

        {state === "polling" && (
          <>
            <div className="flex justify-center mb-5">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Loader2 className="w-7 h-7 text-primary animate-spin" />
              </div>
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">
              Setting up your subscription…
            </h2>
            <p className="text-sm text-muted-foreground">
              Activating your plan. This takes just a moment.
            </p>
          </>
        )}

        {state === "success" && (
          <>
            <div className="flex justify-center mb-5">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <CheckCircle className="w-7 h-7 text-primary" />
              </div>
            </div>
            <h2 className="text-2xl font-serif text-foreground mb-2">
              Welcome to {planName}!
            </h2>
            <p className="text-sm text-muted-foreground mb-8">
              Your {planName} plan is now active. Enjoy full access to all premium rituals and
              features.
            </p>

            {sessionId && (
              <p className="text-xs text-muted-foreground/50 font-mono mb-6">
                Ref: {sessionId.slice(0, 24)}…
              </p>
            )}

            <div className="space-y-3">
              <Link
                href="/member"
                className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-gold-muted transition-all duration-200 flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(217,181,116,0.2)]"
              >
                <Sparkles className="w-4 h-4" />
                Explore Sanctuaries →
              </Link>
              <Link
                href="/member/billing"
                className="w-full h-11 rounded-xl bg-transparent border border-border text-foreground font-medium text-sm hover:bg-secondary transition-colors flex items-center justify-center"
              >
                View Billing
              </Link>
            </div>

            <p className="text-xs text-muted-foreground mt-6">
              Redirecting to your library shortly…
            </p>
          </>
        )}

        {state === "pending" && (
          <>
            <div className="flex justify-center mb-5">
              <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center">
                <CheckCircle className="w-7 h-7 text-muted-foreground" />
              </div>
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">Payment received</h2>
            <p className="text-sm text-muted-foreground mb-8">
              Your payment was received. Your account will be updated shortly — check your billing
              page to confirm once it&apos;s active.
            </p>
            <div className="space-y-3">
              <Link
                href="/member/billing"
                className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-gold-muted transition-all duration-200 flex items-center justify-center gap-2"
              >
                Go to Billing
              </Link>
              <Link
                href="/member"
                className="w-full h-11 rounded-xl bg-transparent border border-border text-foreground font-medium text-sm hover:bg-secondary transition-colors flex items-center justify-center"
              >
                Back to Library
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default function PaymentSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      }
    >
      <PaymentSuccessContent />
    </Suspense>
  )
}

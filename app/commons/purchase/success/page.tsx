"use client"

import { Suspense, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { CheckCircle, Loader2, Library, Play, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { fetchPurchases, type Purchase } from "@/lib/commons"

function SuccessContent() {
  const searchParams = useSearchParams()
  const sessionId = searchParams.get("session_id")

  const [state, setState] = useState<"polling" | "ready" | "pending">("polling")
  const [purchase, setPurchase] = useState<Purchase | null>(null)
  const attemptRef = useRef(0)
  // Fulfilment is a webhook, so the entitlement can lag a second or two.
  const MAX_ATTEMPTS = 6

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    // Snapshot the purchases already present when we land so we can detect the
    // newly-fulfilled entry rather than linking to a stale one.
    let knownIds: Set<number> | null = null

    async function poll() {
      attemptRef.current += 1
      try {
        const purchases = await fetchPurchases()
        if (knownIds === null) {
          // First fetch — remember what was already there so a later fetch can
          // spot the newly-fulfilled entry.
          knownIds = new Set(purchases.map((p) => p.id))
        }
        const fresh = purchases.find((p) => !knownIds!.has(p.id) && p.status === "active")
        // Fallback: the most recently created active purchase.
        const newestActive = purchases
          .filter((p) => p.status === "active")
          .sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
        const target = fresh ?? newestActive
        // Take a brand-new active entry immediately; otherwise, after a couple
        // of tries, fall back to the most recent active purchase.
        if (fresh || (attemptRef.current >= 3 && target)) {
          setPurchase(target ?? null)
          setState("ready")
          return
        }
      } catch {
        // ignore individual poll errors and keep trying
      }

      if (attemptRef.current >= MAX_ATTEMPTS) {
        setState("pending")
        return
      }
      timer = setTimeout(poll, 1500)
    }

    poll()
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-card border border-border rounded-2xl p-8 text-center">
        {state === "polling" && (
          <>
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-5">
              <Loader2 className="w-7 h-7 text-primary animate-spin" />
            </div>
            <h1 className="text-xl font-semibold text-foreground mb-2">Completing your purchase…</h1>
            <p className="text-sm text-muted-foreground">
              Adding this offering to your library. Just a moment.
            </p>
          </>
        )}

        {state === "ready" && (
          <>
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-5">
              <CheckCircle className="w-7 h-7 text-primary" />
            </div>
            <h1 className="text-2xl font-serif text-foreground mb-2">Purchase complete</h1>
            <p className="text-sm text-muted-foreground mb-8">
              {purchase
                ? `“${purchase.listing.title}” is now in your library.`
                : "Your offering is now in your library."}
            </p>

            <div className="space-y-3">
              {purchase?.listing.ritual && (
                <Button asChild className="w-full">
                  <Link
                    href={`/member/ritual/${purchase.listing.ritual.id}`}
                    className="flex items-center justify-center gap-2"
                  >
                    <Play className="w-4 h-4" />
                    Play ritual
                  </Link>
                </Button>
              )}
              <Button asChild variant={purchase?.listing.ritual ? "outline" : "default"} className="w-full">
                <Link href="/commons/library" className="flex items-center justify-center gap-2">
                  <Library className="w-4 h-4" />
                  View my purchases
                </Link>
              </Button>
            </div>
          </>
        )}

        {state === "pending" && (
          <>
            <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mx-auto mb-5">
              <Sparkles className="w-7 h-7 text-muted-foreground" />
            </div>
            <h1 className="text-xl font-semibold text-foreground mb-2">Payment received</h1>
            <p className="text-sm text-muted-foreground mb-8">
              Your payment went through. It can take a moment to appear — your library will update
              shortly.
            </p>
            <Button asChild className="w-full">
              <Link href="/commons/library" className="flex items-center justify-center gap-2">
                <Library className="w-4 h-4" />
                Go to my purchases
              </Link>
            </Button>
          </>
        )}

        {sessionId && (
          <p className="text-xs text-muted-foreground/50 font-mono mt-6">
            Ref: {sessionId.slice(0, 24)}…
          </p>
        )}
      </div>
    </div>
  )
}

export default function PurchaseSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[40vh] flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      }
    >
      <SuccessContent />
    </Suspense>
  )
}

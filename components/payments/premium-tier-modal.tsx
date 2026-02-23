"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { AlertCircle, Loader2, Check, X } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { paymentService, PREMIUM_TIERS } from "@/lib/payments"
import { useToast } from "@/hooks/use-toast"

interface PremiumTierModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface FeatureRow {
  label: string
  evocore: boolean
  evobloom: boolean
  evoluxe: boolean
}

const FEATURE_ROWS: FeatureRow[] = [
  { label: "Access to all sanctuaries", evocore: true, evobloom: true, evoluxe: true },
  { label: "Monthly ritual recommendations", evocore: true, evobloom: true, evoluxe: true },
  { label: "Community support", evocore: true, evobloom: true, evoluxe: true },
  { label: "Advanced ritual tracking", evocore: false, evobloom: true, evoluxe: true },
  { label: "Personal wellness insights", evocore: false, evobloom: true, evoluxe: true },
  { label: "Priority support", evocore: false, evobloom: true, evoluxe: true },
  { label: "1-on-1 coaching sessions", evocore: false, evobloom: false, evoluxe: true },
  { label: "Custom ritual creation", evocore: false, evobloom: false, evoluxe: true },
  { label: "VIP community access", evocore: false, evobloom: false, evoluxe: true },
  { label: "Quarterly wellness reports", evocore: false, evobloom: false, evoluxe: true },
]

export function PremiumTierModal({ open, onOpenChange }: PremiumTierModalProps) {
  const [loadingTierId, setLoadingTierId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  const handleSelectTier = async (tierId: string) => {
    setLoadingTierId(tierId)
    setError(null)

    try {
      const session = await paymentService.createCheckoutSession(tierId)

      if (session.session_url) {
        await paymentService.redirectToCheckout(session.session_url)
      } else {
        throw new Error("No checkout URL received from server")
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to start checkout"
      setError(message)
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      })
      setLoadingTierId(null)
    }
  }

  const tierDescriptions: Record<string, string> = {
    evocore: "Best for newcomers",
    evobloom: "Best for regular practitioners",
    evioluxe: "Best for dedicated seekers",
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto bg-background border-border p-0">
        <div className="px-8 pt-8 pb-2">
          <DialogHeader className="text-center mb-2">
            <DialogTitle className="text-3xl font-bold text-foreground tracking-tight text-center">
              Pricing
            </DialogTitle>
            <p className="text-muted-foreground text-base mt-2 text-center">
              Choose the plan that aligns with your spiritual journey.
            </p>
          </DialogHeader>

          {error && (
            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <div className="px-8 pb-4">
          <div className="grid gap-5 md:grid-cols-3">
            {PREMIUM_TIERS.map((tier) => {
              const isPopular = tier.id === "evobloom"
              const tierKey = tier.id === "evocore" ? "evocore" : tier.id === "evobloom" ? "evobloom" : "evoluxe"

              return (
                <div
                  key={tier.id}
                  className={`relative flex flex-col rounded-xl border transition-all ${
                    isPopular
                      ? "border-primary/60 shadow-[0_0_24px_-6px_rgba(217,181,116,0.15)]"
                      : "border-border"
                  } bg-card`}
                >
                  {/* Header */}
                  <div className="px-6 pt-6 pb-0 text-center">
                    <p className={`text-sm font-semibold tracking-wide mb-4 ${isPopular ? "text-primary" : "text-foreground"}`}>
                      {tier.name}
                    </p>
                    <div className="flex items-baseline justify-center gap-1">
                      <span className="text-4xl font-bold text-foreground">${tier.price}</span>
                      <span className="text-muted-foreground text-sm">/mo</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2 mb-5">
                      {tierDescriptions[tier.id] || tier.description}
                    </p>
                  </div>

                  {/* Divider */}
                  <div className="mx-6 h-px bg-border" />

                  {/* Features */}
                  <div className="flex-1 px-6 py-5">
                    <div className="space-y-3">
                      {FEATURE_ROWS.map((feature, idx) => {
                        const included = feature[tierKey]
                        return (
                          <div key={idx} className="flex items-center gap-3">
                            {included ? (
                              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/20 flex-shrink-0">
                                <Check className="h-3 w-3 text-primary" />
                              </div>
                            ) : (
                              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-muted flex-shrink-0">
                                <X className="h-3 w-3 text-muted-foreground" />
                              </div>
                            )}
                            <span className={`text-sm ${included ? "text-foreground" : "text-muted-foreground"}`}>
                              {feature.label}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* CTA */}
                  <div className="px-6 pb-6">
                    <Button
                      onClick={() => handleSelectTier(tier.id)}
                      disabled={loadingTierId !== null}
                      className={`w-full h-11 text-sm font-medium transition-colors ${
                        isPopular
                          ? "bg-primary text-primary-foreground hover:bg-gold-muted"
                          : "bg-transparent border border-border text-foreground hover:bg-secondary"
                      }`}
                      variant={isPopular ? "default" : "outline"}
                    >
                      {loadingTierId === tier.id ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        `Get ${tier.name}`
                      )}
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="px-8 pb-6">
          <p className="text-xs text-muted-foreground text-center">
            All prices are in USD. Your subscription can be canceled anytime from your account settings.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}

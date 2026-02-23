"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { AlertCircle, Loader2, Check } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { paymentService, PREMIUM_TIERS } from "@/lib/payments"
import { useToast } from "@/hooks/use-toast"

interface PremiumTierModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground">Unlock Premium Access</DialogTitle>
          <DialogDescription>Choose the plan that's right for your spiritual practice</DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-6 md:grid-cols-3 my-6">
          {PREMIUM_TIERS.map((tier) => (
            <Card key={tier.id} className="flex flex-col relative bg-secondary border-border">
              {tier.id === "evobloom" && (
                <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-primary text-primary-foreground">Most Popular</Badge>
              )}

              <CardHeader>
                <CardTitle className="text-foreground">{tier.name}</CardTitle>
                <CardDescription>{tier.description}</CardDescription>
              </CardHeader>

              <CardContent className="flex-1 flex flex-col">
                <div className="mb-6">
                  <span className="text-3xl font-bold">${tier.price}</span>
                  <span className="text-muted-foreground ml-2">/month</span>
                </div>

                <div className="space-y-2 mb-6 flex-1">
                  {tier.features.map((feature, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-foreground">{feature}</span>
                    </div>
                  ))}
                </div>

                <Button
                  onClick={() => handleSelectTier(tier.id)}
                  disabled={loadingTierId !== null}
                  className="w-full"
                  variant={tier.id === "evobloom" ? "default" : "outline"}
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
              </CardContent>
            </Card>
          ))}
        </div>

        <p className="text-xs text-muted-foreground text-center">
          All prices are in USD. Your subscription can be canceled anytime from your account settings.
        </p>
      </DialogContent>
    </Dialog>
  )
}

"use client"

import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Sparkles } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { isPaidActive } from "@/lib/subscription"

export function PremiumCTABanner() {
  const { user } = useAuth()

  // Hide the banner if the user already has an active paid plan
  if (
    user &&
    isPaidActive(user.subscription_plan ?? "free", user.subscription_status ?? "active")
  ) {
    return null
  }

  return (
    <Card className="bg-secondary border border-primary/20 mb-6">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Sparkles className="h-6 w-6 text-primary flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-foreground">Unlock Premium Features</h3>
              <p className="text-sm text-muted-foreground">
                Get exclusive access to advanced rituals, personalized insights, and community features
              </p>
            </div>
          </div>
          <Link
            href="/member/upgrade"
            className="flex-shrink-0 inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-gold-muted transition-all duration-200"
          >
            Get Premium
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}

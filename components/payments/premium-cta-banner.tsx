"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Sparkles } from "lucide-react"
import { PremiumTierModal } from "./premium-tier-modal"

export function PremiumCTABanner() {
  const [modalOpen, setModalOpen] = useState(false)

  return (
    <>
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
            <Button onClick={() => setModalOpen(true)} className="flex-shrink-0 bg-primary text-primary-foreground hover:bg-gold-muted">
              Get Premium
            </Button>
          </div>
        </CardContent>
      </Card>

      <PremiumTierModal open={modalOpen} onOpenChange={setModalOpen} />
    </>
  )
}

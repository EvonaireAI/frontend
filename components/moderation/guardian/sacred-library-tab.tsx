"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ClipboardCheck, Store } from "lucide-react"
import { PendingReviews } from "@/components/moderation/pending-reviews"
import { ReviewQueuePanel } from "@/components/commons/review-queue-panel"

// Two review queues, one tab: rituals awaiting cultural/emotional safety review
// and Commons listings awaiting publication review. Both existed already —
// grouping them here is the whole change.

export function SacredLibraryTab({ onReviewComplete }: { onReviewComplete?: () => void }) {
  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">Ritual review</h3>
        </div>
        <PendingReviews onReviewComplete={onReviewComplete} />
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Store className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">Commons listings</h3>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Listing review queue</CardTitle>
            <CardDescription>
              Marketplace listings can&apos;t publish until a guardian approves them.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ReviewQueuePanel />
          </CardContent>
        </Card>
      </section>
    </div>
  )
}

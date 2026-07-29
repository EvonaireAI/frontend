"use client"

import { useMemo, useState } from "react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Inbox, RefreshCw } from "lucide-react"
import { CaseCard } from "@/components/moderation/case-card"
import { CaseDetail } from "@/components/moderation/case-detail"
import { TakeCaseButton, type GuardianOption } from "@/components/moderation/case-actions"
import { useCaseList } from "./use-case-list"
import type { ModerationCase } from "@/lib/moderation"

// Pending Reviews — `?stage=pending_review`: open AND unassigned, newest first
// (the server orders them). Escalated cases are pinned to the top; everything
// else keeps the server's order.

export function PendingTab({ guardians }: { guardians: GuardianOption[] }) {
  const [selected, setSelected] = useState<ModerationCase | null>(null)
  const { cases, loading, error, reload } = useCaseList({ stage: "pending_review" })

  const ordered = useMemo(() => {
    return [...cases].sort((a, b) => Number(!!b.crisis_escalated) - Number(!!a.crisis_escalated))
  }, [cases])

  if (selected) {
    return (
      <CaseDetail
        case={selected}
        guardians={guardians}
        onBack={() => setSelected(null)}
        onUpdate={() => {
          setSelected(null)
          reload()
        }}
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Unclaimed care cases. Taking one moves it into your Active Cases.
        </p>
        <Button variant="outline" size="sm" onClick={reload} disabled={loading}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-32 w-full" />
          ))}
        </div>
      ) : ordered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-16 text-center">
          <Inbox className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="font-medium text-foreground">Nothing waiting</p>
          <p className="mt-1 text-sm text-muted-foreground">Every open case has a guardian.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {ordered.map((moderationCase) => (
            <CaseCard
              key={moderationCase.id}
              moderationCase={moderationCase}
              onOpen={setSelected}
              actions={<TakeCaseButton caseId={moderationCase.id} onSettled={reload} />}
            />
          ))}
        </div>
      )}
    </div>
  )
}

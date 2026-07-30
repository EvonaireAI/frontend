"use client"

import { useState } from "react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { CheckCircle2, RefreshCw } from "lucide-react"
import { CaseCard } from "@/components/moderation/case-card"
import { CaseDetail } from "@/components/moderation/case-detail"
import {
  EscalateCaseDialog,
  ReleaseCaseDialog,
  ResolveCaseDialog,
  type GuardianOption,
} from "@/components/moderation/case-actions"
import { useCaseList } from "./use-case-list"
import type { ModerationCase } from "@/lib/moderation"

// Active Cases — the caller's queue by default (`?stage=active&assigned=me`),
// with a toggle for every guardian's (`?stage=active`).

export function ActiveTab({ guardians }: { guardians: GuardianOption[] }) {
  const [scope, setScope] = useState<"me" | "all">("me")
  const [selected, setSelected] = useState<ModerationCase | null>(null)
  const [resolveFor, setResolveFor] = useState<ModerationCase | null>(null)
  const [releaseFor, setReleaseFor] = useState<ModerationCase | null>(null)
  const [escalateFor, setEscalateFor] = useState<ModerationCase | null>(null)

  const { cases, loading, error, reload } = useCaseList(
    scope === "me" ? { stage: "active", assigned: "me" } : { stage: "active" },
  )

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
        <div className="inline-flex rounded-lg border border-border p-1">
          <button
            type="button"
            onClick={() => setScope("me")}
            className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
              scope === "me" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            My queue
          </button>
          <button
            type="button"
            onClick={() => setScope("all")}
            className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
              scope === "all" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            All guardians
          </button>
        </div>
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
      ) : cases.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-16 text-center">
          <CheckCircle2 className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="font-medium text-foreground">
            {scope === "me" ? "Your queue is clear" : "No cases are being worked right now"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {scope === "me" ? "Take one from Pending Reviews when you're ready." : "Everything open is still unclaimed."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {cases.map((moderationCase) => (
            <CaseCard
              key={moderationCase.id}
              moderationCase={moderationCase}
              onOpen={setSelected}
              showAssignee={scope === "all"}
              actions={
                <>
                  <Button size="sm" onClick={() => setResolveFor(moderationCase)}>
                    Resolve
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setReleaseFor(moderationCase)}>
                    Release
                  </Button>
                  {!moderationCase.crisis_escalated && (
                    <Button variant="outline" size="sm" onClick={() => setEscalateFor(moderationCase)}>
                      Escalate
                    </Button>
                  )}
                </>
              }
            />
          ))}
        </div>
      )}

      <ResolveCaseDialog
        moderationCase={resolveFor}
        open={!!resolveFor}
        onOpenChange={(open) => !open && setResolveFor(null)}
        onSettled={reload}
      />
      <ReleaseCaseDialog
        moderationCase={releaseFor}
        open={!!releaseFor}
        onOpenChange={(open) => !open && setReleaseFor(null)}
        onSettled={reload}
      />
      <EscalateCaseDialog
        moderationCase={escalateFor}
        open={!!escalateFor}
        onOpenChange={(open) => !open && setEscalateFor(null)}
        onSettled={reload}
      />
    </div>
  )
}

"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, AlertTriangle, Bot, CheckCircle, Clock, FileText, Flag, User as UserIcon } from "lucide-react"
import {
  SEVERITY_CHIPS,
  STAGE_LABELS,
  caseStage,
  historyEventLabel,
  violationLabel,
  type CaseHistoryEntry,
  type ModerationCase,
} from "@/lib/moderation"
import {
  ArchiveCaseDialog,
  DelegateCaseDialog,
  EscalateCaseDialog,
  ReleaseCaseDialog,
  ResolveCaseDialog,
  TakeCaseButton,
  type GuardianOption,
} from "@/components/moderation/case-actions"

// The case detail view. Every action here goes through a transition endpoint —
// the `stage` the serializer returns decides which ones are offered, so the UI
// never re-derives the workflow position from `status` + `assigned_moderator`.

interface CaseDetailProps {
  case: ModerationCase
  onBack: () => void
  /** Refetch the list this case came from. */
  onUpdate: () => void
  guardians?: GuardianOption[]
}

/** Keys already rendered as the entry's own header — everything else on a
 *  history entry is event-specific and worth showing verbatim. */
const HISTORY_META_KEYS = new Set(["at", "by", "event"])

function HistoryEntryRow({ entry }: { entry: CaseHistoryEntry }) {
  const extras = Object.entries(entry).filter(
    ([key, value]) => !HISTORY_META_KEYS.has(key) && value !== null && value !== "" && value !== undefined,
  )

  return (
    <div className="flex items-start gap-3 border-b border-border pb-3 text-sm last:border-0 last:pb-0">
      <div className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-primary" />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-foreground">{historyEventLabel(entry.event)}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
          <span className="break-all">{entry.by || "System"}</span>
          <span>·</span>
          <span>{entry.at ? new Date(entry.at).toLocaleString() : "—"}</span>
        </div>
        {extras.length > 0 && (
          <dl className="mt-2 space-y-1 rounded-md bg-muted p-2 text-xs">
            {extras.map(([key, value]) => (
              <div key={key} className="flex flex-wrap gap-x-2">
                <dt className="text-muted-foreground capitalize">{key.replace(/_/g, " ")}:</dt>
                <dd className="min-w-0 break-words text-foreground">
                  {typeof value === "object" ? JSON.stringify(value) : String(value)}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </div>
  )
}

export function CaseDetail({ case: moderationCase, onBack, onUpdate, guardians = [] }: CaseDetailProps) {
  const [resolveOpen, setResolveOpen] = useState(false)
  const [releaseOpen, setReleaseOpen] = useState(false)
  const [delegateOpen, setDelegateOpen] = useState(false)
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [escalateOpen, setEscalateOpen] = useState(false)
  const [pickable, setPickable] = useState<GuardianOption[]>(guardians)

  const stage = caseStage(moderationCase)
  const severity = SEVERITY_CHIPS[moderationCase.severity] ?? {
    label: moderationCase.severity ?? "—",
    className: "bg-muted text-muted-foreground border-border",
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={onBack} variant="outline" size="sm">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <div className="min-w-0">
          <h2 className="text-2xl font-bold text-foreground">Care Case #{moderationCase.id}</h2>
          <p className="text-sm text-muted-foreground">{STAGE_LABELS[stage]}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Case information
              </CardTitle>
              <div className="flex flex-wrap gap-2 pt-2">
                <Badge variant="outline" className={severity.className}>
                  {severity.label}
                </Badge>
                <Badge variant="outline">{STAGE_LABELS[stage]}</Badge>
                <Badge variant="outline">
                  <Flag className="mr-1 h-3 w-3" />
                  {violationLabel(moderationCase.violation_type)}
                </Badge>
                {moderationCase.flagged_by_ai && (
                  <Badge variant="outline" className="text-muted-foreground">
                    <Bot className="mr-1 h-3 w-3" />
                    Flagged by GAIA
                  </Badge>
                )}
                {moderationCase.crisis_escalated && (
                  <Badge className="border-0 bg-red-600 text-white">
                    <AlertTriangle className="mr-1 h-3 w-3" />
                    Care Escalation
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {moderationCase.reporter_email && (
                <div className="rounded-lg bg-muted p-3">
                  <h4 className="mb-1 flex items-center gap-2 text-sm font-medium">
                    <UserIcon className="h-4 w-4" />
                    Reported by
                  </h4>
                  <p className="break-all text-sm text-muted-foreground">{moderationCase.reporter_email}</p>
                </div>
              )}

              {moderationCase.ritual_title && (
                <div>
                  <h4 className="mb-1 text-sm font-medium">Related ritual</h4>
                  <p className="break-words rounded bg-muted p-3 text-sm text-foreground">
                    {moderationCase.ritual_title}
                    {moderationCase.ritual && (
                      <span className="ml-2 text-muted-foreground">(ID: {moderationCase.ritual})</span>
                    )}
                  </p>
                </div>
              )}

              {moderationCase.flagged_reason && (
                <div>
                  <h4 className="mb-1 text-sm font-medium">Reason</h4>
                  <p className="break-words rounded bg-muted p-3 text-sm text-muted-foreground">
                    {moderationCase.flagged_reason}
                  </p>
                </div>
              )}

              {moderationCase.resolution_note && (
                <div>
                  <h4 className="mb-1 text-sm font-medium">Resolution note</h4>
                  <p className="break-words rounded bg-muted p-3 text-sm text-foreground">
                    {moderationCase.resolution_note}
                  </p>
                </div>
              )}

              <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="font-medium">Opened</dt>
                  <dd className="text-muted-foreground">{new Date(moderationCase.created_at).toLocaleString()}</dd>
                </div>
                <div>
                  <dt className="font-medium">Assigned guardian</dt>
                  <dd className="break-all text-muted-foreground">
                    {moderationCase.assigned_moderator_email || "Unassigned"}
                  </dd>
                </div>
                {moderationCase.resolved_at && (
                  <div>
                    <dt className="font-medium">Resolved</dt>
                    <dd className="text-muted-foreground">
                      {new Date(moderationCase.resolved_at).toLocaleString()}
                      {moderationCase.resolved_by_email && ` · ${moderationCase.resolved_by_email}`}
                    </dd>
                  </div>
                )}
                {moderationCase.archived_at && (
                  <div>
                    <dt className="font-medium">Archived</dt>
                    <dd className="text-muted-foreground">
                      {new Date(moderationCase.archived_at).toLocaleString()}
                      {moderationCase.archived_by_email && ` · ${moderationCase.archived_by_email}`}
                    </dd>
                  </div>
                )}
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Care History
              </CardTitle>
              <CardDescription>Every action taken on this case, oldest first.</CardDescription>
            </CardHeader>
            <CardContent>
              {!moderationCase.history || moderationCase.history.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  Nothing has happened on this case yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {moderationCase.history.map((entry, index) => (
                    <HistoryEntryRow key={`${entry.event}-${entry.at}-${index}`} entry={entry} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {stage === "pending_review" && (
                <>
                  <TakeCaseButton caseId={moderationCase.id} onSettled={onUpdate} size="default" />
                  <Button variant="outline" className="w-full" onClick={() => setDelegateOpen(true)}>
                    Delegate to a guardian
                  </Button>
                  <Button variant="outline" className="w-full" onClick={() => setResolveOpen(true)}>
                    Resolve
                  </Button>
                </>
              )}

              {stage === "active" && (
                <>
                  <Button className="w-full" onClick={() => setResolveOpen(true)}>
                    Resolve
                  </Button>
                  <Button variant="outline" className="w-full" onClick={() => setReleaseOpen(true)}>
                    Release
                  </Button>
                  <Button variant="outline" className="w-full" onClick={() => setDelegateOpen(true)}>
                    Delegate
                  </Button>
                </>
              )}

              {stage === "resolved" && (
                <Button variant="outline" className="w-full" onClick={() => setArchiveOpen(true)}>
                  Archive
                </Button>
              )}

              {stage === "archived" && (
                <p className="text-sm text-muted-foreground">
                  This case is archived. It stays readable here and in The Archive; nothing further happens to it.
                </p>
              )}

              {stage !== "archived" && !moderationCase.crisis_escalated && (
                <Button variant="destructive" className="w-full" onClick={() => setEscalateOpen(true)}>
                  <AlertTriangle className="mr-2 h-4 w-4" />
                  Care Escalation
                </Button>
              )}
            </CardContent>
          </Card>

          {moderationCase.crisis_escalated && (
            <Card className="border-red-600 bg-red-600/10">
              <CardContent className="py-6 text-center">
                <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-red-600" />
                <h3 className="mb-1 font-semibold text-red-600">Escalated</h3>
                <p className="text-sm text-muted-foreground">
                  The crisis team has this case. It still moves through resolve and archive as normal.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <ResolveCaseDialog
        moderationCase={moderationCase}
        open={resolveOpen}
        onOpenChange={setResolveOpen}
        onSettled={onUpdate}
      />
      <ReleaseCaseDialog
        moderationCase={moderationCase}
        open={releaseOpen}
        onOpenChange={setReleaseOpen}
        onSettled={onUpdate}
      />
      <DelegateCaseDialog
        moderationCase={moderationCase}
        guardians={pickable}
        open={delegateOpen}
        onOpenChange={setDelegateOpen}
        onSettled={onUpdate}
        onNotAGuardian={(id) => setPickable((prev) => prev.filter((g) => g.id !== id))}
      />
      <ArchiveCaseDialog
        moderationCase={moderationCase}
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        onSettled={onUpdate}
      />
      <EscalateCaseDialog
        moderationCase={moderationCase}
        open={escalateOpen}
        onOpenChange={setEscalateOpen}
        onSettled={onUpdate}
      />
    </div>
  )
}

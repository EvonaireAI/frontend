"use client"

import type { ReactNode } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { AlertTriangle, Bot, Clock, Flag, User as UserIcon } from "lucide-react"
import {
  SEVERITY_CHIPS,
  relativeAge,
  violationLabel,
  type ModerationCase,
} from "@/lib/moderation"

// One row component for every care-case list — Pending Reviews, Active Cases
// and Care History all render this. The differences between the tabs are the
// action slot and which metadata is worth showing, not the row itself.

interface CaseCardProps {
  moderationCase: ModerationCase
  onOpen: (moderationCase: ModerationCase) => void
  /** Row actions — "Take this case", Resolve/Release/Escalate, Archive. */
  actions?: ReactNode
  /** Active Cases in "all guardians" mode shows who holds each case. */
  showAssignee?: boolean
  /** Care History shows the resolution note and who wrote it. */
  showResolution?: boolean
}

export function CaseCard({
  moderationCase,
  onOpen,
  actions,
  showAssignee = false,
  showResolution = false,
}: CaseCardProps) {
  const severity = SEVERITY_CHIPS[moderationCase.severity] ?? {
    label: moderationCase.severity ?? "—",
    className: "bg-muted text-muted-foreground border-border",
  }
  const escalated = !!moderationCase.crisis_escalated

  return (
    <Card
      className={`border-l-4 transition-shadow hover:shadow-md ${
        escalated
          ? "border-l-red-600 ring-1 ring-red-200 dark:ring-red-900/40"
          : moderationCase.severity === "high"
            ? "border-l-red-500"
            : moderationCase.severity === "medium"
              ? "border-l-yellow-500"
              : "border-l-green-500"
      }`}
    >
      <CardContent className="p-4 sm:p-5 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onOpen(moderationCase)}
            className="font-semibold text-foreground hover:text-primary underline-offset-4 hover:underline"
          >
            Case #{moderationCase.id}
          </button>
          {escalated && (
            <Badge className="bg-red-600 text-white border-0">
              <AlertTriangle className="w-3 h-3 mr-1" />
              Care Escalation
            </Badge>
          )}
          <Badge variant="outline" className={severity.className}>
            {severity.label}
          </Badge>
          <Badge variant="outline" className="text-xs">
            <Flag className="w-3 h-3 mr-1" />
            {violationLabel(moderationCase.violation_type)}
          </Badge>
          {/* A reporter's email can be long enough to push past a 375px
              viewport, and badges don't wrap — so this one truncates. */}
          <Badge variant="outline" className="max-w-full min-w-0 overflow-hidden text-xs text-muted-foreground">
            {moderationCase.flagged_by_ai ? (
              <>
                <Bot className="w-3 h-3 mr-1" />
                Flagged by GAIA
              </>
            ) : (
              <>
                <UserIcon className="w-3 h-3 mr-1 flex-shrink-0" />
                <span className="truncate">
                  {moderationCase.reporter_email ? `Reported by ${moderationCase.reporter_email}` : "Reported"}
                </span>
              </>
            )}
          </Badge>
        </div>

        {moderationCase.ritual_title && (
          <p className="text-sm font-medium text-primary break-words">{moderationCase.ritual_title}</p>
        )}

        {moderationCase.flagged_reason && (
          <p className="text-sm text-muted-foreground line-clamp-2 break-words">{moderationCase.flagged_reason}</p>
        )}

        {showResolution && moderationCase.resolution_note && (
          <div className="rounded-md bg-muted p-3 text-sm">
            <p className="text-foreground break-words">{moderationCase.resolution_note}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Resolved by {moderationCase.resolved_by_email || "—"}
              {moderationCase.resolved_at && ` · ${new Date(moderationCase.resolved_at).toLocaleDateString()}`}
            </p>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            {relativeAge(moderationCase.created_at)} old
          </span>
          {showAssignee && (
            <span className="flex items-center gap-1 break-all">
              <UserIcon className="w-3.5 h-3.5" />
              {moderationCase.assigned_moderator_email || "Unassigned"}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          {actions}
          <Button variant="ghost" size="sm" onClick={() => onOpen(moderationCase)}>
            Open
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

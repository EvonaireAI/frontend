"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ChevronDown, ChevronRight, RefreshCw } from "lucide-react"
import {
  ARCHIVE_TYPE_CHIPS,
  actorLabel,
  adminService,
  archiveTypeLabel,
  type ArchiveEntry,
  type ArchivePage,
  type ArchiveType,
} from "@/lib/admin"

// The Archive: four append-only sources merged into one reverse-chronological
// trail with a single uniform entry shape, so this is ONE row component, not
// four. Read-only by design — nothing here writes, and nothing suggests it can.

const PAGE_SIZE = 50

/** Documented action codes per source. `type` narrows the list; an unlisted
 *  code is still valid to type by hand, which is why this is a hint and not a
 *  closed vocabulary in the request. */
const ACTIONS_BY_TYPE: Record<ArchiveType, string[]> = {
  sanctuary: [
    "created",
    "updated",
    "join_requested",
    "join_approved",
    "join_rejected",
    "membership_revoked",
    "membership_left",
    "capacity_changed",
    "status_changed",
    "ritual_assigned",
    "ritual_removed",
    "license_revoked",
    "rts_threshold",
    "removed",
  ],
  moderation: ["case_opened", "case_resolved", "case_archived", "ritual_review"],
  royalty: ["earning", "idle_redistribution", "adjustment", "refund_reversal", "fraud_hold", "payout", "rollover"],
  subscription: [
    "created",
    "activated",
    "upgraded",
    "downgraded",
    "canceled_scheduled",
    "canceled",
    "renewed",
    "payment_failed",
    "reactivated",
  ],
  // Session 12 — SecurityAuditLog.EventType.
  security: [
    "stream_token_issued",
    "stream_token_rejected",
    "stream_denied",
    "session_superseded",
    "session_terminated",
    "abuse_warning",
    "abuse_flag_opened",
    "abuse_flag_resolved",
    "enforcement_action",
    "playback_restricted",
    "playback_restriction_lifted",
    "account_suspended",
    "license_changed",
    "license_reviewed",
    "entitlement_granted",
    "entitlement_revoked",
  ],
}

function ArchiveRow({ entry }: { entry: ArchiveEntry }) {
  const [expanded, setExpanded] = useState(false)
  const contextEntries = Object.entries(entry.context ?? {})

  return (
    <div className="border-b border-border last:border-0">
      <button
        type="button"
        onClick={() => setExpanded((current) => !current)}
        className="flex w-full items-start gap-3 p-3 text-left transition-colors hover:bg-muted/50"
      >
        <span className="mt-0.5 text-muted-foreground">
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </span>
        <span className="min-w-0 flex-1 space-y-1">
          <span className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className={`text-xs ${ARCHIVE_TYPE_CHIPS[entry.type] ?? "bg-muted text-muted-foreground border-border"}`}
            >
              {archiveTypeLabel(entry.type)}
            </Badge>
            <Badge variant="outline" className="text-xs capitalize">
              {entry.action.replace(/_/g, " ")}
            </Badge>
            <span className="text-xs text-muted-foreground">{new Date(entry.at).toLocaleString()}</span>
          </span>
          <span className="block break-words text-sm text-foreground">{entry.summary}</span>
          <span className="flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
            <span className="break-words">{entry.subject}</span>
            <span className="break-all">by {actorLabel(entry.actor, entry.type)}</span>
          </span>
        </span>
      </button>

      {expanded && contextEntries.length > 0 && (
        <dl className="mx-3 mb-3 space-y-1 rounded-md bg-muted p-3 text-xs">
          {contextEntries.map(([key, value]) => (
            <div key={key} className="flex flex-wrap gap-x-2">
              <dt className="capitalize text-muted-foreground">{key.replace(/_/g, " ")}:</dt>
              <dd className="min-w-0 break-words text-foreground">
                {value === null || value === undefined
                  ? "—"
                  : typeof value === "object"
                    ? JSON.stringify(value)
                    : String(value)}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  )
}

export function ArchiveTab() {
  const [selectedType, setSelectedType] = useState<string>("all")
  const [action, setAction] = useState<string>("all")
  const [since, setSince] = useState("")
  const [until, setUntil] = useState("")
  const [actorId, setActorId] = useState("")
  const [offset, setOffset] = useState(0)

  const [data, setData] = useState<ArchivePage | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setData(
        await adminService.getArchive({
          type: selectedType === "all" ? undefined : selectedType,
          action: action === "all" ? undefined : action,
          since: since || undefined,
          until: until || undefined,
          actor_id: actorId ? Number(actorId) : undefined,
          limit: PAGE_SIZE,
          offset,
        }),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load The Archive")
    } finally {
      setLoading(false)
    }
  }, [selectedType, action, since, until, actorId, offset])

  useEffect(() => {
    load()
  }, [load])

  // Any filter change invalidates the current offset.
  useEffect(() => {
    setOffset(0)
  }, [selectedType, action, since, until, actorId])

  // `available_types` is authoritative — a new source added server-side shows
  // up as a chip on its own. This fallback only covers the first paint.
  const availableTypes: ArchiveType[] = data?.available_types ?? [
    "sanctuary",
    "moderation",
    "royalty",
    "subscription",
    "security",
  ]

  const actionOptions = useMemo(() => {
    if (selectedType !== "all" && ACTIONS_BY_TYPE[selectedType as ArchiveType]) {
      return ACTIONS_BY_TYPE[selectedType as ArchiveType]
    }
    return [...new Set(availableTypes.flatMap((type) => ACTIONS_BY_TYPE[type] ?? []))].sort()
  }, [selectedType, availableTypes])

  const total = data?.total ?? 0
  const firstRow = total === 0 ? 0 : offset + 1
  const lastRow = Math.min(offset + PAGE_SIZE, total)
  const deepPaging = offset >= PAGE_SIZE * 10

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-2xl text-sm text-muted-foreground">
          One trail across every append-only source the platform keeps. Read-only — nothing here can be edited or
          removed.
        </p>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setSelectedType("all")}
          className={`rounded-full border px-3 py-1 text-sm transition-colors ${
            selectedType === "all"
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          All sources
        </button>
        {availableTypes.map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => setSelectedType(type)}
            className={`rounded-full border px-3 py-1 text-sm transition-colors ${
              selectedType === type
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {archiveTypeLabel(type)}
          </button>
        ))}
      </div>

      <div className="grid gap-3 rounded-lg border border-border p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5">
          <Label htmlFor="archive-action">Action</Label>
          <Select value={action} onValueChange={setAction}>
            <SelectTrigger id="archive-action">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any action</SelectItem>
              {actionOptions.map((option) => (
                <SelectItem key={option} value={option}>
                  {option.replace(/_/g, " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="archive-since">From</Label>
          <Input id="archive-since" type="date" value={since} onChange={(e) => setSince(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="archive-until">To</Label>
          <Input id="archive-until" type="date" value={until} onChange={(e) => setUntil(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="archive-actor">Actor user id</Label>
          <Input
            id="archive-actor"
            inputMode="numeric"
            value={actorId}
            onChange={(e) => setActorId(e.target.value.replace(/\D/g, ""))}
            placeholder="e.g. 7"
          />
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {deepPaging && (
        <Alert>
          <AlertDescription className="text-sm">
            Deep paging gets slower the further back you go — narrowing by source and date range is much faster
            than scrolling.
          </AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-16 w-full" />
          ))}
        </div>
      ) : !data || data.entries.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-16 text-center">
          <p className="font-medium text-foreground">Nothing matches these filters</p>
          <p className="mt-1 text-sm text-muted-foreground">Try a wider date range or all sources.</p>
        </div>
      ) : (
        <>
          {/* The trail scrolls inside its own container on narrow viewports. */}
          <div className="w-full overflow-x-auto rounded-lg border border-border">
            <div className="min-w-[36rem]">
              {data.entries.map((entry) => (
                // `id` is "<kind>:<pk>" — unique across sources, and a key only.
                <ArchiveRow key={entry.id} entry={entry} />
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Showing {firstRow.toLocaleString()}–{lastRow.toLocaleString()} of {total.toLocaleString()}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={offset === 0 || loading}
                onClick={() => setOffset((current) => Math.max(0, current - PAGE_SIZE))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!data.has_more || loading}
                onClick={() => setOffset((current) => current + PAGE_SIZE)}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

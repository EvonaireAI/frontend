"use client"

import { useEffect, useState } from "react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Archive, RefreshCw, Search } from "lucide-react"
import { CaseDetail } from "@/components/moderation/case-detail"
import { ArchiveCaseDialog, type GuardianOption } from "@/components/moderation/case-actions"
import { useCaseList } from "./use-case-list"
import { SEVERITY_CHIPS, violationLabel, type CaseFilters, type ModerationCase } from "@/lib/moderation"

// Care History — the only paginated tab. Sending `page` flips the cases
// endpoint into the `{count, next, previous, results}` envelope; `unwrapList`
// in the fetch layer means nothing here has to care which shape came back.

const PAGE_SIZE = 25

const VIOLATION_OPTIONS = [
  "cultural_harm",
  "safety_risk",
  "misinformation",
  "inappropriate_content",
  "spam",
  "other",
]

export function HistoryTab({ guardians }: { guardians: GuardianOption[] }) {
  const [archived, setArchived] = useState(false)
  const [severity, setSeverity] = useState("all")
  const [violationType, setViolationType] = useState("all")
  const [since, setSince] = useState("")
  const [until, setUntil] = useState("")
  const [queryInput, setQueryInput] = useState("")
  const [query, setQuery] = useState("")
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<ModerationCase | null>(null)
  const [archiveFor, setArchiveFor] = useState<ModerationCase | null>(null)

  const filters: CaseFilters = {
    stage: archived ? "archived" : "resolved",
    severity: severity === "all" ? undefined : severity,
    violation_type: violationType === "all" ? undefined : violationType,
    since: since || undefined,
    until: until || undefined,
    q: query || undefined,
    page,
    page_size: PAGE_SIZE,
  }

  const { page: result, cases, loading, error, reload } = useCaseList(filters)

  // Any filter change invalidates the current page number.
  useEffect(() => {
    setPage(1)
  }, [archived, severity, violationType, since, until, query])

  const total = result?.count ?? cases.length
  const firstRow = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const lastRow = Math.min(page * PAGE_SIZE, total)
  const hasNext = !!result?.next
  const hasPrevious = page > 1

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
      <div className="rounded-lg border border-border p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="history-severity">Severity</Label>
            <Select value={severity} onValueChange={setSeverity}>
              <SelectTrigger id="history-severity">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All severities</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="history-violation">Violation type</Label>
            <Select value={violationType} onValueChange={setViolationType}>
              <SelectTrigger id="history-violation">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {VIOLATION_OPTIONS.map((type) => (
                  <SelectItem key={type} value={type}>
                    {violationLabel(type)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="history-since">From</Label>
            <Input id="history-since" type="date" value={since} onChange={(e) => setSince(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="history-until">To</Label>
            <Input id="history-until" type="date" value={until} onChange={(e) => setUntil(e.target.value)} />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div className="min-w-[12rem] flex-1 space-y-1.5">
            <Label htmlFor="history-q">Search</Label>
            <div className="flex gap-2">
              <Input
                id="history-q"
                value={queryInput}
                onChange={(e) => setQueryInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") setQuery(queryInput.trim())
                }}
                placeholder="Reason, resolution note or ritual title"
              />
              <Button variant="outline" onClick={() => setQuery(queryInput.trim())}>
                <Search className="h-4 w-4" />
                <span className="sr-only">Search</span>
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-2 pb-2">
            <Switch id="history-archived" checked={archived} onCheckedChange={setArchived} />
            <Label htmlFor="history-archived" className="cursor-pointer">
              Archived only
            </Label>
          </div>
          <Button variant="outline" size="sm" className="mb-1" onClick={reload} disabled={loading}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-12 w-full" />
          ))}
        </div>
      ) : cases.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-16 text-center">
          <p className="font-medium text-foreground">Nothing matches these filters</p>
          <p className="mt-1 text-sm text-muted-foreground">Widen the date range or clear the search.</p>
        </div>
      ) : (
        <>
          {/* The table scrolls inside its own container — the page body never
              scrolls sideways on a 375px viewport. */}
          <div className="w-full overflow-x-auto rounded-lg border border-border">
            <Table className="min-w-[52rem]">
              <TableHeader>
                <TableRow>
                  <TableHead>Case</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Resolution note</TableHead>
                  <TableHead>Resolved by</TableHead>
                  <TableHead>Resolved</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cases.map((moderationCase) => {
                  const chip = SEVERITY_CHIPS[moderationCase.severity] ?? {
                    label: moderationCase.severity ?? "—",
                    className: "bg-muted text-muted-foreground border-border",
                  }
                  return (
                    <TableRow key={moderationCase.id}>
                      <TableCell>
                        <button
                          type="button"
                          onClick={() => setSelected(moderationCase)}
                          className="font-medium text-foreground underline-offset-4 hover:text-primary hover:underline"
                        >
                          #{moderationCase.id}
                        </button>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`${chip.className} text-xs`}>
                          {chip.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {violationLabel(moderationCase.violation_type)}
                      </TableCell>
                      <TableCell className="max-w-[20rem] text-sm text-foreground">
                        <span className="line-clamp-2">{moderationCase.resolution_note || "—"}</span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {moderationCase.resolved_by_email || "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {moderationCase.resolved_at
                          ? new Date(moderationCase.resolved_at).toLocaleDateString()
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {!archived && (
                          <Button variant="outline" size="sm" onClick={() => setArchiveFor(moderationCase)}>
                            <Archive className="mr-2 h-4 w-4" />
                            Archive
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Showing {firstRow.toLocaleString()}–{lastRow.toLocaleString()} of {total.toLocaleString()}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={!hasPrevious || loading}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!hasNext || loading}
                onClick={() => setPage((current) => current + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}

      <ArchiveCaseDialog
        moderationCase={archiveFor}
        open={!!archiveFor}
        onOpenChange={(open) => !open && setArchiveFor(null)}
        onSettled={reload}
      />
    </div>
  )
}

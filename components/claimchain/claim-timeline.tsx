"use client"

import { useState } from "react"
import { format } from "date-fns"
import { ChevronDown, ChevronRight } from "lucide-react"
import { AnchorStatusBadge } from "@/components/claimchain/anchoring-note"
import { HashValue } from "@/components/claimchain/copy-value"
import { eventLabel, type Anchoring, type ClaimEvent } from "@/lib/claimchain"

// Oldest first: this is a history, and a history read newest-first makes the
// chain links run backwards, which is exactly the thing the reader is being
// invited to follow.
//
// The hashes live in a collapsed drawer. They are the evidence and they must be
// reachable, but a creator opening this page wants to know what happened, not
// to read 64 hex characters four times per row.

function TechnicalRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid sm:grid-cols-[9rem_1fr] gap-1 sm:gap-3 py-1.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-xs text-foreground min-w-0">{children}</dd>
    </div>
  )
}

function EventRow({
  event,
  anchoring,
  isLast,
}: {
  event: ClaimEvent
  anchoring: Anchoring | null | undefined
  isLast: boolean
}) {
  const [open, setOpen] = useState(false)

  return (
    <li className="relative pl-8 pb-5">
      {/* Connector, drawn between dots rather than after the last one. */}
      {!isLast && <span className="absolute left-[7px] top-4 bottom-0 w-px bg-border" aria-hidden />}
      <span
        className="absolute left-0 top-1 w-3.5 h-3.5 rounded-full border-2 border-primary/50 bg-background"
        aria-hidden
      />

      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <p className="text-sm font-medium text-foreground">{eventLabel(event.event_type)}</p>
        <time className="text-xs text-muted-foreground" dateTime={event.created_at}>
          {format(new Date(event.created_at), "d MMM yyyy, HH:mm")}
        </time>
      </div>

      <div className="mt-1.5 flex items-center gap-2 flex-wrap">
        <AnchorStatusBadge status={event.anchor_status} anchoring={anchoring} />
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          {open ? (
            <ChevronDown className="w-3.5 h-3.5" aria-hidden />
          ) : (
            <ChevronRight className="w-3.5 h-3.5" aria-hidden />
          )}
          Technical detail
        </button>
      </div>

      {open && (
        <dl className="mt-2 rounded-lg border border-border bg-secondary/40 px-3 py-2 divide-y divide-border">
          <TechnicalRow label="Event">
            <span className="font-mono">{event.id}</span>
          </TechnicalRow>
          <TechnicalRow label="Payload hash">
            <HashValue value={event.payload_hash} label="payload hash" />
          </TechnicalRow>
          <TechnicalRow label="Previous hash">
            {event.prev_hash ? (
              <HashValue value={event.prev_hash} label="previous hash" />
            ) : (
              <span className="text-muted-foreground">
                None — this is the first event in the ledger
              </span>
            )}
          </TechnicalRow>
          <TechnicalRow label="Batch root">
            {event.batch_root ? (
              <HashValue value={event.batch_root} label="batch root" />
            ) : (
              <span className="text-muted-foreground">
                Not yet sealed into a batch. Batches are sealed every few minutes.
              </span>
            )}
          </TechnicalRow>
          <TechnicalRow label="Publication">
            <AnchorStatusBadge status={event.anchor_status} anchoring={anchoring} />
          </TechnicalRow>
        </dl>
      )}
    </li>
  )
}

export function ClaimTimeline({
  events,
  anchoring,
}: {
  events: ClaimEvent[]
  anchoring: Anchoring | null | undefined
}) {
  // Oldest first, by creation time then id — the append order is the chain order.
  const ordered = [...(events || [])].sort((a, b) => {
    const byTime = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    return byTime !== 0 ? byTime : a.id - b.id
  })

  if (ordered.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No claim events recorded for this ritual yet.
      </p>
    )
  }

  return (
    <ol className="mt-1">
      {ordered.map((event, index) => (
        <EventRow
          key={event.id}
          event={event}
          anchoring={anchoring}
          isLast={index === ordered.length - 1}
        />
      ))}
    </ol>
  )
}

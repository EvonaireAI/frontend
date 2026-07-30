"use client"

import { useState } from "react"
import { AlertTriangle, Info, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { verifyEventChain, type ChainCheck, type ClaimEvent } from "@/lib/claimchain"

// The check itself runs in the creator's browser over hashes they can read on
// the same page. That is what makes it worth having: it is not us telling them
// the record is intact, it is them confirming it.
//
// What it proves: each event's `prev_hash` matches the previous event's
// `payload_hash`, so no event in this list has been edited without breaking a
// link. What it does not prove: that the record is complete, or that the whole
// database was not rewritten end to end. We say so rather than implying more.

function plural(count: number, word: string) {
  return `${count} ${word}${count === 1 ? "" : "s"}`
}

function Result({ result }: { result: ChainCheck }) {
  if (result.outcome === "empty") {
    return (
      <div className="flex items-start gap-2 text-sm text-muted-foreground">
        <Info className="w-4 h-4 mt-0.5 shrink-0" aria-hidden />
        <p>
          There are no events to check yet. Nothing has been recorded against this ritual, so
          there is nothing to verify — this is not a pass.
        </p>
      </div>
    )
  }

  if (result.outcome === "single") {
    return (
      <div className="flex items-start gap-2 text-sm">
        <Info className="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground" aria-hidden />
        <p className="text-foreground">
          One event recorded. There are no links to check yet — a second event will chain onto
          this one.
        </p>
      </div>
    )
  }

  if (result.outcome === "intact") {
    return (
      <div className="flex items-start gap-2 text-sm">
        <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0 text-primary" aria-hidden />
        <div>
          <p className="text-foreground font-medium">
            Record intact — {plural(result.events, "event")} verified
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Every event carries the fingerprint of the one before it, so none of them has been
            changed since it was written. Checked in your browser, from the hashes shown below.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-2 text-sm">
      <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-destructive" aria-hidden />
      <div>
        <p className="text-foreground font-medium">
          Couldn&apos;t confirm the link at event {result.brokenEventId}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Event {result.brokenEventId} should carry the fingerprint of event{" "}
          {result.previousEventId}, and it doesn&apos;t. Send those two event numbers to a Steward
          — they can check the record against the full ledger.
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          This view lists only the events about this ritual. If the ledger holds an unrelated
          event between these two, a Steward will see the link that this page cannot.
        </p>
      </div>
    </div>
  )
}

export function ChainCheckPanel({ events }: { events: ClaimEvent[] }) {
  const [result, setResult] = useState<ChainCheck | null>(null)

  return (
    <div className="rounded-lg border border-border bg-secondary/40 p-4 space-y-3">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-sm font-medium text-foreground">Check this record yourself</p>
          <p className="text-xs text-muted-foreground mt-0.5 max-w-prose">
            Each event stores the fingerprint of the previous one. Walking that chain shows
            whether any of them has been altered.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setResult(verifyEventChain(events))}
          className="bg-transparent"
        >
          <ShieldCheck className="w-4 h-4 mr-2" aria-hidden />
          Verify this record
        </Button>
      </div>
      {result && (
        <div className="pt-3 border-t border-border" role="status" aria-live="polite">
          <Result result={result} />
        </div>
      )}
    </div>
  )
}

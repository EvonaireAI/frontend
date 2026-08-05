"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  ChevronDown,
  ChevronRight,
  FileText,
  Music,
  RefreshCw,
  ScrollText,
} from "lucide-react"
import { HashValue } from "@/components/claimchain/copy-value"
import { authService, type Ritual } from "@/lib/auth"
import {
  fetchMyContent,
  humaniseBytes,
  ritualIdFromSubjectRef,
  type ContentFingerprint,
} from "@/lib/claimchain"

// The creator's provenance record: what was published, when it was first seen,
// and the fingerprint that identifies it.
//
// Titles are joined client-side from the creator's own rituals, because the
// fingerprint payload carries only `subject_ref` ("ritual:41"). A missing title
// is not an error state — it means the ritual has been archived or the join
// simply has nothing to offer, and the fingerprint is still the record.

interface ContentGroup {
  ritualId: number | null
  subjectRef: string
  title: string | null
  /** Newest first. More than one is a real version history, not a duplicate. */
  fingerprints: ContentFingerprint[]
}

function groupBySubject(rows: ContentFingerprint[], titles: Map<number, string>): ContentGroup[] {
  const groups = new Map<string, ContentGroup>()

  for (const row of rows) {
    const existing = groups.get(row.subject_ref)
    if (existing) {
      existing.fingerprints.push(row)
      continue
    }
    const ritualId = ritualIdFromSubjectRef(row.subject_ref)
    groups.set(row.subject_ref, {
      ritualId,
      subjectRef: row.subject_ref,
      title: ritualId !== null ? titles.get(ritualId) ?? null : null,
      fingerprints: [row],
    })
  }

  for (const group of groups.values()) {
    group.fingerprints.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )
  }

  return [...groups.values()].sort((a, b) => {
    const aDate = new Date(a.fingerprints[0]?.created_at ?? 0).getTime()
    const bDate = new Date(b.fingerprints[0]?.created_at ?? 0).getTime()
    return bDate - aDate
  })
}

function VersionHistory({ group }: { group: ContentGroup }) {
  const [open, setOpen] = useState(false)
  // The date the *newest* fingerprint arrived is the interesting one: it is the
  // day the file changed.
  const changedOn = format(new Date(group.fingerprints[0].created_at), "d MMMM")

  return (
    <div className="mt-3 pt-3 border-t border-border">
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
        {group.fingerprints.length} versions
      </button>

      {open && (
        <div className="mt-2 space-y-3">
          <p className="text-xs text-muted-foreground max-w-prose">
            The audio for this ritual changed on {changedOn}. Both versions are recorded.
          </p>
          <ul className="space-y-2">
            {group.fingerprints.map((fingerprint, index) => (
              <li key={fingerprint.id} className="flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  className="bg-secondary text-secondary-foreground border-border text-xs"
                >
                  {index === 0 ? "Current" : "Earlier"}
                </Badge>
                <HashValue value={fingerprint.sha256} label="fingerprint" truncate />
                <span className="text-xs text-muted-foreground">
                  {humaniseBytes(fingerprint.byte_size)} ·{" "}
                  {format(new Date(fingerprint.created_at), "d MMM yyyy")}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export default function CreatorProvenancePage() {
  const router = useRouter()
  const [authChecked, setAuthChecked] = useState(false)
  const [rows, setRows] = useState<ContentFingerprint[]>([])
  const [rituals, setRituals] = useState<Ritual[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      // The ritual list is only used to put titles on rows, so a failure there
      // must not lose the provenance record.
      const [page, myRituals] = await Promise.all([
        fetchMyContent({ limit: 200 }),
        authService.getMyRituals().catch(() => [] as Ritual[]),
      ])
      setRows(page.results ?? [])
      setRituals(myRituals)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const check = async () => {
      if (!authService.isAuthenticated()) {
        router.replace("/auth/login")
        return
      }
      try {
        const user = await authService.getProfile()
        if (user.role !== "creator") {
          router.replace("/dashboard")
          return
        }
      } catch {
        router.replace("/auth/login")
        return
      }
      setAuthChecked(true)
      load()
    }
    check()
  }, [router, load])

  const titles = useMemo(
    () => new Map(rituals.map((ritual) => [ritual.id, ritual.title])),
    [rituals],
  )
  const groups = useMemo(() => groupBySubject(rows, titles), [rows, titles])

  if (!authChecked) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Skeleton className="h-8 w-64 mb-6" />
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <ScrollText className="w-5 h-5 text-primary" />
          <h1 className="text-3xl font-bold text-foreground">Provenance &amp; Licenses</h1>
        </div>
        <p className="text-muted-foreground max-w-prose">
          A record of what you published, when it was first seen, and who holds a license to it.
        </p>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription className="flex items-center justify-between gap-4 flex-wrap">
            <span>We couldn&apos;t load your provenance record right now.</span>
            <Button variant="outline" size="sm" onClick={load} className="bg-transparent">
              <RefreshCw className="w-4 h-4 mr-2" aria-hidden />
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <Card key={index} className="bg-card border-border">
              <CardContent className="p-5 space-y-3">
                <Skeleton className="h-6 w-1/2" />
                <Skeleton className="h-4 w-64" />
                <Skeleton className="h-4 w-40" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : groups.length === 0 && !error ? (
        // This is the common state until the backfill has run, so it says why
        // rather than showing a zero that looks like a failure.
        <div className="text-center py-20 border border-dashed border-border rounded-2xl">
          <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-3" aria-hidden />
          <p className="text-foreground font-medium">Nothing recorded yet</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
            Rituals are added to your provenance record when they&apos;re approved.
          </p>
          <Button asChild variant="outline" className="mt-5 bg-transparent">
            <Link href="/creator" className="flex items-center gap-2">
              <Music className="w-4 h-4" aria-hidden />
              Your rituals
            </Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => {
            const newest = group.fingerprints[0]
            return (
              <Card key={group.subjectRef} className="bg-card border-border">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="min-w-0 space-y-2">
                      <h2 className="text-lg font-semibold text-foreground">
                        {group.title ?? "Untitled ritual"}
                      </h2>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-muted-foreground">Fingerprint (SHA-256)</span>
                        <HashValue value={newest.sha256} label="fingerprint" truncate />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {humaniseBytes(newest.byte_size)} · First seen{" "}
                        {format(new Date(newest.first_seen_at), "d MMMM yyyy")}
                      </p>
                    </div>

                    {group.ritualId !== null && (
                      <Button asChild variant="outline" size="sm" className="bg-transparent">
                        <Link href={`/creator/provenance/${group.ritualId}`}>
                          Record &amp; licenses
                        </Link>
                      </Button>
                    )}
                  </div>

                  {group.fingerprints.length > 1 && <VersionHistory group={group} />}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

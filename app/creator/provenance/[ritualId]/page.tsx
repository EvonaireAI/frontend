"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { format } from "date-fns"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, RefreshCw, ScrollText } from "lucide-react"
import { AnchoringNote } from "@/components/claimchain/anchoring-note"
import { ChainCheckPanel } from "@/components/claimchain/chain-check"
import { ClaimTimeline } from "@/components/claimchain/claim-timeline"
import { HashValue } from "@/components/claimchain/copy-value"
import { LicenseTable } from "@/components/claimchain/license-table"
import { authService } from "@/lib/auth"
import {
  ClaimChainError,
  algoLabel,
  fetchContentProvenance,
  humaniseBytes,
  type ContentProvenance,
  type LicenseRecord,
} from "@/lib/claimchain"

// Three blocks, in this order: what the content is, who holds a license to it,
// and what the ledger recorded. The order is the order a creator asks the
// questions in.
//
// A 404 here means "not yours, or not there" and nothing more — provenance is
// deliberately not probeable by id, so the page must not speculate about which.

function FingerprintBlock({ provenance }: { provenance: ContentProvenance }) {
  const [newest, ...earlier] = provenance.fingerprints

  if (!newest) {
    return (
      <p className="text-sm text-muted-foreground max-w-prose">
        No fingerprint recorded for this ritual yet. Rituals are added to your provenance record
        when they&apos;re approved.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <dl className="space-y-3">
        <div className="grid sm:grid-cols-[10rem_1fr] gap-1 sm:gap-4">
          <dt className="text-sm text-muted-foreground">Algorithm</dt>
          <dd className="text-sm text-foreground">{algoLabel(newest.algo)}</dd>
        </div>
        <div className="grid sm:grid-cols-[10rem_1fr] gap-1 sm:gap-4">
          <dt className="text-sm text-muted-foreground">Fingerprint</dt>
          <dd className="min-w-0">
            <HashValue value={newest.sha256} label="fingerprint" />
          </dd>
        </div>
        <div className="grid sm:grid-cols-[10rem_1fr] gap-1 sm:gap-4">
          <dt className="text-sm text-muted-foreground">Size</dt>
          <dd className="text-sm text-foreground">{humaniseBytes(newest.byte_size)}</dd>
        </div>
        <div className="grid sm:grid-cols-[10rem_1fr] gap-1 sm:gap-4">
          <dt className="text-sm text-muted-foreground">First seen</dt>
          <dd className="text-sm text-foreground">
            {format(new Date(newest.first_seen_at), "d MMMM yyyy")}
          </dd>
        </div>
      </dl>

      <p className="text-xs text-muted-foreground max-w-prose">
        This is a fingerprint of the exact audio file. If a copy of this ritual turns up
        elsewhere, this is how it&apos;s identified as yours.
      </p>

      {earlier.length > 0 && (
        <div className="pt-3 border-t border-border space-y-2">
          <p className="text-sm font-medium text-foreground">
            Earlier {earlier.length === 1 ? "version" : "versions"}
          </p>
          <p className="text-xs text-muted-foreground max-w-prose">
            The audio changed after these were recorded. Every version stays in the record.
          </p>
          <ul className="space-y-2 pt-1">
            {earlier.map((fingerprint) => (
              <li key={fingerprint.id} className="flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  className="bg-secondary text-secondary-foreground border-border text-xs"
                >
                  {format(new Date(fingerprint.created_at), "d MMM yyyy")}
                </Badge>
                <HashValue value={fingerprint.sha256} label="fingerprint" truncate />
                <span className="text-xs text-muted-foreground">
                  {humaniseBytes(fingerprint.byte_size)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export default function ProvenanceDetailPage() {
  const router = useRouter()
  const params = useParams<{ ritualId: string }>()
  const ritualId = Number(params?.ritualId)

  const [authChecked, setAuthChecked] = useState(false)
  const [provenance, setProvenance] = useState<ContentProvenance | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    if (!Number.isFinite(ritualId)) {
      setNotFound(true)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(false)
    setNotFound(false)
    try {
      setProvenance(await fetchContentProvenance(ritualId))
    } catch (err) {
      if (err instanceof ClaimChainError && err.status === 404) setNotFound(true)
      else setError(true)
    } finally {
      setLoading(false)
    }
  }, [ritualId])

  useEffect(() => {
    const check = async () => {
      if (!authService.isAuthenticated()) {
        router.replace("/auth/login")
        return
      }
      setAuthChecked(true)
      load()
    }
    check()
  }, [router, load])

  // One row changes; the page is not refetched. The creator sees exactly what
  // they just did.
  const handleLicenseUpdated = (updated: LicenseRecord) => {
    setProvenance((current) =>
      current
        ? {
            ...current,
            licenses: current.licenses.map((license) =>
              license.id === updated.id ? updated : license,
            ),
          }
        : current,
    )
  }

  if (!authChecked || loading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="text-center py-20 border border-dashed border-border rounded-2xl">
          <ScrollText className="w-8 h-8 text-muted-foreground mx-auto mb-3" aria-hidden />
          <p className="text-foreground font-medium">No record here</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
            There&apos;s no provenance record for this ritual under your account.
          </p>
          <Button asChild variant="outline" className="mt-5 bg-transparent">
            <Link href="/creator/provenance">Back to your record</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2 text-muted-foreground">
        <Link href="/creator/provenance">
          <ArrowLeft className="w-4 h-4 mr-2" aria-hidden />
          Provenance &amp; Licenses
        </Link>
      </Button>

      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">
          {provenance?.ritual_title ?? "Provenance record"}
        </h1>
        <p className="text-muted-foreground">
          Fingerprint, licenses and claim history for this ritual.
        </p>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription className="flex items-center justify-between gap-4 flex-wrap">
            <span>We couldn&apos;t load this record right now.</span>
            <Button variant="outline" size="sm" onClick={load} className="bg-transparent">
              <RefreshCw className="w-4 h-4 mr-2" aria-hidden />
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {provenance && (
        <div className="space-y-6">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground">Fingerprint &amp; ownership</CardTitle>
            </CardHeader>
            <CardContent>
              <FingerprintBlock provenance={provenance} />
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground">Licenses issued</CardTitle>
              <CardDescription>
                Everyone who holds a license to this content, and the terms they hold it under.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <LicenseTable
                licenses={provenance.licenses}
                ritualId={provenance.ritual_id}
                ritualTitle={provenance.ritual_title}
                onLicenseUpdated={handleLicenseUpdated}
              />
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground">Claim history</CardTitle>
              <CardDescription>
                Everything the ledger recorded about this content, oldest first.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <ChainCheckPanel events={provenance.events} />
              <ClaimTimeline events={provenance.events} anchoring={provenance.anchoring} />
              <AnchoringNote anchoring={provenance.anchoring} />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

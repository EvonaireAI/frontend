"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { format } from "date-fns"
import { AlertTriangle, CircleSlash, Loader2, ShieldCheck } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { AiUseRows } from "@/components/claimchain/ai-use"
import { AnchoringNote, AnchorStatusBadge } from "@/components/claimchain/anchoring-note"
import { HashValue } from "@/components/claimchain/copy-value"
import {
  algoLabel,
  eventLabel,
  fetchVerification,
  licenseLevelLabel,
  scopeLabel,
  sourceLabel,
  type Verification,
} from "@/lib/claimchain"

// A certificate, not a dashboard. The visitor is a stranger — a distribution
// platform working a takedown request, or a lawyer — and they came for one
// answer, so that answer is the largest thing on the page.
//
// Fetched client-side with no Authorization header, so the response cannot vary
// by who is looking and no session state is involved at any point.

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid sm:grid-cols-[11rem_1fr] gap-1 sm:gap-4 py-2">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground min-w-0">{children}</dd>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="pt-6 border-t border-border">
      <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-3">
        {title}
      </h2>
      {children}
    </section>
  )
}

function Verdict({ verification }: { verification: Verification }) {
  const revoked = verification.revoked || verification.status === "revoked"

  if (revoked) {
    const on = verification.revoked_at
      ? format(new Date(verification.revoked_at), "d MMMM yyyy")
      : null
    return (
      <div className="flex items-start gap-3">
        <CircleSlash className="w-7 h-7 shrink-0 text-muted-foreground mt-1" aria-hidden />
        <div>
          <p className="text-2xl sm:text-3xl font-bold text-foreground text-balance">
            This license was <span className="text-muted-foreground">withdrawn</span>
            {on ? ` on ${on}` : ""}
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            It was granted on {format(new Date(verification.granted_at), "d MMMM yyyy")} and is no
            longer in force.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-3">
      <ShieldCheck className="w-7 h-7 shrink-0 text-primary mt-1" aria-hidden />
      <div>
        <p className="text-2xl sm:text-3xl font-bold text-foreground text-balance">
          This license is <span className="text-primary">active</span>
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          Granted on {format(new Date(verification.granted_at), "d MMMM yyyy")} and in force as of
          now.
        </p>
      </div>
    </div>
  )
}

export function VerificationCard() {
  const params = useParams<{ claimToken: string }>()
  const claimToken = typeof params?.claimToken === "string" ? params.claimToken : ""

  const [verification, setVerification] = useState<Verification | null>(null)
  const [state, setState] = useState<"loading" | "found" | "unknown" | "error">("loading")

  useEffect(() => {
    let cancelled = false
    if (!claimToken) {
      setState("unknown")
      return
    }
    fetchVerification(claimToken)
      .then((result) => {
        if (cancelled) return
        if (!result) {
          setState("unknown")
          return
        }
        setVerification(result)
        setState("found")
      })
      .catch(() => {
        if (!cancelled) setState("error")
      })
    return () => {
      cancelled = true
    }
  }, [claimToken])

  return (
    <main className="min-h-screen bg-background flex items-start justify-center px-4 py-12">
      <div className="w-full max-w-2xl">
        <p className="text-xs uppercase tracking-widest text-muted-foreground mb-4 text-center">
          Evonaire · License verification
        </p>

        <Card className="bg-card border-border">
          <CardContent className="p-6 sm:p-8 space-y-6">
            {state === "loading" && (
              <div className="space-y-4" aria-busy="true">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
                  Checking this license…
                </div>
                <Skeleton className="h-10 w-3/4" />
                <Skeleton className="h-24 w-full" />
              </div>
            )}

            {/* No speculation about why: "never existed" and "removed" are the
                same answer here, deliberately. */}
            {state === "unknown" && (
              <div className="text-center py-8">
                <CircleSlash className="w-8 h-8 text-muted-foreground mx-auto mb-3" aria-hidden />
                <p className="text-xl font-semibold text-foreground">
                  No license matches this link.
                </p>
              </div>
            )}

            {state === "error" && (
              <div className="text-center py-8">
                <AlertTriangle className="w-8 h-8 text-muted-foreground mx-auto mb-3" aria-hidden />
                <p className="text-xl font-semibold text-foreground">
                  This license couldn&apos;t be checked right now.
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Nothing about the license has changed — the check itself failed. Please try
                  again shortly.
                </p>
              </div>
            )}

            {state === "found" && verification && (
              <>
                <Verdict verification={verification} />

                <Section title="License">
                  <dl className="divide-y divide-border">
                    <Field label="Level">{licenseLevelLabel(verification.license.level)}</Field>
                    <Field label="Scope">{scopeLabel(verification.license.scope)}</Field>
                    <Field label="Source">{sourceLabel(verification.license.source)}</Field>
                    <Field label="Terms version">{verification.license.terms_version}</Field>
                    <Field label="Terms hash">
                      <HashValue value={verification.license.terms_hash} label="terms hash" />
                    </Field>
                  </dl>
                </Section>

                <Section title="Machine use">
                  <AiUseRows aiUse={verification.license.ai_use} />
                  <p className="text-xs text-muted-foreground mt-3 max-w-prose">
                    These four are recorded explicitly on every license. Nothing here is inferred:
                    a right that is not granted is denied.
                  </p>
                </Section>

                <Section title="Content fingerprint">
                  <dl className="divide-y divide-border">
                    <Field label="Algorithm">{algoLabel(verification.content.algo)}</Field>
                    <Field label="Fingerprint">
                      <HashValue value={verification.content.sha256} label="content fingerprint" />
                    </Field>
                    <Field label="Content reference">
                      <code className="font-mono text-xs bg-secondary text-secondary-foreground rounded px-1.5 py-1 break-all">
                        {verification.content.ref}
                      </code>
                    </Field>
                  </dl>
                  <p className="text-xs text-muted-foreground mt-3 max-w-prose">
                    Hash a suspect file with SHA-256 and compare it with the fingerprint above.
                  </p>
                </Section>

                <Section title="Parties">
                  <dl className="divide-y divide-border">
                    <Field label="Creator">
                      <code className="font-mono text-xs bg-secondary text-secondary-foreground rounded px-1.5 py-1 break-all">
                        {verification.parties.creator_ref}
                      </code>
                    </Field>
                    <Field label="License holder">
                      <code className="font-mono text-xs bg-secondary text-secondary-foreground rounded px-1.5 py-1 break-all">
                        {verification.parties.holder_ref}
                      </code>
                    </Field>
                  </dl>
                  <p className="text-xs text-muted-foreground mt-3 max-w-prose">
                    Parties are identified by one-way references. Evonaire can match these to
                    accounts; nobody else can.
                  </p>
                </Section>

                <Section title="Claim record">
                  <ol className="space-y-3">
                    {verification.chain.map((link, index) => (
                      <li
                        key={`${link.payload_hash}-${index}`}
                        className="rounded-lg border border-border bg-secondary/40 px-3 py-2.5 space-y-1.5"
                      >
                        <div className="flex items-baseline justify-between gap-3 flex-wrap">
                          <span className="text-sm font-medium text-foreground">
                            {eventLabel(link.event_type)}
                          </span>
                          <time className="text-xs text-muted-foreground" dateTime={link.created_at}>
                            {format(new Date(link.created_at), "d MMM yyyy, HH:mm")}
                          </time>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            Hash
                            <code className="font-mono bg-secondary text-secondary-foreground rounded px-1 py-0.5 break-all">
                              {link.payload_hash}
                            </code>
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            Previous
                            <code className="font-mono bg-secondary text-secondary-foreground rounded px-1 py-0.5 break-all">
                              {link.prev_hash ?? "—"}
                            </code>
                          </span>
                        </div>
                        <AnchorStatusBadge
                          status={link.anchor_status}
                          anchoring={verification.anchoring}
                        />
                      </li>
                    ))}
                  </ol>
                </Section>

                <Section title="How these records are kept">
                  <AnchoringNote anchoring={verification.anchoring} />
                </Section>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}

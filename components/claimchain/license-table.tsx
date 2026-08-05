"use client"

import { Fragment, useState } from "react"
import { format } from "date-fns"
import { ExternalLink } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { AiUseChips } from "@/components/claimchain/ai-use"
import { CopyButton } from "@/components/claimchain/copy-value"
import { RevokeLicenseDialog } from "@/components/claimchain/revoke-license-dialog"
import {
  licenseLevelLabel,
  revokerLabel,
  sourceLabel,
  type LicenseRecord,
} from "@/lib/claimchain"

// Licenses issued for one ritual. Every row can be sent to a third party: the
// `verify_url` is the artefact a creator hands to a distribution platform or a
// lawyer, so it gets a copy affordance of its own rather than only a link.

function LevelBadge({ level }: { level: LicenseRecord["level"] }) {
  return (
    <Badge variant="outline" className="bg-secondary text-secondary-foreground border-border text-xs">
      {licenseLevelLabel(level)}
    </Badge>
  )
}

function StatusCell({ license }: { license: LicenseRecord }) {
  if (license.status !== "revoked") {
    return (
      <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-xs">
        Active
      </Badge>
    )
  }

  const revoker = revokerLabel(license.revoked_by)
  return (
    <div className="space-y-1">
      <Badge variant="outline" className="bg-muted text-muted-foreground border-border text-xs">
        Withdrawn
      </Badge>
      <p className="text-xs text-muted-foreground">
        {license.revoked_at ? format(new Date(license.revoked_at), "d MMM yyyy") : "—"}
        {revoker ? ` · by ${revoker}` : ""}
      </p>
    </div>
  )
}

export function LicenseTable({
  licenses,
  ritualId,
  ritualTitle,
  onLicenseUpdated,
}: {
  licenses: LicenseRecord[]
  ritualId: number
  ritualTitle: string
  /** Patches the single changed row — the page is never refetched. */
  onLicenseUpdated: (updated: LicenseRecord) => void
}) {
  const [target, setTarget] = useState<LicenseRecord | null>(null)

  if (licenses.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No licenses issued for this ritual yet. A license record is created when someone buys or
        is gifted access through the Commons.
      </p>
    )
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Holder</TableHead>
            <TableHead>Level</TableHead>
            <TableHead>Granted</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right whitespace-nowrap">Verification</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {licenses.map((license) => (
            <Fragment key={license.id}>
              <TableRow className="border-b-0">
                <TableCell className="align-top font-medium text-foreground">
                  {license.holder?.email ?? "—"}
                </TableCell>
                <TableCell className="align-top">
                  <LevelBadge level={license.level} />
                </TableCell>
                <TableCell className="align-top text-muted-foreground whitespace-nowrap">
                  {format(new Date(license.granted_at), "d MMM yyyy")}
                </TableCell>
                <TableCell className="align-top">
                  <StatusCell license={license} />
                </TableCell>
                <TableCell className="align-top text-right">
                  <div className="inline-flex items-center gap-1 justify-end whitespace-nowrap">
                    <Button asChild variant="ghost" size="sm" className="h-7 px-2">
                      <a
                        href={license.verify_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs"
                        title="Open the public verification page for this license"
                      >
                        Verify
                        <ExternalLink className="w-3 h-3 ml-1" aria-hidden />
                      </a>
                    </Button>
                    <CopyButton
                      value={license.verify_url}
                      label="Copy the verification link for this license"
                    />
                    {license.status === "active" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setTarget(license)}
                        className="h-7 px-2 text-xs bg-transparent border-border text-destructive hover:bg-destructive/10"
                      >
                        Revoke
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
              {/* The terms this license was granted under sit under the row they
                  belong to. Source lives here rather than in its own column so
                  the Revoke action never gets pushed off the right edge — an
                  action a creator cannot see is an action they do not have. */}
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={5} className="pt-0 pb-4">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <span className="text-xs text-muted-foreground">
                      {sourceLabel(license.source)} · Terms v{license.terms_version}
                    </span>
                    <AiUseChips aiUse={license.ai_use} />
                  </div>
                </TableCell>
              </TableRow>
            </Fragment>
          ))}
        </TableBody>
      </Table>

      <RevokeLicenseDialog
        license={target}
        ritualId={ritualId}
        ritualTitle={ritualTitle}
        open={target !== null}
        onOpenChange={(open) => { if (!open) setTarget(null) }}
        onRevoked={onLicenseUpdated}
      />
    </>
  )
}

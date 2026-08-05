"use client"

import { format } from "date-fns"
import { ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AiUseChips } from "@/components/claimchain/ai-use"
import { CopyButton } from "@/components/claimchain/copy-value"
import { licenseLevelLabel, type LicenseRecord } from "@/lib/claimchain"

// What a buyer actually holds, attached to the purchase they already recognise.
//
// A withdrawn license is stated as a fact with no alarm styling. Most
// revocations are refunds and rights disputes; almost none are misconduct by
// the buyer, and the copy must not imply otherwise.

export function HeldLicensePanel({ license }: { license: LicenseRecord }) {
  const revoked = license.status === "revoked"

  return (
    <div className="mt-3 pt-3 border-t border-border space-y-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="text-xs text-muted-foreground">
          License {licenseLevelLabel(license.level)}
        </span>
        <AiUseChips aiUse={license.ai_use} />
      </div>

      {revoked && (
        <p className="text-xs text-muted-foreground">
          This license was withdrawn
          {license.revoked_at
            ? ` on ${format(new Date(license.revoked_at), "d MMMM")}`
            : ""}
          . If you weren&apos;t expecting this, contact support.
        </p>
      )}

      <div className="flex items-center gap-1 -ml-2">
        <Button asChild variant="ghost" size="sm" className="h-7 px-2">
          <a
            href={license.verify_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs"
          >
            Verification page
            <ExternalLink className="w-3 h-3 ml-1" aria-hidden />
          </a>
        </Button>
        <CopyButton value={license.verify_url} label="Copy the verification link" />
      </div>
    </div>
  )
}

"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Check, Copy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

// Copying a hash or a verification URL is the point of showing it: the creator
// pastes it into a takedown form, an email to a platform, or a hashing tool.
// The confirmation is inline rather than a toast so it lands next to the thing
// that was copied, which matters when a page has a dozen copy buttons.

async function writeToClipboard(value: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value)
      return true
    }
  } catch {
    // Falls through to the textarea path below — a denied permission prompt or
    // an insecure context both land here.
  }
  try {
    const area = document.createElement("textarea")
    area.value = value
    area.setAttribute("readonly", "")
    area.style.position = "fixed"
    area.style.opacity = "0"
    document.body.appendChild(area)
    area.select()
    const ok = document.execCommand("copy")
    document.body.removeChild(area)
    return ok
  } catch {
    return false
  }
}

export function CopyButton({
  value,
  label,
  className,
}: {
  value: string
  /** Accessible name — say what is being copied, not just "Copy". */
  label: string
  className?: string
}) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  const copy = useCallback(async () => {
    const ok = await writeToClipboard(value)
    if (!ok) return
    setCopied(true)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(false), 1800)
  }, [value])

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={copy}
      title={copied ? "Copied" : label}
      aria-label={label}
      className={cn("h-7 px-2 text-muted-foreground hover:text-foreground shrink-0", className)}
    >
      {copied ? (
        <>
          <Check className="w-3.5 h-3.5 text-primary" aria-hidden />
          <span className="ml-1 text-xs text-primary">Copied</span>
        </>
      ) : (
        <Copy className="w-3.5 h-3.5" aria-hidden />
      )}
    </Button>
  )
}

/**
 * A hash shown in monospace with a copy affordance for the *full* value.
 *
 * `truncate` shows the first 12 characters — enough to recognise, short enough
 * to sit in a table row. The clipboard always gets the whole thing; a partial
 * hash pasted into a comparison tool is worse than no hash at all.
 */
export function HashValue({
  value,
  label,
  truncate = false,
  className,
}: {
  value: string
  label: string
  truncate?: boolean
  className?: string
}) {
  const shown = truncate && value.length > 12 ? `${value.slice(0, 12)}…` : value

  return (
    <span className={cn("inline-flex items-start gap-1 max-w-full", className)}>
      <code
        className={cn(
          "font-mono text-xs bg-secondary text-secondary-foreground rounded px-1.5 py-1",
          truncate ? "whitespace-nowrap" : "break-all",
        )}
        title={truncate ? value : undefined}
      >
        {shown}
      </code>
      <CopyButton value={value} label={`Copy full ${label}`} />
    </span>
  )
}

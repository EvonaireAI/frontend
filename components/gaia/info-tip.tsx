"use client"

import { useEffect, useState } from "react"
import { Info, Loader2 } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { gaiaService, type InfoResponse } from "@/lib/gaia"
import { cn } from "@/lib/utils"

interface GaiaInfoTipProps {
  /**
   * Stable key registered in the backend INFO_BANK (e.g. "ritual.upload").
   */
  infoKey: string
  className?: string
  ariaLabel?: string
  /**
   * Optional side override. Defaults to "top" so popovers float above buttons.
   */
  side?: "top" | "right" | "bottom" | "left"
  align?: "start" | "center" | "end"
}

const cache = new Map<string, InfoResponse>()
const inflight = new Map<string, Promise<InfoResponse>>()

function fetchInfo(key: string): Promise<InfoResponse> {
  const cached = cache.get(key)
  if (cached) return Promise.resolve(cached)
  const existing = inflight.get(key)
  if (existing) return existing
  const promise = gaiaService
    .info(key)
    .then((res) => {
      cache.set(key, res)
      inflight.delete(key)
      return res
    })
    .catch((err) => {
      inflight.delete(key)
      throw err
    })
  inflight.set(key, promise)
  return promise
}

export function GaiaInfoTip({
  infoKey,
  className,
  ariaLabel,
  side = "top",
  align = "center",
}: GaiaInfoTipProps) {
  const [open, setOpen] = useState(false)
  const [info, setInfo] = useState<InfoResponse | null>(() => cache.get(infoKey) ?? null)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!open || info) return
    let cancelled = false
    setError(false)
    fetchInfo(infoKey)
      .then((res) => {
        if (!cancelled) setInfo(res)
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
    return () => {
      cancelled = true
    }
  }, [open, info, infoKey])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={ariaLabel ?? "More information"}
          className={cn(
            "inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground",
            "transition-colors hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
            className
          )}
          // Stop the click from triggering parent button handlers like submit.
          onClick={(e) => e.stopPropagation()}
        >
          <Info className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side={side}
        align={align}
        sideOffset={6}
        className="w-72 border-border bg-card text-card-foreground shadow-xl"
      >
        {!info && !error && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> loading
          </div>
        )}
        {error && (
          <div className="text-sm text-muted-foreground">
            Could not load guidance.
          </div>
        )}
        {info && (
          <div className="space-y-1.5">
            <div className="text-sm font-semibold text-primary">{info.title}</div>
            <div className="text-sm leading-relaxed text-foreground/90">{info.body}</div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

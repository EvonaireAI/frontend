"use client"

import { useCallback, useEffect, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { MetricsForbiddenError } from "@/lib/metrics"
import { RefreshCw } from "lucide-react"

// Per-zone fetch state so one failed endpoint never blanks the whole
// dashboard. A 403 means the caller isn't staff — redirect away rather than
// rendering an empty dashboard. `fetcher` must be referentially stable
// (wrap it in useCallback keyed on its params); a new fetcher refetches.
export function useMetricsZone<T>(fetcher: () => Promise<T>) {
  const router = useRouter()
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      setData(await fetcher())
    } catch (err) {
      if (err instanceof MetricsForbiddenError) {
        router.replace("/dashboard")
        return
      }
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [fetcher, router])

  useEffect(() => {
    load()
  }, [load])

  return { data, loading, error, retry: load }
}

export function ZoneError({ label, onRetry }: { label: string; onRetry: () => void }) {
  return (
    <Alert variant="destructive">
      <AlertDescription className="flex items-center justify-between gap-4 flex-wrap">
        <span>Failed to load {label}.</span>
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Retry
        </Button>
      </AlertDescription>
    </Alert>
  )
}

// Refetches (e.g. a window-selector change) hold the previous render at
// reduced opacity instead of flashing a skeleton.
export function ZoneRefetchDim({ dimmed, children }: { dimmed: boolean; children: ReactNode }) {
  return (
    <div className={dimmed ? "opacity-50 pointer-events-none transition-opacity" : "transition-opacity"}>
      {children}
    </div>
  )
}

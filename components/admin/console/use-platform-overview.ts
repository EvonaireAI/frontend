"use client"

import { useCallback, useEffect, useState } from "react"
import { adminService, type PlatformOverview } from "@/lib/admin"

// `GET /api/admin/overview/` is fetched once for the whole console: the
// Platform Overview tab renders all five card groups from it, and the
// Memberships tab reuses `overview.memberships` rather than calling
// `payments/metrics/overview/` again — the two payloads are identical.

export interface PlatformOverviewState {
  overview: PlatformOverview | null
  loading: boolean
  error: string | null
  reload: () => void
}

export function usePlatformOverview(): PlatformOverviewState {
  const [overview, setOverview] = useState<PlatformOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setOverview(await adminService.getPlatformOverview())
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load the platform overview")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return { overview, loading, error, reload: load }
}

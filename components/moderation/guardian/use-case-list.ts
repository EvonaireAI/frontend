"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { moderationService, type CaseFilters, type ListPage, type ModerationCase } from "@/lib/moderation"

// Shared list loader for Pending Reviews, Active Cases and Case History.
//
// It hands back the whole `ListPage`, so a paginated tab reads `count`/`next`
// and an unpaginated one just reads `results` — the same code path serves both
// shapes of the cases endpoint.

export interface CaseListState {
  page: ListPage<ModerationCase> | null
  cases: ModerationCase[]
  loading: boolean
  error: string | null
  reload: () => void
}

export function useCaseList(filters: CaseFilters): CaseListState {
  // Filters are rebuilt on every render by callers; key off the serialized
  // value so the effect doesn't loop.
  const filterKey = JSON.stringify(filters)
  const stableFilters = useMemo(() => JSON.parse(filterKey) as CaseFilters, [filterKey])

  const [page, setPage] = useState<ListPage<ModerationCase> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const requestId = useRef(0)

  const load = useCallback(async () => {
    const id = ++requestId.current
    setLoading(true)
    setError(null)
    try {
      const result = await moderationService.listCases(stableFilters)
      if (id === requestId.current) setPage(result)
    } catch (err) {
      if (id === requestId.current) setError(err instanceof Error ? err.message : "Failed to load care cases")
    } finally {
      if (id === requestId.current) setLoading(false)
    }
  }, [stableFilters])

  useEffect(() => {
    load()
  }, [load])

  return {
    page,
    cases: page?.results ?? [],
    loading,
    error,
    reload: load,
  }
}

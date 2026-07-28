// A seeker's personal practice summary — the "My Practice" section of
// The Ledger.
//
// Charter note: these numbers are a record, not a scoreboard. Nothing here is
// comparative and nothing is a streak; render them plainly and let them be.

import { authService } from "./auth"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "/api"

export interface PracticePeriod {
  sessions_count: number
  listening_minutes: number
  rituals_completed: number
  blessings_given: number
  blessings_received: number
}

export interface PracticeSummary extends PracticePeriod {
  current_month: PracticePeriod
}

/**
 * `GET /api/analytics/me/summary/`.
 *
 * NOTE(fitsum): as of Session 10 this endpoint is specified but not yet live
 * in the backend repo — callers should treat a failure as "no summary yet"
 * and fall back to locally derived counts rather than showing an error.
 */
export async function fetchPracticeSummary(): Promise<PracticeSummary> {
  const response = await fetch(`${API_BASE_URL}/analytics/me/summary/`, {
    headers: authService.getAuthHeaders(),
  })

  if (!response.ok) {
    throw new Error(`Failed to load practice summary: ${response.statusText}`)
  }

  return response.json()
}

// A seeker's personal practice summary — the "My Practice" section of
// The Ledger.
//
// Charter note: these numbers are a record, not a scoreboard. Nothing here is
// comparative and nothing is a streak; render them plainly and let them be.

import { authService } from "./auth"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "/api"

export interface PracticePeriod {
  sessions_count: number
  /** Whole minutes, accumulated server-side. Never divide this again. */
  listening_minutes: number
  rituals_completed: number
  blessings_given: number
  /** Blessings on rituals the caller created — always 0 for non-creators. */
  blessings_received: number
}

export interface PracticeCurrentMonth extends PracticePeriod {
  /** Calendar month in UTC, e.g. "2026-07". */
  period: string
}

export interface PracticeSummary extends PracticePeriod {
  current_month: PracticeCurrentMonth
}

/**
 * `GET /api/analytics/me/summary/` (API_CONTRACTS Session 10).
 *
 * All-time plus the current UTC calendar month, for the calling user only.
 * A failure is not fatal — callers fall back to locally derived counts from
 * `me/plays/` and `me/blessings/` rather than showing an error.
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

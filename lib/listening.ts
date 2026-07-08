// Creator listening analytics (usage-based royalties). One endpoint,
// creator-only: GET /api/analytics/creator/listening/?period=YYYY-MM.
// Aggregates are computed nightly server-side, so the current day is always
// empty. Qualified minutes are what royalties are based on.

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "/api"

export class ListeningForbiddenError extends Error {
  constructor() {
    super("Creator access required")
    this.name = "ListeningForbiddenError"
  }
}

export interface ListeningTotals {
  qualified_minutes: number
  unique_listeners: number
  sessions: number
}

export interface ListeningDay {
  date: string
  qualified_minutes: number
  unique_listeners: number
  sessions: number
}

export interface ListeningRitual {
  ritual_id: number
  ritual_title: string
  qualified_minutes: number
  unique_listeners: number
  sessions: number
}

export interface CreatorListening {
  period: string
  totals: ListeningTotals
  by_day: ListeningDay[]
  by_ritual: ListeningRitual[]
}

class ListeningService {
  private getAuthHeaders(): Record<string, string> {
    const token = localStorage.getItem("access_token")
    return token ? { Authorization: `Bearer ${token}` } : {}
  }

  // period is "YYYY-MM"; omitted = current UTC month
  async getCreatorListening(period?: string): Promise<CreatorListening> {
    const query = period ? `?period=${period}` : ""
    const response = await fetch(`${API_BASE_URL}/analytics/creator/listening/${query}`, {
      headers: this.getAuthHeaders(),
    })

    if (response.status === 403) {
      throw new ListeningForbiddenError()
    }

    if (!response.ok) {
      throw new Error("Failed to fetch listening analytics")
    }

    return response.json()
  }
}

export const listeningService = new ListeningService()

// --- period helpers (parsed by hand so the UTC calendar month never shifts
// with the viewer's timezone, matching lib/metrics.ts) ---

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

export function currentUtcPeriod(): string {
  return new Date().toISOString().slice(0, 7)
}

// "2026-07" → "July 2026"
export function periodLabel(period: string): string {
  const m = Number(period.slice(5, 7))
  const name = MONTH_NAMES[m - 1]
  return name ? `${name} ${period.slice(0, 4)}` : period
}

// "2026-07" ± 1 month
export function shiftPeriod(period: string, delta: 1 | -1): string {
  const year = Number(period.slice(0, 4))
  const month = Number(period.slice(5, 7))
  const shifted = new Date(Date.UTC(year, month - 1 + delta, 1))
  return shifted.toISOString().slice(0, 7)
}

// Every calendar day of the period, with days absent from by_day filled with
// zeros so the chart axis always spans the whole month.
export function fillMonth(period: string, byDay: ListeningDay[]): ListeningDay[] {
  const year = Number(period.slice(0, 4))
  const month = Number(period.slice(5, 7))
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const byDate = new Map(byDay.map((d) => [d.date, d]))
  return Array.from({ length: daysInMonth }, (_, i) => {
    const date = `${period}-${String(i + 1).padStart(2, "0")}`
    return byDate.get(date) ?? { date, qualified_minutes: 0, unique_listeners: 0, sessions: 0 }
  })
}

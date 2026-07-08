// Admin-only business metrics (MRR, churn, funnel). All three endpoints
// require a staff/admin JWT; non-staff callers get a 403, surfaced as
// MetricsForbiddenError so the dashboard can redirect instead of rendering.
// Money fields are integer cents unless the name says `dollars`.

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "/api"

export class MetricsForbiddenError extends Error {
  constructor() {
    super("Admin access required")
    this.name = "MetricsForbiddenError"
  }
}

export interface PlanCount {
  plan: string
  display_name: string
  count: number
}

export interface MetricsOverview {
  mrr_cents: number
  mrr_dollars: number
  active_subscriptions: number
  by_plan: PlanCount[]
  arpu_cents: number
  arpu_dollars: number
  arpa_all_actives_cents: number
  arpa_all_actives_dollars: number
  scheduled_to_cancel: number
  past_due: number
  as_of: string
}

export interface TimeseriesMonth {
  month: string
  new_subscriptions: number
  upgrades: number
  downgrades: number
  cancellations: number
  net_mrr_change_cents: number
  eom_mrr_cents: number
  churn_rate: number
}

export interface MetricsTimeseries {
  months: TimeseriesMonth[]
}

export interface MetricsFunnel {
  window_start: string
  months: number
  registered_users: number
  free_actives: number
  conversions_to_paid: number
  conversion_rate: number
  median_days_to_convert: number | null
}

class MetricsService {
  private getAuthHeaders(): Record<string, string> {
    const token = localStorage.getItem("access_token")
    return token ? { Authorization: `Bearer ${token}` } : {}
  }

  private async get<T>(path: string): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      headers: this.getAuthHeaders(),
    })

    if (response.status === 403) {
      throw new MetricsForbiddenError()
    }

    if (!response.ok) {
      throw new Error("Failed to fetch metrics")
    }

    return response.json()
  }

  async getOverview(): Promise<MetricsOverview> {
    return this.get<MetricsOverview>("/payments/metrics/overview/")
  }

  async getTimeseries(months = 12): Promise<MetricsTimeseries> {
    return this.get<MetricsTimeseries>(`/payments/metrics/timeseries/?months=${months}`)
  }

  async getFunnel(months = 3): Promise<MetricsFunnel> {
    return this.get<MetricsFunnel>(`/payments/metrics/funnel/?months=${months}`)
  }
}

export const metricsService = new MetricsService()

// --- display helpers ---

export function centsToDollarString(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })
}

export function rateToPercentString(rate: number): string {
  return `${(rate * 100).toLocaleString("en-US", { maximumFractionDigits: 1 })}%`
}

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
]

// "2026-06" → "Jun" (axis ticks) / "Jun 2026" (tooltips). Parsed by hand so
// the UTC calendar month never shifts with the viewer's timezone.
export function monthShortLabel(month: string): string {
  const m = Number(month.slice(5, 7))
  return MONTH_NAMES[m - 1] ?? month
}

export function monthLongLabel(month: string): string {
  const m = Number(month.slice(5, 7))
  const name = MONTH_NAMES[m - 1]
  return name ? `${name} ${month.slice(0, 4)}` : month
}

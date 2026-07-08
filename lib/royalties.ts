// Royalty Engine screens: creator earnings/statements and admin period
// review. Each month 89% of every member's subscription fee is split across
// the creators that member listened to, proportional to qualified minutes;
// the platform keeps 11%. All money fields are integer cents. The API only
// ever returns member counts — never identities — by design.
//
// Earnings/statement endpoints require the creator role; period endpoints
// require staff. Both 403 otherwise, surfaced as RoyaltiesForbiddenError so
// pages redirect instead of rendering broken.

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "/api"

export class RoyaltiesForbiddenError extends Error {
  constructor() {
    super("Access denied")
    this.name = "RoyaltiesForbiddenError"
  }
}

// Non-403 failures that carry a server `detail` (400 bad period, 404 no
// computed period / unknown period id, 409 approve conflict).
export class RoyaltiesApiError extends Error {
  status: number

  constructor(status: number, detail: string) {
    super(detail)
    this.name = "RoyaltiesApiError"
    this.status = status
  }
}

// --- creator earnings ---

export type PayoutStatus =
  | "sent"
  | "skipped_below_minimum"
  | "blocked_not_ready"
  | "failed"
  | "pending"

export interface PayoutHistoryEntry {
  period: string
  amount_cents: number
  status: PayoutStatus
  failure_reason: string | null
  created_at: string
}

export interface LastPayout {
  period: string
  amount_cents: number
  sent_at: string
  stripe_transfer_id: string
}

export interface CreatorEarnings {
  payable_balance_cents: number
  pending_balance_cents: number
  held_cents: number
  lifetime_earned_cents: number
  minimum_payout_cents: number
  payouts_ready: boolean
  last_payout: LastPayout | null
  payout_history: PayoutHistoryEntry[]
}

export interface StatementRitual {
  ritual_id: number
  ritual_title: string
  earned_cents: number
  unique_members: number
  qualified_minutes: number
}

export interface CreatorStatement {
  period: string
  period_status: string
  total_earned_cents: number
  member_pool_cents: number
  idle_redistribution_cents: number
  member_count: number
  by_ritual: StatementRitual[]
  payout: PayoutHistoryEntry | null
}

// --- admin period review ---

export type RoyaltyPeriodStatus =
  | "open"
  | "computing"
  | "computed"
  | "approved"
  | "paying"
  | "paid"

export interface RoyaltyPeriod {
  id: number
  period: string
  status: RoyaltyPeriodStatus
  gross_cents: number
  platform_fee_cents: number
  pool_cents: number
  idle_pool_cents: number
  idle_fallback_applied: "platform_pool" | "care_fund" | null
  paying_members: number
  idle_members: number
  computed_at: string | null
  approved_at: string | null
  paid_at: string | null
}

export interface RoyaltyPeriodList {
  shadow_mode: boolean
  periods: RoyaltyPeriod[]
}

export interface TopCreator {
  creator_id: number
  creator_name: string
  earned_cents: number
  share_of_pool: number
  member_count: number
}

export interface PayoutBatch {
  id: number
  status: string
  sent_count: number
  total_sent_cents: number
  skipped_count: number
  blocked_count: number
  failed_count: number
  created_at: string
}

export interface RoyaltyPeriodReport extends RoyaltyPeriod {
  creators_earning: number
  distributed_cents: number
  undistributed_idle_cents: number
  top_creators: TopCreator[]
  fraud_holds: { count: number; held_cents: number }
  payout_batches: PayoutBatch[]
  shadow_mode: boolean
}

class RoyaltiesService {
  private getAuthHeaders(): Record<string, string> {
    const token = localStorage.getItem("access_token")
    return token ? { Authorization: `Bearer ${token}` } : {}
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: this.getAuthHeaders(),
    })

    if (response.status === 403) {
      throw new RoyaltiesForbiddenError()
    }

    if (!response.ok) {
      let detail = "Request failed"
      try {
        const body = await response.json()
        if (typeof body.detail === "string") detail = body.detail
      } catch {
        // non-JSON error body — keep the fallback message
      }
      throw new RoyaltiesApiError(response.status, detail)
    }

    return response.json()
  }

  async getEarnings(): Promise<CreatorEarnings> {
    return this.request<CreatorEarnings>("/royalties/earnings/")
  }

  // period is "YYYY-MM"; 404 = no computed period for that month
  async getStatement(period: string): Promise<CreatorStatement> {
    return this.request<CreatorStatement>(`/royalties/statement/?period=${period}`)
  }

  async getPeriods(): Promise<RoyaltyPeriodList> {
    return this.request<RoyaltyPeriodList>("/royalties/periods/")
  }

  async getPeriodReport(id: number): Promise<RoyaltyPeriodReport> {
    return this.request<RoyaltyPeriodReport>(`/royalties/periods/${id}/report/`)
  }

  // 409 when the period isn't in `computed` anymore — refetch and show detail
  async approvePeriod(id: number): Promise<RoyaltyPeriod> {
    return this.request<RoyaltyPeriod>(`/royalties/periods/${id}/approve/`, { method: "POST" })
  }
}

export const royaltiesService = new RoyaltiesService()

// --- status chip config (Badge variant="outline" + these classes) ---

export const PAYOUT_STATUS_CHIPS: Record<PayoutStatus, { label: string; className: string }> = {
  sent: {
    label: "Paid",
    className: "bg-green-900/30 text-green-400 border-green-500/30",
  },
  skipped_below_minimum: {
    label: "Rolled forward",
    className: "bg-muted text-muted-foreground border-border",
  },
  blocked_not_ready: {
    label: "Setup needed",
    className: "bg-yellow-900/30 text-yellow-400 border-yellow-500/30",
  },
  failed: {
    label: "Failed — will retry",
    className: "bg-red-900/30 text-red-400 border-red-500/30",
  },
  pending: {
    label: "Processing",
    className: "bg-muted text-muted-foreground border-border",
  },
}

export const PERIOD_STATUS_CHIPS: Record<RoyaltyPeriodStatus, { label: string; className: string }> = {
  open: {
    label: "Open",
    className: "bg-muted text-muted-foreground border-border",
  },
  computing: {
    label: "Computing",
    className: "bg-blue-900/30 text-blue-400 border-blue-500/30",
  },
  computed: {
    label: "Awaiting review",
    className: "bg-yellow-900/30 text-yellow-400 border-yellow-500/30",
  },
  approved: {
    label: "Approved",
    className: "bg-primary/10 text-primary border-primary/20",
  },
  paying: {
    label: "Paying",
    className: "bg-blue-900/30 text-blue-400 border-blue-500/30",
  },
  paid: {
    label: "Paid",
    className: "bg-green-900/30 text-green-400 border-green-500/30",
  },
}

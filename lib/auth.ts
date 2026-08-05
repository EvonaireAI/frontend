import { PLAN_MARKETING_NAMES } from "./plans"
import { throwIfEntitlementDenied } from "./entitlements"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "/api"

export type SubscriptionPlan = "free" | "evocore" | "evobloom" | "evoluxe"
export type SubscriptionStatus = "active" | "trialing" | "past_due" | "canceled" | "incomplete"

export const PAID_PLANS: SubscriptionPlan[] = ["evocore", "evobloom", "evoluxe"]

export const PLAN_DISPLAY_NAMES: Record<SubscriptionPlan, string> = PLAN_MARKETING_NAMES

export function getSubscriptionAccess(plan?: SubscriptionPlan, status?: SubscriptionStatus) {
  const isPaidActive =
    !!plan &&
    PAID_PLANS.includes(plan) &&
    (status === "active" || status === "trialing")
  const isPastDue = !!plan && PAID_PLANS.includes(plan) && status === "past_due"
  const isFree = !isPaidActive
  return { isPaidActive, isPastDue, isFree }
}

export interface User {
  id?: number
  email: string
  first_name: string
  last_name: string
  // `superadmin` is a real role on the account, not just the Django superuser
  // flag — the backend admits it everywhere `admin` is admitted.
  role: "member" | "creator" | "moderator" | "admin" | "superadmin"
  profile_picture?: string
  date_joined: string
  consent_privacy_policy?: boolean
  consent_terms_of_service?: boolean
  consent_accepted_at?: string | null
  consents_accepted?: boolean
  subscription_plan?: SubscriptionPlan
  subscription_status?: SubscriptionStatus
}

export interface LoginResponse {
  refresh: string
  access: string
  role: string
  consent_privacy_policy?: boolean
  consent_terms_of_service?: boolean
  consents_accepted?: boolean
  subscription_plan?: SubscriptionPlan
  subscription_status?: SubscriptionStatus
}

export interface RoleRequest {
  id: number
  user: User
  requested_role: "creator" | "moderator"
  reason: string
  status: "pending" | "approved" | "rejected"
  created_at: string
}

// Added ritual-related interfaces
export interface Ritual {
  id: number
  title: string
  description: string
  care_level: "level1" | "level2" | "level3"
  tags: Array<{ id: number; name: string }>
  cultural_declaration: string
  status: "draft" | "submitted" | "approved" | "pending_review"
  audio_file?: string
  duration_seconds?: number | null
  created_at: string
  updated_at: string
  creator: User
  // Entitlement fields on /rituals/public/ — locked is computed server-side
  // from the caller's plan (anonymous callers get free-plan locks)
  locked?: boolean
  required_plan?: string | null
}

export interface RitualUpload {
  title: string
  description: string
  care_level: "level1" | "level2" | "level3"
  tags: string[]
  cultural_declaration: string
  audio_file: File
}

export interface RitualAnalytics {
  total_plays: number
  total_completions: number
  total_blessings: number
}

export interface RitualFeedback {
  id: number
  ritual: number
  content: string
  is_anonymous: boolean
  created_at: string
  user?: User
}

export interface PlaySession {
  id: number
  ritual: number
  started_at: string
  current_position: number
  completed: boolean
}

export interface Blessing {
  id: number
  ritual: number
  user: number
  created_at: string
}

export interface FeedbackSubmission {
  ritual: number
  feedback_text: string
  is_anonymous: boolean
}

export interface CreatorDashboardMetrics {
  total_plays: number
  total_completions: number
  completion_rate: number
  total_blessings: number
}

export interface CreatorFeedbackItem {
  id: number
  ritual: {
    id: number
    title: string
  }
  user: User | null
  feedback_text: string
  is_anonymous: boolean
  created_at: string
}

export interface PendingRitual {
  id: number
  title: string
  description: string
  creator: number
  creator_email: string
  audio_file: string
  duration_seconds: number
  language: string
  is_ai_generated: boolean
  care_level: "level1" | "level2" | "level3"
  cultural_declaration: string
  status: "submitted" | "pending_review"
  licensing: { type: string }
  tags: Array<{ id: number; name: string }>
  created_at: string
  updated_at: string
}

// The care-case types and every case read/transition live in lib/moderation.ts
// (the Guardian data layer). Re-exported here so existing importers keep
// working.
export type { ModerationCase, CareFeedItem } from "./moderation"

export interface ReviewResponse {
  id: number
  ritual: number
  reviewer: number
  reviewer_email: string
  status_before: string
  status_after: string
  note: string
  created_at: string
}

class AuthService {
  getAuthHeaders(): Record<string, string> {
    const token = localStorage.getItem("access_token")
    return token ? { Authorization: `Bearer ${token}` } : {}
  }

  async register(data: {
    first_name: string
    last_name: string
    email: string
    password: string
    role?: "creator" | "moderator"
    reason?: string
  }) {
    const response = await fetch(`${API_BASE_URL}/auth/register/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || "Registration failed")
    }

    return response.json()
  }

  async login(email: string, password: string): Promise<LoginResponse> {
    const response = await fetch(`${API_BASE_URL}/auth/login/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || "Login failed")
    }

    const data = await response.json()
    localStorage.setItem("access_token", data.access)
    localStorage.setItem("refresh_token", data.refresh)
    document.cookie = `session=1; path=/; SameSite=Lax`
    return data
  }

  async activate(code: string) {
    const response = await fetch(`${API_BASE_URL}/auth/activate/${code}/`)

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || "Activation failed")
    }

    return response.json()
  }

  async resendActivation(email: string) {
    const response = await fetch(`${API_BASE_URL}/auth/resend-activation/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || "Failed to resend activation")
    }

    return response.json()
  }

  async refreshToken() {
    const refreshToken = localStorage.getItem("refresh_token")
    if (!refreshToken) throw new Error("No refresh token available")

    const response = await fetch(`${API_BASE_URL}/auth/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh: refreshToken }),
    })

    if (!response.ok) {
      localStorage.removeItem("access_token")
      localStorage.removeItem("refresh_token")
      throw new Error("Token refresh failed")
    }

    const data = await response.json()
    localStorage.setItem("access_token", data.access)
    return data
  }

  async getProfile(): Promise<User> {
    const response = await fetch(`${API_BASE_URL}/me/`, {
      headers: this.getAuthHeaders(),
    })

    if (!response.ok) {
      if (response.status === 401) {
        try {
          await this.refreshToken()
          return this.getProfile()
        } catch {
          this.logout()
          throw new Error("Authentication required")
        }
      }
      throw new Error("Failed to fetch profile")
    }

    return response.json()
  }

  async updateProfile(data: FormData): Promise<User> {
    const response = await fetch(`${API_BASE_URL}/me/`, {
      method: "PATCH",
      headers: this.getAuthHeaders(),
      body: data,
    })

    if (!response.ok) {
      throw new Error("Failed to update profile")
    }

    return response.json()
  }

  async getRoleRequests(): Promise<RoleRequest[]> {
    const response = await fetch(`${API_BASE_URL}/admin/role-requests/`, {
      headers: this.getAuthHeaders(),
    })

    if (!response.ok) {
      throw new Error("Failed to fetch role requests")
    }

    return response.json()
  }

  async approveRoleRequest(id: number) {
    const response = await fetch(`${API_BASE_URL}/admin/role-requests/${id}/approve/`, {
      method: "POST",
      headers: this.getAuthHeaders(),
    })

    if (!response.ok) {
      throw new Error("Failed to approve role request")
    }

    return response.json()
  }

  async rejectRoleRequest(id: number) {
    const response = await fetch(`${API_BASE_URL}/admin/role-requests/${id}/reject/`, {
      method: "POST",
      headers: this.getAuthHeaders(),
    })

    if (!response.ok) {
      throw new Error("Failed to reject role request")
    }

    return response.json()
  }

  async uploadRitual(data: FormData): Promise<Ritual> {
    const response = await fetch(`${API_BASE_URL}/rituals/`, {
      method: "POST",
      headers: this.getAuthHeaders(),
      body: data,
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || "Failed to upload ritual")
    }

    return response.json()
  }

  async getMyRituals(): Promise<Ritual[]> {
    const response = await fetch(`${API_BASE_URL}/rituals/mine/`, {
      headers: this.getAuthHeaders(),
    })

    if (!response.ok) {
      throw new Error("Failed to fetch rituals")
    }

    return response.json()
  }

  async updateRitual(id: number, data: Partial<RitualUpload>): Promise<Ritual> {
    const response = await fetch(`${API_BASE_URL}/rituals/${id}/`, {
      method: "PATCH",
      headers: {
        ...this.getAuthHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      throw new Error("Failed to update ritual")
    }

    return response.json()
  }

  async deleteRitual(id: number): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/rituals/${id}/`, {
      method: "DELETE",
      headers: this.getAuthHeaders(),
    })

    if (!response.ok) {
      throw new Error("Failed to delete ritual")
    }
  }

  async getRitualAnalytics(id: number): Promise<RitualAnalytics> {
    const response = await fetch(`${API_BASE_URL}/rituals/${id}/analytics/`, {
      headers: this.getAuthHeaders(),
    })

    if (!response.ok) {
      throw new Error("Failed to fetch ritual analytics")
    }

    return response.json()
  }

  async getRitualFeedback(id: number): Promise<RitualFeedback[]> {
    const response = await fetch(`${API_BASE_URL}/rituals/${id}/feedback/`, {
      headers: this.getAuthHeaders(),
    })

    if (!response.ok) {
      throw new Error("Failed to fetch ritual feedback")
    }

    return response.json()
  }

  async getAllRituals(search?: string, tags?: string[]): Promise<Ritual[]> {
    const params = new URLSearchParams()
    if (search) params.append("search", search)
    if (tags && tags.length > 0) params.append("tags", tags.join(","))

    // Send auth when available so locked/required_plan reflect the caller's plan
    const response = await fetch(`${API_BASE_URL}/rituals/public/?${params.toString()}`, {
      headers: this.getAuthHeaders(),
    })

    if (!response.ok) {
      throw new Error("Failed to fetch rituals")
    }

    return response.json()
  }

  async getPublicRituals(search?: string, tags?: string[]): Promise<Ritual[]> {
    return this.getAllRituals(search, tags)
  }

  getRitualStreamUrl(id: number): string {
    return `${API_BASE_URL}/rituals/${id}/stream/`
  }

  async blessRitual(ritualId: number): Promise<Blessing> {
    const response = await fetch(`${API_BASE_URL}/analytics/blessings/`, {
      method: "POST",
      headers: {
        ...this.getAuthHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ritual: ritualId }),
    })

    if (!response.ok) {
      if (response.status === 400) {
        throw new Error("You have already blessed this ritual")
      }
      throw new Error("Failed to bless ritual")
    }

    return response.json()
  }

  async submitFeedback(feedback: FeedbackSubmission): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/analytics/feedback/`, {
      method: "POST",
      headers: {
        ...this.getAuthHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(feedback),
    })

    if (!response.ok) {
      throw new Error("Failed to submit feedback")
    }
  }

  /**
   * @deprecated The ritual player now registers plays via
   * POST /analytics/playback/start/ (see lib/playback-metering.ts), which
   * also handles quota. Calling this for the same listen would create a
   * second play.
   */
  async startPlaySession(ritualId: number): Promise<PlaySession> {
    const response = await fetch(`${API_BASE_URL}/analytics/plays/`, {
      method: "POST",
      headers: {
        ...this.getAuthHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ritual: ritualId }),
    })

    if (!response.ok) {
      // Structured 403s (quota_exceeded / care_level) open the upgrade modal
      await throwIfEntitlementDenied(response)
      throw new Error("Failed to start play session")
    }

    return response.json()
  }

  async updatePlayProgress(playId: number, currentTime: number): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/analytics/plays/${playId}/progress/`, {
      method: "POST",
      headers: {
        ...this.getAuthHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ timestamp: Math.floor(currentTime) }),
    })

    if (!response.ok) {
      throw new Error("Failed to update play progress")
    }
  }

  async completePlaySession(playId: number): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/analytics/plays/${playId}/complete/`, {
      method: "POST",
      headers: this.getAuthHeaders(),
    })

    if (!response.ok) {
      throw new Error("Failed to complete play session")
    }
  }

  async getCreatorDashboardMetrics(): Promise<CreatorDashboardMetrics> {
    const response = await fetch(`${API_BASE_URL}/analytics/creator/dashboard/`, {
      headers: this.getAuthHeaders(),
    })

    if (!response.ok) {
      throw new Error("Failed to fetch creator dashboard metrics")
    }

    return response.json()
  }

  async getCreatorFeedback(): Promise<CreatorFeedbackItem[]> {
    const response = await fetch(`${API_BASE_URL}/analytics/creator/feedback/`, {
      headers: this.getAuthHeaders(),
    })

    if (!response.ok) {
      throw new Error("Failed to fetch creator feedback")
    }

    return response.json()
  }

  async forgotPassword(email: string): Promise<{ message: string }> {
    const response = await fetch(`${API_BASE_URL}/auth/forgot-password/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    })
    if (!response.ok) {
      throw new Error("Unable to process request. Please try again.")
    }
    return response.json()
  }

  async resetPassword(
    token: string,
    newPassword: string,
    confirmPassword: string,
  ): Promise<{ message: string }> {
    const response = await fetch(`${API_BASE_URL}/auth/reset-password/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, new_password: newPassword, confirm_password: confirmPassword }),
    })
    if (!response.ok) {
      const error = await response.json()
      throw new Error(
        error.detail ||
          (Array.isArray(error.confirm_password) ? error.confirm_password[0] : undefined) ||
          "Failed to reset password",
      )
    }
    return response.json()
  }

  getToken(): string | null {
    return localStorage.getItem("access_token")
  }

  logout() {
    localStorage.removeItem("access_token")
    localStorage.removeItem("refresh_token")
    document.cookie = `session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`
  }

  isAuthenticated(): boolean {
    return !!localStorage.getItem("access_token")
  }

  // Consent API
  async acceptConsent(privacyPolicy: boolean, termsOfService: boolean): Promise<{
    message: string
    consents_accepted: boolean
    consent_accepted_at: string
  }> {
    const response = await fetch(`${API_BASE_URL}/auth/consent/`, {
      method: "POST",
      headers: {
        ...this.getAuthHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        privacy_policy: privacyPolicy,
        terms_of_service: termsOfService,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || "Failed to accept consent")
    }

    return response.json()
  }

  // Report API
  async submitReport(data: {
    content_type: "ritual" | "sanctuary" | "user"
    content_id: number
    violation_type: "cultural_harm" | "safety_risk" | "misinformation" | "inappropriate_content" | "spam" | "other"
    description: string
  }): Promise<{ detail: string; case_id: number }> {
    const response = await fetch(`${API_BASE_URL}/moderations/report/`, {
      method: "POST",
      headers: {
        ...this.getAuthHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || "Failed to submit report")
    }

    return response.json()
  }

  // Member Dashboard APIs
  async getMyPlayHistory(): Promise<Array<{
    id: number
    ritual: number
    ritual_title: string
    ritual_care_level: string
    started_at: string
    completed_at: string | null
    progress_seconds: number
    is_completed: boolean
  }>> {
    const response = await fetch(`${API_BASE_URL}/analytics/me/plays/`, {
      headers: this.getAuthHeaders(),
    })

    if (!response.ok) {
      throw new Error("Failed to fetch play history")
    }

    return response.json()
  }

  async getMyBlessings(): Promise<Array<{
    id: number
    ritual: number
    ritual_title: string
    ritual_care_level: string
    created_at: string
  }>> {
    const response = await fetch(`${API_BASE_URL}/analytics/me/blessings/`, {
      headers: this.getAuthHeaders(),
    })

    if (!response.ok) {
      throw new Error("Failed to fetch blessings")
    }

    return response.json()
  }

  async getJoinedSanctuaries(): Promise<Array<{
    id: number
    sanctuary_id: number
    title: string
    description: string
    privacy: string
    sanctuary_status: string
    active_members_count: number
    status: string
    member_since: string
    requested_at: string
  }>> {
    const response = await fetch(`${API_BASE_URL}/sanctuaries/joined/`, {
      headers: this.getAuthHeaders(),
    })

    if (!response.ok) {
      throw new Error("Failed to fetch joined sanctuaries")
    }

    return response.json()
  }

  // Care cases — reads, the five workflow transitions and crisis escalation all
  // live in `moderationService` (lib/moderation.ts). The PATCH-based helpers
  // that used to live here are gone on purpose: writing `status` directly
  // leaves `assigned_at` / `resolved_by` / `archived_at` unstamped, so the case
  // never appears correctly in Care History or The Archive.

  async getPendingRituals(): Promise<PendingRitual[]> {
    const response = await fetch(`${API_BASE_URL}/moderations/rituals/pending/`, {
      headers: this.getAuthHeaders(),
    })

    if (!response.ok) {
      throw new Error("Failed to fetch pending rituals")
    }

    return response.json()
  }

  async reviewRitual(ritualId: number, action: "approve" | "reject", note?: string): Promise<ReviewResponse> {
    const response = await fetch(`${API_BASE_URL}/moderations/rituals/${ritualId}/review/`, {
      method: "POST",
      headers: {
        ...this.getAuthHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action, note }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || "Failed to review ritual")
    }

    return response.json()
  }
}

export const authService = new AuthService()

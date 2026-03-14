const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "/api"

export interface User {
  email: string
  first_name: string
  last_name: string
  role: "member" | "creator" | "moderator" | "admin"
  profile_picture?: string
  date_joined: string
}

export interface LoginResponse {
  refresh: string
  access: string
  role: string
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

export interface ModerationCase {
  id: number
  ritual: number | null
  ritual_title?: string
  emotional_state?: number | null
  flagged_by_ai: boolean
  flagged_reason?: string
  severity: "low" | "medium" | "high"
  assigned_moderator?: number | null
  assigned_moderator_email?: string
  status: "open" | "assigned" | "resolved" | "closed"
  created_at: string
  updated_at: string
  history: Array<{
    at: string
    by: string
    event: string
    before: Record<string, any>
    after: Record<string, any>
  }>
}

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

export interface CareFeedItem {
  id: number
  type: "blessing" | "feedback" | "case"
  ritual?: number | null
  ritual_title?: string
  user?: number | null
  giver_email?: string
  feedback_text?: string
  is_anonymous?: boolean
  emotional_state?: number | null
  flagged_by_ai?: boolean
  flagged_reason?: string
  severity?: "low" | "medium" | "high"
  assigned_moderator?: number | null
  assigned_moderator_email?: string
  status?: string
  created_at?: string
  updated_at?: string
  history?: Array<Record<string, any>>
}

class AuthService {
  getAuthHeaders() {
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

    const response = await fetch(`${API_BASE_URL}/rituals/public/?${params.toString()}`)

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

  async getModerationStats(): Promise<{
    pending_reviews: number
    open_cases: number
    reviews_completed_today: number
    cases_resolved_today: number
  }> {
    // This endpoint doesn't exist in the API docs, so we'll calculate from other endpoints
    const [pendingRituals, cases] = await Promise.all([this.getPendingRituals(), this.getModerationCases()])

    return {
      pending_reviews: pendingRituals.length,
      open_cases: cases.filter((c) => c.status === "open").length,
      reviews_completed_today: 0, // Would need separate endpoint
      cases_resolved_today: 0, // Would need separate endpoint
    }
  }

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

  async getModerationCases(): Promise<ModerationCase[]> {
    const response = await fetch(`${API_BASE_URL}/moderations/cases/`, {
      headers: this.getAuthHeaders(),
    })

    if (!response.ok) {
      throw new Error("Failed to fetch moderation cases")
    }

    return response.json()
  }

  async getModerationCase(caseId: number): Promise<ModerationCase> {
    const response = await fetch(`${API_BASE_URL}/moderations/cases/${caseId}/`, {
      headers: this.getAuthHeaders(),
    })

    if (!response.ok) {
      throw new Error("Failed to fetch moderation case")
    }

    return response.json()
  }

  async updateModerationCase(
    caseId: number,
    updates: {
      assigned_moderator?: number
      status?: "open" | "assigned" | "resolved" | "closed"
      severity?: "low" | "medium" | "high"
    },
  ): Promise<ModerationCase> {
    const response = await fetch(`${API_BASE_URL}/moderations/cases/${caseId}/`, {
      method: "PATCH",
      headers: {
        ...this.getAuthHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(updates),
    })

    if (!response.ok) {
      throw new Error("Failed to update moderation case")
    }

    return response.json()
  }

  async getCareFeed(): Promise<CareFeedItem[]> {
    const response = await fetch(`${API_BASE_URL}/moderations/care-feed/`, {
      headers: this.getAuthHeaders(),
    })

    if (!response.ok) {
      throw new Error("Failed to fetch care feed")
    }

    return response.json()
  }

  async updateCaseStatus(caseId: number, status: string, notes?: string): Promise<ModerationCase> {
    const response = await fetch(`${API_BASE_URL}/moderations/cases/${caseId}/`, {
      method: "PATCH",
      headers: {
        ...this.getAuthHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        status,
      }),
    })

    if (!response.ok) {
      throw new Error("Failed to update case status")
    }

    return response.json()
  }

  async assignCase(caseId: number): Promise<ModerationCase> {
    const response = await fetch(`${API_BASE_URL}/moderations/cases/${caseId}/`, {
      method: "PATCH",
      headers: {
        ...this.getAuthHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        status: "assigned",
      }),
    })

    if (!response.ok) {
      throw new Error("Failed to assign case")
    }

    return response.json()
  }
}

export const authService = new AuthService()

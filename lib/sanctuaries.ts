import { authService } from "./auth"
import { throwIfGated } from "./gateway-quiz"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "/api"

// Types
export interface User {
  id: number
  email: string
  first_name: string
  last_name: string
  role: string
  profile_picture?: string
  date_joined: string
}

export interface Tag {
  id: number
  name: string
}

export interface Sanctuary {
  id: number
  title: string
  description: string
  welcome_message: string
  privacy: "public" | "invite_only"
  status: "active" | "paused" | "archived"
  capacity: number
  allow_open_join: boolean
  tags: Tag[]
  owner: User
  active_members_count: number
  membership_status?: "pending" | "approved" | "rejected" | "revoked" | "canceled" | null
  created_at: string
  updated_at: string
}

export interface Membership {
  id: number
  member: User
  status: "pending" | "approved" | "rejected" | "revoked" | "canceled"
  requested_at: string
  acted_at?: string | null
  handled_by?: User | null
  note?: string
}

export interface RitualAssignment {
  id: number
  ritual_id: number
  ritual_title: string
  care_level: string
  status: string
  assigned_at: string
}

export interface AuditLogEntry {
  id: number
  action: string
  context: Record<string, any>
  actor: User
  created_at: string
}

export interface CreateSanctuaryPayload {
  title: string
  description?: string
  welcome_message?: string
  privacy: "public" | "invite_only"
  capacity?: number
  allow_open_join?: boolean
  tags_write?: string[]
}

export interface UpdateSanctuaryPayload {
  title?: string
  description?: string
  welcome_message?: string
  privacy?: "public" | "invite_only"
  capacity?: number
  allow_open_join?: boolean
  tags_write?: string[]
}

export interface CapacityPayload {
  capacity: number
  allow_open_join?: boolean
}

export interface StatusPayload {
  status: "active" | "paused" | "archived"
}

export interface JoinRequestPayload {
  note?: string
  invite_token?: string
}

export interface ApproveRejectPayload {
  note?: string
}

// API Service
class SanctuariesService {
  private getHeaders() {
    return authService.getAuthHeaders()
  }

  // List all accessible sanctuaries
  async listSanctuaries(): Promise<Sanctuary[]> {
    const response = await fetch(`${API_BASE_URL}/sanctuaries/`, {
      method: "GET",
      headers: this.getHeaders(),
    })

    if (!response.ok) {
      throw new Error(`Failed to list sanctuaries: ${response.statusText}`)
    }

    return response.json()
  }

  // Get creator's owned sanctuaries
  async getOwnedSanctuaries(): Promise<Sanctuary[]> {
    const response = await fetch(`${API_BASE_URL}/sanctuaries/mine/`, {
      method: "GET",
      headers: this.getHeaders(),
    })

    if (!response.ok) {
      throw new Error(`Failed to get owned sanctuaries: ${response.statusText}`)
    }

    return response.json()
  }

  // Get sanctuary detail
  async getSanctuaryDetail(id: number): Promise<Sanctuary> {
    const response = await fetch(`${API_BASE_URL}/sanctuaries/${id}/`, {
      method: "GET",
      headers: this.getHeaders(),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || `Failed to get sanctuary: ${response.statusText}`)
    }

    return response.json()
  }

  // Create new sanctuary
  async createSanctuary(payload: CreateSanctuaryPayload): Promise<Sanctuary> {
    const response = await fetch(`${API_BASE_URL}/sanctuaries/`, {
      method: "POST",
      headers: {
        ...this.getHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || `Failed to create sanctuary: ${response.statusText}`)
    }

    return response.json()
  }

  // Update sanctuary
  async updateSanctuary(id: number, payload: UpdateSanctuaryPayload): Promise<Sanctuary> {
    const response = await fetch(`${API_BASE_URL}/sanctuaries/${id}/`, {
      method: "PATCH",
      headers: {
        ...this.getHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || `Failed to update sanctuary: ${response.statusText}`)
    }

    return response.json()
  }

  // Adjust capacity and open join
  async adjustCapacity(id: number, payload: CapacityPayload): Promise<Sanctuary> {
    const response = await fetch(`${API_BASE_URL}/sanctuaries/${id}/capacity/`, {
      method: "POST",
      headers: {
        ...this.getHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || `Failed to adjust capacity: ${response.statusText}`)
    }

    return response.json()
  }

  // Change sanctuary status
  async changeSanctuaryStatus(id: number, payload: StatusPayload): Promise<Sanctuary> {
    const response = await fetch(`${API_BASE_URL}/sanctuaries/${id}/status/`, {
      method: "POST",
      headers: {
        ...this.getHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || `Failed to change status: ${response.statusText}`)
    }

    return response.json()
  }

  // Request to join sanctuary
  async requestJoin(id: number, payload?: JoinRequestPayload): Promise<Membership> {
    const response = await fetch(`${API_BASE_URL}/sanctuaries/${id}/join-request/`, {
      method: "POST",
      headers: {
        ...this.getHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload || {}),
    })

    if (!response.ok) {
      // gateway_incomplete 403s throw GatewayIncompleteError (runGatedAction
      // finishes the Gateway then retries the join); sanctuary_limit 403s open
      // the upgrade modal; other 403s surface their detail as a normal error.
      const error = await throwIfGated(response)
      throw new Error(error?.detail || `Failed to request join: ${response.statusText}`)
    }

    return response.json()
  }

  // Get current user's membership status
  async getMembershipStatus(id: number): Promise<Membership> {
    const response = await fetch(`${API_BASE_URL}/sanctuaries/${id}/membership/`, {
      method: "GET",
      headers: this.getHeaders(),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || `Failed to get membership status: ${response.statusText}`)
    }

    return response.json()
  }

  // Leave sanctuary
  async leaveSanctuary(id: number): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/sanctuaries/${id}/membership/`, {
      method: "DELETE",
      headers: this.getHeaders(),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || `Failed to leave sanctuary: ${response.statusText}`)
    }
  }

  // Get pending join requests (creator only)
  async getPendingRequests(id: number): Promise<Membership[]> {
    const response = await fetch(`${API_BASE_URL}/sanctuaries/${id}/requests/`, {
      method: "GET",
      headers: this.getHeaders(),
    })

    if (!response.ok) {
      throw new Error(`Failed to get pending requests: ${response.statusText}`)
    }

    return response.json()
  }

  // Approve join request
  async approveRequest(id: number, membershipId: number, payload?: ApproveRejectPayload): Promise<Membership> {
    const response = await fetch(`${API_BASE_URL}/sanctuaries/${id}/requests/${membershipId}/approve/`, {
      method: "POST",
      headers: {
        ...this.getHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload || {}),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || `Failed to approve request: ${response.statusText}`)
    }

    return response.json()
  }

  // Reject join request
  async rejectRequest(id: number, membershipId: number, payload?: ApproveRejectPayload): Promise<Membership> {
    const response = await fetch(`${API_BASE_URL}/sanctuaries/${id}/requests/${membershipId}/reject/`, {
      method: "POST",
      headers: {
        ...this.getHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload || {}),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || `Failed to reject request: ${response.statusText}`)
    }

    return response.json()
  }

  // Get approved members
  async getApprovedMembers(id: number): Promise<Membership[]> {
    const response = await fetch(`${API_BASE_URL}/sanctuaries/${id}/members/`, {
      method: "GET",
      headers: this.getHeaders(),
    })

    if (!response.ok) {
      throw new Error(`Failed to get members: ${response.statusText}`)
    }

    return response.json()
  }

  // Revoke membership
  async revokeMembership(id: number, membershipId: number, payload?: ApproveRejectPayload): Promise<Membership> {
    const response = await fetch(`${API_BASE_URL}/sanctuaries/${id}/members/${membershipId}/revoke/`, {
      method: "POST",
      headers: {
        ...this.getHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload || {}),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || `Failed to revoke membership: ${response.statusText}`)
    }

    return response.json()
  }

  // Get audit log
  async getAuditLog(id: number): Promise<AuditLogEntry[]> {
    const response = await fetch(`${API_BASE_URL}/sanctuaries/${id}/audits/`, {
      method: "GET",
      headers: this.getHeaders(),
    })

    if (!response.ok) {
      throw new Error(`Failed to get audit log: ${response.statusText}`)
    }

    return response.json()
  }

  // Get assigned rituals
  async getAssignedRituals(id: number): Promise<RitualAssignment[]> {
    const response = await fetch(`${API_BASE_URL}/sanctuaries/${id}/rituals/`, {
      method: "GET",
      headers: this.getHeaders(),
    })

    if (!response.ok) {
      throw new Error(`Failed to get rituals: ${response.statusText}`)
    }

    return response.json()
  }

  // Assign ritual
  async assignRitual(id: number, ritualId: number): Promise<RitualAssignment> {
    const response = await fetch(`${API_BASE_URL}/sanctuaries/${id}/rituals/${ritualId}/assign/`, {
      method: "POST",
      headers: this.getHeaders(),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || `Failed to assign ritual: ${response.statusText}`)
    }

    return response.json()
  }

  // Remove ritual assignment
  async removeRitualAssignment(id: number, ritualId: number): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/sanctuaries/${id}/rituals/${ritualId}/assign/`, {
      method: "DELETE",
      headers: this.getHeaders(),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || `Failed to remove ritual: ${response.statusText}`)
    }
  }

  /**
   * Permanently remove a sanctuary. `acknowledge: true` is required by the
   * server — a request without it comes back 400, and a non-owner (who isn't a
   * Steward) comes back 403. The audit trail is written backend-side.
   */
  async removeSanctuary(id: number): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/sanctuaries/${id}/`, {
      method: "DELETE",
      headers: {
        ...this.getHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ acknowledge: true }),
    })

    if (!response.ok) {
      throw await toRemovalError(response)
    }
  }
}

/** Error from `DELETE /sanctuaries/<id>/`, carrying the status so the UI can
 *  distinguish "you're not the owner" (403) from a validation failure (400). */
export class SanctuaryRemovalError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = "SanctuaryRemovalError"
    this.status = status
  }
}

async function toRemovalError(response: Response): Promise<SanctuaryRemovalError> {
  let message = ""
  try {
    const body = await response.json()
    // DRF puts non-field errors under `detail`; serializer errors come back
    // keyed by field, so fall back to the first string we can find.
    message =
      body?.detail ||
      body?.acknowledge?.[0] ||
      (typeof body === "string" ? body : "") ||
      Object.values(body ?? {}).flat().find((v) => typeof v === "string") ||
      ""
  } catch {
    // Non-JSON body (proxy error page, empty 502) — fall through to defaults.
  }

  if (!message) {
    message =
      response.status === 403
        ? "Only the sanctuary owner can remove this sanctuary."
        : `Failed to remove sanctuary: ${response.statusText}`
  }

  return new SanctuaryRemovalError(message, response.status)
}

export const sanctuariesService = new SanctuariesService()

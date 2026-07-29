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

  // Get sanctuary detail.
  //
  // Since Session 10 an archived (removed) sanctuary 404s for everyone except
  // stewards — including its former owner — so callers must treat 404 as
  // "gone" and route back to the list rather than assuming an auth problem.
  async getSanctuaryDetail(id: number): Promise<Sanctuary> {
    const response = await fetch(`${API_BASE_URL}/sanctuaries/${id}/`, {
      method: "GET",
      headers: this.getHeaders(),
    })

    if (!response.ok) {
      const body = await readJson(response)
      throw new SanctuaryRequestError(
        body?.detail || `Failed to get sanctuary: ${response.statusText}`,
        response.status,
      )
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
   * Step 1 of removal: `POST /sanctuaries/<id>/remove/` with an empty body.
   *
   * The server answers 400 `acknowledgment_required` carrying the consequence
   * copy to show in the confirm dialog. That copy is server-owned — render it
   * verbatim rather than hardcoding it here (API_CONTRACTS Session 10).
   *
   * A 403 means the control shouldn't have been rendered at all; 400
   * `already_removed` means someone else got there first.
   */
  async getRemovalConsequences(id: number): Promise<RemovalConsequences> {
    const response = await fetch(`${API_BASE_URL}/sanctuaries/${id}/remove/`, {
      method: "POST",
      headers: { ...this.getHeaders(), "Content-Type": "application/json" },
      body: "{}",
    })

    const body = await readJson(response)

    if (response.status === 400 && body?.code === "acknowledgment_required") {
      return {
        consequences: Array.isArray(body.consequences) ? body.consequences : [],
        reversible: body.reversible === true,
        title: body?.sanctuary?.title ?? null,
      }
    }

    // Anything else — including an unexpected 200 — is a genuine failure of
    // the preflight; the caller falls back to generic copy or surfaces it.
    throw toRemovalError(response, body)
  }

  /**
   * Step 2: re-send with the acknowledgment. Returns the 200 body so the UI
   * can toast the server's own `detail` string.
   *
   * Note this is a *soft* delete — the sanctuary moves to `archived` and only
   * platform staff can restore it. Members, circles and ritual links are not
   * restored by a restore.
   */
  async removeSanctuary(id: number): Promise<RemovalResult> {
    const response = await fetch(`${API_BASE_URL}/sanctuaries/${id}/remove/`, {
      method: "POST",
      headers: { ...this.getHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ acknowledge: true }),
    })

    const body = await readJson(response)

    if (!response.ok) {
      throw toRemovalError(response, body)
    }

    return {
      detail: body?.detail ?? "Sanctuary removed.",
      sanctuaryId: body?.sanctuary_id ?? id,
      status: body?.status ?? "archived",
      membershipsRevoked: body?.memberships_revoked ?? 0,
      circlesArchived: body?.circles_archived ?? 0,
      ritualsDetached: body?.rituals_detached ?? 0,
    }
  }
}

/** The 400 `acknowledgment_required` preflight payload. */
export interface RemovalConsequences {
  /** Server-owned copy for the confirm dialog. Render verbatim. */
  consequences: string[]
  reversible: boolean
  title: string | null
}

export interface RemovalResult {
  detail: string
  sanctuaryId: number
  status: string
  membershipsRevoked: number
  circlesArchived: number
  ritualsDetached: number
}

/** A failed sanctuary read, carrying the HTTP status so callers can tell
 *  "gone" (404 — e.g. removed) from "not signed in" (401). */
export class SanctuaryRequestError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = "SanctuaryRequestError"
    this.status = status
  }
}

/** Error from `POST /sanctuaries/<id>/remove/`, carrying the status and the
 *  server's `code` so the UI can tell "you're not allowed" (403) from
 *  "someone already removed it" (400 `already_removed`). */
export class SanctuaryRemovalError extends Error {
  readonly status: number
  readonly code: string | null

  constructor(message: string, status: number, code: string | null = null) {
    super(message)
    this.name = "SanctuaryRemovalError"
    this.status = status
    this.code = code
  }

  /** The sanctuary was already archived — treat as success-ish, not a fault. */
  get alreadyRemoved(): boolean {
    return this.code === "already_removed"
  }
}

async function readJson(response: Response): Promise<any> {
  try {
    return await response.json()
  } catch {
    // Non-JSON body (proxy error page, empty 502).
    return null
  }
}

function toRemovalError(response: Response, body: any): SanctuaryRemovalError {
  // DRF puts non-field errors under `detail`; serializer errors come back
  // keyed by field, so fall back to the first string we can find.
  let message: string =
    body?.detail ||
    body?.acknowledge?.[0] ||
    (typeof body === "string" ? body : "") ||
    Object.values(body ?? {}).flat().find((v) => typeof v === "string") ||
    ""

  if (!message) {
    message =
      response.status === 403
        ? "Only the sanctuary owner or platform staff can remove this sanctuary."
        : response.status === 404
        ? "This sanctuary no longer exists."
        : `Failed to remove sanctuary: ${response.statusText}`
  }

  return new SanctuaryRemovalError(message, response.status, body?.code ?? null)
}

export const sanctuariesService = new SanctuariesService()

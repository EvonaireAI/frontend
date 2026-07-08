import { authService } from "./auth"
import { throwIfEntitlementDenied } from "./entitlements"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "/api"

// Types (mirror docs/API_CONTRACTS.md — the Agora)

export interface AgoraUser {
  id: number
  display_name: string
}

// Combined server-side with membership and plan — always render CTAs from
// these flags, never re-derive tier logic client-side.
export interface AgoraCapabilities {
  can_post: boolean
  can_host: boolean
  is_moderator: boolean
}

export interface Circle {
  id: number
  sanctuary: number
  host: AgoraUser
  title: string
  description: string
  status: "active" | "archived"
  post_count: number
  created_at: string
}

export interface CirclesResponse {
  circles: Circle[]
  capabilities: AgoraCapabilities
}

export interface AgoraReply {
  id: number
  post: number
  author: AgoraUser
  body: string
  status: string
  created_at: string
  edited_at: string | null
}

export interface AgoraPost {
  id: number
  circle: number
  author: AgoraUser
  body: string
  status: string
  blessing_count: number
  caller_blessed: boolean
  replies: AgoraReply[]
  created_at: string
  edited_at: string | null
}

export interface PostsPage {
  circle: Circle
  posts: AgoraPost[]
  next_before: number | null
  has_more: boolean
  capabilities: AgoraCapabilities
}

export type FlagReason = "emotional_harm" | "cultural_harm" | "misuse" | "other"

export const FLAG_REASON_LABELS: Record<FlagReason, string> = {
  emotional_harm: "Emotional harm",
  cultural_harm: "Cultural harm",
  misuse: "Misuse of the space",
  other: "Something else",
}

export interface FlagPayload {
  reason: FlagReason
  note?: string
}

export interface FlagResponse {
  id: number
  target: "post" | "reply"
  target_id: number
  reason: FlagReason
}

export interface RemovalResponse {
  id: number
  status: "removed_by_author" | "removed_by_moderation"
}

// Plain (non-entitlement) 403 — the caller isn't an approved member of the
// sanctuary. UI shows a "join this sanctuary first" state, never upgrade UI.
export class NotMemberError extends Error {
  constructor(detail: string) {
    super(detail)
    this.name = "NotMemberError"
  }
}

// 429 — post/reply/flag creation is throttled at 10/minute. Surface as a
// gentle neutral toast, not an error.
export class ThrottledError extends Error {
  constructor() {
    super("Take a breath — you're posting quickly. Try again in a moment.")
    this.name = "ThrottledError"
  }
}

// 400 on circle creation with a per-field body ({"title": "..."}) — shown
// inline under the title field rather than as a toast.
export class CircleTitleError extends Error {
  constructor(detail: string) {
    super(detail)
    this.name = "CircleTitleError"
  }
}

class AgoraService {
  private getHeaders() {
    return authService.getAuthHeaders()
  }

  // Shared non-ok handling: 429 → ThrottledError; entitlement 403 → upgrade
  // modal (throwIfEntitlementDenied throws EntitlementDeniedError); plain
  // 403 → NotMemberError; anything else → detail as a normal error.
  private async raise(response: Response, fallback: string): Promise<never> {
    if (response.status === 429) throw new ThrottledError()
    const body = await throwIfEntitlementDenied(response)
    if (response.status === 403) throw new NotMemberError(body?.detail || fallback)
    throw new Error(body?.detail || fallback)
  }

  async getCircles(sanctuaryId: number): Promise<CirclesResponse> {
    const response = await fetch(`${API_BASE_URL}/agora/sanctuaries/${sanctuaryId}/circles/`, {
      method: "GET",
      headers: this.getHeaders(),
    })

    if (!response.ok) {
      await this.raise(response, `Failed to load circles: ${response.statusText}`)
    }

    return response.json()
  }

  async createCircle(sanctuaryId: number, payload: { title: string; description?: string }): Promise<Circle> {
    const response = await fetch(`${API_BASE_URL}/agora/sanctuaries/${sanctuaryId}/circles/`, {
      method: "POST",
      headers: {
        ...this.getHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      if (response.status === 429) throw new ThrottledError()
      const body = await throwIfEntitlementDenied(response)
      const titleError = body?.title
      if (response.status === 400 && titleError) {
        throw new CircleTitleError(Array.isArray(titleError) ? titleError[0] : titleError)
      }
      if (response.status === 403) {
        throw new NotMemberError(body?.detail || "You must be a member of this sanctuary.")
      }
      throw new Error(body?.detail || `Failed to create circle: ${response.statusText}`)
    }

    return response.json()
  }

  async archiveCircle(circleId: number): Promise<Circle> {
    const response = await fetch(`${API_BASE_URL}/agora/circles/${circleId}/archive/`, {
      method: "POST",
      headers: this.getHeaders(),
    })

    if (!response.ok) {
      await this.raise(response, `Failed to archive circle: ${response.statusText}`)
    }

    return response.json()
  }

  // Newest first, id-cursor pagination: first page without `before`, older
  // pages with the previous response's `next_before`.
  async getPosts(circleId: number, before?: number | null, limit = 20): Promise<PostsPage> {
    const params = new URLSearchParams({ limit: String(limit) })
    if (before != null) params.set("before", String(before))

    const response = await fetch(`${API_BASE_URL}/agora/circles/${circleId}/posts/?${params}`, {
      method: "GET",
      headers: this.getHeaders(),
    })

    if (!response.ok) {
      await this.raise(response, `Failed to load posts: ${response.statusText}`)
    }

    return response.json()
  }

  async createPost(circleId: number, body: string): Promise<AgoraPost> {
    const response = await fetch(`${API_BASE_URL}/agora/circles/${circleId}/posts/`, {
      method: "POST",
      headers: {
        ...this.getHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ body }),
    })

    if (!response.ok) {
      await this.raise(response, `Failed to share post: ${response.statusText}`)
    }

    return response.json()
  }

  async createReply(postId: number, body: string): Promise<AgoraReply> {
    const response = await fetch(`${API_BASE_URL}/agora/posts/${postId}/replies/`, {
      method: "POST",
      headers: {
        ...this.getHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ body }),
    })

    if (!response.ok) {
      await this.raise(response, `Failed to reply: ${response.statusText}`)
    }

    return response.json()
  }

  async blessPost(postId: number): Promise<{ blessed: boolean; blessing_count: number }> {
    const response = await fetch(`${API_BASE_URL}/agora/posts/${postId}/bless/`, {
      method: "POST",
      headers: this.getHeaders(),
    })

    if (!response.ok) {
      await this.raise(response, `Failed to bless post: ${response.statusText}`)
    }

    return response.json()
  }

  async flagPost(postId: number, payload: FlagPayload): Promise<FlagResponse> {
    return this.flag(`${API_BASE_URL}/agora/posts/${postId}/flag/`, payload)
  }

  async flagReply(replyId: number, payload: FlagPayload): Promise<FlagResponse> {
    return this.flag(`${API_BASE_URL}/agora/replies/${replyId}/flag/`, payload)
  }

  private async flag(url: string, payload: FlagPayload): Promise<FlagResponse> {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        ...this.getHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      await this.raise(response, `Failed to raise a care flag: ${response.statusText}`)
    }

    return response.json()
  }

  async removePost(postId: number): Promise<RemovalResponse> {
    const response = await fetch(`${API_BASE_URL}/agora/posts/${postId}/`, {
      method: "DELETE",
      headers: this.getHeaders(),
    })

    if (!response.ok) {
      await this.raise(response, `Failed to remove post: ${response.statusText}`)
    }

    return response.json()
  }

  async removeReply(replyId: number): Promise<RemovalResponse> {
    const response = await fetch(`${API_BASE_URL}/agora/replies/${replyId}/`, {
      method: "DELETE",
      headers: this.getHeaders(),
    })

    if (!response.ok) {
      await this.raise(response, `Failed to remove reply: ${response.statusText}`)
    }

    return response.json()
  }
}

export const agoraService = new AgoraService()

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "/api"

// RTS Types
export interface RTSScore {
  user: {
    id: number
    email: string
    first_name: string
    last_name: string
  }
  current_score: number
  score_version: string
  last_calculated_at: string
  meta: Record<string, any>
}

export interface RTSHistoryEntry {
  id: number
  score_before: number
  score_after: number
  trigger_input: number
  trigger_type: string
  explanation: {
    bounds: {
      max: number
      min: number
    }
    contrib: Record<
      string,
      {
        value: number
        weight: number
        contribution: number
      }
    >
    version: string
    missing_signals: string[]
    present_signals: string[]
    weights_effective: Record<string, number>
  }
  created_at: string
}

export interface RTSSelfAssessment {
  physical_health: number
  emotional_state: number
  spiritual_connection: number
  community_engagement: number
  creative_energy: number
}

export interface RTSCreatorSummary {
  user: {
    id: number
    email: string
    first_name: string
    last_name: string
  }
  current_score: number
  score_version: string
  last_calculated_at: string
  meta: Record<string, any>
}

export interface RTSCreatorDetail {
  user_id: number
  email: string
  name: string
  current_score: number
  band: string
  last_updated: string
  can_expand: boolean
  history: RTSHistoryEntry[]
}

export interface RTSFlag {
  ritual_id?: number
  user_id: number
  flag_type: "cultural_concern" | "emotional_safety" | "quality_issue" | "other"
  description: string
  severity: "low" | "medium" | "high"
}

export interface RTSAlert {
  id: number
  user_id: number
  email: string
  name: string
  score: number
  band: string
  triggered_at: string
  acknowledged: boolean
}

export interface RTSConfig {
  id: number
  name: string
  weights: Record<string, number>
  decay_half_life_hours: number
  min_score: number
  max_score: number
  threshold_expand: number
  threshold_clear: number
  threshold_caution: number
  threshold_pause: number
  created_at: string
  updated_at: string
}

export interface RTSAuditEntry {
  timestamp: string
  event_type: string
  score_before: number
  score_after: number
  details: Record<string, any>
}

export interface RTSAuditResponse {
  inputs: Array<{
    id: number
    user: number
    input_type: string
    source: string
    source_app: string | null
    source_id: number | null
    value: number
    value_json: Record<string, any>
    model_meta: Record<string, any>
    created_at: string
  }>
  history: RTSHistoryEntry[]
  interventions: Array<{
    id: number
    type: string
    resolved: boolean
    notes: string
    created_at: string
    resolved_at: string | null
  }>
}

class RTSService {
  private getAuthHeaders() {
    const token = localStorage.getItem("access_token")
    return token ? { Authorization: `Bearer ${token}` } : {}
  }

  // Creator endpoints
  async getMyScore(): Promise<RTSScore> {
    const response = await fetch(`${API_BASE_URL}/rts/me/`, {
      headers: this.getAuthHeaders(),
    })

    if (!response.ok) {
      throw new Error("Failed to fetch RTS score")
    }

    return response.json()
  }

  async getMyHistory(): Promise<RTSHistoryEntry[]> {
    const response = await fetch(`${API_BASE_URL}/rts/history/`, {
      headers: this.getAuthHeaders(),
    })

    if (!response.ok) {
      throw new Error("Failed to fetch RTS history")
    }

    return response.json()
  }

  async submitSelfAssessment(assessment: RTSSelfAssessment): Promise<{ message: string; new_score: number }> {
    const response = await fetch(`${API_BASE_URL}/rts/assessment/`, {
      method: "POST",
      headers: {
        ...this.getAuthHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(assessment),
    })

    if (!response.ok) {
      throw new Error("Failed to submit self-assessment")
    }

    return response.json()
  }

  // Moderator endpoints
  async getAllCreators(): Promise<RTSCreatorSummary[]> {
    const response = await fetch(`${API_BASE_URL}/rts/creators/`, {
      headers: this.getAuthHeaders(),
    })

    if (!response.ok) {
      throw new Error("Failed to fetch creators")
    }

    return response.json()
  }

  async getCreatorScore(userId: number): Promise<RTSScore> {
    const response = await fetch(`${API_BASE_URL}/rts/${userId}/`, {
      headers: this.getAuthHeaders(),
    })

    if (!response.ok) {
      throw new Error("Failed to fetch creator score")
    }

    return response.json()
  }

  async getCreatorHistory(userId: number): Promise<RTSHistoryEntry[]> {
    const response = await fetch(`${API_BASE_URL}/rts/history/${userId}/`, {
      headers: this.getAuthHeaders(),
    })

    if (!response.ok) {
      throw new Error("Failed to fetch creator history")
    }

    return response.json()
  }

  async getCreatorAudit(userId: number): Promise<RTSAuditResponse> {
    const response = await fetch(`${API_BASE_URL}/rts/audit/${userId}/`, {
      headers: this.getAuthHeaders(),
    })

    if (!response.ok) {
      throw new Error("Failed to fetch audit trail")
    }

    return response.json()
  }

  async createFlag(flag: RTSFlag): Promise<{ message: string }> {
    const response = await fetch(`${API_BASE_URL}/rts/ai/interpret/`, {
      method: "POST",
      headers: {
        ...this.getAuthHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(flag),

    })

    if (!response.ok) {
      throw new Error("Failed to create flag")
    }

    return response.json()
  }

  async getAlerts(): Promise<RTSAlert[]> {
    const response = await fetch(`${API_BASE_URL}/rts/alerts/`, {
      headers: this.getAuthHeaders(),
    })

    if (!response.ok) {
      throw new Error("Failed to fetch alerts")
    }

    return response.json()
  }

  // Admin endpoints
  async getConfig(): Promise<RTSConfig> {
    const response = await fetch(`${API_BASE_URL}/rts/config/`, {
      headers: this.getAuthHeaders(),
    })

    if (!response.ok) {
      throw new Error("Failed to fetch RTS config")
    }

    const data = await response.json()
    // API returns array, get first item
    return Array.isArray(data) ? data[0] : data
  }

  async updateConfig(configId: number, updates: Partial<RTSConfig>): Promise<RTSConfig> {
    const response = await fetch(`${API_BASE_URL}/rts/config/${configId}/`, {
      method: "PATCH",
      headers: {
        ...this.getAuthHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(updates),
    })

    if (!response.ok) {
      throw new Error("Failed to update RTS config")
    }

    return response.json()
  }

  // Utility methods
  getScoreBand(score: number): "expand" | "clear" | "check_in" | "caution" | "critical" {
    if (score >= 95) return "expand"
    if (score >= 90) return "clear"
    if (score >= 80) return "check_in"
    if (score >= 70) return "caution"
    return "critical"
  }

  getBandColor(band: string): string {
    switch (band) {
      case "expand":
      case "clear":
        return "text-green-600 bg-green-50 border-green-200"
      case "check_in":
        return "text-yellow-600 bg-yellow-50 border-yellow-200"
      case "caution":
        return "text-orange-600 bg-orange-50 border-orange-200"
      case "critical":
        return "text-red-600 bg-red-50 border-red-200"
      default:
        return "text-gray-600 bg-gray-50 border-gray-200"
    }
  }

  getBandLabel(band: string): string {
    switch (band) {
      case "expand":
        return "Ready to Expand"
      case "clear":
        return "All Clear"
      case "check_in":
        return "Gentle Check-in"
      case "caution":
        return "Caution/Paused"
      case "critical":
        return "Critical Care"
      default:
        return band
    }
  }
}

export const rtsService = new RTSService()

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "/api"

export interface GuidanceResponse {
  voice_script: string
  matched: boolean
}

export interface InfoResponse {
  key: string
  title: string
  body: string
  matched: boolean
}

export interface QuickRepliesResponse {
  quick_replies: string[]
}

export const gaiaService = {
  async guidance(query: string): Promise<GuidanceResponse> {
    const url = `${API_BASE_URL}/gaia/guidance/?q=${encodeURIComponent(query)}`
    const response = await fetch(url, { method: "GET" })
    if (!response.ok) {
      throw new Error(`gaia guidance failed: ${response.status}`)
    }
    return response.json()
  },

  async info(key: string): Promise<InfoResponse> {
    const url = `${API_BASE_URL}/gaia/info/?key=${encodeURIComponent(key)}`
    const response = await fetch(url, { method: "GET" })
    if (!response.ok) {
      throw new Error(`gaia info failed: ${response.status}`)
    }
    return response.json()
  },

  async quickReplies(): Promise<QuickRepliesResponse> {
    const url = `${API_BASE_URL}/gaia/quick-replies/`
    const response = await fetch(url, { method: "GET" })
    if (!response.ok) {
      throw new Error(`gaia quick-replies failed: ${response.status}`)
    }
    return response.json()
  },
}

// GAIA Lite client over the /api/v1/ Zero Dependence contract.
// Guidance is consent-gated and deterministic: members opt in through
// /consents/, pick an approved question, and can revoke everything via
// /gaia/zero-dependence/. Free text never leaves the client — it only
// selects which approved question to ask.

import {
  v1Consents,
  v1Gaia,
  type GaiaQuestion,
  type ZeroDependenceStatus,
} from "@/lib/v1"

export interface GuidanceResponse {
  voice_script: string
  matched: boolean
  source_route?: string
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

function tokenize(text: string): Set<string> {
  return new Set(text.toLowerCase().match(/[a-z0-9]+/g) ?? [])
}

// Score a question against the member's text by word overlap on its
// title and topic. Returns null when nothing clears the bar so the
// caller can fall back to the question list instead of guessing.
function matchQuestion(query: string, questions: GaiaQuestion[]): GaiaQuestion | null {
  const tokens = tokenize(query)
  if (!tokens.size) return null
  let best: GaiaQuestion | null = null
  let bestScore = 0
  for (const q of questions) {
    const hay = tokenize(`${q.title} ${q.topic} ${q.id.replace(/-/g, " ")}`)
    let score = 0
    for (const t of tokens) {
      if (hay.has(t)) score += t.length > 3 ? 2 : 1
    }
    if (score > bestScore) {
      bestScore = score
      best = q
    }
  }
  return bestScore >= 3 ? best : null
}

export const gaiaService = {
  async status(): Promise<ZeroDependenceStatus> {
    return v1Gaia.zeroDependence()
  },

  async enable(): Promise<void> {
    await v1Consents.set("gaia_lite", "grant")
  },

  async disableAll(): Promise<ZeroDependenceStatus> {
    return v1Gaia.disableAllAi()
  },

  async questions(): Promise<GaiaQuestion[]> {
    const caps = await v1Gaia.capabilities()
    return caps.questions ?? []
  },

  // Static help entries — deterministic, consent-free like the rest of
  // the approved education surface.
  async info(key: string): Promise<InfoResponse> {
    const res = (await v1Gaia.educate(key)) as { info: InfoResponse }
    return res.info
  },

  async quickReplies(): Promise<QuickRepliesResponse> {
    try {
      const questions = await gaiaService.questions()
      return { quick_replies: questions.map((q) => q.title) }
    } catch {
      return { quick_replies: [] }
    }
  },

  async guidance(query: string): Promise<GuidanceResponse> {
    const questions = await gaiaService.questions()
    const question = matchQuestion(query, questions)
    if (!question) {
      return {
        voice_script:
          "I did not find an approved topic for that. Try one of the suggested questions, or open a page directly below.",
        matched: false,
      }
    }
    const answer = await v1Gaia.guidance(question.id)
    return {
      voice_script: answer.answer,
      matched: true,
      source_route: answer.source_route,
    }
  },
}

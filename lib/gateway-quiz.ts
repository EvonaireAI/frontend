const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "/api"

export type GatewayQuizStatus = "not_started" | "in_progress" | "completed"

export type GatewayQuizOptionKey = "A" | "B" | "C" | "D"

export interface GatewayQuizAttempt {
  status: GatewayQuizStatus
  last_question_number: number
  next_question_number: number | null
  correct_count: number
  total_questions: number
  started_at: string | null
  completed_at: string | null
}

export interface GatewayQuizQuestion {
  question_number: number
  question_text: string
  options: Record<GatewayQuizOptionKey, string>
}

export interface GatewayQuizSection {
  section: string
  title: string
  theme: string
  questions: GatewayQuizQuestion[]
}

export interface GatewayQuizContent {
  quiz_title: string
  opening_message: string
  completion_message: string
  total_questions: number
  sections: GatewayQuizSection[]
}

export interface GatewayQuizAnswerResult extends GatewayQuizAttempt {
  is_correct: boolean
  correct_option: GatewayQuizOptionKey
  correct_option_text: string
  completion_message?: string
}

function authHeaders(): HeadersInit {
  if (typeof window === "undefined") return {}
  const token = localStorage.getItem("access_token")
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function parseError(response: Response, fallback: string): Promise<never> {
  let detail = fallback
  try {
    const body = await response.json()
    if (body && typeof body.detail === "string") detail = body.detail
  } catch {
    // ignore — keep fallback
  }
  throw new Error(detail)
}

export const gatewayQuizService = {
  async getStatus(): Promise<GatewayQuizAttempt> {
    const response = await fetch(`${API_BASE_URL}/gateway-quiz/status/`, {
      headers: authHeaders(),
    })
    if (!response.ok) {
      await parseError(response, "Failed to load Gateway Quiz status")
    }
    return response.json()
  },

  async getContent(): Promise<GatewayQuizContent> {
    const response = await fetch(`${API_BASE_URL}/gateway-quiz/`, {
      headers: authHeaders(),
    })
    if (!response.ok) {
      await parseError(response, "Failed to load Gateway Quiz content")
    }
    return response.json()
  },

  async start(): Promise<GatewayQuizAttempt> {
    const response = await fetch(`${API_BASE_URL}/gateway-quiz/start/`, {
      method: "POST",
      headers: authHeaders(),
    })
    if (!response.ok) {
      await parseError(response, "Failed to start the Gateway Quiz")
    }
    return response.json()
  },

  async submitAnswer(
    questionNumber: number,
    selectedOption: GatewayQuizOptionKey,
  ): Promise<GatewayQuizAnswerResult> {
    const response = await fetch(`${API_BASE_URL}/gateway-quiz/answer/`, {
      method: "POST",
      headers: {
        ...authHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        question_number: questionNumber,
        selected_option: selectedOption,
      }),
    })
    if (!response.ok) {
      await parseError(response, "Failed to submit your answer")
    }
    return response.json()
  },
}

/** Strip the "Voice narration:\n" prefix and surrounding curly quotes for display. */
export function cleanNarration(text: string): string {
  if (!text) return ""
  const stripped = text.replace(/^Voice narration:\s*/i, "").trim()
  return stripped.replace(/^[“"]|[”"]$/g, "").trim()
}

/** Flatten sections into a single ordered list of questions. */
export function flattenQuestions(content: GatewayQuizContent): GatewayQuizQuestion[] {
  return content.sections.flatMap((section) => section.questions)
}

export function findSectionFor(
  content: GatewayQuizContent,
  questionNumber: number,
): GatewayQuizSection | undefined {
  return content.sections.find((section) =>
    section.questions.some((q) => q.question_number === questionNumber),
  )
}

import {
  EntitlementDeniedError,
  emitEntitlementDenial,
  isEntitlementDenial,
} from "./entitlements"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "/api"

export type GatewayQuizStatus = "not_started" | "in_progress" | "completed"

export type GatewayQuizOptionKey = "A" | "B" | "C" | "D"

// The progress block that now rides on every Gateway response. This — not
// last_question_number — is the source of truth for how far along the user is.
export interface GatewayProgress {
  answered_count: number
  total: number
  remaining: number
  completed: boolean
}

export interface GatewayQuizAttempt extends GatewayProgress {
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

// Up to N random unanswered questions plus progress (GET /next/).
export interface GatewayQuizNext extends GatewayProgress {
  questions: GatewayQuizQuestion[]
}

/** Narrow a Gateway response down to just its progress block. */
export function toProgress(source: GatewayProgress): GatewayProgress {
  return {
    answered_count: source.answered_count,
    total: source.total,
    remaining: source.remaining,
    completed: source.completed,
  }
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

  // Up to `count` (1–5) random unanswered questions. Order no longer matters —
  // the backend picks which questions to serve.
  async getNext(count = 1): Promise<GatewayQuizNext> {
    const clamped = Math.min(5, Math.max(1, Math.floor(count)))
    const response = await fetch(
      `${API_BASE_URL}/gateway-quiz/next/?count=${clamped}`,
      { headers: authHeaders() },
    )
    if (!response.ok) {
      await parseError(response, "Failed to load your next Gateway question")
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
      // 409 (already answered) is benign — callers can refetch /next/ and move
      // on; the status rides along so loops can branch on it.
      let detail = "Failed to submit your answer"
      try {
        const body = await response.json()
        if (body && typeof body.detail === "string") detail = body.detail
      } catch {
        // keep fallback
      }
      throw new GatewayAnswerError(response.status, detail)
    }
    return response.json()
  },
}

/** Answer-submission failure carrying the HTTP status (e.g. 409 already answered). */
export class GatewayAnswerError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = "GatewayAnswerError"
    this.status = status
  }
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

// ── gateway_incomplete 403 (the shared gated-action denial) ─────────────────────
// The three consequential actions — subscribe checkout, sanctuary join, and any
// future creator withdraw — return this when the Gateway isn't finished. It is
// detected like an entitlement denial but routed to the finish-your-Gateway flow.

export interface GatewayIncomplete {
  error: "gateway_incomplete"
  detail: string
  answered: number
  total: number
  remaining: number
}

export class GatewayIncompleteError extends Error {
  denial: GatewayIncomplete

  constructor(denial: GatewayIncomplete) {
    super("gateway_incomplete")
    this.name = "GatewayIncompleteError"
    this.denial = denial
  }
}

// Thrown when the user closes the finish-your-Gateway modal before completing —
// no penalty, the caller should abort quietly (no error toast).
export class GatewayCancelledError extends Error {
  constructor() {
    super("gateway_cancelled")
    this.name = "GatewayCancelledError"
  }
}

export function isGatewayIncomplete(body: unknown): body is GatewayIncomplete {
  return (
    typeof body === "object" &&
    body !== null &&
    (body as { error?: string }).error === "gateway_incomplete"
  )
}

// Call on any non-ok response from a gated action. Reads the body once and, on a
// 403, routes gateway_incomplete to the Gateway flow (throwing
// GatewayIncompleteError for runGatedAction to catch) and entitlement_denied to
// the upgrade modal. Otherwise returns the parsed body (or null) so the caller
// can raise its usual error.
export async function throwIfGated(response: Response): Promise<any> {
  let body: unknown = null
  try {
    body = await response.json()
  } catch {
    return null
  }
  if (response.status === 403) {
    if (isGatewayIncomplete(body)) {
      throw new GatewayIncompleteError(body)
    }
    if (isEntitlementDenial(body)) {
      emitEntitlementDenial(body)
      throw new EntitlementDeniedError(body)
    }
  }
  return body
}

// ── Completion-request bus ──────────────────────────────────────────────────────
// Lets the plain-fetch service layer ask the React completion modal to open and
// await the user finishing (or cancelling) the remaining questions.

export interface GatewayCompletionRequest {
  denial: GatewayIncomplete
  resolve: () => void
  reject: (reason?: unknown) => void
}

type CompletionListener = (request: GatewayCompletionRequest) => void

const completionListeners = new Set<CompletionListener>()

export function onGatewayCompletionRequest(listener: CompletionListener): () => void {
  completionListeners.add(listener)
  return () => {
    completionListeners.delete(listener)
  }
}

// Opens the finish-your-Gateway modal and resolves once the user completes the
// Gateway, or rejects with GatewayCancelledError if they close it early. Rejects
// with the original GatewayIncompleteError if no modal host is mounted.
export function requestGatewayCompletion(denial: GatewayIncomplete): Promise<void> {
  return new Promise((resolve, reject) => {
    if (completionListeners.size === 0) {
      reject(new GatewayIncompleteError(denial))
      return
    }
    completionListeners.forEach((listener) => listener({ denial, resolve, reject }))
  })
}

// Wrap a gated action (checkout / join / withdraw). On a gateway_incomplete
// denial it opens the completion modal, lets the user answer the remaining
// questions, then auto-retries the action. A GatewayCancelledError propagates so
// the caller can abort quietly.
export async function runGatedAction<T>(action: () => Promise<T>): Promise<T> {
  try {
    return await action()
  } catch (err) {
    if (err instanceof GatewayIncompleteError) {
      await requestGatewayCompletion(err.denial)
      return await action()
    }
    throw err
  }
}

// ── Progress bus ────────────────────────────────────────────────────────────────
// Any answer submitted anywhere (nudge or completion modal) broadcasts fresh
// progress so the quiet chrome indicator stays in sync without refetching.

type ProgressListener = (progress: GatewayProgress) => void

const progressListeners = new Set<ProgressListener>()

export function onGatewayProgress(listener: ProgressListener): () => void {
  progressListeners.add(listener)
  return () => {
    progressListeners.delete(listener)
  }
}

export function emitGatewayProgress(progress: GatewayProgress): void {
  progressListeners.forEach((listener) => listener(toProgress(progress)))
}

// ── Nudge suppression signal ────────────────────────────────────────────────────
// The gentle pop-up must never appear over a modal the user already opened. The
// completion modal flips this while open so the nudge holds back.

let gatewayModalOpen = false

export function setGatewayModalOpen(open: boolean): void {
  gatewayModalOpen = open
}

export function isGatewayModalOpen(): boolean {
  return gatewayModalOpen
}

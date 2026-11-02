// Structured API errors. DRF-style bodies like
//   {"password": ["This password is too short."], "detail": "..."}
// are split into per-field messages plus a non-field summary so forms can
// render each error beside its input instead of collapsing everything into
// a generic fallback. `message` always carries the full text for callers
// that do not know about fields.

export type FieldErrorMap = Record<string, string[]>

export class ApiError extends Error {
  /** HTTP status of the failed response; 0 when the failure had none. */
  readonly status: number
  /** Field-name → messages, for rendering beside form inputs. */
  readonly fields: FieldErrorMap
  /** Messages not tied to a field (detail / non_field_errors). */
  readonly nonFieldMessage: string

  constructor(
    message: string,
    options: { status?: number; fields?: FieldErrorMap; nonFieldMessage?: string } = {},
  ) {
    super(message)
    this.name = "ApiError"
    this.status = options.status ?? 0
    this.fields = options.fields ?? {}
    this.nonFieldMessage = options.nonFieldMessage ?? ""
  }
}

function flatMessages(value: unknown): string[] {
  if (typeof value === "string") return [value]
  if (Array.isArray(value)) return value.flatMap(flatMessages)
  if (value && typeof value === "object") return Object.values(value).flatMap(flatMessages)
  return value == null ? [] : [String(value)]
}

// Field errors arrive as lists of strings; nested serializer errors arrive
// as objects and flatten to dotted keys ("items.0.name") rather than being
// dropped.
function collectFieldErrors(field: string, value: unknown, out: FieldErrorMap): void {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    for (const [key, nested] of Object.entries(value)) {
      collectFieldErrors(field ? `${field}.${key}` : key, nested, out)
    }
    return
  }
  const messages = flatMessages(value)
  if (messages.length) (out[field] ??= []).push(...messages)
}

const NON_FIELD_KEYS = new Set(["detail", "non_field_errors", "message"])

// Parses a DRF-style error body into an ApiError. Yields `fallback` for
// bodies with no usable message (null, {}, non-JSON error pages).
export function toApiError(body: unknown, fallback: string, status = 0): ApiError {
  if (typeof body === "string") {
    return new ApiError(body || fallback, { status })
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return new ApiError(fallback, { status })
  }

  const fields: FieldErrorMap = {}
  const nonField: string[] = []
  for (const [key, value] of Object.entries(body)) {
    if (NON_FIELD_KEYS.has(key)) nonField.push(...flatMessages(value))
    else collectFieldErrors(key, value, fields)
  }

  const nonFieldMessage = nonField.join(" ")
  const fieldMessage = Object.entries(fields)
    .map(([field, messages]) => `${field}: ${messages.join(" ")}`)
    .join(" ")
  const message = [nonFieldMessage, fieldMessage].filter(Boolean).join(" ") || fallback
  return new ApiError(message, { status, fields, nonFieldMessage })
}

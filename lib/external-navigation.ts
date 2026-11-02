// Guard for API-provided URLs before they reach a programmatic navigation
// sink. React strips javascript: hrefs in JSX but not window.location,
// location.assign, or window.open, so a hostile or malformed response value
// would otherwise be followed verbatim. Every flow that uses this guard
// produces a Stripe-hosted destination (checkout or connect).

const STRIPE_HOST = /^([a-z0-9-]+\.)*stripe\.com$/i

export function isAllowedExternalUrl(raw: unknown): raw is string {
  if (typeof raw !== "string") return false
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return false
  }
  return url.protocol === "https:" && STRIPE_HOST.test(url.hostname)
}

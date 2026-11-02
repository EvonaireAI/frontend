const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "/api"

// Access tokens expire mid-session. Refresh once and retry on 401 so a
// continuous session keeps working instead of failing every request until
// reload. Concurrent 401s share the in-flight refresh — a second refresh
// with a just-rotated (now blacklisted) token would clear the session
// outright.
let refreshInFlight: Promise<unknown> | null = null

function refreshAccessToken(): Promise<unknown> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const refreshToken = localStorage.getItem("refresh_token")
      if (!refreshToken) throw new Error("No refresh token available")
      const response = await fetch(`${API_BASE_URL}/auth/refresh/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh: refreshToken }),
      })
      if (!response.ok) throw new Error("Token refresh failed")
      const data = await response.json()
      localStorage.setItem("access_token", data.access)
      if (data.refresh) localStorage.setItem("refresh_token", data.refresh)
    })().finally(() => {
      refreshInFlight = null
    })
  }
  return refreshInFlight
}

// The account identity a token belongs to (SimpleJWT's user_id claim). A
// rotated token for the same account reads the same; a different account's
// token reads differently. Undecodable tokens read as no account.
function tokenAccountId(token: string | null): string | null {
  if (!token) return null
  const segment = token.split(".")[1]
  if (!segment) return null
  try {
    const payload = JSON.parse(atob(segment.replace(/-/g, "+").replace(/_/g, "/")))
    const id = payload?.user_id ?? payload?.sub
    return id == null ? null : String(id)
  } catch {
    return null
  }
}

function currentAccountId(): string | null {
  if (typeof window === "undefined") return null
  return tokenAccountId(localStorage.getItem("access_token"))
}

function withAccessToken(init: RequestInit, token: string | null): RequestInit {
  if (!token) return init
  const headers = new Headers(init.headers)
  headers.set("Authorization", `Bearer ${token}`)
  return { ...init, headers }
}

/**
 * fetch that attaches the current access token and retries once on 401
 * after a deduplicated refresh. A delayed 401 can arrive after the account
 * changed: refreshing then would renew whichever account is current, and
 * the retry would carry this request — made for the original account —
 * under the new one's bearer token. An unchanged token is trivially the
 * same session; a replaced one must still name the same account. An
 * unauthenticated request stays unauthenticated either way.
 */
export async function authedFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const sentToken = typeof window === "undefined" ? null : localStorage.getItem("access_token")
  const sentAccount = tokenAccountId(sentToken)
  const response = await fetch(url, withAccessToken(init, sentToken))
  if (response.status !== 401 || !sentToken) return response
  const currentToken = localStorage.getItem("access_token")
  if (currentToken !== sentToken && currentAccountId() !== sentAccount) return response
  try {
    await refreshAccessToken()
  } catch {
    return response
  }
  // The refresh could also have resolved across an account switch; the
  // retry re-reads whatever token is current, so check it still belongs to
  // the sender.
  if (currentAccountId() !== sentAccount) return response
  return fetch(url, withAccessToken(init, localStorage.getItem("access_token")))
}

// Owns "which account does this provider state belong to" for the
// account-scoped context providers (entitlements, gateway progress). Each
// login identity gets a fresh token; a response that arrives after logout
// or an account switch fails the currency check and is discarded instead of
// repopulating state it was not fetched under.
export class SessionScope {
  private session: { key: string; token: symbol } | null = null

  /** Token identifying the active session; null while signed out or ineligible. */
  get current(): symbol | null {
    return this.session?.token ?? null
  }

  // Start or continue the session for `key` (the account identity). Returns
  // true when the identity changed — the caller must clear state belonging
  // to the previous session before loading anew. A fresh user object for
  // the same account keeps the session and its warm state.
  activate(key: string): boolean {
    if (this.session?.key === key) return false
    this.session = { key, token: Symbol(key) }
    return true
  }

  /** End the session on logout or loss of eligibility. */
  deactivate(): void {
    this.session = null
  }

  /** True when `token` still owns the session it was captured under. */
  isCurrent(token: symbol | null): boolean {
    return token !== null && this.session?.token === token
  }
}

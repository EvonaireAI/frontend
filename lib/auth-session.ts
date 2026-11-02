// Owns "which login session do in-flight auth calls belong to" inside
// AuthProvider. Unlike the account-keyed SessionScope used by downstream
// providers, the auth layer has no identity to key on before a login
// resolves (or at mount, when only persisted tokens exist), so sessions are
// numbered: each login attempt begins a new generation and logout ends the
// current one. A response that resolves under a superseded generation —
// fetched for a signed-out session or a previous account — is discarded
// instead of overwriting the state its successor already committed.
export class AuthSession {
  private generation = 0

  /** Generation identifying the active session right now. */
  get current(): number {
    return this.generation
  }

  /** Start a new session on each login attempt. Returns its generation. */
  begin(): number {
    this.generation += 1
    return this.generation
  }

  /** End the session on logout, invalidating anything still in flight. */
  end(): void {
    this.generation += 1
  }

  /** True when `generation` still owns the session it was captured under. */
  owns(generation: number): boolean {
    return generation === this.generation
  }
}

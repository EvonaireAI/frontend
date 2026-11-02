// Which localStorage keys carry the auth session. AuthProvider watches
// storage events for these: a write in another tab means the identity this
// tab displays no longer owns the session and must be reloaded.
export function isAuthStorageKey(key: string | null): boolean {
  // localStorage.clear() reports a null key; the tokens are gone either way.
  return key === null || key === "access_token" || key === "refresh_token"
}

// Platform role → dashboard label mapping.
//
// There are TWO distinct naming axes in Evonaire — do not conflate them:
//   1. Role / dashboard label (this file) — derived from the account `role`.
//   2. Subscription tier (Wanderer / Seeker / Scholar) — the billing plan,
//      surfaced via entitlements `display_name`. See lib/entitlements.ts.
//
// Note the deliberate collision: a `member`'s *role* label is "Seeker (D1)"
// while their *plan* may separately be Wanderer / Seeker / Scholar. Keep them
// in the right context — this helper is for the role axis only.

export type PlatformRole =
  | "member"
  | "creator"
  | "moderator"
  | "admin"
  | "superadmin"
  | (string & {})

const ROLE_DASHBOARD_LABELS: Record<string, string> = {
  member: "Seeker (D1)",
  creator: "Creator (D2)",
  moderator: "Guardian (D3)",
  admin: "Steward (D4)",
  superadmin: "Steward (D4)",
}

/** Full dashboard label for a role, e.g. "Seeker (D1)". Falls back to a
 *  capitalized version of any unknown role so the UI never shows an empty
 *  badge. */
export function roleDashboardLabel(role: string | null | undefined): string {
  if (!role) return "Seeker (D1)"
  return ROLE_DASHBOARD_LABELS[role] ?? role.charAt(0).toUpperCase() + role.slice(1)
}

/** Short label without the tier code, e.g. "Seeker" — for compact contexts. */
export function roleShortLabel(role: string | null | undefined): string {
  return roleDashboardLabel(role).replace(/\s*\(D\d\)\s*$/, "")
}

// ── Access helpers ──────────────────────────────────────────────────────────
//
// These mirror the backend permission classes exactly. Use them instead of
// inline role comparisons so the two never drift:
//
//   IsModerator      → moderator | admin | superadmin   (isGuardian)
//   IsAdminUser      → admin | superadmin               (isSteward)
//
// Session 11 backend fix: `role="superadmin"` accounts without the Django
// superuser flag used to be rejected by every `/api/admin/*` endpoint. Several
// screens mirrored that bug with `user.role !== "admin"`. Anything gating on
// steward access must go through `isSteward`.

export const GUARDIAN_ROLES = ["moderator", "admin", "superadmin"] as const
export const STEWARD_ROLES = ["admin", "superadmin"] as const

/** Can work care cases — the Guardian Dashboard. Stewards qualify too. */
export function isGuardian(role: string | null | undefined): boolean {
  return !!role && (GUARDIAN_ROLES as readonly string[]).includes(role)
}

/** Can reach the Steward Console and the steward-only endpoints. */
export function isSteward(role: string | null | undefined): boolean {
  return !!role && (STEWARD_ROLES as readonly string[]).includes(role)
}

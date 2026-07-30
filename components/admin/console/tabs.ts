// The Steward Console's canonical sections. The `id` appears in
// `/admin?tab=…`, so these strings are deep links — treat them as stable.

export const STEWARD_TABS = [
  { id: "overview", label: "Platform Overview" },
  { id: "requests", label: "Steward Requests" },
  { id: "trust-care", label: "Trust & Care" },
  { id: "resonance", label: "Resonance Configuration" },
  { id: "memberships", label: "Memberships" },
  { id: "earnings", label: "Creator Earnings" },
  { id: "commons", label: "The Commons" },
  { id: "intelligence", label: "Platform Intelligence" },
  { id: "archive", label: "The Archive" },
  { id: "configuration", label: "Platform Configuration" },
] as const

export type StewardTab = (typeof STEWARD_TABS)[number]["id"]

export const DEFAULT_STEWARD_TAB: StewardTab = "overview"

export function isStewardTab(value: string | null | undefined): value is StewardTab {
  return !!value && STEWARD_TABS.some((tab) => tab.id === value)
}

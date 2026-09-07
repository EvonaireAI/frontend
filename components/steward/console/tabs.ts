// The Steward workspace sections at `/steward?tab=…`. Role requests live at
// `/steward/requests` as their own page — not a tab here.

export const STEWARD_CONSOLE_TABS = [
  { id: "overview", label: "Platform Overview" },
  { id: "trust-care", label: "Trust & Care" },
  { id: "resonance", label: "Resonance Configuration" },
  { id: "memberships", label: "Memberships" },
  { id: "earnings", label: "Creator Earnings" },
  { id: "commons", label: "The Commons" },
  { id: "intelligence", label: "Platform Intelligence" },
  { id: "archive", label: "The Archive" },
  { id: "configuration", label: "Platform Configuration" },
] as const

export type StewardConsoleTab = (typeof STEWARD_CONSOLE_TABS)[number]["id"]

export const DEFAULT_STEWARD_CONSOLE_TAB: StewardConsoleTab = "overview"

export function isStewardConsoleTab(value: string | null | undefined): value is StewardConsoleTab {
  return !!value && STEWARD_CONSOLE_TABS.some((tab) => tab.id === value)
}

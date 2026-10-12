// Steward workspace tabs backed by live API routes. Role requests live at
// `/steward/requests`; guardian care work lives at `/moderate`.

export const STEWARD_CONSOLE_TABS = [
  { id: "overview", label: "Platform Overview" },
  { id: "requests", label: "Steward Requests" },
  { id: "trust-care", label: "Trust & Care" },
  { id: "resonance", label: "Resonance Configuration" },
  { id: "memberships", label: "Memberships" },
  { id: "earnings", label: "Creator Earnings" },
  { id: "symposium", label: "Symposium" },
  { id: "intelligence", label: "Platform Intelligence" },
  { id: "archive", label: "The Archive" },
  { id: "configuration", label: "Platform Configuration" },
] as const

export type StewardConsoleTab = (typeof STEWARD_CONSOLE_TABS)[number]["id"]

export const DEFAULT_STEWARD_CONSOLE_TAB: StewardConsoleTab = "overview"

export function isStewardConsoleTab(value: string | null | undefined): value is StewardConsoleTab {
  return !!value && STEWARD_CONSOLE_TABS.some((tab) => tab.id === value)
}

/** Legacy tab ids from older URLs. */
export function normalizeStewardConsoleTab(value: string | null | undefined): StewardConsoleTab | null {
  if (!value) return null
  if (value === "commons") return "symposium"
  if (value === "home" || value === "rts") return "overview"
  return isStewardConsoleTab(value) ? value : null
}

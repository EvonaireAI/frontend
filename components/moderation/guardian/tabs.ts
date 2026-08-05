// The Guardian Dashboard's canonical sections. The `id` is what appears in
// `/moderate?tab=…`, so these strings are deep links — treat them as stable.
//
// Display names are Guardian / Care Case / Care History throughout; the API
// keeps saying moderation / moderator / case.

export const GUARDIAN_TABS = [
  { id: "overview", label: "Overview" },
  { id: "pending", label: "Pending Reviews" },
  { id: "active", label: "Active Cases" },
  { id: "care-feed", label: "Care Feed" },
  { id: "rts", label: "RTS Monitoring" },
  { id: "sanctuaries", label: "Sanctuaries" },
  { id: "library", label: "Sacred Library" },
  { id: "history", label: "Case History" },
] as const

export type GuardianTab = (typeof GUARDIAN_TABS)[number]["id"]

export const DEFAULT_GUARDIAN_TAB: GuardianTab = "overview"

export function isGuardianTab(value: string | null | undefined): value is GuardianTab {
  return !!value && GUARDIAN_TABS.some((tab) => tab.id === value)
}

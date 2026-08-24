// The canonical Evonaire glossary.
//
// Every user-facing destination name lives here so nav labels, page headers
// and empty states can't drift apart. If a label appears in more than one
// place, import it from here rather than retyping the string.
//
// Two naming axes exist alongside this one — don't conflate them:
//   • Role / dashboard labels ("Seeker (D1)") → lib/roles.ts
//   • Subscription tiers (Wanderer / Seeker / Scholar) → lib/entitlements.ts

export const GLOSSARY = {
  // ── Seeker-facing ──────────────────────────────────────────────────────────
  sacredLibrary: "Sacred Library",
  agora: "The Agora",
  mySanctuary: "My Sanctuary",
  ledger: "The Ledger",
  symposium: "Symposium",
  civicVirtue: "Civic Virtue",
  /** A section INSIDE The Ledger — never a standalone nav entry. */
  billing: "Billing",
  reflectionRoom: "Reflection Room",
  commons: "Symposium",

  // ── Creator-facing ─────────────────────────────────────────────────────────
  creatorStudio: "Creator Studio",
  uploadRitual: "Upload Ritual",
  myRituals: "My Rituals",
  earnings: "Earnings",
  payouts: "Payouts",
  /** Always spelled out on first use; "RTS" is acceptable shorthand after. */
  rts: "Resonance Trust Synthesis",
  rtsShort: "RTS",

  // ── Guardian (D3) surfaces ─────────────────────────────────────────────────
  guardianDashboard: "Guardian Dashboard",
  careFeed: "Care Feed",
  careCases: "Care Cases",
  careHistory: "Care History",
  careReports: "Care Reports",
  careEscalation: "Care Escalation",

  // ── Steward (D4) surfaces ──────────────────────────────────────────────────
  stewardConsole: "Steward Console",
  stewardRequests: "Steward Requests",
  resonanceConfiguration: "Resonance Configuration",
  archive: "The Archive",
  platformIntelligence: "Platform Intelligence",
  platformSignals: "Platform Signals",
  platformConfiguration: "Platform Configuration",
} as const

// Primary sections the CEO has named but that have no product definition yet.
// Rendered as disabled "Coming soon" nav entries so they're discoverable
// without inventing pages.
// TODO(fitsum): confirm Symposium / Civic Virtue routes, then promote these
// to real navigation items.
export const COMING_SOON_SECTIONS: readonly string[] = [
  GLOSSARY.symposium,
  GLOSSARY.civicVirtue,
]

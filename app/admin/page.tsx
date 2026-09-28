import { redirect } from "next/navigation"

import { normalizeStewardConsoleTab } from "@/components/steward/console/tabs"

// Legacy `/admin` URLs redirect into the steward workspace at `/steward`.
export default function AdminRedirectPage({
  searchParams,
}: {
  searchParams: { tab?: string }
}) {
  const tab = searchParams.tab

  if (tab === "requests") {
    redirect("/steward?tab=requests")
  }

  const normalized = normalizeStewardConsoleTab(tab)
  if (normalized) {
    redirect(normalized === "overview" ? "/steward" : `/steward?tab=${normalized}`)
  }

  redirect("/steward")
}

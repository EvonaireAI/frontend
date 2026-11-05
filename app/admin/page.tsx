import { redirect } from "next/navigation"

import { normalizeStewardConsoleTab } from "@/components/steward/console/tabs"

// Legacy `/admin` URLs redirect into the steward workspace at `/steward`.
export default async function AdminRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab } = await searchParams

  if (tab === "requests") {
    redirect("/steward?tab=requests")
  }

  const normalized = normalizeStewardConsoleTab(tab)
  if (normalized) {
    redirect(normalized === "overview" ? "/steward" : `/steward?tab=${normalized}`)
  }

  redirect("/steward")
}

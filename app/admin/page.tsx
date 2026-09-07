import { redirect } from "next/navigation"

// Legacy `/admin` URLs redirect into the steward workspace at `/steward`.
export default function AdminRedirectPage({
  searchParams,
}: {
  searchParams: { tab?: string }
}) {
  const tab = searchParams.tab

  if (tab === "requests") {
    redirect("/steward/requests")
  }

  if (tab) {
    redirect(`/steward?tab=${tab}`)
  }

  redirect("/steward")
}

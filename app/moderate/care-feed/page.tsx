import { redirect } from "next/navigation"

// The Care Feed is a tab of the Guardian Dashboard now.
export default function CareFeedRedirect() {
  redirect("/moderate?tab=care-feed")
}

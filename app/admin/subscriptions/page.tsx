import { redirect } from "next/navigation"

// Subscription metrics are the Memberships tab of the Steward Console now.
export default function AdminSubscriptionsRedirect() {
  redirect("/admin?tab=memberships")
}

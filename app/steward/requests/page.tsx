import { redirect } from "next/navigation"

// Role approvals live on the Steward Requests tab in the main console.
export default function StewardRequestsRedirectPage() {
  redirect("/steward?tab=requests")
}

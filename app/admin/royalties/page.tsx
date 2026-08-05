import { redirect } from "next/navigation"

// Royalty periods are the Creator Earnings tab of the Steward Console now. The
// per-period report keeps its own route at /admin/royalties/<id>.
export default function AdminRoyaltiesRedirect() {
  redirect("/admin?tab=earnings")
}

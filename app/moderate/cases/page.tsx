import { redirect } from "next/navigation"

// Care Cases are now two tabs of the Guardian Dashboard — Active Cases for the
// working queue, Pending Reviews for unclaimed ones. Old links land on the
// working queue.
export default function ModerationCasesRedirect() {
  redirect("/moderate?tab=active")
}

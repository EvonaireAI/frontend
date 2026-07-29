import { redirect } from "next/navigation"

// The Commons review queue is one of the two sub-lists on the Sacred Library
// tab of the Guardian Dashboard.
export default function ReviewQueueRedirect() {
  redirect("/moderate?tab=library")
}

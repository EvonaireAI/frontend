import { redirect } from "next/navigation"

// "My Space" was renamed to "My Sanctuary". Keep this path alive so existing
// links and bookmarks don't 404 — permanently redirect to the new route.
export default function MySpaceRedirect() {
  redirect("/member/my-sanctuary")
}

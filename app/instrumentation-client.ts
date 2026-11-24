// Next.js client instrumentation entry. Runs once per page load on the
// client; posthog-js is dynamically imported inside initAnalytics so the
// SDK stays out of the bundle path when NEXT_PUBLIC_POSTHOG_KEY is unset.
import { initAnalytics } from "@/lib/analytics"

void initAnalytics()

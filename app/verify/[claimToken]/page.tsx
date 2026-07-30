import type { Metadata } from "next"
import { VerificationCard } from "@/components/claimchain/verification-card"

// Public license verification. Unauthenticated by design: a verification page
// that requires an account verifies nothing.
//
// Privacy rules this page exists under — the backend already guarantees them,
// and the job here is to not undo them:
//   - no listing, ritual or creator lookup to "enrich" the card;
//   - no resolving `creator_ref` / `holder_ref` against anything;
//   - the claim token never reaches the page title or an analytics event;
//   - no og:image, because rendering one would render the content.
//
// The metadata is therefore static and says nothing about which license is
// being viewed. `robots: noindex` keeps verification links out of search
// results: they are shared deliberately with a platform or a lawyer, not
// published.

export const metadata: Metadata = {
  title: "License verification — Evonaire",
  description: "Check whether an Evonaire content license is in force.",
  robots: { index: false, follow: false },
}

export default function VerifyPage() {
  return <VerificationCard />
}

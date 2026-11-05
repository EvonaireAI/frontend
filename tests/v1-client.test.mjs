// lib/v1.ts contract checks: every directive endpoint group is wired, the
// consent/revocation verbs exist, and the admin surface stays separate.
// Source-level assertions keep the suite runnable under plain node
// (no TypeScript loader needed).

import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const src = readFileSync(new URL("../lib/v1.ts", import.meta.url), "utf8")

test("all directive endpoint groups are wired", () => {
  const paths = [
    "/gateway/applications/", "/gateway/status/", "/gateway/education/complete/",
    "/gateway/verification/", "/holding-garden/status/", "/gateway/appeals/",
    "/me/permissions/", "/memberships/plans/", "/memberships/checkout/",
    "/memberships/current/", "/memberships/cancel/", "/marketplace/offerings/",
    "/marketplace/checkout/", "/marketplace/usage/", "/creator/offerings/",
    "/creator/analytics/", "/creator/revenue/", "/rights/licenses/",
    "/rights/consents/", "/rights/access-checks/", "/claimchain/receipts/",
    "/payments/refund-requests/", "/me/purchases/", "/me/entitlements/",
    "/me/ledger/", "/me/receipts/", "/creators/earnings/", "/creators/payouts/",
    "/creator/transactions/", "/horae/availability/", "/bookings/",
    "/classes/", "/safety/reports/", "/support/requests/", "/guardian/cases/",
    "/guardian/available-work/", "/guardian/time-entries/",
    "/gaia/capabilities/", "/gaia/education/", "/gaia/navigation/",
    "/gaia/consent-status/", "/reflections/", "/operations/summary/",
    "/audit/events/", "/finance/reconciliation/",
  ]
  for (const p of paths) {
    assert.ok(src.includes(p), `missing ${p}`)
  }
})

test("consent and revocation verbs exist", () => {
  assert.match(src, /revokeConsent/)
  assert.match(src, /accessCheck/)
  assert.match(src, /claim_token/)
  assert.match(src, /Idempotency-Key/)
})

test("admin surface is separated", () => {
  assert.match(src, /admin-api\/v1/)
  assert.match(src, /decideApplication/)
  assert.match(src, /opsSummary/)
})

# Session 13 (frontend) — Provenance & Licenses: API notes

What the UI assumed where `docs/API_CONTRACTS.md` (Session 13) left room, and
what would break if the assumption is wrong. Ordered by how likely each one is
to bite.

---

## 1. `events[]` may not chain contiguously in a per-ritual view

**The risk this session should worry about most.**

The contract describes **one global chain**: `prev_hash` carries a UNIQUE
constraint, and concurrent appends race for the same tail. But
`GET /api/claimchain/content/{ritual_id}/` returns only the events *about that
ritual*. If the global chain interleaves events from other creators — and with a
single chain it must — then event N's `prev_hash` in this filtered list will not
equal event N-1's `payload_hash`, because an unrelated event sits between them.

The contract nonetheless states the response is self-verifying: *"walk `events`
in order and confirm each event's `prev_hash` equals the previous event's
`payload_hash`."* Both cannot be true unless the backend serves per-subject
chains, or filters while preserving links some other way.

**What the UI does:** implements the check exactly as specified. On a mismatch it
names the two event ids and says to contact a Steward, and adds one muted line
noting that this view lists only events about this ritual, so an intervening
unrelated event would look the same from here.

**If the chain is global, this needs a backend answer before launch.** Every
creator with more than one event would be told their record could not be
verified and to contact a Steward. That is a support-load and trust problem, not
a cosmetic one. Options: expose a per-subject `prev_subject_hash`, or return the
intervening links, or have `/content/{id}/` state the verification result itself.

## 2. Event ordering in `events[]` is unspecified

`fingerprints` is documented as newest first; `events` says nothing. Since the
timeline reads oldest first and the chain walk depends on order, the UI sorts by
`created_at` then `id` ascending before doing anything. The chain is append-only,
so creation order is chain order — but this is an inference, not a contract.
Worth stating explicitly in the doc either way.

## 3. Empty states are the common case and are under-specified

Content is fingerprinted at **approval**, and older rituals need
`backfill_fingerprints`. Until that has run in production, most creators will hit
empty responses. The contract shows only populated payloads, so the following
were treated as normal rather than as errors:

- `GET /api/claimchain/content/` → `{count: 0, results: []}` — the index says
  *"Nothing recorded yet. Rituals are added to your provenance record when
  they're approved."*
- `GET /api/claimchain/content/{id}/` with `fingerprints: []` — assumed possible
  (an approved ritual whose stored object was unreadable, which §8 says the
  backfill reports and skips). The detail page renders the same sentence rather
  than an empty block. **Unconfirmed:** does this endpoint 404 in that case
  instead?
- `licenses: []` and `events: []` are treated as ordinary.
- An empty `events[]` explicitly does **not** pass verification — it reports
  "nothing to verify — this is not a pass" rather than a green tick over zero
  events.

## 4. No `GET /api/claimchain/licenses/{id}/`

The revoke flow needs to re-read one license after a `400` "already revoked", to
refresh the row rather than show a raw error. With no detail endpoint, the UI
calls `GET /api/claimchain/licenses/?ritual={id}` and picks the row out. Works,
but fetches up to 200 records to update one. A detail route would be cheaper.

## 5. `revoked_by` shape is never shown populated

Every example prints `"revoked_by": null`. The UI accepts an object
(`{id, email}`), a bare id, or a string, and renders `email` → `account #id` →
the raw string in that order. Worth pinning down: if it serialises as a bare id,
the creator sees "by account #5", which is not useful.

## 6. Matching held licenses to purchases

`GET /api/commons/purchases/` returns entitlements with `id: 55`;
`LicenseRecord.entitlement` is `315` in the example. The library screen assumes
`LicenseRecord.entitlement === Purchase.id` (a Commons purchase *is* an
entitlement), and falls back to matching on `listing` id. If those id spaces are
not the same, the fallback silently attaches the wrong license to a purchase —
worth confirming, because the failure is invisible rather than loud.

Also: entitlements predating the ledger have no license record at all, so the
library shows nothing extra for them rather than an error. That is deliberate.

## 7. Pagination on `/claimchain/content/` and `/claimchain/licenses/`

Both are documented as paginated (limit/offset, default 50, max 200). The UI
requests `limit=200` and does not page further. A creator with more than 200
fingerprints or a ritual with more than 200 licenses would silently see a
truncated record — acceptable now, wrong eventually. Flagging rather than
building a pager for a case that cannot yet occur.

## 8. `verify_url` is an absolute API-host URL

The example is `https://api.evonaire.com/api/verify/u7Kx…/`, i.e. it points at
the API host, not at the front end's `/verify/{claim_token}` page. The UI links
and copies `verify_url` verbatim — it is the field a creator sends to a platform,
and rewriting it client-side would mean shipping two different "official" URLs
for the same license.

**This needs a product decision:** if `verify_url` resolves to raw JSON, a lawyer
following that link gets a JSON blob instead of the certificate page. Either the
backend should emit the front-end URL, or `/api/verify/{token}/` should
content-negotiate and redirect browsers to `/verify/{token}`.

## 9. Anchoring copy is runtime-driven, as instructed

No copy is hardcoded to today's `enabled: false`. `anchorStatusLabel()` branches
on `anchoring.enabled`, so `pending` reads "Sealed — not yet published
externally" now and "Sealed — awaiting publication" the day anchoring is turned
on, with no redeploy. `anchoring.note` is rendered verbatim in plain type.

A null `anchor_status` (event not yet batched) renders "Not yet sealed" with the
note that batches seal every few minutes — that one genuinely is transient,
unlike `pending`.

## 10. Public verification page — what was deliberately not done

- Fetched **client-side with no `Authorization` header**, so the response cannot
  vary by who is looking, even for a signed-in visitor.
- `AppShell` skips the auth providers, navigation, consent guard and footer
  entirely on `/verify/*`, so `AuthProvider` never mounts and never calls
  `/api/me/`. Verified in the browser: the only request the page makes is
  `/api/verify/{token}/`.
- Static `<title>` with no token, `robots: noindex`, no `og:image`, no analytics.
- No listing/creator/ritual lookup, and no attempt to resolve `creator_ref` or
  `holder_ref` against anything.
- `404` renders "No license matches this link." with no speculation and no
  sign-up prompt.

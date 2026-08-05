# Content protection — what we do, and what we cannot do

Session 12. Companion to the backend's `docs/API_CONTRACTS.md` §
"Session 12 — Content Protection".

This document exists because the honest answer to "can you stop people
screenshotting or recording our audio?" is **no**, and everyone — the CEO, a
creator asking how their work is protected, and a security reviewer — deserves
that answer written down rather than discovered later.

What we ship instead is **deterrence and traceability**: short-lived URLs bound
to one live session, a visible watermark that follows a recording wherever it
goes, deterrents that make casual copying awkward, and a behavioural detector
with a human-reviewed enforcement ladder on the server.

---

## The platform matrix

✅ implemented and effective · ⚠️ partial, with a caveat · ❌ not possible

| | Web (desktop) | iOS Safari / PWA | Android Chrome / PWA | Future native app |
| --- | --- | --- | --- | --- |
| **Screenshot blocking** | ❌ No web API exists | ❌ No web API exists | ❌ No web API exists, even in a PWA | ✅ `FLAG_SECURE` (Android); secure overlay on `UIScreen.isCaptured` (iOS) |
| **Recording detection** | ❌ No reliable signal | ⚠️ `screen.isCaptured` where the engine exposes it; absent on most builds | ❌ No signal exposed to the page | ✅ `UIScreen.isCaptured` / `MediaProjection` callbacks, reported as a first-class event |
| **Download blocking** | ⚠️ `controlsList="nodownload"`, no context menu, URL never in markup — devtools and the network tab still see it | ⚠️ Same, plus long-press callout suppressed | ⚠️ Same; some Android browsers still expose a download affordance | ⚠️ Better, not absolute — a rooted/jailbroken device can always reach the buffer |
| **Watermark** | ✅ Drifting overlay: pseudonym · session · UTC clock, refreshed every 15s | ✅ Same | ✅ Same | ✅ Same, and it survives into the native capture path |
| **DRM** | ❌ Not implemented. EME/Widevine is a video path; there is no usable DRM story for bare `<audio>` | ❌ Not implemented (FairPlay would need HLS + a licence server) | ❌ Not implemented | ⚠️ Possible: Widevine/FairPlay once content is packaged as encrypted HLS/DASH |

### Reading the ❌s honestly

- **Screenshots.** There is no browser equivalent of `FLAG_SECURE`. Nothing a
  page can do — not CSS, not canvas, not disabling the PrintScreen key —
  prevents an OS-level screen capture. Any product claiming otherwise on the
  web is wrong. We do not have this, and we do not imply we do in any UI copy.
- **Recording detection.** Chrome and Safari expose no "am I being recorded?"
  signal to a page. Heuristics people reach for (frame-rate drops, focus loss,
  `getDisplayMedia` presence) detect ordinary behaviour far more often than
  capture. We deliberately report **nothing** rather than fabricate a signal:
  a false "recording detected" is worse than no detection, because it looks
  like protection while flagging innocent people.
- **A phone pointed at a speaker** defeats every measure on this page, on every
  platform, forever. Watermarking is the answer to that, not prevention.

---

## What is implemented, and where

| Concern | Where | Notes |
| --- | --- | --- |
| Capability report | [lib/screen-protection.ts](../lib/screen-protection.ts) | `getScreenProtectionCapabilities()` → `{platform, canBlockScreenshots, canDetectRecording, isStandalonePWA}`. Both booleans are `false` on every web platform today. |
| Native seam | [lib/screen-protection.ts](../lib/screen-protection.ts) | `applySecureScreen()` is a documented no-op on the web. A Capacitor/RN host sets `window.__evonaireSecureScreen` and it upgrades with no player change. |
| Surface deterrents | [lib/screen-protection.ts](../lib/screen-protection.ts) | `protectSurface()` — no context menu, no drag-off, no selection, no iOS long-press callout. |
| Media hardening | [lib/screen-protection.ts](../lib/screen-protection.ts) | `hardenMediaElement()` — `controlsList="nodownload"`, `disablePictureInPicture`, `disableRemotePlayback`. |
| URL kept out of React | [lib/screen-protection.ts](../lib/screen-protection.ts) | `assignStreamSource()` sets `.src` as a property, so the URL is never a React prop, never in the server-rendered HTML, never in a component-tree dump. ⚠️ `src` is a *reflected* attribute — the live element does carry the URL and devtools can read it. See "Deliberate decisions" below. Never written to `localStorage` or history, never logged. |
| Obscure on hide/blur | [app/member/ritual/[id]/page.tsx](<../app/member/ritual/[id]/page.tsx>) | Artwork blurs and audio pauses when the tab is hidden or the window loses focus; resumes cleanly on return. |
| Watermark | [components/player/dynamic-watermark.tsx](../components/player/dynamic-watermark.tsx) | Four tiles at ~0.25 opacity, drifting and refreshing every 15s, restored by a `MutationObserver` plus a 2s integrity pass if detached or restyled. `aria-hidden`, `pointer-events: none`, never focusable, honours `prefers-reduced-motion`. |
| Watermark identity | [lib/watermark.ts](../lib/watermark.ts) | 8-char pseudonym + short session id + live UTC clock. **Never** the email or raw user id — the mark is visible to anyone looking at the screen. |
| Session-bound streaming | [lib/playback-metering.ts](../lib/playback-metering.ts) | `POST /analytics/playback/stream-token/`; rotates on PAUSE/RESUME/SEEK/RECONNECT and before expiry; one request in flight; echoes `stream_token` on every event. |
| Enforcement UX | [components/player/playback-notice.tsx](../components/player/playback-notice.tsx) | Warning toast once per session; calm locked and restricted cards; "Playback moved to your other device" with "Play here instead". |
| Review-queue protection | [components/player/protected-audio-preview.tsx](../components/player/protected-audio-preview.tsx) | The moderation preview is watermarked and hardened too. |

---

## Deliberate decisions a reviewer should know about

**The watermark pseudonym is derived in the browser.** The Session 12 backend
contract does not yet expose a server-side HMAC pseudonym, so
`derivePseudonym()` computes SHA-256 over the user id with a fixed domain
prefix. It is opaque on screen and stable per user, and the platform can
recompute the mapping — but so could anyone with the client bundle and a guess
at the user id. When the backend adds a pseudonym keyed on
`ANALYTICS_HASH_SALT`, pass it as `serverPseudonym` and the local derivation is
skipped. That is the preferred source.

**The stream URL is not hidden from the DOM, and cannot be.** The brief asked
for the URL to be kept out of the markup by assigning `src` in JS. That is what
we do — but `src` is a reflected IDL attribute, so the live element carries the
URL either way and devtools reads it in one click. What the property assignment
genuinely prevents is the URL becoming a React prop: out of the server-rendered
HTML, out of component-tree and error-boundary dumps, out of page snapshots.
Truly hiding it would mean buffering the whole file into a blob URL (losing
range requests and streaming on mobile) or driving an MSE `SourceBuffer`.
Neither is worth it, because the URL is not a secret: it lives 180 seconds and
is bound to one live session. That is the protection.

**Rotating a token does not reassign `src`.** The contract requires a fresh
token on every transport event. Reassigning the element's source mid-listen
would reload the media and throw away the listener's position, so the new URL
is held in memory and only assigned on initial load and on reconnect. The
contract obligation (previous token invalidated, request shape recorded) is met
either way; what changes is that the audio already streaming continues from the
old grant until it ends. This is the same limitation the backend documents:
S3 validates its own signature and cannot ask whether our session is still
blessed. Putting the origin behind CloudFront with a signed-cookie edge check
closes both halves at once.

**Auto-pauses are not transport events.** Pausing because the tab was hidden
does *not* emit `PAUSE`/`RESUME` or rotate the token. Alt-tabbing is not
listener behaviour, and feeding it to the detector would let ordinary
multitasking trip `rapid_transport` (>25 transport events in 10 minutes) and
warn someone who did nothing wrong.

**Client capture reports are signals, not evidence.** Where a platform genuinely
exposes capture state we send `CAPTURE_SUSPECTED`. The backend weights it at
**zero** by design, so it can never cost anyone access on its own — it is
context for a reviewing Guardian. Where no signal exists we send nothing.

**Nothing here is a security boundary against a determined attacker.** Every
client-side measure is removable by someone with devtools. They raise the effort
of casual copying and they make what does leak traceable. Real prevention lives
in the next two items.

---

## What a native wrapper or DRM would unlock

| Step | Unlocks | Cost |
| --- | --- | --- |
| **Capacitor / React Native shell** implementing `window.__evonaireSecureScreen` | Genuine screenshot blocking (`FLAG_SECURE` on Android, secure overlay on iOS), real capture detection via `UIScreen.isCaptured` / `MediaProjection` — no player code changes, the seam already exists | App-store distribution, a native build pipeline, a bridge to maintain |
| **CloudFront + signed cookies** in front of the media origin | Session binding enforced at *fetch* time, not just issuance: a leaked URL stops working the moment the session is superseded or flagged | Backend/infra work; named as the natural next step in the backend contract |
| **Encrypted HLS/DASH + EME** (Widevine / FairPlay) | Content encrypted at rest and in transit to the decoder; casual stream-ripping stops working | Packaging pipeline, a licence server, per-platform testing; still defeated by an analogue recording |

None of these stop a phone pointed at a speaker. The watermark is the only
measure that survives that, which is why it is the piece we invested in first.

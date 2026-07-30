// Playback metering (usage-based royalties). The player reports listening via
// POST /analytics/playback/{start,heartbeat,end}/ — start also registers the
// play for quota purposes, replacing the legacy POST /analytics/plays/ call.
//
// Metering is telemetry: every request here is swallowed on failure and must
// NEVER block, pause, or interrupt audio. The one exception is start(), whose
// structured 403 entitlement denial means the play itself is not allowed — it
// opens the upgrade modal (via the entitlements event bus) and throws
// EntitlementDeniedError so the caller can skip starting audio.
//
// ── Session 12: protected streaming ───────────────────────────────────────────
// The meter also owns stream-token acquisition, because a stream token is bound
// to the playback session and there must be exactly one owner of that session.
// Unlike the metering calls above, `acquireStreamUrl` DOES gate audio: no grant,
// no URL, no playback. Its failures are structured (StreamDeniedError,
// PlaybackLockedError) so the player can render the right calm notice.
//
// Contract: backend-code/docs/API_CONTRACTS.md § "Session 12 — Content
// Protection". Tokens live 180s, rotate at rotate_after_seconds, and minting a
// new one invalidates the previous. Stream URLs are never persisted or logged.

import { throwIfEntitlementDenied } from "./entitlements"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "/api"

const DEVICE_ID_KEY = "evonaire_device_id"
const DEFAULT_HEARTBEAT_SECONDS = 25
const START_RETRY_DELAY_MS = 5000
// Floor for the rotation timer, so a misconfigured server cannot make us
// hammer the token endpoint.
const MIN_ROTATE_SECONDS = 30

interface PlaybackStartResponse {
  session_id: number
  heartbeat_interval_seconds: number
  ritual_duration_seconds: number
  // Session 12: this device may have displaced another one of the user's
  superseded_session_ids?: number[]
  playback_moved?: boolean
  playback_moved_message?: string | null
  max_concurrent_sessions?: number
}

// ── Session 12 types (mirror the contract) ────────────────────────────────────

export type EnforcementLevel = "none" | "warning" | "locked"

export interface Enforcement {
  level: EnforcementLevel
  score: number
  reason_codes: string[]
  show_warning: boolean
  message: string | null
  flag_id: number | null
}

/** Events that mint a fresh token, per `rotate_on_events`. */
export type StreamRotateEvent = "PAUSE" | "RESUME" | "SEEK" | "RECONNECT" | "EXPIRY"

/** Events a client may write via POST /analytics/playback/event/. */
export type ClientPlaybackEvent =
  | "PAUSE"
  | "RESUME"
  | "SEEK"
  | "RECONNECT"
  | "ERROR"
  | "CAPTURE_SUSPECTED"

interface StreamGrant {
  session_id: number
  stream_token: string
  stream_url: string
  expires_at: string
  rotate_after_seconds: number
  rotate_on_events: string[]
  enforcement?: Enforcement
}

export type StreamDeniedReason =
  | "session_not_found"
  | "session_closed"
  | "session_superseded"
  | "session_flagged"
  | "playback_restricted"
  | "unavailable"

export class StreamDeniedError extends Error {
  reason: StreamDeniedReason
  detail: string | null

  constructor(reason: StreamDeniedReason, detail: string | null) {
    super(`stream_denied:${reason}`)
    this.name = "StreamDeniedError"
    this.reason = reason
    this.detail = detail
  }
}

export class PlaybackLockedError extends Error {
  flagId: number | null
  detail: string
  sessionId: number | null

  constructor(detail: string, flagId: number | null, sessionId: number | null) {
    super("playback_locked")
    this.name = "PlaybackLockedError"
    this.detail = detail
    this.flagId = flagId
    this.sessionId = sessionId
  }
}

export interface MeterCallbacks {
  /** A warning-level enforcement block. Raised at most once per session. */
  onWarning?: (enforcement: Enforcement) => void
  /** The backend closed this session under review (423 / session_flagged). */
  onLocked?: (error: PlaybackLockedError) => void
  /** Playback started on another device and took over this user's one session. */
  onSuperseded?: (detail: string | null) => void
  /** A Guardian has restricted this account's playback. */
  onRestricted?: (detail: string | null) => void
  /** The active session changed (including to null). Drives the watermark label. */
  onSessionChange?: (sessionId: number | null) => void
}

// Stable opaque per-browser id, hashed server-side. Never anything personal.
function getDeviceId(): string | undefined {
  if (typeof window === "undefined") return undefined
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY)
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem(DEVICE_ID_KEY, id)
    }
    return id
  } catch {
    return undefined
  }
}

function getAuthHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {}
  const token = localStorage.getItem("access_token")
  return token ? { Authorization: `Bearer ${token}` } : {}
}

// keepalive lets beats/ends survive tab hide and unload; sendBeacon is not an
// option because SimpleJWT needs the Authorization header.
function post(path: string, body: object): Promise<Response> {
  return fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    keepalive: true,
    headers: {
      ...getAuthHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })
}

async function readJson(response: Response): Promise<any> {
  try {
    return await response.json()
  } catch {
    return null
  }
}

// One meter per player. Lifecycle:
//   start(ritualId)  before audio starts (throws only EntitlementDeniedError)
//   acquireStreamUrl() to obtain audio (throws StreamDenied/PlaybackLocked)
//   onPlaying()      whenever audio actually starts or resumes
//   onPause()        when audio pauses
//   onHidden()       on visibilitychange → hidden while playing
//   end()            on track end, user stop, navigation, or pagehide
// A listen that ended needs a fresh start() — check `listening` first.
export class PlaybackMeter {
  private getPosition: () => number
  private callbacks: MeterCallbacks
  private ritualId: number | null = null
  private sessionId: number | null = null
  private intervalMs = DEFAULT_HEARTBEAT_SECONDS * 1000
  private timer: ReturnType<typeof setInterval> | null = null
  private startRetryTimer: ReturnType<typeof setTimeout> | null = null
  private beatInFlight = false
  private resumeBeatPending = false
  private isListening = false

  // Session 12 state. The stream URL lives here and nowhere else — not in
  // React state, not in the DOM, not in storage.
  private streamToken: string | null = null
  private streamUrl: string | null = null
  private rotateOnEvents: Set<string> = new Set(["PAUSE", "RESUME", "SEEK", "RECONNECT"])
  private rotationTimer: ReturnType<typeof setTimeout> | null = null
  private grantInFlight: Promise<string> | null = null
  private warned = false
  private locked = false

  constructor(getPosition: () => number, callbacks: MeterCallbacks = {}) {
    this.getPosition = getPosition
    this.callbacks = callbacks
  }

  // True from start() until end() — even if the start request itself failed
  // (we play anyway and may adopt a session from the delayed retry).
  get listening(): boolean {
    return this.isListening
  }

  get activeSessionId(): number | null {
    return this.sessionId
  }

  /** The most recently minted URL, or null. Read it, use it, never store it. */
  get currentStreamUrl(): string | null {
    return this.streamUrl
  }

  async start(ritualId: number): Promise<void> {
    this.reset()
    this.isListening = true
    this.ritualId = ritualId

    let response: Response
    try {
      response = await post("/analytics/playback/start/", {
        ritual_id: ritualId,
        device_id: getDeviceId(),
      })
    } catch (err) {
      console.error("Playback metering: start failed, playing unmetered:", err)
      this.scheduleStartRetry(ritualId)
      return
    }

    if (!response.ok) {
      // Returns the parsed body when it is not an entitlement denial — take it,
      // because reading the response a second time would fail.
      let body: any = null
      try {
        body = await throwIfEntitlementDenied(response)
      } catch (err) {
        // The play is not allowed — the upgrade modal is already open
        this.reset()
        throw err
      }
      // Session 12: a restricted account is refused here as well as at the
      // token endpoint. That is not a metering failure — surface it.
      if (response.status === 403 && body?.error === "stream_denied") {
        const reason: StreamDeniedReason = body.reason ?? "unavailable"
        const detail: string | null = body.detail ?? null
        this.reset()
        this.ritualId = ritualId
        this.raiseDenial(reason, detail)
        throw new StreamDeniedError(reason, detail)
      }
      console.error(`Playback metering: start returned ${response.status}, playing unmetered`)
      this.scheduleStartRetry(ritualId)
      return
    }

    await this.adoptSession(response)
  }

  onPlaying(): void {
    if (!this.isListening || this.timer) return
    if (this.resumeBeatPending) {
      this.resumeBeatPending = false
      void this.sendBeat()
    }
    this.startTimer()
  }

  onPause(): void {
    this.stopTimer()
    // The resume beat credits time up to the pause boundary immediately
    this.resumeBeatPending = true
  }

  onHidden(): void {
    // Credit listening up to this moment in case background timers throttle.
    // Fire-and-forget; the request is keepalive so it survives the tab hide.
    if (this.timer && this.sessionId) {
      void this.sendBeat()
    }
  }

  // Safe to call unconditionally (no-op without an active session). A second
  // end (or one after the server's abandon sweep) gets a 409, which the
  // server semantics define as already-closed — success for our purposes.
  end(): void {
    this.stopTimer()
    this.stopRotation()
    const sessionId = this.sessionId
    const position = Math.floor(this.getPosition())
    this.reset()
    if (sessionId === null) return
    post("/analytics/playback/end/", { session_id: sessionId, position_seconds: position }).catch((err) => {
      console.error("Playback metering: end failed:", err)
    })
  }

  // ── Session 12: stream tokens ───────────────────────────────────────────────

  /**
   * Mint a session-bound stream URL.
   *
   * Call for the initial load and on RECONNECT. For PAUSE/RESUME/SEEK use
   * `rotateFor`, which refreshes the grant without disturbing the audio
   * element — reassigning `src` mid-listen would reload the media and throw
   * away the listener's position.
   *
   * At most one request is in flight; concurrent callers share it.
   */
  async acquireStreamUrl(eventType?: StreamRotateEvent): Promise<string> {
    if (this.grantInFlight) return this.grantInFlight
    const request = this.mintToken(eventType, true).finally(() => {
      this.grantInFlight = null
    })
    this.grantInFlight = request
    return request
  }

  /**
   * Refresh the grant because a transport event happened.
   *
   * This is a contract obligation (the backend scores request shapes, and the
   * previous token dies the moment a new one is minted), not a way to get audio
   * playing. Failures are reported through the callbacks and swallowed here:
   * a rotation that fails must not interrupt audio that is already sounding.
   * The player re-acquires properly if the media actually errors.
   */
  rotateFor(eventType: StreamRotateEvent): void {
    if (!this.rotateOnEvents.has(eventType) && eventType !== "EXPIRY") return
    if (this.sessionId === null || this.grantInFlight || this.locked) return
    const request = this.mintToken(eventType, false)
      .catch(() => null)
      .finally(() => {
        this.grantInFlight = null
      })
    this.grantInFlight = request as Promise<any>
  }

  /**
   * Record a client-side playback event and echo the current stream token.
   *
   * Echoing matters: a stale or foreign token is the clearest sharing signal
   * the backend has. Telemetry — never blocks audio.
   */
  async reportEvent(
    eventType: ClientPlaybackEvent,
    meta?: Record<string, string | number | boolean>,
  ): Promise<void> {
    if (this.sessionId === null) return
    // A transport event rotates the token and reports it in the same breath.
    // Wait for the rotation to land first: echoing the token it just replaced
    // would be logged as TOKEN_REJECTED and add 25 to the abuse score for
    // nothing more than pressing pause.
    if (this.grantInFlight) {
      try {
        await this.grantInFlight
      } catch {
        // The rotation failed; report against whatever token we still hold
      }
    }
    if (this.sessionId === null) return
    try {
      const response = await post("/analytics/playback/event/", {
        session_id: this.sessionId,
        event_type: eventType,
        position_seconds: Math.floor(this.getPosition()),
        stream_token: this.streamToken,
        ...(meta ? { meta } : {}),
      })
      if (!response.ok) return
      const body = await readJson(response)
      this.applyEnforcement(body?.enforcement)
      // The server tells us when our token is stale or the event demands a
      // fresh one; obey rather than guessing.
      if (body?.rotate_required && !this.locked) this.rotateFor("RECONNECT")
    } catch {
      // Event ingest is best-effort; a dropped event costs us signal, not audio
    }
  }

  /**
   * Start a brand-new session after this one was superseded, and hand back a
   * fresh stream URL. Drives the "Play here instead" action.
   */
  async reclaimPlayback(): Promise<string> {
    if (this.ritualId === null) throw new StreamDeniedError("unavailable", null)
    const ritualId = this.ritualId
    this.clearGrant()
    this.setSession(null)
    this.isListening = true
    this.locked = false
    this.warned = false
    await this.start(ritualId)
    return this.acquireStreamUrl("RECONNECT")
  }

  private async mintToken(eventType: StreamRotateEvent | undefined, fatal: boolean): Promise<string> {
    if (this.sessionId === null) {
      await this.restartSession()
      if (this.sessionId === null) throw new StreamDeniedError("unavailable", null)
    }

    let response: Response
    try {
      response = await post("/analytics/playback/stream-token/", {
        session_id: this.sessionId,
        ...(eventType ? { event_type: eventType } : {}),
      })
    } catch {
      throw new StreamDeniedError("unavailable", null)
    }

    if (response.status === 423) {
      const body = await readJson(response)
      const error = new PlaybackLockedError(
        body?.detail ??
          "We've paused this playback session while we take a look at some unusual activity.",
        body?.flag_id ?? null,
        body?.session_id ?? this.sessionId,
      )
      // The server has already closed the session and wiped the token
      this.locked = true
      this.clearGrant()
      this.stopTimer()
      this.setSession(null)
      this.isListening = false
      this.callbacks.onLocked?.(error)
      throw error
    }

    if (response.status === 403) {
      const body = await readJson(response)
      const reason: StreamDeniedReason = body?.reason ?? "unavailable"
      const detail: string | null = body?.detail ?? null

      // A session that is merely gone or finished is not an incident: open a
      // new one and carry on, exactly as the heartbeat path already does.
      if ((reason === "session_not_found" || reason === "session_closed") && fatal) {
        this.setSession(null)
        await this.restartSession()
        if (this.sessionId !== null) return this.mintTokenOnce(eventType)
      }

      this.raiseDenial(reason, detail)
      throw new StreamDeniedError(reason, detail)
    }

    if (!response.ok) {
      await throwIfEntitlementDenied(response)
      throw new StreamDeniedError("unavailable", null)
    }

    return this.adoptGrant(await readJson(response))
  }

  // One retry after a transparent session restart; never recurses further.
  private async mintTokenOnce(eventType: StreamRotateEvent | undefined): Promise<string> {
    const response = await post("/analytics/playback/stream-token/", {
      session_id: this.sessionId,
      ...(eventType ? { event_type: eventType } : {}),
    })
    if (!response.ok) {
      const body = await readJson(response)
      if (response.status === 423) {
        const error = new PlaybackLockedError(
          body?.detail ?? "Playback is paused pending review.",
          body?.flag_id ?? null,
          body?.session_id ?? this.sessionId,
        )
        this.locked = true
        this.clearGrant()
        this.setSession(null)
        this.callbacks.onLocked?.(error)
        throw error
      }
      const reason: StreamDeniedReason = body?.reason ?? "unavailable"
      this.raiseDenial(reason, body?.detail ?? null)
      throw new StreamDeniedError(reason, body?.detail ?? null)
    }
    return this.adoptGrant(await readJson(response))
  }

  private adoptGrant(grant: StreamGrant | null): string {
    if (!grant?.stream_url) throw new StreamDeniedError("unavailable", null)
    this.streamToken = grant.stream_token ?? null
    this.streamUrl = grant.stream_url
    if (Array.isArray(grant.rotate_on_events) && grant.rotate_on_events.length > 0) {
      this.rotateOnEvents = new Set(grant.rotate_on_events)
    }
    if (typeof grant.session_id === "number" && grant.session_id !== this.sessionId) {
      this.setSession(grant.session_id)
    }
    this.applyEnforcement(grant.enforcement)
    this.scheduleRotation(grant)
    return grant.stream_url
  }

  // Rotate before the grant expires. rotate_after_seconds is two-thirds of the
  // TTL; expires_at is the backstop if the server omits it.
  private scheduleRotation(grant: StreamGrant): void {
    this.stopRotation()
    let seconds = Number(grant.rotate_after_seconds)
    if (!Number.isFinite(seconds) || seconds <= 0) {
      const expiry = Date.parse(grant.expires_at)
      seconds = Number.isFinite(expiry) ? ((expiry - Date.now()) / 1000) * 0.67 : 120
    }
    seconds = Math.max(MIN_ROTATE_SECONDS, seconds)
    this.rotationTimer = setTimeout(() => {
      this.rotationTimer = null
      if (!this.isListening || this.locked) return
      this.rotateFor("EXPIRY")
    }, seconds * 1000)
  }

  private stopRotation(): void {
    if (this.rotationTimer) {
      clearTimeout(this.rotationTimer)
      this.rotationTimer = null
    }
  }

  private clearGrant(): void {
    this.stopRotation()
    this.streamToken = null
    this.streamUrl = null
    this.grantInFlight = null
  }

  // Shown once per session: repeating a warning on every request would turn a
  // quiet notice into nagging, which the charter rules out.
  private applyEnforcement(enforcement: Enforcement | undefined | null): void {
    if (!enforcement) return
    if (enforcement.show_warning && enforcement.level === "warning" && !this.warned) {
      this.warned = true
      this.callbacks.onWarning?.(enforcement)
    }
  }

  private raiseDenial(reason: StreamDeniedReason, detail: string | null): void {
    if (reason === "session_superseded") {
      this.stopTimer()
      this.clearGrant()
      this.setSession(null)
      this.callbacks.onSuperseded?.(detail)
      return
    }
    if (reason === "playback_restricted") {
      this.stopTimer()
      this.clearGrant()
      this.setSession(null)
      this.isListening = false
      this.callbacks.onRestricted?.(detail)
      return
    }
    if (reason === "session_flagged") {
      this.locked = true
      this.stopTimer()
      this.clearGrant()
      const flagged = new PlaybackLockedError(
        detail ?? "Playback is paused while a Guardian reviews some unusual activity.",
        null,
        this.sessionId,
      )
      this.setSession(null)
      this.isListening = false
      this.callbacks.onLocked?.(flagged)
    }
  }

  private setSession(sessionId: number | null): void {
    if (this.sessionId === sessionId) return
    this.sessionId = sessionId
    this.callbacks.onSessionChange?.(sessionId)
  }

  private async adoptSession(response: Response): Promise<void> {
    try {
      const data: PlaybackStartResponse = await response.json()
      this.setSession(data.session_id)
      // A new session invalidates any grant held for the old one
      this.clearGrant()
      // Server accepts a 20–30s cadence; clamp whatever it advertises
      const seconds = Math.min(30, Math.max(20, data.heartbeat_interval_seconds || DEFAULT_HEARTBEAT_SECONDS))
      this.intervalMs = seconds * 1000
      if (this.timer) this.startTimer()
    } catch (err) {
      console.error("Playback metering: unreadable start response:", err)
    }
  }

  // One delayed retry after a failed start; adopt the session only if this
  // listen is still in progress and nothing else registered one meanwhile.
  private scheduleStartRetry(ritualId: number): void {
    this.startRetryTimer = setTimeout(async () => {
      this.startRetryTimer = null
      if (!this.isListening || this.sessionId !== null || this.ritualId !== ritualId) return
      try {
        const response = await post("/analytics/playback/start/", {
          ritual_id: ritualId,
          device_id: getDeviceId(),
        })
        if (response.ok) await this.adoptSession(response)
      } catch {
        // Still down — this listen stays unmetered
      }
    }, START_RETRY_DELAY_MS)
  }

  // At most one beat in flight; a failed beat is skipped, never queued or
  // replayed — the server caps credit per beat, so catching up is pointless.
  private async sendBeat(): Promise<void> {
    if (this.sessionId === null || this.beatInFlight) return
    this.beatInFlight = true
    try {
      const response = await post("/analytics/playback/heartbeat/", {
        session_id: this.sessionId,
        position_seconds: Math.floor(this.getPosition()),
      })
      if (response.ok) {
        this.applyEnforcement((await readJson(response))?.enforcement)
      } else if (response.status === 409 || response.status === 404) {
        const body = response.status === 409 ? await readJson(response) : null
        // Session 12: the device that got displaced learns about it here. That
        // is not a lost session to quietly re-open — the user is listening
        // somewhere else, and starting a new session would yank playback back.
        if (body?.status === "superseded") {
          this.stopTimer()
          this.clearGrant()
          this.setSession(null)
          this.callbacks.onSuperseded?.(body?.detail ?? null)
          return
        }
        // Server closed the session (e.g. >5 min gap after a laptop sleep).
        // The user is still listening: transparently start a new session.
        this.setSession(null)
        await this.restartSession()
      }
    } catch {
      // Network/5xx: skip this beat, try again next interval
    } finally {
      this.beatInFlight = false
    }
  }

  private async restartSession(): Promise<void> {
    if (!this.isListening || this.ritualId === null || this.locked) return
    try {
      const response = await post("/analytics/playback/start/", {
        ritual_id: this.ritualId,
        device_id: getDeviceId(),
      })
      if (response.ok) await this.adoptSession(response)
      // Any failure (including a denial) stays silent mid-listen; the next
      // heartbeat tick lands on a null session and we try again then
    } catch {
      // Same: retry from the next tick
    }
  }

  private startTimer(): void {
    this.stopTimer()
    this.timer = setInterval(() => {
      if (this.sessionId === null) {
        // Session lost and restart failed earlier — keep trying while playing
        void this.restartSession()
        return
      }
      void this.sendBeat()
    }, this.intervalMs)
  }

  private stopTimer(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  private reset(): void {
    this.stopTimer()
    this.clearGrant()
    if (this.startRetryTimer) {
      clearTimeout(this.startRetryTimer)
      this.startRetryTimer = null
    }
    this.ritualId = null
    this.setSession(null)
    this.isListening = false
    this.beatInFlight = false
    this.resumeBeatPending = false
    this.warned = false
    this.locked = false
    this.intervalMs = DEFAULT_HEARTBEAT_SECONDS * 1000
  }
}

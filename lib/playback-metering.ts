// Playback metering (usage-based royalties). The player reports listening via
// POST /analytics/playback/{start,heartbeat,end}/ — start also registers the
// play for quota purposes, replacing the legacy POST /analytics/plays/ call.
//
// Metering is telemetry: every request here is swallowed on failure and must
// NEVER block, pause, or interrupt audio. The one exception is start(), whose
// structured 403 entitlement denial means the play itself is not allowed — it
// opens the upgrade modal (via the entitlements event bus) and throws
// EntitlementDeniedError so the caller can skip starting audio.

import { throwIfEntitlementDenied } from "./entitlements"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "/api"

const DEVICE_ID_KEY = "evonaire_device_id"
const DEFAULT_HEARTBEAT_SECONDS = 25
const START_RETRY_DELAY_MS = 5000

interface PlaybackStartResponse {
  session_id: number
  heartbeat_interval_seconds: number
  ritual_duration_seconds: number
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

// One meter per player. Lifecycle:
//   start(ritualId)  before audio starts (throws only EntitlementDeniedError)
//   onPlaying()      whenever audio actually starts or resumes
//   onPause()        when audio pauses
//   onHidden()       on visibilitychange → hidden while playing
//   end()            on track end, user stop, navigation, or pagehide
// A listen that ended needs a fresh start() — check `listening` first.
export class PlaybackMeter {
  private getPosition: () => number
  private ritualId: number | null = null
  private sessionId: number | null = null
  private intervalMs = DEFAULT_HEARTBEAT_SECONDS * 1000
  private timer: ReturnType<typeof setInterval> | null = null
  private startRetryTimer: ReturnType<typeof setTimeout> | null = null
  private beatInFlight = false
  private resumeBeatPending = false
  private isListening = false

  constructor(getPosition: () => number) {
    this.getPosition = getPosition
  }

  // True from start() until end() — even if the start request itself failed
  // (we play anyway and may adopt a session from the delayed retry).
  get listening(): boolean {
    return this.isListening
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
      try {
        await throwIfEntitlementDenied(response)
      } catch (err) {
        // The play is not allowed — the upgrade modal is already open
        this.reset()
        throw err
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
    const sessionId = this.sessionId
    const position = Math.floor(this.getPosition())
    this.reset()
    if (sessionId === null) return
    post("/analytics/playback/end/", { session_id: sessionId, position_seconds: position }).catch((err) => {
      console.error("Playback metering: end failed:", err)
    })
  }

  private async adoptSession(response: Response): Promise<void> {
    try {
      const data: PlaybackStartResponse = await response.json()
      this.sessionId = data.session_id
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
      if (response.status === 409 || response.status === 404) {
        // Server closed the session (e.g. >5 min gap after a laptop sleep).
        // The user is still listening: transparently start a new session.
        this.sessionId = null
        await this.restartSession()
      }
    } catch {
      // Network/5xx: skip this beat, try again next interval
    } finally {
      this.beatInFlight = false
    }
  }

  private async restartSession(): Promise<void> {
    if (!this.isListening || this.ritualId === null) return
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
    if (this.startRetryTimer) {
      clearTimeout(this.startRetryTimer)
      this.startRetryTimer = null
    }
    this.ritualId = null
    this.sessionId = null
    this.isListening = false
    this.beatInFlight = false
    this.resumeBeatPending = false
    this.intervalMs = DEFAULT_HEARTBEAT_SECONDS * 1000
  }
}

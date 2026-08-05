// Screen protection for media surfaces (Session 12, CEO framework area 1).
//
// READ THIS BEFORE CHANGING ANYTHING HERE.
//
// The web platform provides NO way to block screenshots. There is no browser
// equivalent of Android's FLAG_SECURE or an iOS secure view, and there is no
// reliable "am I being screen-recorded?" signal in Safari or Chrome. Nothing in
// this file prevents capture, and no comment or UI copy anywhere in the app may
// claim that it does.
//
// What this file actually provides:
//   1. An honest capability report per platform, so the UI can say what is and
//      is not protected rather than implying more than we deliver.
//   2. Deterrents: no context menu, no drag-off, no selection, no download
//      affordance, no Picture-in-Picture, and blur/pause when the surface is
//      not in front of the user.
//   3. A documented no-op adapter (`applySecureScreen`) that a Capacitor or
//      React Native wrapper can implement later without the player changing.
//   4. An optional capture *hint*, reported to the backend as a signal only.
//      Per the Session 12 contract the backend weights it at zero and can never
//      restrict an account on it alone.
//
// See docs/CONTENT-PROTECTION.md for the platform-by-platform matrix.

export type ProtectionPlatform =
  | "web-desktop"
  | "ios-web"
  | "android-web"
  | "native"
  | "unknown"

export interface ScreenProtectionCapabilities {
  platform: ProtectionPlatform
  /** True only inside a native wrapper that implements the secure-screen bridge. */
  canBlockScreenshots: boolean
  /** True only where the platform exposes a real capture signal. Never true on the web today. */
  canDetectRecording: boolean
  /** Standalone display-mode PWA rather than a browser tab. Changes nothing about capture. */
  isStandalonePWA: boolean
}

// The seam a native wrapper implements. A Capacitor/RN host sets
// window.__evonaireSecureScreen before the app boots; everything below then
// upgrades automatically and no player code changes.
export interface NativeSecureScreenBridge {
  /** Android FLAG_SECURE / iOS secure overlay. Returns a teardown function. */
  enable?: () => void
  disable?: () => void
  /** iOS UIScreen.isCaptured (and Android equivalents), if the host wires it. */
  isCaptured?: () => boolean
  onCaptureChange?: (listener: (captured: boolean) => void) => () => void
}

declare global {
  interface Window {
    __evonaireSecureScreen?: NativeSecureScreenBridge
  }
}

function nativeBridge(): NativeSecureScreenBridge | undefined {
  if (typeof window === "undefined") return undefined
  return window.__evonaireSecureScreen
}

function detectPlatform(): ProtectionPlatform {
  if (typeof window === "undefined") return "unknown"
  if (nativeBridge()) return "native"

  const ua = navigator.userAgent || ""
  // iPadOS 13+ reports a desktop UA; the touch-point check is the usual tell.
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  if (isIOS) return "ios-web"
  if (/Android/.test(ua)) return "android-web"
  if (/Mobi/.test(ua)) return "unknown"
  return "web-desktop"
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone
  return (
    iosStandalone === true ||
    (typeof window.matchMedia === "function" &&
      window.matchMedia("(display-mode: standalone)").matches)
  )
}

export function getScreenProtectionCapabilities(): ScreenProtectionCapabilities {
  const platform = detectPlatform()
  const bridge = nativeBridge()
  return {
    platform,
    // Only a native host can genuinely block capture. Web/PWA is always false.
    canBlockScreenshots: typeof bridge?.enable === "function",
    // Only true where a real signal exists. We do not infer recording from
    // frame rates, focus loss or any other guess — that would be fabrication.
    canDetectRecording:
      typeof bridge?.isCaptured === "function" ||
      typeof bridge?.onCaptureChange === "function",
    isStandalonePWA: isStandalone(),
  }
}

/**
 * Ask the host for the strongest screen protection it has.
 *
 * On the web this is a deliberate no-op: there is nothing to call. It exists so
 * a native wrapper can implement FLAG_SECURE / an iOS secure view by providing
 * `window.__evonaireSecureScreen` — the player calls this either way.
 *
 * Returns a teardown function; always safe to call.
 */
export function applySecureScreen(): () => void {
  const bridge = nativeBridge()
  if (!bridge?.enable) return () => {}
  try {
    bridge.enable()
  } catch {
    return () => {}
  }
  return () => {
    try {
      bridge.disable?.()
    } catch {
      // A wrapper that cannot tear down is not worth breaking playback over
    }
  }
}

/**
 * Deterrents on a media surface: no context menu (so no "Save audio as…"), no
 * dragging the element out, no text selection over the artwork or watermark.
 *
 * These are speed bumps for casual copying. They do not stop anyone determined,
 * and they do nothing at all about screenshots.
 */
export function protectSurface(element: HTMLElement | null): () => void {
  if (!element) return () => {}

  const block = (event: Event) => event.preventDefault()

  element.addEventListener("contextmenu", block)
  element.addEventListener("dragstart", block)
  element.addEventListener("selectstart", block)
  element.style.setProperty("user-select", "none")
  element.style.setProperty("-webkit-user-select", "none")
  // iOS Safari long-press "Save Image"/callout menu
  element.style.setProperty("-webkit-touch-callout", "none")

  return () => {
    element.removeEventListener("contextmenu", block)
    element.removeEventListener("dragstart", block)
    element.removeEventListener("selectstart", block)
    element.style.removeProperty("user-select")
    element.style.removeProperty("-webkit-user-select")
    element.style.removeProperty("-webkit-touch-callout")
  }
}

/**
 * Remove the browser's own download/PiP affordances from a media element.
 *
 * `controlsList` and `disablePictureInPicture` are reflected as attributes by
 * some engines and ignored by others; setting both the property and attribute
 * is the portable form. Neither stops devtools or a proxy — see the matrix.
 */
export function hardenMediaElement(media: HTMLMediaElement | null): void {
  if (!media) return
  const el = media as HTMLMediaElement & {
    controlsList?: DOMTokenList
    disablePictureInPicture?: boolean
    disableRemotePlayback?: boolean
  }
  try {
    media.setAttribute("controlsList", "nodownload noplaybackrate")
    el.controlsList?.add?.("nodownload")
    media.setAttribute("disablePictureInPicture", "true")
    el.disablePictureInPicture = true
    // Casting a presigned URL to a speaker hands the URL to another device.
    media.setAttribute("disableRemotePlayback", "true")
    el.disableRemotePlayback = true
  } catch {
    // Older engines reject some of these; the rest still applied
  }
}

/**
 * Assign a stream URL by property rather than by React prop.
 *
 * Be precise about what this does and does not achieve. `src` is a reflected
 * IDL attribute, so after this call the live element DOES carry a `src`
 * attribute holding the presigned URL. Anyone with devtools can read it, and
 * the network tab would show it regardless. There is no way to hand a URL to a
 * media element and hide it from the page.
 *
 * What this buys us is narrower and still worth having: the URL never becomes a
 * React prop, so it is never serialised into the server-rendered HTML, never
 * captured in a component tree or an error boundary's props dump, and never
 * survives into a page snapshot. It stays in JS memory and on one element.
 *
 * Genuinely keeping it out of the DOM would mean buffering the whole file
 * through `fetch` into a blob URL (losing range requests and streaming) or
 * feeding an MSE `SourceBuffer`. Neither is worth it here: the URL is
 * deliberately not a secret. It lives 180 seconds and is bound to one live
 * session — that, not obscurity, is the protection.
 *
 * Never persist the URL to localStorage, history, or a log.
 */
export function assignStreamSource(media: HTMLMediaElement | null, url: string): void {
  if (!media) return
  media.removeAttribute("src")
  media.src = url
}

export function clearStreamSource(media: HTMLMediaElement | null): void {
  if (!media) return
  media.removeAttribute("src")
  media.src = ""
  try {
    media.load()
  } catch {
    // Detached element — nothing to reload
  }
}

/**
 * Watch for a genuine platform capture signal.
 *
 * If the host exposes nothing meaningful, this subscribes to nothing and
 * reports nothing. We do not synthesise a signal from heuristics: a fabricated
 * "recording detected" would be worse than no detection, because it would look
 * like protection while flagging innocent people.
 *
 * When a signal does exist, the caller reports it as a CAPTURE_SUSPECTED
 * playback event — a hint for a reviewing Guardian, weighted zero by the
 * backend, structurally unable to cost anyone access on its own.
 */
export function watchCaptureSignal(onCaptured: () => void): () => void {
  const bridge = nativeBridge()

  if (bridge?.onCaptureChange) {
    try {
      return bridge.onCaptureChange((captured) => {
        if (captured) onCaptured()
      })
    } catch {
      return () => {}
    }
  }

  // Some iOS builds expose screen.isCaptured. Where it exists it is real; where
  // it does not, we stay silent rather than guessing.
  const screenWithCapture = typeof window !== "undefined"
    ? (window.screen as Screen & { isCaptured?: boolean })
    : undefined
  const pollable =
    typeof bridge?.isCaptured === "function" ||
    (screenWithCapture !== undefined && typeof screenWithCapture.isCaptured === "boolean")
  if (!pollable) return () => {}

  let last = false
  const read = (): boolean => {
    try {
      if (typeof bridge?.isCaptured === "function") return bridge.isCaptured() === true
      return screenWithCapture?.isCaptured === true
    } catch {
      return false
    }
  }

  const timer = setInterval(() => {
    const now = read()
    // Report the transition only — one signal per capture, not one per poll
    if (now && !last) onCaptured()
    last = now
  }, 5000)

  return () => clearInterval(timer)
}

/**
 * Fire `onObscure` when the surface stops being in front of the user (tab
 * hidden, window blurred) and `onRestore` when it comes back.
 *
 * The player uses this to blur the artwork and pause. It is a deterrent against
 * "start recording, switch away, come back later" — not a capture defence, and
 * it does nothing while the tab is visible and being recorded.
 */
export function watchSurfaceVisibility(
  onObscure: () => void,
  onRestore: () => void,
): () => void {
  if (typeof document === "undefined") return () => {}

  let obscured = false
  const obscure = () => {
    if (obscured) return
    obscured = true
    onObscure()
  }
  const restore = () => {
    if (!obscured) return
    obscured = false
    onRestore()
  }

  const handleVisibility = () => {
    if (document.visibilityState === "hidden") obscure()
    else if (document.hasFocus()) restore()
  }

  document.addEventListener("visibilitychange", handleVisibility)
  window.addEventListener("blur", obscure)
  window.addEventListener("focus", restore)

  return () => {
    document.removeEventListener("visibilitychange", handleVisibility)
    window.removeEventListener("blur", obscure)
    window.removeEventListener("focus", restore)
  }
}

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

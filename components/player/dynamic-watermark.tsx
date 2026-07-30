"use client"

// Visible dynamic watermark overlay (Session 12, CEO framework area 3).
//
// Traceability, not prevention. A screen recording of a protected surface
// carries the listener's pseudonym, their session, and the time — so a leaked
// file can be traced to one account. Nothing here stops the recording; see
// docs/CONTENT-PROTECTION.md.
//
// Design constraints from the spec:
//   · ~0.25 opacity, subtle, never blocking the controls underneath
//   · position drifts and the content refreshes every 15s, so it cannot be
//     cropped out of a recording the way a fixed corner mark can
//   · several nodes, restored on tampering, so it is awkward to remove casually
//   · aria-hidden, never focusable, honours prefers-reduced-motion

import { useEffect, useRef, useState } from "react"
import { prefersReducedMotion } from "@/lib/screen-protection"
import { watermarkText, type WatermarkIdentity } from "@/lib/watermark"

const TILE_COUNT = 4
const DRIFT_INTERVAL_MS = 15_000
const CLOCK_INTERVAL_MS = 1_000
const INTEGRITY_INTERVAL_MS = 2_000

// Spread across the surface so no single crop removes them all. Server-rendered
// as-is; drift only starts after mount, so there is no hydration mismatch.
const ANCHORS = [
  { top: 16, left: 8 },
  { top: 38, left: 54 },
  { top: 66, left: 18 },
  { top: 84, left: 62 },
]

// Inline styles are re-asserted as !important by the integrity check, so a
// devtools tweak to opacity or display does not survive.
const TILE_CRITICAL_STYLE: Record<string, string> = {
  position: "absolute",
  opacity: "0.25",
  display: "block",
  visibility: "visible",
  "pointer-events": "none",
  "user-select": "none",
  "white-space": "nowrap",
  "font-family": "var(--font-mono, ui-monospace, monospace)",
  "font-size": "11px",
  "letter-spacing": "0.04em",
  "line-height": "1",
  color: "currentColor",
  "text-shadow": "0 1px 2px rgba(0,0,0,0.35)",
  "z-index": "40",
}

const ROOT_CRITICAL_STYLE: Record<string, string> = {
  position: "absolute",
  inset: "0",
  overflow: "hidden",
  display: "block",
  visibility: "visible",
  opacity: "1",
  "pointer-events": "none",
  "z-index": "40",
}

function applyCritical(el: HTMLElement, style: Record<string, string>) {
  for (const [prop, value] of Object.entries(style)) {
    if (el.style.getPropertyValue(prop) !== value || el.style.getPropertyPriority(prop) !== "important") {
      el.style.setProperty(prop, value, "important")
    }
  }
}

interface DynamicWatermarkProps {
  identity: WatermarkIdentity
  /** Set false to lift the overlay (e.g. no session, nothing protected on screen). */
  active?: boolean
  className?: string
}

export function DynamicWatermark({ identity, active = true, className }: DynamicWatermarkProps) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const tileRefs = useRef<Array<HTMLSpanElement | null>>([])
  const identityRef = useRef(identity)
  identityRef.current = identity

  const [offsets, setOffsets] = useState(() => ANCHORS.map(() => ({ dx: 0, dy: 0, rotate: -16 })))
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    setReducedMotion(prefersReducedMotion())
  }, [])

  // Live clock. Written straight to the DOM rather than through state so the
  // surrounding player does not re-render once a second.
  useEffect(() => {
    if (!active) return
    const paint = () => {
      const text = watermarkText(identityRef.current, new Date())
      for (const tile of tileRefs.current) {
        if (tile && tile.textContent !== text) tile.textContent = text
      }
    }
    paint()
    const timer = setInterval(paint, CLOCK_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [active, identity.pseudonym, identity.sessionLabel])

  // Drift: new positions every 15s. With reduced motion the jump is instant and
  // the travel is smaller, so there is no sliding text to track.
  useEffect(() => {
    if (!active) return
    const drift = () => {
      const spread = reducedMotion ? 4 : 10
      setOffsets(
        ANCHORS.map(() => ({
          dx: (Math.random() - 0.5) * 2 * spread,
          dy: (Math.random() - 0.5) * 2 * spread,
          rotate: reducedMotion ? -16 : -16 + (Math.random() - 0.5) * 10,
        })),
      )
    }
    const timer = setInterval(drift, DRIFT_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [active, reducedMotion])

  // Tamper resistance. Two layers, both restoring rather than recreating, so
  // React's tree stays valid: re-attach nodes that were detached, and re-assert
  // the styles that make the mark visible.
  useEffect(() => {
    if (!active) return
    const root = rootRef.current
    const surface = root?.parentElement
    if (!root || !surface) return

    const restore = () => {
      if (!surface.contains(root)) surface.appendChild(root)
      applyCritical(root, ROOT_CRITICAL_STYLE)
      tileRefs.current.forEach((tile) => {
        if (!tile) return
        if (!root.contains(tile)) root.appendChild(tile)
        applyCritical(tile, TILE_CRITICAL_STYLE)
      })
    }

    restore()

    // Detachment is watched on the surface; style tampering only on our own
    // subtree, so ordinary player updates (slider aria values on every
    // timeupdate) do not wake the observer four times a second.
    const detachObserver = new MutationObserver(restore)
    detachObserver.observe(surface, { childList: true })
    const styleObserver = new MutationObserver(restore)
    styleObserver.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["style", "class", "hidden"],
    })
    const timer = setInterval(restore, INTEGRITY_INTERVAL_MS)

    return () => {
      detachObserver.disconnect()
      styleObserver.disconnect()
      clearInterval(timer)
    }
  }, [active, offsets])

  if (!active) return null

  return (
    <div
      ref={rootRef}
      aria-hidden="true"
      data-watermark-root=""
      className={`absolute inset-0 overflow-hidden text-foreground ${className ?? ""}`}
      style={{ pointerEvents: "none" }}
    >
      {ANCHORS.map((anchor, i) => (
        <span
          key={i}
          ref={(el) => {
            tileRefs.current[i] = el
          }}
          data-watermark-tile={i}
          style={{
            top: `${anchor.top + offsets[i].dy}%`,
            left: `${anchor.left + offsets[i].dx}%`,
            transform: `rotate(${offsets[i].rotate}deg)`,
            transition: reducedMotion ? "none" : "top 4s linear, left 4s linear, transform 4s linear",
          }}
        />
      ))}
    </div>
  )
}

export default DynamicWatermark

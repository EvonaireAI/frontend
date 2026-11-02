// Per-browser identifier attached to playback metering calls. The backend
// hashes it; it is never derived from account data, so on its own it says
// nothing about who is signed in.
const DEVICE_ID_KEY = "evonaire_device_id"

/**
 * Read the stored device id, minting one on first use.
 *
 * Returns undefined outside the browser and when storage is unavailable.
 * Metering treats the field as optional, so a missing id must not throw.
 */
export function getDeviceId(): string | undefined {
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

/**
 * Drop the stored id.
 *
 * Logout calls this so two accounts used in the same browser cannot be
 * linked through the device id their metering calls carried. The next
 * session mints a fresh id, which keeps the anti-abuse signal scoped to a
 * single signed-in session instead of the whole browser profile.
 */
export function clearDeviceId(): void {
  if (typeof window === "undefined") return
  try {
    localStorage.removeItem(DEVICE_ID_KEY)
  } catch {
    // Storage unavailable: nothing was stored to clear.
  }
}

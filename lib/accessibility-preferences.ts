export type AccessibilityPreferences = {
  highContrast: boolean
  reducedMotion: boolean
  pausedAnimations: boolean
  biggerText: boolean
  biggerTextSpacing: boolean
  dyslexiaFriendly: boolean
}
  
  export const DEFAULT_A11Y_PREFERENCES: AccessibilityPreferences = {
    highContrast: false,
    reducedMotion: false,
    pausedAnimations: false,
    biggerText: false,
    biggerTextSpacing: false,
    dyslexiaFriendly: false,
  }

  function mergePreferences(value: unknown): AccessibilityPreferences {
    if (!value || typeof value !== "object") return DEFAULT_A11Y_PREFERENCES
    const v = value as Record<string, unknown>
    return {
      highContrast:
        typeof v.highContrast === "boolean" ? v.highContrast : DEFAULT_A11Y_PREFERENCES.highContrast,
      reducedMotion:
        typeof v.reducedMotion === "boolean" ? v.reducedMotion : DEFAULT_A11Y_PREFERENCES.reducedMotion,
      pausedAnimations:
        typeof v.pausedAnimations === "boolean"
          ? v.pausedAnimations
          : DEFAULT_A11Y_PREFERENCES.pausedAnimations,
      biggerText:
        typeof v.biggerText === "boolean" ? v.biggerText : DEFAULT_A11Y_PREFERENCES.biggerText,
      biggerTextSpacing:
        typeof v.biggerTextSpacing === "boolean"
          ? v.biggerTextSpacing
          : DEFAULT_A11Y_PREFERENCES.biggerTextSpacing,
      dyslexiaFriendly:
        typeof v.dyslexiaFriendly === "boolean"
          ? v.dyslexiaFriendly
          : DEFAULT_A11Y_PREFERENCES.dyslexiaFriendly,
    }
  }

const STORAGE_KEY = "evonaire-a11y-preferences"
  
  // Read saved prefs from localStorage, or return defaults if none/invalid.
  export function loadPreferences(): AccessibilityPreferences {
    if (typeof window === "undefined") return DEFAULT_A11Y_PREFERENCES
  
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return DEFAULT_A11Y_PREFERENCES
      const parsed: unknown = JSON.parse(raw)
      return mergePreferences(parsed)
    } catch {
      return DEFAULT_A11Y_PREFERENCES
    }
  }
  
  // Persist prefs whenever the user changes a toggle 
  export function savePreferences(prefs: AccessibilityPreferences): void {
    if (typeof window === "undefined") return
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
  }
  
  // Sync prefs to the document so CSS can react via [data-a11y-*] selectors
  export function applyAccessibilityPreferences(prefs: AccessibilityPreferences): void {
    if (typeof document === "undefined") return
    const root = document.documentElement
  
    root.toggleAttribute("data-a11y-high-contrast", prefs.highContrast)
    root.toggleAttribute("data-a11y-reduced-motion", prefs.reducedMotion)
    root.toggleAttribute("data-a11y-paused-animations", prefs.pausedAnimations)
    root.toggleAttribute("data-a11y-bigger-text", prefs.biggerText)
    root.toggleAttribute("data-a11y-bigger-spacing", prefs.biggerTextSpacing)
    root.toggleAttribute("data-a11y-dyslexia-friendly", prefs.dyslexiaFriendly)
  }
  

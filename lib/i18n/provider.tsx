"use client"

// Locale provider. Detection order on mount: evonaire_lang cookie, then
// navigator.languages, then English. Dictionaries load lazily per locale —
// the active locale's messages/<code>.json (plus fallback-chain files) is
// dynamic-imported, registered, then activated; the keyed Fragment remounts
// the subtree so every tr() call re-evaluates under the new dictionary.
// English needs no file: tr() falls back to the key itself.

import {
  createContext,
  Fragment,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react"
import {
  activateLocale,
  dirFor,
  fallbackChain,
  getActiveLocale,
  LOCALE_CODES,
  LOCALE_COOKIE,
  matchLocale,
  SOURCE_LOCALE,
  tr,
  type Locale,
} from "./runtime.ts"
import { hasDictionary, registerDictionary } from "./dictionaries.ts"

export interface I18nContextValue {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: typeof tr
}

const I18nContext = createContext<I18nContextValue>({
  locale: "en",
  setLocale: () => {},
  t: tr,
})

export function useI18n(): I18nContextValue {
  return useContext(I18nContext)
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null
  const prefix = `${name}=`
  for (const part of document.cookie.split(";")) {
    const trimmed = part.trim()
    if (trimmed.startsWith(prefix)) return decodeURIComponent(trimmed.slice(prefix.length))
  }
  return null
}

function detectLocale(): Locale {
  const saved = readCookie(LOCALE_COOKIE)
  if (saved) return matchLocale(saved)
  if (typeof navigator !== "undefined" && navigator.languages?.length) {
    for (const tag of navigator.languages) {
      const matched = matchLocale(tag)
      if (matched !== "en" || tag.toLowerCase().startsWith("en")) return matched
    }
  }
  return "en"
}

function applyDocumentLocale(locale: Locale): void {
  if (typeof document === "undefined") return
  document.documentElement.lang = locale
  document.documentElement.dir = dirFor(locale)
}

function persistLocale(locale: Locale): void {
  if (typeof document === "undefined") return
  document.cookie = `${LOCALE_COOKIE}=${encodeURIComponent(locale)};path=/;max-age=31536000;samesite=lax`
}

async function ensureDictionaries(locale: Locale): Promise<void> {
  const needed = fallbackChain(locale).filter(
    (code) =>
      code !== SOURCE_LOCALE &&
      LOCALE_CODES.has(code) &&
      !hasDictionary(code),
  )
  await Promise.all(
    needed.map(async (code) => {
      try {
        const mod = (await import(`../../messages/${code}.json`)) as {
          default: Record<string, string>
        }
        registerDictionary(code, mod.default)
      } catch {
        // Chunk failed to load — tr() keeps falling back to English for
        // this locale rather than breaking the page.
      }
    }),
  )
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en")
  const requestRef = useRef(0)

  const applyLocale = async (next: Locale, persist: boolean) => {
    const req = ++requestRef.current
    await ensureDictionaries(next)
    if (requestRef.current !== req) return
    activateLocale(next)
    if (persist) persistLocale(next)
    applyDocumentLocale(next)
    setLocaleState(next)
  }

  useEffect(() => {
    void applyLocale(detectLocale(), false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const setLocale = (next: Locale) => {
    void applyLocale(next, true)
  }

  return (
    <I18nContext.Provider value={{ locale, setLocale, t: tr }}>
      {/* key remounts the whole subtree on locale change so tr() readers
          re-render; providers above this boundary keep their state. */}
      <Fragment key={locale}>{children}</Fragment>
    </I18nContext.Provider>
  )
}

export { getActiveLocale }

// Active-locale runtime for Evonaire UI strings.
//
// English is the source language: message keys ARE the English strings, so a
// missing translation falls back to the key itself and the UI never breaks.
// tr() looks a key up in the active locale's dictionary (messages/<locale>.json),
// walks the fallback chain (e.g. zh-Hant -> zh-Hans -> en), then interpolates
// {name} placeholders.
//
// This module is isomorphic: it imports no React and no client-only APIs, so
// server components, client components, and plain .ts helpers can all call
// tr(). On the server the active locale is always English; the client
// I18nProvider activates the detected/saved locale after hydration and
// remounts the tree so every tr() call re-evaluates.

import { createElement, Fragment, type ReactNode } from "react"
import { DICTIONARIES } from "./dictionaries.ts"

export const SOURCE_LOCALE = "en"

export interface LocaleMeta {
  code: string
  /** Name shown in the picker, in the language itself. */
  nativeName: string
  dir: "ltr" | "rtl"
}

export const LOCALES: readonly LocaleMeta[] = [
  { code: "en", nativeName: "English", dir: "ltr" },
  { code: "es", nativeName: "Español", dir: "ltr" },
  { code: "fr", nativeName: "Français", dir: "ltr" },
  { code: "de", nativeName: "Deutsch", dir: "ltr" },
  { code: "pt", nativeName: "Português", dir: "ltr" },
  { code: "it", nativeName: "Italiano", dir: "ltr" },
  { code: "nl", nativeName: "Nederlands", dir: "ltr" },
  { code: "pl", nativeName: "Polski", dir: "ltr" },
  { code: "sv", nativeName: "Svenska", dir: "ltr" },
  { code: "uk", nativeName: "Українська", dir: "ltr" },
  { code: "ru", nativeName: "Русский", dir: "ltr" },
  { code: "tr", nativeName: "Türkçe", dir: "ltr" },
  { code: "ar", nativeName: "العربية", dir: "rtl" },
  { code: "fa", nativeName: "فارسی", dir: "rtl" },
  { code: "hi", nativeName: "हिन्दी", dir: "ltr" },
  { code: "ja", nativeName: "日本語", dir: "ltr" },
  { code: "ko", nativeName: "한국어", dir: "ltr" },
  { code: "zh-Hans", nativeName: "简体中文", dir: "ltr" },
  { code: "zh-Hant", nativeName: "繁體中文", dir: "ltr" },
  { code: "vi", nativeName: "Tiếng Việt", dir: "ltr" },
  { code: "th", nativeName: "ไทย", dir: "ltr" },
  { code: "id", nativeName: "Indonesia", dir: "ltr" },
] as const

export type Locale = (typeof LOCALES)[number]["code"]

export const LOCALE_CODES = new Set<string>(LOCALES.map((l) => l.code))
const LOCALE_DIRS = new Map(LOCALES.map((l) => [l.code, l.dir]))

export const LOCALE_COOKIE = "evonaire_lang"

// Extra fallbacks beyond the base-language strip. Traditional Chinese readers
// generally also read Simplified, so zh-Hant degrades to zh-Hans before en.
const EXTRA_FALLBACKS: Record<string, string[]> = {
  "zh-Hant": ["zh-Hans"],
}

/** Map a BCP-47 tag (navigator.languages entry, cookie value) to a supported
 *  locale code, falling back to English. */
export function matchLocale(tag: string | null | undefined): Locale {
  if (!tag) return SOURCE_LOCALE
  const norm = tag.trim().toLowerCase().replace(/_/g, "-")
  if (!norm) return SOURCE_LOCALE
  for (const l of LOCALES) {
    if (l.code.toLowerCase() === norm) return l.code
  }
  const [base, region] = norm.split("-")
  if (base === "zh") {
    if (norm.includes("hant") || region === "tw" || region === "hk" || region === "mo") {
      return "zh-Hant"
    }
    return "zh-Hans"
  }
  if (base && LOCALE_CODES.has(base)) return base as Locale
  return SOURCE_LOCALE
}

export function fallbackChain(locale: string): string[] {
  const chain: string[] = [locale]
  for (const extra of EXTRA_FALLBACKS[locale] ?? []) chain.push(extra)
  const base = locale.split("-")[0]
  if (base !== locale) chain.push(base)
  chain.push(SOURCE_LOCALE)
  return [...new Set(chain)]
}

// ── Active dictionary state ──────────────────────────────────────────────────
// Module-level on purpose: tr() must work inside plain functions, event
// handlers, and non-component modules without a hook. The I18nProvider keeps
// this in sync and remounts the tree on change, so staleness cannot occur
// inside React renders.

let activeLocale: Locale = SOURCE_LOCALE
let activeChain: Record<string, string>[] = [DICTIONARIES[SOURCE_LOCALE]]

export function activateLocale(locale: string): void {
  const matched = LOCALE_CODES.has(locale) ? (locale as Locale) : matchLocale(locale)
  activeLocale = matched
  activeChain = fallbackChain(matched)
    .map((code) => DICTIONARIES[code])
    .filter((d): d is Record<string, string> => !!d)
}

export function getActiveLocale(): Locale {
  return activeLocale
}

/** BCP-47 tag for Intl.DateTimeFormat/NumberFormat under the active locale. */
export function fmtLocale(): string {
  return activeLocale
}

export function dirFor(locale: string): "ltr" | "rtl" {
  return LOCALE_DIRS.get(locale as Locale) ?? "ltr"
}

// ── Translation ──────────────────────────────────────────────────────────────

// React renders nothing for null/undefined/booleans; String() would print
// "false"/"null", so interpolation maps them to "".
function varToString(value: unknown): string {
  if (value === null || value === undefined || typeof value === "boolean") return ""
  return String(value)
}

function interpolate(text: string, vars?: Record<string, unknown>): string {
  if (!vars) return text
  return text.replace(/\{(\w+)\}/g, (match, name) =>
    name in vars ? varToString(vars[name]) : match,
  )
}

/** Translate an English source string. `vars` fills {name} placeholders.
 *  Keys are looked up trimmed; leading/trailing whitespace on the key is
 *  layout spacing (e.g. " now" beside an inline element) and is re-attached
 *  around the translation so word-order differences can't eat it. */
export function tr(key: string, vars?: Record<string, unknown>): string {
  if (!key) return key
  const core = key.trim()
  const lead = /^\s/.test(key) ? " " : ""
  const trail = /\s$/.test(key) && core.length > 0 ? " " : ""
  for (const dict of activeChain) {
    const hit = dict[core] ?? dict[key]
    if (hit !== undefined) {
      return lead + interpolate(hit, vars).trim() + trail
    }
  }
  return interpolate(key, vars)
}

const PRIMITIVE_VAR = new Set(["string", "number", "bigint", "boolean", "undefined"])

function isPrimitiveVar(value: unknown): boolean {
  return value === null || PRIMITIVE_VAR.has(typeof value)
}

/** Like tr(), but safe for JSX expression children that may evaluate to
 *  React elements. When every var is a primitive it returns an interpolated
 *  string (word order from the translation applies). When any var is an
 *  element/object it splits the translated template on the placeholders and
 *  returns a Fragment that interleaves the raw values, so "{p0} results"
 *  can still reorder around a non-text child. */
export function trNode(
  key: string,
  vars?: Record<string, unknown>,
): ReactNode {
  const resolved = tr(key) // translated template, edge spaces handled
  if (!vars) return resolved
  const entries = Object.entries(vars)
  if (entries.every(([, v]) => isPrimitiveVar(v))) {
    return interpolate(resolved, vars)
  }
  const nodes: ReactNode[] = []
  const pattern = /\{(\w+)\}/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = pattern.exec(resolved))) {
    if (m.index > last) nodes.push(resolved.slice(last, m.index))
    const name = m[1]
    nodes.push(name in vars ? (vars[name] as ReactNode) : m[0])
    last = m.index + m[0].length
  }
  if (last < resolved.length) nodes.push(resolved.slice(last))
  return createElement(Fragment, null, ...nodes.filter((n) => n !== ""))
}

/** Wrap an object of UI strings so every string value is translated on access.
 *  Use for label/status maps that are read at render time. */
export function trMap<T extends Record<string, unknown>>(obj: T): T {
  return new Proxy(obj, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver)
      return typeof value === "string" ? tr(value) : value
    },
  })
}

/** Wrap an array of UI strings so each element is translated on access. */
export function trList<T extends readonly string[]>(list: T): T {
  return new Proxy(list, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver)
      return typeof value === "string" ? tr(value) : value
    },
  })
}

/** Structural strings pass through untranslated: routes (/member), URLs,
 *  and utility-class strings ("bg-red-900/30 text-red-400") appear inside
 *  trDeep'd constants, and localizing them breaks navigation and styling.
 *  A string is structural when it starts with "/" or every whitespace-
 *  separated token is "codey" (contains a digit, -, _, /, ., or :). */
const STRUCTURAL_TOKEN = /^[\w]*[-_/.:0-9][\w\-./:]*$/

function isStructural(text: string): boolean {
  if (text.startsWith("/") || /^https?:/i.test(text)) return true
  const tokens = text.trim().split(/\s+/).filter(Boolean)
  return tokens.length >= 2 && tokens.every((t) => STRUCTURAL_TOKEN.test(t))
}

/** Deep variant of trMap for nested label structures (arrays of objects with
 *  label/value pairs). Strings translate on access at any depth; functions
 *  and other values pass through. Apply to module-level constants — calling
 *  tr() inside a top-level literal would freeze English because modules
 *  evaluate before the provider activates a locale. */
export function trDeep<T>(value: T): T {
  if (typeof value === "string") {
    return (isStructural(value) ? value : tr(value)) as T
  }
  if (Array.isArray(value)) {
    return new Proxy(value, {
      get(target, prop, receiver) {
        return trDeep(Reflect.get(target, prop, receiver))
      },
    }) as T
  }
  if (value !== null && typeof value === "object") {
    const proto = Object.getPrototypeOf(value)
    // Only plain objects get proxied — class instances, Dates, Maps and
    // React elements ($$typeof) must pass through untouched.
    if ((proto === Object.prototype || proto === null) && !("$$typeof" in value)) {
      return new Proxy(value as object, {
        get(target, prop, receiver) {
          return trDeep(Reflect.get(target, prop, receiver))
        },
      }) as T
    }
  }
  return value
}

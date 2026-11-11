// Locale-aware date/time formatting. Wraps Intl.DateTimeFormat so month
// names, ordering, and hour cycles follow the active UI locale instead of
// date-fns' always-English output. Pattern keys mirror the date-fns format
// strings this codebase already uses; the mapping is deliberate — each
// pattern becomes fixed Intl options and CLDR handles per-language order.
//
// English is unaffected: fmtLocale() is "en" until the provider activates
// another locale, and en-US Intl output matches the old date-fns strings.

import { fmtLocale } from "./runtime.ts"

export type DatePattern =
  | "MMM d, yyyy"
  | "MMMM d, yyyy"
  | "d MMMM yyyy"
  | "MMM d, yyyy h:mm a"
  | "d MMM yyyy"
  | "d MMM yyyy, HH:mm"
  | "d MMMM"
  | "MMMM d"
  | "MMM d"

const OPTIONS: Record<DatePattern, Intl.DateTimeFormatOptions> = {
  "MMM d, yyyy": { month: "short", day: "numeric", year: "numeric" },
  "MMMM d, yyyy": { month: "long", day: "numeric", year: "numeric" },
  "d MMMM yyyy": { day: "numeric", month: "long", year: "numeric" },
  "MMM d, yyyy h:mm a": {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
  },
  "d MMM yyyy": { day: "numeric", month: "short", year: "numeric" },
  "d MMM yyyy, HH:mm": {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: false,
  },
  "d MMMM": { day: "numeric", month: "long" },
  "MMMM d": { month: "long", day: "numeric" },
  "MMM d": { month: "short", day: "numeric" },
}

const rtfCache = new Map<string, Intl.RelativeTimeFormat>()

const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 31536000],
  ["month", 2592000],
  ["day", 86400],
  ["hour", 3600],
  ["minute", 60],
]

/** "3 days ago"-style relative time under the active locale. Returns "" for
 *  invalid dates. Equivalent to date-fns formatDistanceToNow(addSuffix). */
export function formatRelativeTime(date: Date | number | string): string {
  const d = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(d.getTime())) return ""
  const diffSec = (d.getTime() - Date.now()) / 1000
  const abs = Math.abs(diffSec)
  const [unit, secs] = RELATIVE_UNITS.find(([, s]) => abs >= s) ?? ["second", 1]
  const key = fmtLocale()
  let rtf = rtfCache.get(key)
  if (!rtf) {
    rtf = new Intl.RelativeTimeFormat(key, { numeric: "auto" })
    rtfCache.set(key, rtf)
  }
  return rtf.format(Math.round(diffSec / secs), unit)
}

const cache = new Map<string, Intl.DateTimeFormat>()

function formatterFor(pattern: DatePattern): Intl.DateTimeFormat {
  const key = `${pattern}|${fmtLocale()}`
  let f = cache.get(key)
  if (!f) {
    f = new Intl.DateTimeFormat(fmtLocale(), OPTIONS[pattern])
    cache.set(key, f)
  }
  return f
}

/** Format a date under the active locale. Returns "" for invalid dates so
 *  callers don't print "Invalid Date". */
export function formatDate(
  date: Date | number | string,
  pattern: DatePattern,
): string {
  const d = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(d.getTime())) return ""
  return formatterFor(pattern).format(d)
}

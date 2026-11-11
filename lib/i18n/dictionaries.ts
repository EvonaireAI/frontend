// Locale dictionary registry. Each messages/<locale>.json is a flat map of
// English source string -> translation. English itself needs no dictionary:
// tr() falls back to the key.
//
// Dictionaries are NOT imported eagerly: all 21 locales would add ~2 MB of
// JSON to every page load for a feature most visitors never switch to. The
// I18nProvider dynamic-imports only the active locale's file (and its
// fallback chain's) and registers it here before activating the locale.
// Until a dictionary lands, tr() falls back to English keys — never breaks.

export const DICTIONARIES: Record<string, Record<string, string>> = {
  en: {},
}

export function registerDictionary(
  locale: string,
  dict: Record<string, string>,
): void {
  DICTIONARIES[locale] = dict
}

export function hasDictionary(locale: string): boolean {
  return locale in DICTIONARIES
}

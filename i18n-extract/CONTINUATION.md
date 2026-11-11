# i18n feature build, continuation checkpoint (2026-11-10 ~17:10 EST)

The user asked to feature-build translations for all languages. The prior run was interrupted mid-translation and this session resumed it.

## Architecture

The runtime is English-as-key `tr()`/`trNode()` in `lib/i18n/runtime.ts` with `trMap`, `trList`, and `trDeep` proxies. `trDeep` now skips structural strings such as routes and CSS class tokens via `isStructural`, so translated values cannot break hrefs or styles. `I18nProvider` in `lib/i18n/provider.tsx` reads the `evonaire_lang` cookie, then navigator.languages. It lazy-imports `messages/<loc>.json` on demand. After loading it calls `activateLocale` and remounts the tree on a keyed Fragment. Mounting happens in `components/app-shell.tsx` on both the standalone and shell paths. Dates go through `formatDate` and `formatRelativeTime` in `lib/i18n/datetime.ts`. `fmtLocale()` feeds the remaining toLocale calls. The picker is `components/language-switcher.tsx` in the nav. There are 22 locales including English. English has no dictionary and falls back to the key.

## Codemods

The original `scripts/i18n-codemod.mjs` pass wrapped JSX children. `i18n-codemod2.mjs` covered throws and setters. `i18n-dates.mjs` swapped date-fns calls. I added `i18n-codemod3.mjs` for component props such as label and title. A later relaxation made single-word labels wrap and kept capitalized tags like Link out of the skip set. `i18n-codemod4.mjs` covers prose template literals and attribute-ternary literals by mapping expressions to {pN} vars. Non-prose values are skipped there. FILTER_RE and VERBOSE env vars are supported. Page-level setter calls got hand-wrapped. DescribeDenial and the begin-here suggestion object got wrapped too. One detail field in lib/admin.ts got wrapped. The chat widget got a trDeep wrap. Gift-dialog and studio-status-strip each got wraps. The payouts page now calls formatRelativeTime.

## Verification

`npx tsc --noEmit` is clean. `npm test` is 149/149. `next build` produces all 48 routes. `next dev` cannot hydrate under the committed CSP because unsafe-eval is absent. Verify only on `next build` then `npx next start -p 4000`. The new `evonaire-platform-matrix/matrix-i18n.mjs` passed 7/7 on the production build. Coverage includes navigator detection for de and ja. Coverage includes cookie selection for fr and ar with dir=rtl. Coverage includes the eo fallback to en. Coverage includes the zh-TW mapping to zh-Hant. Coverage includes a switcher click producing French text and the cookie.

## Translation state

`/tmp/needed-keys.json` holds the authoritative 1862-key set (fk2 plus scanned literals plus prop-keys plus template-keys). On disk, 19 locales sit at 1390 keys from the earlier codex run. Th is at 1200. Id is empty. A serial ollama run is translating into the staging dir `/tmp/i18n-new/`. The runner is `/tmp/run-i18n-ollama.sh` on gemma4-abliterated:12b with log `/tmp/i18n-ollama.log`. The workdir is `/tmp/i18n-work-delta` with cached glossaries. Both the codex and claude CLIs are rate-limited. Codex resets about 18:45 EST and claude at 4am. `scripts/i18n-translate.py` accepts `TRANSLATE_BACKEND=ollama` with `OLLAMA_MODEL` to switch backends. Checkpoints survive a swap. The earlier HTTP 500s came from `--workers 4`, so keep `--workers 1`. The ar and de delta chunks are done.

After this run each locale still lacks about 220 keys (the newer key groups are not in the keys-*.json files). Rebuild the missing set from needed-keys.json versus merged dicts, then run a second pass in a FRESH workdir because chunk checkpoint names collide across different keysets. Merge with `python3 /tmp/merge-i18n.py`. That script unions staging into messages/, self-maps structural keys, and rewrites /tmp/missing-per-locale.json. Dictionary backup sits at /tmp/messages-backup-1794346893.

## Remaining

Let the serial run finish all three phases, then merge and run the second pass. Spot-check ollama output quality. The script validates placeholder preservation. It translated routes like /commons, but the merge self-maps structural keys so that is safe. Regenerate `i18n-extract/keys.json` (currently []) from needed-keys.json. Gaps to report in the final message, backend API error strings stay English (Django has no LocaleMiddleware). SSR metadata titles stay English. The '/ month' and '/mo' keys translate through tr() even though they match isStructural, which only affects trDeep.

## Gotchas

Never import `@/lib/i18n` inside lib/*.ts. Use `./i18n/index.ts` because the node --test loader only resolves relative paths with extensions. The `useChart`-style context guards under components/ui/ are dev-only and excluded. Page metadata in layout.tsx and verify/[claimToken] stays English by design (server-rendered).

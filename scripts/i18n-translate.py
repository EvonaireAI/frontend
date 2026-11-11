#!/usr/bin/env python3
"""Generate messages/<locale>.json dictionaries for the Evonaire i18n runtime.

Each dictionary maps the English source string (the tr() key) to its
translation. Keys are extracted from tr()/trNode() call sites and trDeep()
label structures; English needs no file because tr() falls back to the key.

Translation is delegated to `codex exec` (ChatGPT subscription CLI) in
read-only mode. Phase A translates a fixed product glossary once per locale;
phase B translates key chunks, each prompt carrying that locale's glossary so
role/feature names stay consistent across chunks. Outputs are validated for
key coverage and {pN} placeholder preservation, checkpointed under --workdir,
and merged into messages/<locale>.json.

Usage:
  python3 scripts/i18n-translate.py --keys /tmp/final-keys.json \
      --outdir messages --locales de,fr --workers 6
  python3 scripts/i18n-translate.py --keys /tmp/final-keys.json \
      --outdir messages            # all 21 locales
"""

import argparse
import concurrent.futures
import json
import os
import re
import subprocess
import sys
import time
from pathlib import Path

LANGUAGE_NAMES = {
    "es": "Spanish (español)",
    "fr": "French (français)",
    "de": "German (Deutsch)",
    "pt": "Portuguese (Brazilian)",
    "it": "Italian (italiano)",
    "nl": "Dutch (Nederlands)",
    "pl": "Polish (polski)",
    "sv": "Swedish (svenska)",
    "uk": "Ukrainian (українська)",
    "ru": "Russian (русский)",
    "tr": "Turkish (Türkçe)",
    "ar": "Arabic (العربية)",
    "fa": "Persian/Farsi (فارسی)",
    "hi": "Hindi (हिन्दी)",
    "ja": "Japanese (日本語)",
    "ko": "Korean (한국어)",
    "zh-Hans": "Simplified Chinese (简体中文)",
    "zh-Hant": "Traditional Chinese (繁體中文)",
    "vi": "Vietnamese (Tiếng Việt)",
    "th": "Thai (ไทย)",
    "id": "Indonesian (Bahasa Indonesia)",
}

ALL_LOCALES = list(LANGUAGE_NAMES)

# Product vocabulary that must translate identically everywhere it appears.
# Proper nouns map to themselves; everything else gets a real translation.
GLOSSARY_TERMS = [
    "Evonaire", "Gaia", "Bluesky", "Stripe", "RTS",
    "Wanderer", "Seeker", "Scholar", "Scholars", "Creator", "Guardian",
    "Steward", "Seeker (D1)", "Creator (D2)", "Guardian (D3)", "Steward (D4)",
    "The Commons", "Commons", "Sanctuary", "Sanctuaries", "My Sanctuary",
    "Ritual", "Rituals", "My Rituals", "The Archive", "Sacred Library",
    "Agora", "The Ledger", "Gateway", "Reflection Room", "Symposium",
    "Care Feed", "Care Cases", "Active Cases", "Pending Reviews",
    "Guardian Dashboard", "Steward Console", "Steward Requests",
    "Resonance Trust Synthesis", "Claim Chain", "Circle", "Circles",
    "Blessing", "Blessings", "Provenance", "Gateway Quiz", "Member",
    "Moderator", "Admin", "Superadmin", "Dashboard", "Library",
    "Marketing", "Billing", "Earnings", "Payouts", "Subscription",
    "Free plan", "Sustainer plan", "AI insights", "Fine-tuning",
    "Dataset reuse", "Redistribution", "No AI training",
]

GLOSSARY_PROMPT = """You are a professional software localizer preparing a terminology base for the Evonaire platform (a wellness and community app: members hold "sanctuaries" and "rituals", creators earn royalties, staff use "Guardian"/"Steward" moderation dashboards, "The Commons" is a listing marketplace, plans are Wanderer/Seeker/Scholar and roles are Seeker/Creator/Guardian/Steward).

Translate each term below into {language}. Rules:
- Return ONLY a JSON object mapping each English term to its {language} form.
- Keep brand/product names untranslated when that is the natural choice for {language} UI: "Evonaire", "Gaia", "Bluesky", "Stripe", "RTS", "Agora", "Gateway" may stay in English if the language commonly keeps such names; otherwise translate naturally.
- Role and plan names (Wanderer, Seeker, Scholar, Creator, Guardian, Steward and the "(D1)"-"(D4)" forms) SHOULD be translated — they are product roles, not brands.
- Feature names (The Commons, Sanctuary, Ritual, The Archive, Sacred Library, Reflection Room, Symposium, Care Feed, etc.) SHOULD be translated consistently as feature names.
- Keep every "(Dn)" suffix and capitalization style appropriate to {language}.
- No markdown fences, no commentary.

Terms (JSON array):
{terms_json}

JSON object:"""

PROMPT_TEMPLATE = """You are a professional software localizer. Translate the English UI strings below from the Evonaire platform into {language}. Evonaire is a wellness and community platform: members hold "sanctuaries" and "rituals", creators earn royalties, and staff use "Guardian"/"Steward" moderation dashboards. The "Commons" is a marketplace for listings.

Approved terminology for this language — use these exact forms wherever the corresponding concept appears:
{glossary_json}

Rules:
- Return ONLY a JSON object. Every key must be one of the exact English strings listed; the value is its translation.
- Preserve every {{p0}}, {{p1}}, ... placeholder token exactly — same names, same count per string. You may reorder placeholders if the target grammar requires it.
- Do NOT translate keys, do NOT add or drop keys, do NOT wrap the JSON in markdown fences or add commentary.
- Keep untranslated: "Evonaire", "Gaia", "Bluesky", "RTS", URLs, file paths, and CSS-like tokens. Currency markers like "${{p0}}/mo" keep the "$" and "{{p0}}" and "/mo" structure — translate only surrounding words.
- Match the source register: button labels and menu items stay terse; sentences stay sentences. Strings that are fragments (leading/trailing spaces were trimmed, e.g. "/ month", " now") must still read correctly in context.
- Use the © character where the source has it.
- For languages written right-to-left (Arabic, Persian) still output the JSON in normal key order; only the values are RTL.

English strings (JSON array):
{keys_json}

JSON object:"""

PLACEHOLDER_RE = re.compile(r"\{(\w+)\}")
FENCE_RE = re.compile(r"^```(?:json)?\s*|\s*```$", re.MULTILINE)


def placeholders(text: str) -> set:
    return set(PLACEHOLDER_RE.findall(text))


def extract_json(text: str) -> dict:
    text = FENCE_RE.sub("", text.strip())
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise ValueError("no JSON object in output")
    return json.loads(text[start : end + 1])


def run_codex(prompt: str, out_file: Path, timeout: int) -> str:
    cmd = [
        "codex", "exec",
        "--skip-git-repo-check",
        "--sandbox", "read-only",
        "--output-last-message", str(out_file),
        prompt,
    ]
    proc = subprocess.run(
        cmd,
        stdin=subprocess.DEVNULL,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        timeout=timeout,
        cwd="/tmp",
    )
    if proc.returncode != 0:
        raise RuntimeError(f"codex exit {proc.returncode}")
    return out_file.read_text(encoding="utf-8")


# Local fallback: TRANSLATE_BACKEND=ollama OLLAMA_MODEL=qwen3.6:35b-a3b routes
# the same prompts through localhost:11434 instead of the codex CLI.
def run_ollama(prompt: str, out_file: Path, timeout: int) -> str:
    import urllib.request
    model = os.environ.get("OLLAMA_MODEL", "qwen3.6:35b-a3b")
    body = json.dumps({
        "model": model,
        "prompt": prompt,
        "stream": False,
        "think": False,
        "options": {"temperature": 0.2, "num_predict": 8192},
    }).encode("utf-8")
    req = urllib.request.Request(
        "http://localhost:11434/api/generate", data=body,
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    text = data.get("response", "")
    if not text.strip():
        raise RuntimeError("ollama returned empty response")
    out_file.write_text(text, encoding="utf-8")
    return text


def run_llm(prompt: str, out_file: Path, timeout: int) -> str:
    if os.environ.get("TRANSLATE_BACKEND") == "ollama":
        return run_ollama(prompt, out_file, timeout)
    return run_codex(prompt, out_file, timeout)


def ensure_glossary(locale: str, workdir: Path, timeout: int) -> dict:
    ckpt = workdir / f"glossary__{locale}.json"
    if ckpt.exists():
        try:
            data = json.loads(ckpt.read_text(encoding="utf-8"))
            if isinstance(data, dict) and len(data) >= len(GLOSSARY_TERMS) * 0.8:
                return data
        except Exception:
            pass
    prompt = GLOSSARY_PROMPT.format(
        language=LANGUAGE_NAMES[locale],
        terms_json=json.dumps(GLOSSARY_TERMS, ensure_ascii=False),
    )
    out_file = workdir / f"glossary__{locale}.last.txt"
    last_exc = None
    for attempt in range(3):
        try:
            raw = run_llm(prompt, out_file, timeout)
            data = extract_json(raw)
            if isinstance(data, dict):
                ckpt.write_text(json.dumps(data, ensure_ascii=False, indent=1,
                                           sort_keys=True), encoding="utf-8")
                return data
        except Exception as exc:
            last_exc = exc
            time.sleep(5 * (attempt + 1))
    raise RuntimeError(f"glossary failed for {locale}: {last_exc}")


def translate_chunk(locale: str, glossary: dict, chunk: list[str],
                    workdir: Path, timeout: int) -> tuple[dict, list[str]]:
    language = LANGUAGE_NAMES[locale]
    prompt = PROMPT_TEMPLATE.format(
        language=language,
        glossary_json=json.dumps(glossary, ensure_ascii=False, indent=1,
                                 sort_keys=True),
        keys_json=json.dumps(chunk, ensure_ascii=False),
    )
    out_file = workdir / f"chunk__{locale}__{abs(hash(tuple(chunk))) & 0xFFFFFFFF:x}.last.txt"
    raw = run_llm(prompt, out_file, timeout)
    data = extract_json(raw)
    if not isinstance(data, dict):
        raise ValueError("top-level value is not an object")

    good, problems = {}, []
    wanted = set(chunk)
    for key in chunk:
        val = data.get(key)
        if val is None:
            problems.append(f"missing key: {key[:60]!r}")
            continue
        if not isinstance(val, str) or not val.strip():
            problems.append(f"empty/non-string value for {key[:60]!r}")
            continue
        if placeholders(key) != placeholders(val):
            problems.append(
                f"placeholder mismatch for {key[:60]!r}: "
                f"{sorted(placeholders(key))} -> {sorted(placeholders(val))}"
            )
            continue
        good[key] = val
    extra = set(data) - wanted
    if extra:
        problems.append(f"{len(extra)} unexpected keys dropped")
    return good, problems


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--keys", required=True, help="JSON array of English keys")
    ap.add_argument("--outdir", default="messages")
    ap.add_argument("--locales", default=",".join(ALL_LOCALES))
    ap.add_argument("--workers", type=int, default=6)
    ap.add_argument("--chunk-size", type=int, default=200)
    ap.add_argument("--timeout", type=int, default=300)
    ap.add_argument("--workdir", default="/tmp/i18n-translate-work")
    args = ap.parse_args()

    keys = json.loads(Path(args.keys).read_text(encoding="utf-8"))
    locales = [l.strip() for l in args.locales.split(",") if l.strip()]
    for l in locales:
        if l not in LANGUAGE_NAMES:
            print(f"skip unknown locale {l}", file=sys.stderr)
            sys.exit(2)
    workdir = Path(args.workdir)
    workdir.mkdir(parents=True, exist_ok=True)
    outdir = Path(args.outdir)
    outdir.mkdir(parents=True, exist_ok=True)

    # Phase A: per-locale glossaries (cached in workdir).
    glossaries: dict[str, dict] = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
        futs = {pool.submit(ensure_glossary, l, workdir, args.timeout): l
                for l in locales}
        for fut in concurrent.futures.as_completed(futs):
            loc = futs[fut]
            try:
                glossaries[loc] = fut.result()
                print(f"glossary {loc}: {len(glossaries[loc])} terms", flush=True)
            except Exception as exc:
                print(f"glossary {loc} FAILED: {exc}", file=sys.stderr, flush=True)
    if len(glossaries) != len(locales):
        print("aborting: missing glossaries", file=sys.stderr)
        return 1

    # Phase B: all (locale, chunk) tasks in one pool.
    tasks = []
    for locale in locales:
        for idx in range(0, len(keys), args.chunk_size):
            tasks.append((locale, idx // args.chunk_size,
                          keys[idx : idx + args.chunk_size]))

    def run_task(task):
        locale, cidx, chunk = task
        ckpt = workdir / f"chunk__{locale}__{cidx:02d}.json"
        if ckpt.exists():
            try:
                saved = json.loads(ckpt.read_text(encoding="utf-8"))
                if isinstance(saved, dict) and saved.get("__ok__"):
                    return locale, cidx, saved["data"], []
            except Exception:
                pass
        last_exc, good, problems = None, {}, []
        for attempt in range(2):
            try:
                good, problems = translate_chunk(
                    locale, glossaries[locale], chunk, workdir, args.timeout)
            except Exception as exc:
                last_exc = str(exc)
                time.sleep(5 * (attempt + 1))
                continue
            if len(good) / len(chunk) >= 0.98 or attempt == 1:
                ckpt.write_text(json.dumps(
                    {"__ok__": True, "data": good}, ensure_ascii=False))
                return locale, cidx, good, problems
            time.sleep(3)
        return locale, cidx, {}, [f"chunk failed after retries: {last_exc}"]

    per_locale: dict[str, dict] = {l: {} for l in locales}
    all_problems: dict[str, list] = {l: [] for l in locales}
    done = 0
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
        for locale, cidx, data, problems in pool.map(run_task, tasks):
            per_locale[locale].update(data)
            all_problems[locale].extend(f"chunk{cidx}: {p}" for p in problems)
            done += 1
            if done % 10 == 0 or done == len(tasks):
                print(f"progress {done}/{len(tasks)} chunks", flush=True)

    report = {}
    rc = 0
    for locale in locales:
        merged = per_locale[locale]
        problems = all_problems[locale]
        out = outdir / f"{locale}.json"
        out.write_text(json.dumps(merged, ensure_ascii=False, indent=1,
                                  sort_keys=True) + "\n", encoding="utf-8")
        report[locale] = {"keys": len(merged), "of": len(keys),
                          "problems": len(problems)}
        flag = "" if len(merged) == len(keys) else "  <-- INCOMPLETE"
        print(f"{locale}: {len(merged)}/{len(keys)} keys, "
              f"{len(problems)} problems{flag}", flush=True)
        for p in problems[:8]:
            print(f"    ! {p}", flush=True)
        if len(merged) < len(keys):
            rc = 1

    (workdir / "report.json").write_text(
        json.dumps(report, indent=2), encoding="utf-8")
    return rc


if __name__ == "__main__":
    sys.exit(main())

// i18n codemod: rewrite user-facing JSX strings into tr() calls.
//
//   node scripts/i18n-codemod.mjs [--dry] [--stats]
//
// Pass 1 — JSX children: consecutive runs of JsxText / eligible JsxExpression
// children are replaced by a single {tr("template"[, { p0: expr, ... }])}.
// String-literal expressions merge into the template; other expressions
// become {pN} placeholders. Runs containing nested JSX break into separate
// runs, so markup like <b> stays put and only the text around it translates.
//
// Pass 2 — attributes: placeholder/title/aria-label/alt/aria-description on
// intrinsic elements become {tr("...")}.
//
// Keys are the cleaned English template (placeholders included); tr() trims
// edge whitespace for lookup and re-attaches it, so " now" and "now" share a
// dictionary entry.

import ts from "typescript"
import { readFileSync, writeFileSync, mkdirSync } from "node:fs"
import { execSync } from "node:child_process"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const DRY = process.argv.includes("--dry")
const STATS = process.argv.includes("--stats")

const onlyFile = process.argv.find((a) => a.endsWith(".ts") || a.endsWith(".tsx"))
const files = (onlyFile
  ? [onlyFile]
  : execSync(
      `fd -e ts -e tsx . app components lib hooks --exclude node_modules`,
      { cwd: ROOT, encoding: "utf8" },
    )
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((f) => join(ROOT, f)))

// Tags whose children are code/config, not prose.
const SKIP_TAGS = new Set([
  "script", "style", "textarea", "code", "pre", "kbd", "samp", "noscript",
])

const UI_ATTRS = new Set([
  "placeholder", "title", "aria-label", "aria-description", "alt",
])
// On custom components only unambiguous UI-text props are safe to translate;
// `title`/`alt` there are usually data.
const UI_ATTRS_CUSTOM = new Set(["placeholder", "ariaLabel", "aria-label"])

// Object-literal properties that hold display text. `label`/`title` alone
// would catch status maps and API payloads, so the set stays narrow and the
// pass only fires inside function bodies (module-level literals would freeze
// English — tr() runs before the provider activates a locale).
const SAFE_PROPS = new Set([
  "label", "title", "description", "heading", "message", "caption",
  "subtitle", "tooltip", "ariaLabel", "deniedLabel", "helperText",
  "emptyText", "emptyMessage", "confirmText", "cancelText",
])

const FUNCTION_LIKE = new Set([
  ts.SyntaxKind.FunctionDeclaration,
  ts.SyntaxKind.FunctionExpression,
  ts.SyntaxKind.ArrowFunction,
  ts.SyntaxKind.MethodDeclaration,
  ts.SyntaxKind.GetAccessor,
  ts.SyntaxKind.SetAccessor,
  ts.SyntaxKind.Constructor,
])

function inFunction(node) {
  for (let p = node.parent; p; p = p.parent) {
    if (FUNCTION_LIKE.has(p.kind)) return true
    if (p.kind === ts.SyntaxKind.SourceFile) return false
  }
  return false
}

const ENTITIES = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
}

function decodeEntities(text) {
  return text.replace(/&(#x?[0-9a-fA-F]+|\w+);/g, (m, entity) => {
    if (entity[0] === "#") {
      const code = entity[1] === "x" || entity[1] === "X"
        ? parseInt(entity.slice(2), 16)
        : parseInt(entity.slice(1), 10)
      return Number.isFinite(code) ? String.fromCodePoint(code) : m
    }
    return ENTITIES[entity] ?? m
  })
}

// Port of the JSX text cleaning babel applies before children reach props:
// per-line trim, blank lines dropped, remaining lines joined with a space.
// First line keeps leading space, last line keeps trailing space.
function cleanJsxText(raw) {
  const lines = raw.split(/\r\n|\n|\r/)
  let lastNonEmpty = 0
  for (let i = 0; i < lines.length; i++) {
    if (/[^ \t]/.test(lines[i])) lastNonEmpty = i
  }
  let out = ""
  for (let i = 0; i < lines.length; i++) {
    const isFirst = i === 0
    const isLast = i === lines.length - 1
    let line = lines[i].replace(/\t/g, " ")
    if (!isFirst) line = line.replace(/^ +/, "")
    if (!isLast) line = line.replace(/ +$/, "")
    if (line) {
      if (i !== lastNonEmpty) line += " "
      out += line
    }
  }
  return decodeEntities(out)
}

function hasJsx(node) {
  let found = false
  const visit = (n) => {
    if (found) return
    if (
      ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n) || ts.isJsxFragment(n)
    ) {
      found = true
      return
    }
    ts.forEachChild(n, visit)
  }
  visit(node)
  return found
}

// An expression child becomes a {pN} placeholder unless it is a plain string
// (merged into the template) or contains JSX (breaks the run). tr()/trNode()
// calls from a previous codemod run also break runs so the pass is
// idempotent.
function exprKind(expr) {
  if (!expr) return "empty"
  if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) {
    return "string"
  }
  if (
    expr.kind === ts.SyntaxKind.SpreadElement ||
    expr.kind === ts.SyntaxKind.SpreadAssignment
  ) {
    return "spread"
  }
  if (
    ts.isCallExpression(expr) &&
    ts.isIdentifier(expr.expression) &&
    (expr.expression.text === "tr" || expr.expression.text === "trNode")
  ) {
    return "jsx"
  }
  if (hasJsx(expr)) return "jsx"
  return "var"
}

const LETTER_RE = /\p{L}/u

function processFile(file) {
  const source = readFileSync(file, "utf8")
  const sf = ts.createSourceFile(
    file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX,
  )
  const edits = [] // {start, end, text}
  const keys = new Set()
  const usedSymbols = new Set()
  const wrappedDecls = new Set()

  function tagNameOf(node) {
    // JsxElement -> openingElement.tagName ; JsxOpeningElement /
    // JsxSelfClosingElement -> tagName ; JsxFragment -> null
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      return node.tagName.getText(sf)
    }
    if (ts.isJsxElement(node)) return node.openingElement.tagName.getText(sf)
    return null
  }

  function visit(node) {
    // ── Pass 1: children runs ────────────────────────────────────────────
    if (ts.isJsxElement(node) || ts.isJsxFragment(node)) {
      const tag = tagNameOf(node)
      if (tag === null || !SKIP_TAGS.has(tag.toLowerCase())) {
        const children = node.children ?? []
        let run = []
        const flush = () => {
          if (!run.length) return
          buildRunReplacement(run)
          run = []
        }
        for (const child of children) {
          if (ts.isJsxText(child)) {
            run.push(child)
          } else if (ts.isJsxExpression(child)) {
            const kind = exprKind(child.expression)
            if (kind === "jsx" || kind === "spread") {
              flush()
            } else {
              run.push(child)
            }
          } else {
            // JsxElement / JsxSelfClosingElement / JsxFragment child
            flush()
          }
        }
        flush()
      }
    }

    // ── Pass 2: attributes ───────────────────────────────────────────────
    if (ts.isJsxAttribute(node)) {
      const attrName = node.name.getText(sf)
      const owner = node.parent // JsxAttributes
      const opening = owner?.parent // JsxOpeningElement | JsxSelfClosingElement
      const tag = opening ? tagNameOf(opening) : null
      const intrinsic = tag && /^[a-z]/.test(tag)
      const allowed = intrinsic ? UI_ATTRS : UI_ATTRS_CUSTOM
      if (tag && allowed.has(attrName) && node.initializer) {
        const init = node.initializer
        if (ts.isStringLiteral(init)) {
          const decoded = decodeEntities(init.text)
          if (LETTER_RE.test(decoded)) {
            edits.push({
              start: init.getStart(sf),
              end: init.getEnd(),
              text: `{tr(${JSON.stringify(decoded)})}`,
            })
            keys.add(decoded)
            usedSymbols.add("tr")
          }
        } else if (ts.isJsxExpression(init) && init.expression) {
          const e = init.expression
          if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) {
            const decoded = decodeEntities(e.text)
            if (LETTER_RE.test(decoded)) {
              edits.push({
                start: init.getStart(sf),
                end: init.getEnd(),
                text: `{tr(${JSON.stringify(decoded)})}`,
              })
              keys.add(decoded)
              usedSymbols.add("tr")
            }
          }
        }
      }
    }

    // ── Pass 3: UI-text object properties inside function bodies ─────────
    if (ts.isPropertyAssignment(node)) {
      const name =
        ts.isIdentifier(node.name) || ts.isStringLiteral(node.name)
          ? node.name.text
          : null
      const init = node.initializer
      const isUiString =
        name &&
        SAFE_PROPS.has(name) &&
        (ts.isStringLiteral(init) || ts.isNoSubstitutionTemplateLiteral(init)) &&
        LETTER_RE.test(decodeEntities(init.text))
      if (isUiString && inFunction(node)) {
        const decoded = decodeEntities(init.text)
        edits.push({
          start: init.getStart(sf),
          end: init.getEnd(),
          text: `tr(${JSON.stringify(decoded)})`,
        })
        keys.add(decoded)
        usedSymbols.add("tr")
      } else if (isUiString) {
        // Module-level literal: tr() would freeze English, so wrap the
        // enclosing top-level variable initializer in trDeep() instead.
        let decl = node.parent
        while (decl && !ts.isVariableDeclaration(decl)) decl = decl.parent
        if (decl && ts.isVariableDeclaration(decl) && decl.initializer) {
          const list = decl.parent
          const stmt = list?.parent
          if (
            stmt &&
            ts.isVariableStatement(stmt) &&
            stmt.parent === sf &&
            !wrappedDecls.has(decl)
          ) {
            wrappedDecls.add(decl)
            const text = decl.initializer.getText(sf)
            edits.push({
              start: decl.initializer.getStart(sf),
              end: decl.initializer.getEnd(),
              text: `trDeep(${text})`,
            })
            usedSymbols.add("trDeep")
          }
        }
      }
    }

    ts.forEachChild(node, visit)
  }

  // JsxText whitespace runs report getStart()==getEnd() (the whitespace is
  // skipped like trivia), so getText() loses it. pos/end always cover the
  // real source span.
  function rawText(node) {
    return ts.isJsxText(node)
      ? source.slice(node.pos, node.end)
      : node.getText(sf)
  }
  function spanStart(node) {
    return ts.isJsxText(node) ? node.pos : node.getStart(sf)
  }
  function spanEnd(node) {
    return ts.isJsxText(node) ? node.end : node.getEnd()
  }

  function buildRunReplacement(run) {
    // Build the template: cleaned JsxText + merged string exprs + {pN} vars.
    let template = ""
    const vars = []
    let hasLetter = false
    let hasVar = false

    for (const child of run) {
      if (ts.isJsxText(child)) {
        const text = cleanJsxText(rawText(child))
        template += text
        if (LETTER_RE.test(text)) hasLetter = true
      } else if (ts.isJsxExpression(child)) {
        const e = child.expression
        const kind = exprKind(e)
        if (kind === "empty") continue
        if (kind === "string") {
          const text = e.text
          template += text
          if (LETTER_RE.test(text)) hasLetter = true
        } else {
          const name = `p${vars.length}`
          template += `{${name}}`
          vars.push(`${name}: ${e.getText(sf)}`)
          hasVar = true
        }
      }
    }

    if (!hasLetter || !LETTER_RE.test(template.replace(/\{p\d+\}/g, ""))) return
    // Skip runs that are only a placeholder.
    if (!template.replace(/\{p\d+\}/g, "").trim()) return

    const key = template.trim()
    keys.add(key)

    // Runs with expression children may evaluate to React elements, so they
    // go through trNode (splits the translated template around placeholders).
    // Pure-text runs stay strings via tr(), preserving `children: string`.
    const fn = hasVar ? "trNode" : "tr"
    usedSymbols.add(fn)
    const call = vars.length
      ? `${fn}(${JSON.stringify(template)}, { ${vars.join(", ")} })`
      : `${fn}(${JSON.stringify(template)})`

    // Preserve layout whitespace at the run edges so the JSX stays readable:
    // whitespace containing a newline is formatting, not content.
    let leadLayout = ""
    let trailLayout = ""
    const first = run[0]
    const last = run[run.length - 1]
    if (ts.isJsxText(first)) {
      const m = rawText(first).match(/^\s*\n\s*/)
      if (m) leadLayout = m[0]
    }
    if (ts.isJsxText(last)) {
      const m = rawText(last).match(/\s*\n\s*$/)
      if (m) trailLayout = m[0]
    }

    const replacement = `${leadLayout}{${call}}${trailLayout}`

    const start = spanStart(run[0])
    const end = spanEnd(run[run.length - 1])
    edits.push({ start, end, text: replacement })
  }

  visit(sf)

  if (!edits.length) return { file, edits: 0, keys: 0 }

  // Ensure the tr/trNode imports exist.
  if (usedSymbols.size) {
    const names = [...usedSymbols].sort().join(", ")
    const importRe = /import\s*\{([^}]*)\}\s*from\s*["']@\/lib\/i18n["']/
    const m = source.match(importRe)
    if (m) {
      const have = new Set(m[1].split(",").map((s) => s.trim()).filter(Boolean))
      for (const s of usedSymbols) have.add(s)
      const merged = `import { ${[...have].sort().join(", ")} } from "@/lib/i18n"`
      edits.push({
        start: m.index,
        end: m.index + m[0].length,
        text: merged,
      })
    } else {
      // Insert after the last top-level import statement, or after leading
      // directives ("use client") when the file has no imports.
      let lastImportEnd = 0
      for (const stmt of sf.statements) {
        if (ts.isImportDeclaration(stmt)) lastImportEnd = stmt.getEnd()
      }
      if (lastImportEnd === 0) {
        for (const stmt of sf.statements) {
          const txt = stmt.getText(sf)
          if (txt.startsWith('"use ') || txt.startsWith("'use ")) {
            lastImportEnd = stmt.getEnd()
          } else break
        }
      }
      const importLine = `import { ${names} } from "@/lib/i18n"\n`
      edits.push({
        start: lastImportEnd,
        end: lastImportEnd,
        text: source[lastImportEnd - 1] === "\n" ? importLine : `\n${importLine}`,
      })
    }
  }

  // Apply edits right-to-left.
  edits.sort((a, b) => b.start - a.start)
  let out = source
  for (const e of edits) {
    out = out.slice(0, e.start) + e.text + out.slice(e.end)
  }

  if (!DRY) writeFileSync(file, out)
  return { file, edits: edits.length, keys: keys.size, keyList: [...keys] }
}

const allKeys = new Set()
let totalEdits = 0
const perFile = []

for (const file of files) {
  // Skip the i18n module itself and generated messages.
  if (file.includes("/lib/i18n/") || file.includes("/messages/")) continue
  const result = processFile(file)
  if (result.edits) {
    totalEdits += result.edits
    perFile.push(`${result.file.replace(ROOT + "/", "")}: ${result.edits} edits, ${result.keys} keys`)
    for (const k of result.keyList ?? []) allKeys.add(k)
  }
}

if (STATS) {
  console.log(perFile.join("\n"))
  console.log(`\nTOTAL: ${totalEdits} edits, ${allKeys.size} unique keys`)
}

mkdirSync(join(ROOT, "i18n-extract"), { recursive: true })
writeFileSync(
  join(ROOT, "i18n-extract", "keys.json"),
  JSON.stringify([...allKeys].sort(), null, 2),
)
console.log(`wrote ${allKeys.size} keys to i18n-extract/keys.json`)

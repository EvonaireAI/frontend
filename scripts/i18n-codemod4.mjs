// i18n codemod pass 4: convert user-facing template literals to tr()/trNode().
//
//   node scripts/i18n-codemod4.mjs [--dry]
//
// Earlier passes handled static strings. This pass handles
// `prose ${expr} prose` TemplateExpressions in three user-facing contexts:
//
//   - JSX children:           <p>`Hello ${name}`</p>  -> {trNode("Hello {p0}", {p0: name})}
//   - new Error(...) args:    new Error(`Failed: ${s}`) -> new Error(tr("Failed: {p0}", {p0: s}))
//   - setter/toast/etc args:  setX(`Count: ${n}`)      -> setX(tr("Count: {p0}", {p0: n}))
//
// trNode is used in JSX position so element-valued expressions still work;
// tr elsewhere (string contexts). Placeholders are named p0..pN in order.
//
// Skipped: className/style attributes, cn()/clsx()/cva() args, URLs/fetch
// paths, console.*, CSS text, templates whose literal parts have no prose
// (fewer than two words or no vowel-bearing word >= 3 chars, e.g. `#${id}`).

import ts from "typescript"
import { readFileSync, writeFileSync } from "node:fs"
import { execSync } from "node:child_process"

const DRY = process.argv.includes("--dry")

const SETTER_RE = /^(set[A-Z]\w*|toast|parseErrorMessage|describeDenial|message|confirm|alert|notification\w*)$/
// DOM mutators take (name, value) — their values are tokens, not prose.
const DOM_MUTATOR = new Set([
  "setAttribute", "setItem", "setProperty", "setRangeText",
  "setSelectionRange", "setValue", "setAttributeNS",
])
const STYLE_CALL_RE = /^(cn|clsx|cva|cx|classnames)$/
const SKIP_CALL_RE = /^(fetch|authedFetch|tr|trNode|t|console|require|import|encodeURIComponent|encodeURI|router\.push|router\.replace|push|replace|redirect|format|formatDate|formatRelativeTime|Intl\.\w+|matchMedia|localStorage\.\w+|sessionStorage\.\w+)$/

const TEXT_ATTRS = new Set([
  "placeholder", "title", "aria-label", "aria-description", "alt",
  "label", "caption", "hint", "empty", "description", "heading",
  "message", "subtitle", "note", "tooltip", "summary",
])

const PROSE_VAR_RE = /body|message|text|label|title|hint|note|caption|description|subtitle|error|banner|cta|heading|summary|tooltip|placeholder|empty|reason|denial|greeting|farewell|notice|warning|line|sentence|phrase|quote/i

const FILTER = process.env.FILTER_RE ? new RegExp(process.env.FILTER_RE) : null
const files = execSync(
  'git ls-files app components lib hooks | grep -E "\\.tsx?$"',
  { encoding: "utf8" },
).trim().split("\n").filter((f) => !FILTER || FILTER.test(f))
const VERBOSE = !!process.env.VERBOSE

const newKeys = new Set()
let totalEdits = 0
const perFile = []
const skipped = []

function literalProseScore(text) {
  const words = text.replace(/[^A-Za-zÀ-ÿ'’ ]/g, " ").trim().split(/\s+/).filter(Boolean)
  const real = words.filter((w) => /[aeiouAEIOUàâäéèêëîïôöùûü]/.test(w) && w.length >= 3)
  return real.length
}

function isInClassNameContext(node) {
  let p = node.parent
  while (p) {
    if (ts.isJsxAttribute(p)) {
      const n = p.name.getText()
      return n === "className" || n === "style" || n === "data-theme"
    }
    if (ts.isJsxElement(p) || ts.isJsxFragment(p) || ts.isSourceFile(p)) return false
    p = p.parent
  }
  return false
}

function callName(expr) {
  if (ts.isIdentifier(expr)) return expr.text
  if (ts.isPropertyAccessExpression(expr)) return callName(expr.expression) + "." + expr.name.text
  return ""
}

// Walk up to decide context: "jsx" | "string" | null
function contextOf(node, sf) {
  let p = node.parent
  let hops = 0
  while (p && hops++ < 6) {
    if (ts.isJsxExpression(p)) {
      // child of an element/fragment? parent is JsxElement's children list or fragment
      const gp = p.parent
      if (gp && (ts.isJsxElement(gp) || ts.isJsxFragment(gp))) return "jsx"
      // attribute expression like className={...} — handled at the attribute
      p = gp ?? p.parent
      continue
    }
    if (ts.isJsxAttribute(p)) {
      return TEXT_ATTRS.has(p.name.getText(sf)) ? "string" : null
    }
    if (ts.isVariableDeclaration(p) && ts.isIdentifier(p.name)) {
      return PROSE_VAR_RE.test(p.name.text) ? "string" : null
    }
    if (ts.isNewExpression(p) || ts.isCallExpression(p)) {
      const name = callName(p.expression)
      if (STYLE_CALL_RE.test(name.split(".").pop())) return null
      if (name === "Error" || name === "TypeError" || name === "RangeError") return "string"
      const leaf = name.split(".").pop()
      if (DOM_MUTATOR.has(leaf)) return null
      if (SETTER_RE.test(leaf) || SETTER_RE.test(name)) return "string"
      if (SKIP_CALL_RE.test(leaf) || SKIP_CALL_RE.test(name)) return null
      // unknown call: keep walking (e.g. inside ternary arg of a setter)
    }
    if (ts.isThrowStatement(p)) return "string"
    if (ts.isReturnStatement(p)) {
      // returning a template from a function — ambiguous; treat as string
      // only if function name hints at user-facing message production
      let fn = p.parent
      while (fn && !ts.isFunctionLike(fn)) fn = fn.parent
      const fname = fn?.name?.getText(sf) ?? ""
      return /message|error|label|text|title|describe|denial|reason/i.test(fname) ? "string" : null
    }
    if (ts.isVariableStatement(p) || ts.isPropertyAssignment(p)) return null
    p = p.parent
  }
  return null
}

for (const file of files) {
  if (file.includes("lib/i18n/") || file.includes("components/ui/")) continue
  const source = readFileSync(file, "utf8")
  if (!source.includes("`")) continue
  const sf = ts.createSourceFile(
    file, source, ts.ScriptTarget.Latest, true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  )
  const edits = []
  let needsNode = false
  const visit = (n) => {
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) {
      // bare literals inside text-attr expressions (ternary branches etc.)
      // or prose-named vars; direct tr() args and imports resolve to null.
      const val = n.text
      if (literalProseScore(val) < 2) { ts.forEachChild(n, visit); return }
      // identifiers are not prose: snake_case codes, storage keys, domains,
      // CSS tokens ("nodownload"), handles. Anything spaceless that parses
      // as a dotted/dashed token is structural, not user-facing.
      if (/^-?[\w-]+(\.[\w-]+)*$/.test(val.trim())) { ts.forEachChild(n, visit); return }
      if (isInClassNameContext(n)) { ts.forEachChild(n, visit); return }
      const ctx = contextOf(n, sf)
      if (ctx !== "string") { ts.forEachChild(n, visit); return }
      // don't double-wrap: a literal that IS the attr initializer was done
      // by pass 3; skip if direct JsxAttribute initializer or tr() arg.
      const par = n.parent
      if (par && (ts.isJsxAttribute(par))) { ts.forEachChild(n, visit); return }
      edits.push({
        start: n.getStart(sf),
        end: n.end,
        text: `tr(${JSON.stringify(val)})`,
      })
      if (VERBOSE) console.log(`  ${file}:${sf.getLineAndCharacterOfPosition(n.getStart()).line + 1} LIT ${JSON.stringify(val.slice(0, 60))}`)
      newKeys.add(val.trim())
      ts.forEachChild(n, visit)
      return
    }
    if (ts.isTemplateExpression(n)) {
      const parts = [n.head.text, ...n.templateSpans.map((s) => s.literal.text)]
      const prose = parts.reduce((acc, t) => acc + literalProseScore(t), 0)
      if (prose < 2) { ts.forEachChild(n, visit); return }
      if (isInClassNameContext(n)) { ts.forEachChild(n, visit); return }
      const ctx = contextOf(n, sf)
      if (!ctx) {
        const line = sf.getLineAndCharacterOfPosition(n.getStart()).line + 1
        skipped.push(`${file}:${line} \`${(n.head.text + "...").slice(0, 50)}\``)
        ts.forEachChild(n, visit); return
      }
      // Build key: literal parts joined with {pN}; keep interior whitespace,
      // trim the ends (tr trims for lookup and re-attaches edge spaces).
      const keyParts = []
      keyParts.push(parts[0])
      n.templateSpans.forEach((s, i) => keyParts.push(`{p${i}}`, parts[i + 1]))
      const key = keyParts.join("").replace(/\s+/g, " ").trim()
      if (!/[A-Za-zÀ-ÿ]{3}/.test(key.replace(/\{p\d\}/g, ""))) { ts.forEachChild(n, visit); return }
      const vars = `{ ${n.templateSpans.map((s, i) => `p${i}: ${s.expression.getText(sf)}`).join(", ")} }`
      const fn = ctx === "jsx" ? "trNode" : "tr"
      if (ctx === "jsx") needsNode = true
      const lead = /^\s/.test(n.head.text) ? " " : ""
      const tailT = parts[parts.length - 1]
      const trail = /\s$/.test(tailT) ? " " : ""
      const finalKey = lead + key + trail
      edits.push({
        start: n.getStart(sf),
        end: n.end,
        text: `${fn}(${JSON.stringify(finalKey)}, ${vars})`,
      })
      if (VERBOSE) console.log(`  ${file}:${sf.getLineAndCharacterOfPosition(n.getStart()).line + 1} TPL ${JSON.stringify(finalKey.slice(0, 60))} ctx=${ctx}`)
      newKeys.add(finalKey)
    }
    ts.forEachChild(n, visit)
  }
  visit(sf)
  if (!edits.length) continue

  // ensure imports: tr always needed; trNode when a JSX edit landed
  let importEdit = null
  let hasTr = false, hasNode = false, i18nDecl = null, lastImportEnd = 0
  for (const st of sf.statements) {
    if (ts.isImportDeclaration(st)) {
      lastImportEnd = st.end
      const spec = st.moduleSpecifier.text
      if (spec === "@/lib/i18n" || spec.endsWith("/i18n") || spec.endsWith("/i18n/index.ts")) {
        i18nDecl = st
        const named = st.importClause?.namedBindings
        if (named && ts.isNamedImports(named)) {
          for (const el of named.elements) {
            const nm = (el.propertyName ?? el.name).text
            if (nm === "tr") hasTr = true
            if (nm === "trNode") hasNode = true
          }
        }
      }
    }
  }
  const wanted = ["tr", ...(needsNode ? ["trNode"] : [])].filter(
    (x) => !(x === "tr" ? hasTr : hasNode),
  )
  if (wanted.length) {
    if (i18nDecl && ts.isNamedImports(i18nDecl.importClause.namedBindings)) {
      const nb = i18nDecl.importClause.namedBindings
      const last = nb.elements[nb.elements.length - 1]
      importEdit = { start: last.end, end: last.end, text: wanted.map((w) => `, ${w}`).join("") }
    } else if (lastImportEnd) {
      importEdit = {
        start: lastImportEnd, end: lastImportEnd,
        text: `\nimport { ${wanted.join(", ")} } from "@/lib/i18n"`,
      }
    }
  }
  if (importEdit) edits.push(importEdit)

  edits.sort((a, b) => b.start - a.start)
  let out = source
  for (const e of edits) out = out.slice(0, e.start) + e.text + out.slice(e.end)
  if (!DRY) writeFileSync(file, out)
  totalEdits += edits.length
  perFile.push(`${file}: ${edits.length} edits`)
}

console.log(perFile.join("\n"))
console.log(`\nTOTAL: ${totalEdits} edits, ${newKeys.size} new keys`)
writeFileSync("/tmp/template-keys.json", JSON.stringify([...newKeys].sort(), null, 2))
console.log("wrote /tmp/template-keys.json")
console.log("\n=== SKIPPED (context unclear) ===")
console.log(skipped.slice(0, 40).join("\n"))
console.log(`${skipped.length} skipped`)

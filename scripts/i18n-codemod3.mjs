// i18n codemod pass 3: wrap string-literal props on components in tr().
//
//   node scripts/i18n-codemod3.mjs [--dry]
//
// Passes 1 and 2 covered JSX children and intrinsic-element attributes
// (placeholder/title/aria-label/alt on lowercase tags). This pass covers
// user-visible text passed as props to components: label, title, caption,
// hint, empty, description, heading, message, subtitle, note, placeholder,
// tooltip, summary. Values that look like tokens (no spaces, short,
// lower/camel/kebab) are skipped.
//
// Adds `tr` to the file's "@/lib/i18n" import when missing.

import ts from "typescript"
import { readFileSync, writeFileSync } from "node:fs"
import { execSync } from "node:child_process"

const DRY = process.argv.includes("--dry")

const PROPS = new Set([
  "label", "caption", "hint", "title", "empty", "description",
  "heading", "message", "subtitle", "note", "placeholder",
  "tooltip", "summary",
])

const SKIP_TAGS = new Set(["input", "meta", "link", "img", "br", "hr", "source", "track"])

const files = execSync(
  'git ls-files app components lib hooks | grep -E "\\.tsx$"',
  { encoding: "utf8" },
).trim().split("\n")

const newKeys = new Set()
let totalEdits = 0
const perFile = []

function looksLikeProse(val) {
  if (/^\s*$/.test(val)) return false
  if (/^(https?:|mailto:|tel:|\/|#|\.\/|\.\.\/)/.test(val)) return false
  if (/^\{.*\}$/.test(val)) return false
  // props in the PROPS set are declared user-facing text; even a single
  // lowercase word ("fingerprint") is a label. Only reject values with no
  // letters at all (numbers, symbols) or clear enum tokens in SCREAMING_CASE.
  if (!/[A-Za-zÀ-ÿ]{2,}/.test(val)) return false
  if (/^[A-Z][A-Z0-9_]{3,}$/.test(val)) return false
  return true
}

function hasTrImport(sf) {
  let found = false
  for (const st of sf.statements) {
    if (!ts.isImportDeclaration(st)) continue
    const spec = st.moduleSpecifier.text
    if (spec !== "@/lib/i18n" && !spec.endsWith("/i18n") && spec !== "@/lib/i18n/index.ts") continue
    const named = st.importClause?.namedBindings
    if (named && ts.isNamedImports(named)) {
      for (const el of named.elements) {
        if ((el.propertyName ?? el.name).text === "tr") found = true
      }
    }
  }
  return found
}

function lastImportEnd(sf) {
  let end = 0
  for (const st of sf.statements) {
    if (ts.isImportDeclaration(st)) end = st.end
  }
  return end
}

for (const file of files) {
  if (file.includes("/lib/i18n/")) continue
  const source = readFileSync(file, "utf8")
  if (!source.includes('"') && !source.includes("'")) continue
  const sf = ts.createSourceFile(
    file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX,
  )
  const edits = []
  const visit = (n) => {
    if (
      ts.isJsxAttribute(n) &&
      PROPS.has(n.name.getText(sf)) &&
      n.initializer &&
      ts.isStringLiteral(n.initializer)
    ) {
      const tag = n.parent?.parent?.tagName?.getText(sf) ?? ""
      const val = n.initializer.text
      // SKIP_TAGS applies only to true intrinsics (lowercase tag); a
      // capitalized <Link>/<Image> is a component and its props translate.
      const isIntrinsic = tag && tag[0] === tag[0].toLowerCase()
      if (!(isIntrinsic && SKIP_TAGS.has(tag)) && looksLikeProse(val)) {
        edits.push({
          start: n.initializer.getStart(sf),
          end: n.initializer.end,
          text: `{tr(${JSON.stringify(val)})}`,
        })
        newKeys.add(val)
      }
    }
    ts.forEachChild(n, visit)
  }
  visit(sf)
  if (!edits.length) continue

  if (!hasTrImport(sf)) {
    const anchor = lastImportEnd(sf)
    if (anchor === 0) continue
    edits.push({ start: anchor, end: anchor, text: `\nimport { tr } from "@/lib/i18n"` })
  }

  edits.sort((a, b) => b.start - a.start)
  let out = source
  for (const e of edits) out = out.slice(0, e.start) + e.text + out.slice(e.end)
  if (!DRY) writeFileSync(file, out)
  totalEdits += edits.length
  perFile.push(`${file}: ${edits.length} edits`)
}

console.log(perFile.join("\n"))
console.log(`\nTOTAL: ${totalEdits} edits, ${newKeys.size} new keys`)
writeFileSync("/tmp/prop-keys.json", JSON.stringify([...newKeys].sort(), null, 2))
console.log("wrote /tmp/prop-keys.json")

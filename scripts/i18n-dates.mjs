// Swap date-fns format() calls using the catalogued patterns for the
// locale-aware formatDate() from lib/i18n, and fix imports.
import ts from "typescript"
import { readFileSync, writeFileSync } from "node:fs"
import { execSync } from "node:child_process"

const PATTERNS = new Set([
  "MMM d, yyyy", "MMMM d, yyyy", "d MMMM yyyy", "MMM d, yyyy h:mm a",
  "d MMM yyyy", "d MMM yyyy, HH:mm", "d MMMM", "MMMM d", "MMM d",
])

const files = execSync(
  'git ls-files app components lib hooks | grep -E "\\.(tsx?|jsx?)$"',
  { encoding: "utf8" },
).trim().split("\n")

let total = 0
const touchedFiles = new Set()
const leftovers = []

for (const f of files) {
  const src = readFileSync(f, "utf8")
  if (!src.includes("format(") || !src.includes("date-fns")) continue
  const sf = ts.createSourceFile(
    f, src, ts.ScriptTarget.Latest, true,
    f.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  )
  const reps = []
  const visit = (n) => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) &&
        n.expression.text === "format") {
      const a1 = n.arguments[1]
      if (a1 && ts.isStringLiteral(a1) && PATTERNS.has(a1.text)) {
        reps.push({ start: n.expression.getStart(sf), end: n.expression.getEnd() })
      } else {
        leftovers.push(`${f}:${sf.getLineAndCharacterOfPosition(n.getStart()).line + 1} :: ${n.getText(sf).slice(0, 80)}`)
      }
    }
    ts.forEachChild(n, visit)
  }
  visit(sf)
  if (!reps.length) continue

  let out = src
  reps.sort((a, b) => b.start - a.start)
  for (const r of reps) out = out.slice(0, r.start) + "formatDate" + out.slice(r.end)

  const stillUsesFormat = /[^a-zA-Z]format\(/.test(out.replace(/formatDate\(/g, ""))
  out = out.replace(
    /import\s*\{([^}]*)\}\s*from\s*["']date-fns["']/,
    (m, names) => {
      let ns = names.split(",").map((s) => s.trim()).filter(Boolean)
      if (!stillUsesFormat) ns = ns.filter((s) => s !== "format")
      return ns.length ? `import { ${ns.join(", ")} } from "date-fns"` : ""
    },
  )
  if (/from ["']@\/lib\/i18n["']/.test(out)) {
    out = out.replace(
      /import\s*\{([^}]*)\}\s*from\s*["'](@\/lib\/i18n)["']/,
      (m, names, path) => /\bformatDate\b/.test(names)
        ? m
        : `import { formatDate,${names.trimStart()} } from "${path}"`,
    )
  } else {
    const lines = [...out.matchAll(/^import .*$/gm)]
    const at = lines.length
      ? lines[lines.length - 1].index + lines[lines.length - 1][0].length
      : 0
    out = out.slice(0, at) + `\nimport { formatDate } from "@/lib/i18n"` + out.slice(at)
  }
  writeFileSync(f, out)
  touchedFiles.add(f)
  total += reps.length
}

console.log("swapped", total, "calls in", touchedFiles.size, "files")
console.log("leftover format( calls:", leftovers.length)
for (const l of leftovers.slice(0, 40)) console.log(" ", l)

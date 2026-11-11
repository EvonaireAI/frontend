// i18n codemod pass 2: wrap non-JSX user-facing strings in tr().
//
//   node scripts/i18n-codemod2.mjs [--dry]
//
// Handles the mechanical cases the JSX codemod could not reach:
//   - throw new Error("literal")            -> throw new Error(tr("literal"))
//   - toast.(success|error|info|warning|message|loading)(ARG)
//   - setError/setMessage/setLoadError/setSubmitError/setApiError/setFormError/
//     setFeedback/setNotice(ARG)
//
// For toast/setter args, string literals are wrapped directly, and literals
// inside top-level ?: branches and || / ?? fallbacks are wrapped too:
//   err instanceof Error ? err.message : "Fallback"  ->  ... : tr("Fallback")
//   err.message || "Fallback"                        ->  err.message || tr("Fallback")
//   isEdit ? "A" : "B"                               ->  isEdit ? tr("A") : tr("B")
//
// NOT touched: template literals with substitutions, equality-comparison
// operands, identifiers, and already-wrapped tr()/trNode() calls — those are
// listed at the end for manual review. Dev-only guard throws in
// components/ui/* and lib/*-context.tsx are excluded entirely.

import ts from "typescript"
import { readFileSync, writeFileSync } from "node:fs"
import { execSync } from "node:child_process"

const DRY = process.argv.includes("--dry")

const EXCLUDE = new Set([
  "components/ui/carousel.tsx",
  "components/ui/chart.tsx",
  "components/ui/form.tsx",
  "components/ui/sidebar.tsx",
  "lib/accessibility-context.tsx",
  "lib/auth-context.tsx",
  "lib/entitlements-context.tsx",
  "lib/gateway-context.tsx",
])

const files = execSync(
  'git ls-files app components lib hooks | grep -E "\\.(tsx?|jsx?)$"',
  { encoding: "utf8" },
).trim().split("\n").filter((f) => !EXCLUDE.has(f))

const ERROR_SETTERS = new Set([
  "setError", "setMessage", "setLoadError", "setSubmitError",
  "setApiError", "setFormError", "setFeedback", "setNotice",
])
const TOAST_METHODS = new Set([
  "success", "error", "info", "warning", "message", "loading",
])
const EQUALITY_OPS = new Set([
  ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken,
  ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsToken,
])

const edits = []
const skipped = []

function isLiteral(n) {
  return ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)
}

function inTrCall(n) {
  let p = n.parent
  while (p && (ts.isParenthesizedExpression(p) || ts.isAsExpression(p))) p = p.parent
  return p && ts.isCallExpression(p) && ts.isIdentifier(p.expression) &&
    (p.expression.text === "tr" || p.expression.text === "trNode")
}

// Wrap literal leaves reachable through ?: branches and || / ?? fallbacks.
// Returns list of {start,end,text} edits. Never descends into conditions,
// equality operands, templates, or call arguments.
function collectExprWraps(n, sf, out) {
  if (isLiteral(n)) {
    if (n.text.trim() && !inTrCall(n)) {
      out.push({ start: n.getStart(sf), end: n.getEnd(), text: `tr(${n.getText(sf)})` })
    }
    return
  }
  if (ts.isConditionalExpression(n)) {
    collectExprWraps(n.whenTrue, sf, out)
    collectExprWraps(n.whenFalse, sf, out)
    return
  }
  if (ts.isBinaryExpression(n) &&
      (n.operatorToken.kind === ts.SyntaxKind.BarBarToken ||
       n.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken)) {
    collectExprWraps(n.left, sf, out)
    collectExprWraps(n.right, sf, out)
    return
  }
  if (ts.isParenthesizedExpression(n) || ts.isAsExpression(n)) {
    collectExprWraps(n.expression, sf, out)
    return
  }
  // Property access (err.message, result.detail) and equality comparisons
  // carry no translatable literal — skip silently. Templates, identifiers
  // and other calls may hide messages — list for manual review.
  const ignorable = ts.isPropertyAccessExpression(n) ||
    (ts.isBinaryExpression(n) && EQUALITY_OPS.has(n.operatorToken.kind))
  if (!inTrCall(n) && !ignorable) {
    out.push({ skip: true, node: n, sf })
  }
}

let totalWraps = 0
for (const file of files) {
  const src = readFileSync(file, "utf8")
  if (!/toast\.|throw new Error|set(Error|Message|LoadError|SubmitError|ApiError|FormError|Feedback|Notice)\s*\(/.test(src)) continue
  const sf = ts.createSourceFile(
    file, src, ts.ScriptTarget.Latest, true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  )
  const fileEdits = []
  const fileSkips = []

  const visit = (n) => {
    // throw new Error("lit")
    if (ts.isNewExpression(n) && ts.isIdentifier(n.expression) &&
        n.expression.text === "Error") {
      const a0 = n.arguments && n.arguments[0]
      if (a0 && isLiteral(a0) && a0.text.trim() && !inTrCall(n)) {
        fileEdits.push({ start: a0.getStart(sf), end: a0.getEnd(),
                         text: `tr(${a0.getText(sf)})` })
      }
    }
    if (ts.isCallExpression(n)) {
      const isToast = ts.isPropertyAccessExpression(n.expression) &&
        ts.isIdentifier(n.expression.expression) &&
        n.expression.expression.text === "toast" &&
        TOAST_METHODS.has(n.expression.name.text)
      const isSetter = ts.isIdentifier(n.expression) &&
        ERROR_SETTERS.has(n.expression.text)
      if ((isToast || isSetter) && n.arguments.length) {
        for (const arg of n.arguments) {
          const found = []
          collectExprWraps(arg, sf, found)
          for (const f of found) {
            if (f.skip) {
              const kind = isToast ? `toast.${n.expression.name.text}` : n.expression.text
              fileSkips.push(`${file}:${sf.getLineAndCharacterOfPosition(n.getStart()).line + 1} ${kind}(${f.node.getText(sf).slice(0, 70)})`)
            } else {
              fileEdits.push(f)
            }
          }
        }
      }
    }
    ts.forEachChild(n, visit)
  }
  visit(sf)

  if (!fileEdits.length) {
    for (const s of fileSkips) skipped.push(s)
    continue
  }

  let out = src
  fileEdits.sort((a, b) => b.start - a.start)
  for (const e of fileEdits) out = out.slice(0, e.start) + e.text + out.slice(e.end)

  // ensure tr import
  const hasI18n = /from ["']@\/lib\/i18n["']/.test(out) || /from ["']@\/lib\/i18n\//.test(out)
  if (!hasI18n) {
    const importLines = [...out.matchAll(/^import .*$/gm)]
    if (importLines.length) {
      const last = importLines[importLines.length - 1]
      const at = last.index + last[0].length
      out = out.slice(0, at) + `\nimport { tr } from "@/lib/i18n"` + out.slice(at)
    } else {
      out = `import { tr } from "@/lib/i18n"\n` + out
    }
  } else {
    out = out.replace(
      /import\s*\{([^}]*)\}\s*from\s*["'](@\/lib\/i18n(?:\/[\w-]+)?)["']/,
      (m, names, path) => /\btr\b/.test(names) ? m : `import { tr,${names.trimStart()} } from "${path}"`,
    )
  }

  if (!DRY) writeFileSync(file, out)
  totalWraps += fileEdits.length
  console.log(`${DRY ? "WOULD EDIT" : "edited"} ${file} (${fileEdits.length} wraps)`)
  for (const s of fileSkips) skipped.push(s)
}

console.log(`\n${totalWraps} literal wraps applied`)
if (skipped.length) {
  console.log(`\n${skipped.length} non-literal sites need manual review:`)
  for (const s of skipped) console.log(" ", s)
}

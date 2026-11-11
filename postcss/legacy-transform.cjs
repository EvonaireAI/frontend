const postcss = require("postcss")

// translate/rotate/scale as standalone properties shipped in Chrome 104.
// Older engines drop the declarations, so utilities like -translate-x-1/2
// silently do nothing. For every rule that uses them this emits a sibling
// @supports-gated rule setting transform: instead. The transform value is
// identical for every contributing rule — it only references the shared
// --tw-* custom properties — so whichever declaration wins the cascade
// computes the same composed transform.
const INDIVIDUAL = new Set(["translate", "rotate", "scale"])
const RESET = new Set(["none", "initial", "inherit", "unset", "revert", "revert-layer"])
const CANONICAL =
  "translate(var(--tw-translate-x,0),var(--tw-translate-y,0)) " +
  "rotate(var(--tw-legacy-rotate,0deg)) " +
  "scale(var(--tw-scale-x,1),var(--tw-scale-y,1))"

function splitArgs(value) {
  const args = []
  let depth = 0
  let cur = ""
  for (const ch of value) {
    if (ch === "(") depth++
    else if (ch === ")") depth--
    if (depth === 0 && /\s/.test(ch)) {
      if (cur) {
        args.push(cur)
        cur = ""
      }
    } else {
      cur += ch
    }
  }
  if (cur) args.push(cur)
  return args
}

// Literal rotate/scale values have no shared --tw-* variable to read, so
// mirror them into one. The * rule already defaults every other --tw-*
// variable; --tw-legacy-rotate gets the same treatment below.
function normalize(rule, decls) {
  const byProp = {}
  for (const d of decls) {
    if (INDIVIDUAL.has(d.prop)) byProp[d.prop] = d
  }

  const rot = byProp.rotate
  if (rot) {
    const args = splitArgs(rot.value.trim())
    if (args.length === 1) {
      const value = args[0].toLowerCase() === "0" || RESET.has(args[0].toLowerCase()) ? "0deg" : args[0]
      rule.append({ prop: "--tw-legacy-rotate", value })
    }
    // Multi-token rotate (axis + angle) has no rotate() equivalent; the
    // variable keeps its *-rule default and the fallback omits the rotation.
  }

  const scl = byProp.scale
  if (scl && !scl.value.includes("var(--tw-scale")) {
    const args = splitArgs(scl.value.trim())
    if (args.length >= 1 && args.length <= 2) {
      const axis = (a, fallback) => (RESET.has(a.toLowerCase()) ? fallback : a)
      const x = axis(args[0], "1")
      const y = args.length === 2 ? axis(args[1], "1") : x
      rule.append({ prop: "--tw-scale-x", value: x })
      rule.append({ prop: "--tw-scale-y", value: y })
    }
  }

  const tr = byProp.translate
  if (tr && RESET.has(tr.value.trim().toLowerCase())) {
    rule.append({ prop: "--tw-translate-x", value: "0" })
    rule.append({ prop: "--tw-translate-y", value: "0" })
  }
}

module.exports = {
  postcssPlugin: "legacy-transform-properties",
  Once(root) {
    // Seed --tw-legacy-rotate next to the other --tw-* defaults so it never
    // inherits a parent's rotation.
    root.walkRules((rule) => {
      const sel = rule.selector.replace(/\s+/g, "")
      if (sel.startsWith("*,") && sel.includes("::backdrop")) {
        rule.append({ prop: "--tw-legacy-rotate", value: "0deg" })
      }
    })

    root.walkRules((rule) => {
      const parent = rule.parent
      if (parent && parent.type === "atrule" && /keyframes$/i.test(parent.name)) return

      const decls = (rule.nodes || []).filter((n) => n.type === "decl")
      if (!decls.some((d) => INDIVIDUAL.has(d.prop))) return

      normalize(rule, decls)

      const transform = [...decls].reverse().find((d) => d.prop === "transform")
      const value = transform ? `${CANONICAL} ${transform.value}` : CANONICAL

      const shadow = rule.clone()
      shadow.removeAll()
      shadow.append({ prop: "transform", value })
      const gate = postcss.atRule({ name: "supports", params: "not (translate: 0px)" })
      gate.append(shadow)
      rule.after(gate)
    })
  },
}

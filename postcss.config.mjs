/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    '@tailwindcss/postcss': {},
    // Chrome 69 does not parse @layer, so it drops every Tailwind utility
    // rule. This flattens the layers in source order; it must run after Tailwind.
    '@csstools/postcss-cascade-layers': {},
    // Chrome 69 cannot parse oklch(), and Tailwind v4 defines its palette with
    // it. This replaces each value with an rgb() equivalent.
    '@csstools/postcss-oklab-function': { preserve: false },
    // translate/rotate/scale as standalone properties need Chrome 104. This
    // emits an @supports-gated transform: fallback for older engines.
    './postcss/legacy-transform.cjs': {},
  },
}

export default config

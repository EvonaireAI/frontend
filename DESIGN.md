# DESIGN.md

Design tokens and rationale for the Evonaire frontend. Read this before
building or restyling any UI. Tokens mirror `app/globals.css`. When
they disagree, the CSS wins and this file gets updated.

```yaml
tokens:
  colors:
    background: "#0f171e"
    foreground: "#f6f2e8"
    card: "#1a2230"
    card-foreground: "#f6f2e8"
    popover: "#1a2230"
    primary: "#d9b574"
    primary-foreground: "#0f171e"
    secondary: "#1f2b3a"
    secondary-foreground: "#f0d9a5"
    muted: "#162030"
    muted-foreground: "#b3b3b3"
    accent: "#b8975a"
    accent-foreground: "#0f171e"
    destructive: "#c44040"
    destructive-foreground: "#f6f2e8"
    border: "#2a3848"
    input: "#1a2230"
    ring: "oklch(0.75 0.1 70 / 0.3)"
    gold: "#d9b574"
    gold-light: "#f0d9a5"
    gold-muted: "#b8975a"
    cream: "#f3e5c8"
    dark-navy: "#0f171e"
    dark-navy-light: "#1a2230"
    dark-navy-lighter: "#1f2b3a"
  typography:
    display:
      family: Playfair Display
      css-var: --font-playfair
      usage: page titles, ritual names, marketing hero
    ui:
      family: Inter
      css-var: --font-inter
      usage: body text, labels, forms on marketing and gateway surfaces
    accessible:
      family: Lexend
      css-var: --font-dyslexia-friendly
      usage: global fallback the accessibility provider can activate
    base:
      family: Geist Sans
      css-var: --font-sans
      usage: html default and product chrome
    mono:
      family: Geist Mono
      css-var: --font-mono
      usage: code, ids, technical strings
  rounded:
    sm: 2px
    md: 6px
    lg: 10px
    xl: 14px
    full: 9999px
  spacing:
    xs: 4px
    sm: 8px
    md: 16px
    lg: 24px
    xl: 32px
    xxl: 48px
```

## Overview

Evonaire is a wellness platform for guided rituals and reflection.
The interface should feel like a quiet room. Dark surfaces with one
warm accent and generous whitespace. Every role shares the same calm
register.

## Colors

The palette has one accent family and one neutral family. That
restraint is the design.

Gold (#d9b574, with #f0d9a5 light and #b8975a muted) is the only
interactive accent. It marks primary actions and active states.
Focus rings and sacred or premium moments use it too. Dark navy carries all structure.
The page sits on #0f171e, cards on #1a2230, raised surfaces on
#1f2b3a, and borders on #2a3848. Cream (#f3e5c8) and warm white
(#f6f2e8) are the text colors. Pure white and pure black never appear.
Muted text (#b3b3b3) covers metadata and captions. Destructive
(#c44040) is reserved for errors and destructive flows & never
appears decoratively.

When a design needs emphasis, spend gold weight or surface elevation
before introducing any new hue.

## Typography

Four families load in `app/layout.tsx` and surface as CSS variables.

Playfair Display (`--font-playfair`, exposed as `--font-display`) is
the serif voice for page titles and ritual titles. A page gets one or
two display moments. Inter (`--font-inter`, `--font-ui-light`) handles
body text and forms across marketing & gateway surfaces.
Lexend (`--font-dyslexia-friendly`) is loaded for readability and the
accessibility provider can switch the UI to it, so new code respects
that setting. Geist Sans and Geist Mono (`--font-sans`, `--font-mono`)
are the app default for dashboard and product chrome.

Headings pair the serif display face with sans body. Body copy avoids
Playfair. Keep line lengths near 65 to 75 characters on reading
surfaces like reflections and rituals.

## Spacing and layout

The app uses Tailwind's default 4px scale. Page containers cap at
`max-w-5xl` or `max-w-7xl` with `px-4` on mobile. Cards use
`rounded-2xl` with `border border-border` and `bg-card`. The
`rounded-xl` variant is for inputs and smaller containers. Vertical
rhythm between sections runs `space-y-8` to `space-y-12`, and inside
cards `space-y-4` to `space-y-6`. Touch targets stay at least 44px
tall (`h-11`, `h-12`) on mobile.

## Components

UI primitives live in `components/ui/` as thin wrappers over Radix UI
styled with Tailwind. Feature components live under
`components/<area>/` and `app/<route>/`.

Buttons come from `components/ui/button.tsx`. Primary actions use the
gold treatment (`bg-primary text-primary-foreground` or explicit
`bg-gold text-dark-navy`). Secondary actions are bordered or muted.
Destructive actions use `variant="destructive"`.

Form inputs are `bg-dark-navy` or `bg-input` with
`border-gold/20`, `rounded-xl`, `h-12`, and gold focus rings
(`focus:border-gold/60 focus:ring-gold/30`). Labels are `text-sm` at
70% foreground opacity.

Cards are `bg-card border-border rounded-2xl`. Depth comes from the
border and surface step. Gold glow shadows
(`shadow-[0_0_20px_rgba(217,181,116,0.15)]`) are reserved for hero and
ceremonial moments.

Feedback uses `sonner` toasts through `<Toaster richColors />` in
`AppShell`. Inline errors render `text-red-300` on dark surfaces.
Icons come from `lucide-react` at `w-4 h-4` inline or `w-5 h-5` in
headers, and never carry meaning alone.

## Voice and content

The product speaks calmly and plainly. Ritual and reflection content
is user-generated. It renders without editorial framing. Error messages stay gentle but specific ("This activation
link has expired" beats "Something went wrong"). Empty states invite
action.

## What not to do

- No pure white backgrounds or pure black text.
- No new accent colors, gradients, or neon.
- No emoji in UI chrome.
- No modal-heavy flows for routine actions. Prefer inline expansion
  or dedicated routes.
- No telemetry of user text. `lib/analytics.ts` documents the privacy
  constraints already enforced.

# Handoff: LinkDude auth screens redesign (sign-in + sign-up)

## Overview

A redesign of the `(auth)` split-panel screens so they share the visual language of the redesigned
marketing landing page: large uppercase display type with an italic serif accent clause, a visible
1px rail grid, monospace labels, one accent blue, and page-wide grain + scanline texture.

The current screens are structurally right — the split panel, the shared shell, the Google-only
form — but visually they're a bare headline and a small card on flat black, so they read as a
different product from the page the visitor just came through. This redesign keeps the structure and
every documented behaviour, and rebuilds the surface.

Target files:

- `src/components/global/auth/auth-shell.tsx` — the split shell (brand panel + form panel)
- `src/components/global/auth/auth-form.tsx` — `GoogleOnlyForm`, `AuthHeading`, `AuthError`,
  `GoogleButton`, and `SignUpForm`'s check-your-email state
- `src/app/(auth)/sign-in/page.tsx` and `sign-up/page.tsx` stay as they are (thin route shells)

Scope note: this covers the **Google-only mode** (`EMAIL_AUTH_ENABLED=false`), which is what the app
currently renders. The email+password forms are unchanged by this handoff — but the new panel,
heading and button treatments below apply to them too when that flag is on, so style them to match
rather than leaving two visual systems.

## About the design files

The files in this bundle are **design references created in HTML** — a prototype of the intended
look, not production code to copy.

`Sign In - Redesign.dc.html` and `Sign Up - Redesign.dc.html` are self-contained HTML prototypes
using a small custom template runtime (`support.js`) that has nothing to do with your stack.
**Do not port that runtime or its markup.** Recreate the design with the codebase's own patterns:
Next.js App Router, Tailwind v4 with the tokens in `src/app/globals.css`, the existing
`surface-raised` / `bg-grid-lines` / `bg-grain` / `aurora-blob` utilities, `components/ui`
primitives, and `lucide-react` icons.

Open both files in a browser to see the states. Read this README for the values.

## Fidelity

**High-fidelity.** Colors, type, spacing, radii, shadows and copy are final. Two caveats:

- `Instrument Serif` (italic display accent) is not currently loaded in the app. Add it, or fall
  back to a Georgia italic and accept a slightly heavier feel.
- The prototypes' `--acid*` tokens are **blue**, deliberately the same hue family as `--brand`
  (hue 252). They are a lighter, more saturated step of the existing brand blue, not a new colour.
  Map them onto the existing brand ramp in `globals.css` rather than adding a parallel palette.

## Behaviour that must not regress

Two things `auth-shell.tsx` already documents, both of which the prototype preserves and which are
easy to break while restyling:

1. **The form column comes FIRST in the DOM** and is moved right with `order` at `lg`. Tab order and
   screen-reader order must reach the Google button before the sales copy. Keep `lg:order-2` on the
   form column and `lg:order-1` on the brand column; do not reorder the JSX.
2. **The brand column is `hidden … lg:flex`.** Below `lg` it must not render — otherwise it pushes
   the form off the first screen. In the prototype the breakpoint is 1040px; use the existing `lg`
   token rather than introducing a new one. When the brand column is hidden, the logo lockup appears
   inside the form column instead (the current shell already does this with
   `self-center lg:hidden`).

Also unchanged: the screens are **not** entrance-animated (people hit sign-in repeatedly, often with
a password manager already firing). The only motion is ambient — aurora/halo, the pulse dot, the
badge sheen, scanline drift, and one 700ms fade on the teaser line. Everything ambient should stop
under `prefers-reduced-motion: reduce`.

---

## Layout

Root: `min-h-svh`, `display: grid`, one column by default; at `lg` two columns at
`1.02fr 0.98fr`. Both halves share one continuous backdrop — there is no divider rule other than a
single 1px `--rail` border on the brand column's right edge.

Two fixed, page-wide, `pointer-events-none`, `aria-hidden` texture layers (same as the marketing
surfaces):

- **Grain** — `z-50`, `opacity: 0.045`, `mix-blend-mode: overlay`, inline SVG `feTurbulence`
  fractalNoise, `baseFrequency 0.8`, `numOctaves 4`, 160×160 tile. (The existing `bg-grain`
  utility at `opacity-[0.03]` is close enough — nudge to `0.045` if you want to match exactly.)
- **Scanlines** — `z-49`, `opacity: 0.3`,
  `repeating-linear-gradient(to bottom, color-mix(in oklch, oklch(1 0 0) 3%, transparent) 0 1px, transparent 1px 3px)`,
  animated `scanline-drift 1.6s steps(3) infinite` (translateY 0 → 6px). This is new; add it
  alongside `bg-grain`.

### Form column (DOM first, painted right at `lg`)

`position: relative; overflow: hidden`, centered both axes,
`padding: clamp(40px, 6vw, 72px) clamp(24px, 4vw, 56px)`, content in a `max-w-[400px]` column with
`gap: 22px`.

Decorative, `aria-hidden`:

- Horizontal rails — `z-index: -2`, `opacity: 0.35`,
  `repeating-linear-gradient(to bottom, var(--rail) 0 1px, transparent 1px 96px)`, masked
  `radial-gradient(70% 60% at 50% 40%, oklch(0 0 0) 0%, transparent 100%)`.
- Accent glow — `z-index: -1`, `bottom: -300px; right: -160px`, `760 × 620px`,
  `radial-gradient(42% 42% at 50% 50%, color-mix(in oklch, var(--acid) 13%, transparent) 0%, transparent 70%)`.

Contents, in order:

1. **Logo lockup** (`lg:hidden` — the brand column carries it at wide widths): mascot 26×26,
   `border-radius: 7px`, `object-fit: cover`; wordmark in mono 13px/500, `letter-spacing: 0.02em`,
   uppercase; then a 5px `--acid` dot animated `pulse-dot 2.2s ease-in-out infinite` (opacity
   1 → 0.3).
2. **Heading block**, `gap: 10px`, left-aligned (the current `AuthHeading` centers — change it):
   - Kicker: mono 11px, `letter-spacing: 0.14em`, uppercase, `--acid`.
   - `h1`: `clamp(30px, 3.2vw, 40px)`, weight 600, `line-height: 0.96`,
     `letter-spacing: -0.045em`, `text-transform: uppercase`.
   - Description: 14.5px / 1.6, `--muted-fg`, `text-wrap: pretty`.
3. **The panel** — `border-radius: 18px`, `padding: clamp(22px, 2.4vw, 28px)`, `gap: 16px`,
   background `linear-gradient(to bottom, color-mix(in oklch, var(--card) 88%, oklch(1 0 0)), var(--card) 44%)`,
   `box-shadow: inset 0 0 0 1px var(--border), inset 0 1px 0 color-mix(in oklch, oklch(1 0 0) 15%, transparent), 0 40px 90px -50px color-mix(in oklch, var(--brand) 55%, transparent)`.
   This replaces the current `surface-raised rounded-xl border p-6 shadow-xl`; the top-lit 1px inner
   edge plus the brand-tinted drop is what makes it read as lit rather than outlined.
   - **Error slot** (when set) — `border-radius: 11px`, `border: 1px solid oklch(0.42 0.14 25)`,
     `background: color-mix(in oklch, oklch(0.42 0.14 25) 22%, transparent)`, `padding: 11px 13px`,
     13px / 1.5, text `oklch(0.86 0.09 25)`, `role="alert"`. Keep the existing destructive tokens if
     they land in the same place visually.
   - **Google button** — full width, 50px tall, `border-radius: 12px`, `background: var(--acid)`,
     text `oklch(0.12 0.03 252)`, mono 12.5px/500, `letter-spacing: 0.06em`, uppercase, `gap: 10px`,
     `box-shadow: 0 16px 40px -14px color-mix(in oklch, var(--acid) 70%, transparent), inset 0 1px 0 color-mix(in oklch, oklch(1 0 0) 40%, transparent)`.
     Label `Continue with Google` with the existing inline `GoogleGlyph` at 16px. **Pending state:**
     label becomes `Opening Google…`, the glyph is replaced by a 16px ring spinner
     (`border: 2px solid color-mix(in oklch, oklch(1 0 0) 35%, transparent)`, `border-top-color: oklch(1 0 0)`,
     `spin-loader 700ms linear infinite`), `opacity: 0.72`, `cursor: default`,
     `transition: opacity 240ms ease`. (`Loader2Icon` is fine in place of the hand-rolled ring.)
   - **Assurance list** — above a `border-top: 1px solid var(--rail)` with `padding-top: 16px`,
     `gap: 11px`; each row 12.5px / 1.55 `--muted-fg` with a 13px `--acid-dim` lucide icon,
     `margin-top: 2px`, `flex: none`. This is the new content that answers the actual hesitation at a
     Google-only wall.
4. **Footer line** — centered mono 10.5px, `letter-spacing: 0.07em`, uppercase, `--dim`:
   `Not affiliated with LinkedIn Corporation.`

### Brand column (DOM second, painted left at `lg`, hidden below)

`display: none` by default, `flex` at `lg`. `flex-direction: column`,
`justify-content: space-between`, `gap: 40px`,
`padding: clamp(28px, 4vw, 52px) clamp(24px, 4vw, 60px)`, `border-right: 1px solid var(--rail)`,
`overflow: hidden`.

Decorative, `aria-hidden`:

- Dot grid — `z-index: -2`, `opacity: 0.5`,
  `radial-gradient(color-mix(in oklch, oklch(1 0 0) 13%, transparent) 1px, transparent 1px)`,
  `background-size: 26px 26px`, masked
  `radial-gradient(72% 60% at 30% 12%, oklch(0 0 0) 0%, transparent 100%)`.
- Brand halo — `z-index: -1`, `top: -340px; left: -120px`, `900 × 760px`,
  `radial-gradient(40% 40% at 50% 50%, color-mix(in oklch, var(--brand) 26%, transparent) 0%, transparent 70%)`,
  animated `halo-breathe 11s ease-in-out infinite` (opacity 0.7 → 1, scale 1 → 1.07). The existing
  `aurora-blob` + `animate-aurora-*` utilities cover this.

Contents:

1. **Logo lockup** — same as above, but `aria-hidden="true"` and `tabindex="-1"`, because the form
   column already exposes a real one and this is the visual duplicate.
2. **Middle block**, `gap: clamp(24px, 3vw, 34px)`, `max-width: 30em`:
   - **Badge** — mono 11px, `letter-spacing: 0.1em`, uppercase, `--acid`,
     `border: 1px solid var(--acid-soft)`,
     `background: color-mix(in oklch, var(--acid-soft) 34%, transparent)`, `padding: 6px 15px`,
     `border-radius: 9999px`, `white-space: nowrap`, containing a 5px pulsing dot and a sheen
     overlay (`sheen-sweep 6.5s cubic-bezier(0.77,0,0.175,1) infinite`, a 50%-wide
     `linear-gradient(to right, transparent, color-mix(in oklch, var(--acid) 26%, transparent), transparent)`
     translating -140% → 240%). Copy: `Free forever · no card`.
   - **Headline** — `clamp(36px, 4.6vw, 62px)`, weight 600, `line-height: 0.92`,
     `letter-spacing: -0.05em`, uppercase, `text-wrap: balance`. Copy is the existing string, split:
     `You're one post away from becoming a` in Geist, then `LinkedIn influencer.` in
     **Instrument Serif italic 400**, `text-transform: none`, `letter-spacing: -0.02em`,
     `color: var(--acid)`. Note this is an `h2`/`p` in the brand column, **not** an `h1` — the form
     column's heading owns `h1` now, since it comes first in the document.
   - **Subhead** — `clamp(15px, 1.3vw, 17px)` / 1.65, `--muted-fg`, `max-width: 30em`,
     `text-wrap: pretty`. Existing copy, `APP_NAME` interpolated as today.
   - **Mascot speech bubble** — `display: flex; align-items: flex-end; gap: 12px`. The bubble is
     `flex: 1`, `border-radius: 16px 16px 4px 16px`, the same top-lit panel gradient and
     `inset 0 0 0 1px var(--border)` + `inset 0 1px 0 …15%` as the form panel,
     `padding: 16px 18px`, `gap: 10px`, containing: a mono 10px `letter-spacing: 0.12em` uppercase
     `--dim` label `Drafted while you were away`; the teaser line at 13.5px / 1.62 fading in with
     `line-in 700ms 120ms cubic-bezier(0.23,1,0.32,1)` (opacity 0→1, `translateY(6px)`→0,
     `blur(3px)`→0); and a chip row. The tail is an 11×11px `rotate(45deg)` square at
     `right: -5px; bottom: 11px`, filled `color-mix(in oklch, var(--card) 96%, oklch(1 0 0))` to
     match the bubble edge it attaches to, with `box-shadow: 1px -1px 0 0 var(--border)`.
     The mascot image sits right of the bubble at `clamp(64px, 7vw, 84px)`, `flex: none`, masked
     `radial-gradient(closest-side, oklch(0 0 0) 74%, transparent 100%)`. The effect is the mascot
     showing you what was waiting while you were gone.
     - Chips: `calendar-check` + `Tue 9:00 AM` in the accent treatment
       (`background: color-mix(in oklch, var(--acid-soft) 78%, transparent)`,
       `box-shadow: inset 0 0 0 1px color-mix(in oklch, var(--acid) 30%, transparent)`,
       `border-radius: 8px`, `padding: 6px 10px`, mono 10px, `letter-spacing: 0.07em`, uppercase,
       `--acid`), and a `--dim` label `3 more in the queue`. **Both need `white-space: nowrap`** —
       without it the time chip breaks as "TUE 9:00 / AM".
     - Teaser line copy: `We priced our first ten customers wrong. All ten. Not too high — too
       specific…`
3. **Free-tier strip** — `display: grid; grid-template-columns: repeat(auto-fit, minmax(96px, 1fr))`,
   `gap: 1px`, `background: var(--rail)`, `border: 1px solid var(--rail)`, `border-radius: 14px`,
   `overflow: hidden`, `max-width: 34em` (the 1px gap over a rail background is what draws the
   internal grid lines). Each cell: `background: oklch(0.015 0 0)`, `padding: 16px 14px`, `gap: 6px`;
   figure `clamp(22px, 2.2vw, 30px)`, weight 600, `line-height: 0.9`, `letter-spacing: -0.05em`,
   tabular; label mono 9.5px, `letter-spacing: 0.1em`, uppercase, `--dim`.
   Cells: **10** Posts / mo (figure in `--acid`) · **25** AI generations · **2** Carousels ·
   **3** Profile analyses. Source these from `plans.ts` / `resources.ts` like the marketing page
   does — don't hardcode.

---

## Per-screen content

### Sign-in (`/sign-in`)

| Slot | Copy |
|------|------|
| Kicker | `Sign in` |
| Heading | `Welcome back` |
| Description | `Sign in with your Google account to continue.` |
| Button | `Continue with Google` |
| Assurance 1 | `shield-check` — `Nothing posts to LinkedIn until you approve it.` |
| Assurance 2 | `credit-card` — `No card required. The free plan has no trial timer.` |
| Assurance 3 | `log-out` — `Disconnect your LinkedIn account at any time.` |

### Sign-up (`/sign-up`)

Same shell and the same brand panel. Differences:

| Slot | Copy |
|------|------|
| Kicker | `Create an account` |
| Heading | `Start posting` |
| Description | `Sign up with your Google account to get started.` |
| Button | `Continue with Google` |
| Assurance 1 | `credit-card` — `No card required. The free plan has no trial timer.` |
| Assurance 2 | `shield-check` — `Nothing posts to LinkedIn until you approve it.` |
| Assurance 3 | `sparkles` — `First post drafted in about a minute after you connect.` |

The assurance order flips deliberately: a returning user cares about safety first, a first-time
visitor about cost.

Note the existing `GoogleOnlyForm` renders heading `Create an account` for sign-up; the redesign
moves that string to the kicker and gives the `h1` `Start posting`, so the largest words on the page
are an action rather than a form name. Keep `Welcome back` as-is on sign-in.

### Sign-up: check-your-email state

Replaces the button and assurance list inside the same panel (the heading block above it changes
too). This is `SignUpForm`'s existing post-submit branch, restyled — same trigger, same copy.

- Heading block becomes kicker `Almost there`, `h1` `One click left`, description
  `We just need to confirm the address before your workspace opens.`
- Panel content, `gap: 14px`: a 46×46 `border-radius: 12px` mark with
  `background: color-mix(in oklch, var(--acid-soft) 78%, transparent)`,
  `box-shadow: inset 0 0 0 1px color-mix(in oklch, var(--acid) 30%, transparent)`, holding a 21px
  `mail-check` icon in `--acid`; then `Check your email` at 19px weight 600
  `letter-spacing: -0.02em`; then `We sent a verification link to <email>. Click it to finish
  creating your account.` at 13.5px / 1.62 `--muted-fg`, with the address in **mono 12.5px** at full
  white; then a 42px `border: 1px solid var(--border)` `border-radius: 11px` mono 11.5px uppercase
  `Back to sign in` link to `AUTH_ROUTES.signIn`.
- The error slot is suppressed in this state.

---

## State

All local, no new server state:

| State | Type | Purpose |
|-------|------|---------|
| `error` | `string \| null` | Error banner — already in `useAuthEffects` |
| `google.isPending` | boolean | Button pending state — already in `useAuthEffects` |
| `submittedEmail` | `string \| null` | Drives the check-your-email branch — already in `SignUpForm` |

Nothing new is needed; the redesign is presentational over the existing hooks.

## Design tokens

Same ramp as the landing-page handoff. Everything is oklch.

| Token | Value | Use |
|-------|-------|-----|
| page background | `oklch(0.015 0 0)` | Both columns |
| foreground | `oklch(0.99 0 0)` | Primary text |
| `--brand` | `oklch(0.58 0.155 252)` | Halo, panel drop shadow |
| `--brand-soft` | `oklch(0.24 0.045 252)` | Avatar-style fills |
| `--brand-soft-fg` | `oklch(0.82 0.085 252)` | On `--brand-soft` |
| `--brand-border` | `oklch(0.36 0.065 252)` | Brand-tinted hairlines |
| `--acid` | `oklch(0.74 0.145 252)` | Accent: button, kicker, italic clause, chips |
| `--acid-dim` | `oklch(0.62 0.15 252)` | Assurance icons |
| `--acid-soft` | `oklch(0.25 0.055 252)` | Accent surfaces (badge, chips, mail mark) |
| accent foreground | `oklch(0.12 0.03 252)` | Text on the filled accent button |
| `--card` | `oklch(0.135 0 0)` | Panel base |
| `--muted-fg` | `oklch(0.7 0 0)` | Body copy |
| `--dim` | `oklch(0.52 0 0)` | Mono labels |
| `--border` | `oklch(0.25 0 0)` | Panel borders |
| `--rail` | `oklch(0.175 0 0)` | Grid lines, dividers |

**Type.** `Geist` 300–700, `Geist Mono` 400–500 (all labels, buttons, metadata),
`Instrument Serif` italic 400 (display accent clause — new).

**Radii.** 7px (logo mark) · 8px (chips) · 11–12px (buttons, error, mail mark) · 14px (stat strip) ·
16px (bubble, with a 4px corner on the tail side) · 18px (form panel) · 9999px (badge, dots).

**Motion.** Ambient only: `pulse-dot 2.2–2.4s` · `sheen-sweep 6.5s cubic-bezier(0.77,0,0.175,1)` ·
`halo-breathe 11s` · `scanline-drift 1.6s steps(3)` · `spin-loader 700ms` (pending only) ·
`line-in 700ms cubic-bezier(0.23,1,0.32,1)` (teaser, once). No entrance animation on the form.

## Assets

`assets/linkdin-dude.png` is the existing mascot (`src/app/assets/images/linkdin-dude.png`) — used
at 26px in the lockups, `clamp(64px, 7vw, 84px)` beside the bubble. Already in the repo.

Icons are lucide: `calendar-check`, `shield-check`, `credit-card`, `log-out`, `sparkles`,
`mail-check`. Use `lucide-react` as the codebase already does.

## Files

- `Sign In - Redesign.dc.html` — sign-in reference (Tweaks: error message, teaser line).
- `Sign Up - Redesign.dc.html` — sign-up reference (Tweaks: check-your-email state, submitted
  email, error message, teaser line).
- `support.js` — prototype runtime. Not part of the design; do not port.
- `assets/linkdin-dude.png` — mascot, for reference.

## Notes for implementation

- **New copy goes in config, not JSX.** The assurance lines, kicker strings, teaser line and the
  bubble label are new; put them alongside the existing auth copy rather than inline.
- **Keep the shell shared.** `forgot-password`, `reset-password` and `accept-invitation` all render
  inside `AuthShell` too. The brand panel restyle lands on all five routes for free; check those
  three still look right, since their form panels have different content heights.
- **The teaser bubble is decorative.** It implies a queued draft that a brand-new visitor doesn't
  have. That's fine on the brand panel (it's `aria-hidden`-adjacent sales copy, and the same bubble
  appears on the landing page) — but don't wire it to real data, and don't let it imply an existing
  account on `/sign-up`.
- Accessibility: keep the form column first in the DOM; the brand column's duplicate lockup is
  `aria-hidden` + `tabindex="-1"`; the error slot keeps `role="alert"`; the Google button keeps its
  disabled state while pending; check `--dim` mono text contrast at 9.5–10.5px if you shrink it
  further.

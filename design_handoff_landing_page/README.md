# Handoff: LinkDude marketing landing page redesign

## Overview

A full redesign of the `(marketing)` landing page for LinkDude — the AI LinkedIn posting tool. The
existing page is a stack of ten generic SaaS sections (hero, capability marquee, problem cards, six
identical feature cards, how-it-works, free-tier band, pricing, comparison table, FAQ, final CTA)
that never shows the product. The redesign cuts it to six sections, puts a live app demo directly
under the headline, and rebuilds the visual language around large display type, a visible grid, and
one accent blue.

Target route: `src/app/(marketing)/page.tsx` and its `_components/`.

## About the design files

The files in this bundle are **design references created in HTML** — a prototype showing the
intended look and behaviour, not production code to copy directly.

`Landing Page - Cool v3.dc.html` is a self-contained HTML prototype (it uses a small custom
template runtime, `support.js`, that has nothing to do with your stack). **Do not port that runtime
or its markup wholesale.** The task is to recreate this design in the existing codebase using its
established patterns: Next.js App Router, React server/client components, Tailwind v4 with the
tokens already defined in `src/app/globals.css`, the `src/components/ui/*` primitives (Card,
Button, Badge), `lucide-react` icons, and the existing content in `src/lib/config/marketing.ts`
and `src/lib/config/plans.ts`.

Open the HTML file in a browser to see the motion and interaction. Read this README for the values.

## Fidelity

**High-fidelity.** Colors, typography, spacing, radii, shadows, motion timings and copy are all
final. Recreate the UI pixel-perfectly using the codebase's existing libraries.

Two caveats:

- The prototype hardcodes plan and limit data. In the real page, keep sourcing it from
  `plans.ts` / `resources.ts` as the current page already does — the numbers in this document
  came from those files and should stay generated, not literal.
- The prototype uses `Instrument Serif` for italic display clauses. That font is not currently
  loaded in the app; add it (see Design tokens) or substitute per the fallback note.

## Section order

The redesign is six sections plus header and footer. Sections the current page has that the
redesign **deletes**: `CapabilityMarquee` as a standalone band (it becomes a thin ticker),
`ProblemCards` (its content is absorbed into the loop copy), `HowItWorks` (absorbed into the loop),
the standalone `FreeTierStats` band (becomes the counter row), and `PlanComparisonTable` as an
always-visible section (becomes a collapsed disclosure inside pricing).

1. Header (sticky)
2. Hero + live app demo
3. Capability ticker
4. Free-tier counter row
5. `01 / The loop` — Write / Ship / Land
6. `02 / Inside` — bento of six surfaces
7. `03 / Pricing` — four plans + collapsed comparison
8. `04 / Questions` — FAQ
9. Final CTA
10. Footer

Everything from the header down sits inside a centered `max-w-[1240px]` column with a **1px left and
right border** in `--rail`. Section boundaries are 1px `--rail` borders. This visible grid is the
single most important structural detail of the design — without it the page reads as loose cards.

---

## Screens / Views

There is one view. Each section is documented below.

### Global page shell

- Background `oklch(0.015 0 0)`, text `oklch(0.99 0 0)`, font `Geist`, base 16px / 1.5.
- Fixed decorative layers, all `pointer-events: none`:
  - **Brand halo** — `z-index: -30`, `position: fixed`, `left: 50%`, `top: -560px`,
    `1500 × 1000px`, `radial-gradient(40% 40% at 50% 50%, color-mix(in oklch, var(--brand) 24%, transparent) 0%, transparent 70%)`,
    animated `halo-breathe 11s ease-in-out infinite` (opacity 0.65 → 1, scale 1 → 1.07, keeping the
    `translateX(-50%)` in every keyframe).
  - **Grain** — `z-index: 60`, `opacity: 0.045`, `mix-blend-mode: overlay`, inline SVG
    `feTurbulence` fractalNoise, `baseFrequency 0.8`, `numOctaves 4`, 160×160 tile.
  - **Scanlines** — `z-index: 59`, `opacity: 0.35`,
    `repeating-linear-gradient(to bottom, color-mix(in oklch, oklch(1 0 0) 3%, transparent) 0 1px, transparent 1px 3px)`,
    animated `scanline-drift 1.6s steps(3) infinite` (translateY 0 → 6px).

### 1. Header (sticky)

- `position: sticky; top: 0; z-index: 50`. Background
  `color-mix(in oklch, oklch(0.015 0 0) 74%, transparent)`, `backdrop-filter: blur(22px) saturate(1.4)`,
  bottom border 1px `color-mix(in oklch, var(--rail) 65%, transparent)`.
- Inner row: `max-w-[1240px]`, `min-height: 62px`, `padding: 10px clamp(20px, 3vw, 44px)`,
  `display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 16px; row-gap: 10px`.
- **Left** — logo mark (`linkdin-dude.png`, 26×26, `border-radius: 7px`, `object-fit: cover`) +
  wordmark "LinkDude" in mono 13px/500, `letter-spacing: 0.02em`, uppercase + a 5px accent dot
  animated `pulse-dot 2.2s ease-in-out infinite` (opacity 1 → 0.3).
- **Center** — nav pill: `border: 1px solid var(--rail)`, `border-radius: 9999px`, `padding: 4px`,
  items `padding: 6px 14px`, mono 11.5px, `letter-spacing: 0.06em`, uppercase, `--muted-fg`.
  Links: The loop, Inside, Pricing, FAQ. **Responsive:** the pill is `order: 3; flex: 1 1 100%`, so
  below roughly 1000px it wraps onto its own centered row instead of colliding with the CTA.
- **Right** — "Sign in" (mono 11.5px uppercase, `--muted-fg`) and primary CTA: 34px tall,
  `border-radius: 9px`, background `var(--acid)`, text `oklch(0.12 0.03 252)`, mono 11.5px/500,
  `letter-spacing: 0.05em`, uppercase, `white-space: nowrap`, `flex: none`,
  `box-shadow: 0 0 24px -6px color-mix(in oklch, var(--acid) 55%, transparent)`, trailing
  `arrow-right` icon 13px.

### 2. Hero

Padding `clamp(48px, 7vw, 92px) clamp(20px, 3vw, 44px) 0`, `overflow: hidden`, centered text.

- **Dot grid** behind it: `z-index: -1`, `opacity: 0.5`,
  `radial-gradient(color-mix(in oklch, oklch(1 0 0) 13%, transparent) 1px, transparent 1px)`,
  `background-size: 26px 26px`, masked with
  `radial-gradient(62% 55% at 50% 8%, oklch(0 0 0) 0%, transparent 100%)`.
- **Eyebrow pill** — mono 11px, `letter-spacing: 0.1em`, uppercase, `--acid` text,
  `border: 1px solid var(--acid-soft)`, background `color-mix(in oklch, var(--acid-soft) 34%, transparent)`,
  `padding: 6px 15px`, `border-radius: 9999px`. Contains a 5px pulsing dot and an animated sheen
  overlay (`sheen-sweep 6.5s cubic-bezier(0.77,0,0.175,1) infinite`, a 50%-wide
  `linear-gradient(to right, transparent, color-mix(in oklch, var(--acid) 26%, transparent), transparent)`
  translating from -140% to 240%). Copy: `For founders who keep meaning to post`.
- **H1** — `font-size: clamp(46px, 8.6vw, 132px)`, weight 600, `line-height: 0.86`,
  `letter-spacing: -0.055em`, `text-transform: uppercase`, `max-width: 13em`, `text-wrap: balance`.
  Line 1 `You already know` in Geist; line 2 `what to say.` in **Instrument Serif italic 400**,
  `text-transform: none`, `letter-spacing: -0.02em`, color `var(--acid)`. This two-part
  display/italic pairing repeats in every section heading and is the core typographic idea.
- **Subhead** — `clamp(16px, 1.4vw, 19px)`, `line-height: 1.62`, `max-width: 32em`, `--muted-fg`,
  `text-wrap: pretty`. Copy: `Type the thing you already know. LinkDude writes it as a post in your
  voice, queues it for the morning it should go out, and fixes the profile people land on when it
  works.`
- **Buttons** — primary 52px tall, `border-radius: 12px`, `padding: 0 26px`, background `var(--acid)`,
  text `oklch(0.12 0.03 252)`, mono 13px/500, `letter-spacing: 0.06em`, uppercase,
  `box-shadow: 0 16px 40px -14px color-mix(in oklch, var(--acid) 70%, transparent), inset 0 1px 0 color-mix(in oklch, oklch(1 0 0) 40%, transparent)`,
  trailing `arrow-right` 15px. Secondary same height, `border: 1px solid var(--rail)`,
  `padding: 0 22px`, `--muted-fg`, label `See the loop`.
- **Reassurance line** — mono 12px, `letter-spacing: 0.06em`, `--dim`:
  `Free forever · no card · no trial timer`.

#### The app demo frame

The single most important element on the page. It bleeds to the column edges
(`margin: clamp(36px, 5.5vw, 72px) calc(-1 * clamp(20px, 3vw, 44px)) -1px`) and is cut off by the
section border, so it reads as a window into the app.

- Frame: `border: 1px solid var(--border)`, no bottom border, `border-radius: 18px 18px 0 0`,
  `padding: 13px`, background
  `linear-gradient(to bottom, color-mix(in oklch, var(--card) 90%, oklch(1 0 0)), var(--card) 42%)`,
  `box-shadow: inset 0 1px 0 color-mix(in oklch, oklch(1 0 0) 14%, transparent), 0 50px 130px -50px color-mix(in oklch, var(--brand) 46%, transparent)`.
- Title bar: three 9px `--rail` dots, centered mono 11px `app.linkdude.com / create`, right-aligned
  mono 11px generation counter.
- Body: `display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 13px`,
  three children — sidebar (`max-width: 190px`), composer (`grid-column: span 2`), queue
  (`max-width: 260px`). Each child: `border-radius: 13px`, background `oklch(0.015 0 0)`.
  - **Sidebar** — six nav rows (Create post `sparkles`, Calendar `calendar-days`, Posts
    `file-stack`, Content plan `compass`, Profile `user-search`, Carousel `layers`), mono 11px,
    icon 15px, `padding: 8px 10px`, `border-radius: 9px`. Active row (Create post):
    background `color-mix(in oklch, var(--acid-soft) 70%, transparent)`, text `var(--acid)`,
    `box-shadow: inset 0 0 0 1px color-mix(in oklch, var(--acid) 28%, transparent)`.
    Inactive: `--dim`.
  - **Composer** — topic input (`border: 1px solid var(--border)`, `border-radius: 11px`,
    `padding: 12px 14px`, `min-height: 44px`, mono 12.5px), four tone chips (first active in the
    accent treatment above, rest `border: 1px solid var(--border)` / `--dim`; labels
    Founder voice, Contrarian, Story, Teardown), a `min-height: 232px` post area with 34px avatar
    "PR" on `--brand-soft` / `--brand-soft-fg`, name `Priya Raman`, mono 10px status line, and the
    four post paragraphs at 13.5px / 1.66; then an action row (Publish, a
    `calendar-check` + `Tue 9:00 AM` button, and a mono hint).
  - **Queue** — header `Queue` / `NEXT 7 DAYS`, then four cards (`border-radius: 10px`,
    `padding: 10px 11px`, background `color-mix(in oklch, var(--card) 65%, transparent)`) each with
    a mono 10px time and an 11.5px title.

Exact post copy (four paragraphs):

```
We priced our first ten customers wrong. All ten.
Not too high — too specific. A number per feature taught them to buy features instead of outcomes.
The eleventh got one number and one promise. She closed in a day.
Price the outcome. Let the features be free.
```

Topic string: `what I learned pricing our first ten customers`

### 3. Capability ticker

Thin band, `padding: 14px 0`, background `color-mix(in oklch, var(--card) 24%, transparent)`,
`overflow: hidden`, bottom border 1px `--rail`. Inner track is the twelve capability names rendered
**twice** back to back in a `width: max-content` flex row with `gap: 30px`, animated
`ticker-run 46s linear infinite` (`translateX(0)` → `translateX(-50%)`). Items: mono 11.5px,
`letter-spacing: 0.13em`, uppercase; every third item `--acid-dim`, the rest `--dim`.

Order: LinkedIn posts, AI generation, Carousels, Content plans, Profile analysis, Profile lookups,
AI image edit, Content calendar, Post library, Deep profile insights, Team members, Audit logs.

### 4. Free-tier counter row

`display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr))`. Five cells, each
`padding: clamp(26px, 3.4vw, 40px) 12px`, centered, `gap: 12px`, with a 1px `--rail` **left** border
on all but the first.

- Figure: `clamp(40px, 5.4vw, 74px)`, weight 600, `line-height: 0.86`, `letter-spacing: -0.06em`,
  `font-variant-numeric: tabular-nums`. First cell (`10 Posts`) is `--acid`; the rest
  `oklch(0.99 0 0)`.
- Label: mono 10.5px, `letter-spacing: 0.1em`, uppercase, `--dim`.
- Values: 10 Posts · 25 AI generations · 2 Carousels · 3 Profile analyses · 1 Content plan.
- Footer line under a 1px `--rail` border: `padding: 13px clamp(20px, 3vw, 44px)`, centered,
  mono 11px uppercase `--dim`: `Every month, on the free plan, before you ever enter a card.`

These figures **count up** — see Interactions.

### 5. `01 / The loop`

Padding `clamp(64px, 8vw, 108px) clamp(20px, 3vw, 44px)`.

- Header row: `display: flex; align-items: flex-end; justify-content: space-between; gap: 44px; flex-wrap: wrap`.
  - Kicker: mono 11px, `letter-spacing: 0.14em`, uppercase, `--acid`: `01 / The loop`.
  - H2: `clamp(36px, 5.4vw, 72px)`, weight 600, `letter-spacing: -0.055em`, `line-height: 0.9`,
    uppercase, `max-width: 20em` — `Write it. Ship it.` + `Land it.` in Instrument Serif italic
    `--acid`.
  - Right paragraph, `max-width: 25em`, 16px / 1.65, `--muted-fg`: `Three jobs in the order they
    actually happen. Each one is useful alone — together they're the reason the posting sticks past
    week two.`
- Then three rows, each `border-top: 1px solid var(--rail)`,
  `padding: clamp(28px, 3.4vw, 46px) 0`,
  `display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: clamp(20px, 4vw, 56px); align-items: start`.
  - **Column 1** — outlined ghost numeral: `clamp(56px, 7vw, 104px)`, weight 600,
    `line-height: 0.74`, `letter-spacing: -0.07em`, `color: transparent`,
    `-webkit-text-stroke: 1px color-mix(in oklch, var(--acid) 55%, transparent)`; beside it a mono
    11px `letter-spacing: 0.14em` uppercase `--acid` kicker (Write / Ship / Land).
  - **Column 2** — H3 `clamp(22px, 2.3vw, 32px)`, weight 600, `letter-spacing: -0.035em`,
    `line-height: 1.06`.
  - **Column 3** — body 15px / 1.68 `--muted-fg`, then the **mascot speech bubble**:
    `display: flex; align-items: flex-end; gap: 10px`; bubble is `flex: 1`,
    `border-radius: 14px 14px 4px 14px`, background
    `color-mix(in oklch, var(--acid-soft) 62%, transparent)`,
    `box-shadow: inset 0 0 0 1px color-mix(in oklch, var(--acid) 26%, transparent)`,
    `padding: 13px 15px`, text mono 11.5px / 1.65 `--acid`; a tail sits at `right: -5px; bottom: 9px`,
    `11×11px`, `transform: rotate(45deg)`, same background,
    `box-shadow: 1px -1px 0 0 color-mix(in oklch, var(--acid) 26%, transparent)`; then the mascot
    image at 58px wide, `flex: none`, masked with
    `radial-gradient(closest-side, oklch(0 0 0) 74%, transparent 100%)`. The effect is the mascot
    telling the user the proof point.

Row content:

| # | Kicker | Title | Body | Bubble (mascot line) |
|---|--------|-------|------|----------------------|
| 01 | Write | A post, not a first draft | Type a topic. It comes back with a hook built to earn the "see more" click, in the voice your profile and your answers taught it. Edit any line before it goes anywhere. | Publishes over LinkedIn OAuth. Crop an image, or describe the change and let AI redraw it. |
| 02 | Ship | Queued, not remembered | Publish now, or drop it on the calendar for the morning it should go out. Scheduled posts fire on their own, and drafts cost you nothing until they do. | Reschedule or cancel anything up to the moment it fires. |
| 03 | Land | The profile catches it | A post that works sends people to your profile. Paste it in and get a score, a critique per section, and rewrites for the headline and About people actually read. | Per-role and per-project rewrites on paid plans. |

### 6. `02 / Inside` — bento

Kicker `02 / Inside`; H2 `clamp(34px, 5vw, 68px)` uppercase, `max-width: 17em`:
`Six surfaces you'd otherwise open` + `six tabs for.` (Instrument Serif italic, `--acid`).

Grid: `repeat(auto-fit, minmax(280px, 1fr))`, `gap: 16px`. Every tile:
`border-radius: 16px`, `padding: clamp(20px, 2.2vw, 28px)`, background
`linear-gradient(to bottom, color-mix(in oklch, var(--card) 88%, oklch(1 0 0)), var(--card) 44%)`,
`box-shadow: inset 0 0 0 1px var(--border), inset 0 1px 0 color-mix(in oklch, oklch(1 0 0) 15%, transparent)`,
`transition: transform 320ms cubic-bezier(0.23,1,0.32,1)`. Tile label is mono 10.5px,
`letter-spacing: 0.12em`, uppercase, `--dim`; tile H3 weight 600, `letter-spacing: -0.035em`.

- **Content calendar** (`grid-column: span 2`) — heading `Your cadence, visible`, body
  `Everything scheduled and everything published on one grid. A gap you can see is a gap you fill —
  the month you notice late is the month you stop.`, right-aligned mono `9 scheduled · 2 gaps` in
  `--acid`, then a `repeat(7, 1fr)` day grid, `gap: 6px`, cells 30px tall, `border-radius: 8px`,
  mono 10.5px tabular. Cell states: out-of-month `color-mix(in oklch, var(--dim) 40%, transparent)`;
  published (days 2, 4, 9, 11, 13) `background: color-mix(in oklch, oklch(1 0 0) 13%, transparent)`
  with white text; scheduled (16, 18, 20, 23, 25, 27, 30)
  `background: color-mix(in oklch, var(--acid-soft) 85%, transparent)`, text `--acid`,
  `box-shadow: inset 0 0 0 1px color-mix(in oklch, var(--acid) 32%, transparent)`; empty
  `background: color-mix(in oklch, oklch(1 0 0) 4%, transparent)`, text `--dim`. The mock month
  starts on a Wednesday (two blank leading cells, 35 total).
- **Profile analysis** — heading `Fix what the click lands on`, body `A score, a section-by-section
  critique, and rewrites you can paste straight back in.`, then the score `82` at
  `clamp(44px, 4.6vw, 62px)` weight 600 `letter-spacing: -0.06em` in `--acid` with a mono `/ 100`,
  a 5px track (`background: var(--muted)`) with an 82% fill
  `linear-gradient(to right, var(--acid-dim), var(--acid))` and
  `transition: width 900ms cubic-bezier(0.23,1,0.32,1)`, then three rows — Headline `Rewrite ready`,
  About `Rewrite ready`, Experience `Strong`. Verdicts are mono 10.5px uppercase; "ready" states in
  `--acid`, `Strong` in `--dim`. The score also counts up.
- **Three equal tiles** — each with three mock rows (`border-radius: 9px`,
  `background: color-mix(in oklch, oklch(0.015 0 0) 65%, transparent)`, `padding: 9px 11px`, left
  label 11.5px `--muted-fg` truncated, right value mono 10px uppercase):
  - *Carousels* — `Decks that stop the scroll` / `A topic becomes a 3–12 slide deck, rendered to a
    real PDF and published as a swipeable document.` Rows: Cover · Pricing mistakes `01`,
    The number per feature `02`, One number, one promise `03`.
  - *Post library* — `Nothing you wrote gets lost` / `Drafts, scheduled, published and failed in one
    list. A draft never spends a post.` Rows: Pricing our first ten `Scheduled`, Hiring slowly on
    purpose `Draft`, The 90-day question `Published`.
  - *Content plan* — `Thirty days, decided` / `A guided chat reads your profile and returns pillars,
    cadence and the next thing to post.` Rows: Pillar · Pricing in public `3×/wk`, Pillar · Hiring
    `1×/wk`, Pillar · Build notes `2×/wk`.

### 7. `03 / Pricing`

Kicker `03 / Pricing`; H2 `Start free.` + `Pay when it's working.` (italic accent); body
`Every plan includes the whole product. What changes is how much of it you can use.`

- **Interval toggle**, right-aligned: wrapper `border: 1px solid var(--rail)`, `border-radius: 11px`,
  `padding: 3px`; buttons `padding: 8px 16px`, `border-radius: 8px`, mono 11.5px/500,
  `letter-spacing: 0.07em`, uppercase. Active: `background: var(--acid)`, text
  `oklch(0.12 0.03 252)`. Inactive: transparent, `--muted-fg`. Below it, mono 11px uppercase
  `--acid`: `Save 17% paying yearly`.
- **Cards** — `repeat(auto-fit, minmax(230px, 1fr))`, `gap: 16px`, `align-items: stretch`. Each:
  `border-radius: 16px`, `padding: clamp(20px, 2.2vw, 26px)`, `gap: 17px`, column flex, full height,
  `transition: transform 320ms cubic-bezier(0.23,1,0.32,1)`.
  - Standard: `background: color-mix(in oklch, var(--card) 48%, transparent)`,
    `box-shadow: inset 0 0 0 1px var(--rail)`.
  - Pro (highlighted): `background: linear-gradient(to bottom, color-mix(in oklch, var(--card) 88%, var(--acid)), var(--card) 52%)`,
    `box-shadow: inset 0 0 0 1px color-mix(in oklch, var(--acid) 34%, transparent), inset 0 1px 0 color-mix(in oklch, oklch(1 0 0) 16%, transparent), 0 28px 70px -34px color-mix(in oklch, var(--acid) 40%, transparent)`,
    plus a `Most popular` pill (`background: var(--acid)`, text `oklch(0.12 0.03 252)`, mono 9.5px,
    `letter-spacing: 0.1em`, uppercase, `padding: 4px 10px`).
  - Plan name: mono 12px/500, `letter-spacing: 0.08em`, uppercase. Price:
    `clamp(36px, 3.6vw, 46px)`, weight 600, `line-height: 0.9`, `letter-spacing: -0.06em`, tabular,
    with a 15px weight-400 `--dim` `/mo` suffix. Billing note: mono 10.5px uppercase `--dim`.
    Pitch: 13px / 1.58 `--muted-fg`. Bullets: 13px `--muted-fg` with a 14px `check` mask in
    `--acid-dim`. CTA: `margin-top: auto`, 44px, `border-radius: 11px`, mono 11.5px/500 uppercase —
    Pro filled `--acid`, others `border: 1px solid var(--border)` with white text.

| Plan | Monthly | Yearly | Billed yearly | Pitch | CTA |
|------|---------|--------|---------------|-------|-----|
| Free | $0 | $0 | No card required | Enough to publish for a month and see whether it changes anything. | Start free |
| Starter | $19 | $16 | $190 billed yearly | For posting several times a week without watching the counter. | Start 14-day trial |
| Pro | $49 | $41 | $490 billed yearly | Daily posting, carousels every week, and the audit trail. | Start 14-day trial |
| Enterprise | $149 | $124 | $1,490 billed yearly | Unlimited everything, and seats for the whole team. | Start 30-day trial |

Bullets per plan (six each): Free — 10 posts, 25 generations, 2 carousels, 3 profile analyses,
1 content plan, 1 seat. Starter — 100 posts, 300 generations, 30 carousels, 50 profile analyses,
3 seats, Deep profile insights. Pro — 500 posts, 2,000 generations, 200 carousels, 300 profile
analyses, 10 seats, Audit logs. Enterprise — Unlimited posts / generations / carousels / analyses /
seats, Audit logs.

- **Comparison disclosure** — a text button, mono 11.5px, `letter-spacing: 0.09em`, uppercase,
  `--acid`, with a rotating `chevron-down` (`transition: transform 240ms cubic-bezier(0.23,1,0.32,1)`).
  Collapsed label `Compare all four plans, line by line`; expanded `Hide the full comparison`.
  Revealed table: `border-radius: 16px`, `border: 1px solid var(--border)`, `overflow-x: auto`,
  `min-width: 760px`, header row mono 10.5px uppercase (the `Pro` column header in `--acid`), group
  header rows `background: color-mix(in oklch, var(--muted) 40%, transparent)` mono 10px uppercase,
  data cells mono tabular — `Unlimited` and `✓` in `--acid`, everything else `--dim`. Groups and
  rows are exactly the current `PlanComparisonTable` data (Create & publish, Profile intelligence,
  Team & workspace).

### 8. `04 / Questions`

`display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: clamp(32px, 5vw, 72px)`.
Left column (`max-width: 20em`) holds the kicker and H2 `Asked before` + `signing up` (italic
accent) at `clamp(30px, 4vw, 50px)`. Right column is `grid-column: span 2`.

Each item: bottom border 1px `--rail`; trigger is a full-width button, `padding: 22px 0`,
`font-size: clamp(15px, 1.3vw, 16.5px)`, weight 500, `letter-spacing: -0.012em`, with a mono 10.5px
`--acid-dim` two-digit index (`01`…) 14px to the left of the question and a rotating
`chevron-down` in `--muted-fg` on the right. Answer paragraph: 14px / 1.78, `--muted-fg`,
`padding: 0 clamp(0px, 5vw, 64px) 24px 34px` (the 34px left indent aligns it past the number).
First item open by default.

Six questions, verbatim from the current `faqs` config: *Does it actually post to LinkedIn?* ·
*Will it sound like me, or like AI?* · *Can it make carousels?* · *Can I save a post and finish it
later?* · *What happens when I hit a plan limit?* · *Do I need a card to start?*

### 9. Final CTA

`padding: clamp(72px, 9vw, 124px) clamp(20px, 3vw, 44px)`, centered, `overflow: hidden`, with a
decorative glow at `left: 50%; bottom: -320px`, `1000 × 620px`,
`radial-gradient(44% 44% at 50% 50%, color-mix(in oklch, var(--acid) 14%, transparent) 0%, transparent 70%)`.

Mascot image at `clamp(88px, 9vw, 116px)` masked with
`radial-gradient(closest-side, oklch(0 0 0) 72%, transparent 100%)`; H2
`clamp(38px, 6vw, 86px)`, weight 600, `letter-spacing: -0.06em`, `line-height: 0.88`, uppercase,
`max-width: 15em` — `Your next thirty posts are` + `one conversation away.` (italic accent);
body `Connect LinkedIn, answer a few questions, and leave with a month of posts already on the
calendar.`; the same primary/secondary button pair as the hero (secondary label `Sign in`); closing
mono 11.5px `--dim`: `10 posts and 25 generations a month, free. No card, no trial timer.`

### 10. Footer

`padding: clamp(40px, 5vw, 56px) clamp(20px, 3vw, 44px)`,
`grid-template-columns: repeat(auto-fit, minmax(160px, 1fr))`, `gap: 40px`. First cell spans 2 and
holds the logo lockup (mono 13px uppercase) plus the description
`Generate LinkedIn posts in your own voice, build a content plan from your profile, and schedule
everything from one place.` Three link columns — Product (The loop, Inside, Pricing), Get started
(Get started free, Sign in), Support (FAQ, Why it works) — headed by mono 10.5px
`letter-spacing: 0.12em` uppercase `--dim` labels, links 13.5px `--muted-fg`. Bottom bar above a 1px
`--rail` border: mono 10.5px uppercase `--dim`, `© 2026 LinkDude` and
`Not affiliated with LinkedIn Corporation.`

---

## Interactions & Behavior

### Hero demo sequence (the main one)

A looping four-phase state machine driving the composer. Implement as a client component with a
single `phase` state (`typing → generating → written → queued`) plus a `typed` character count.

1. **typing** — the topic string types in 3 characters every 42ms (~14 ticks/sec). A 2px caret in
   `--acid` blinks `caret-blink 1.1s steps(1) infinite`. Status line reads `ready when you are`,
   counter `25 / 25 generations left`.
2. **generating** — starts 420ms after typing completes, lasts 1250ms. The input gets a moving
   sheen (`shimmer-pass 1.1s linear infinite`, a `linear-gradient(100deg, transparent 20%, color-mix(in oklch, var(--acid) 18%, transparent), transparent 80%)`
   translating -100% → 320%) and the post area shows four skeleton bars (88%, 100%, 72%, 54% wide;
   the last one tinted `color-mix(in oklch, var(--acid) 30%, transparent)`). Status `writing…`.
3. **written** — skeletons are replaced by the four real paragraphs, each animating in with
   `line-in 620ms cubic-bezier(0.23,1,0.32,1)` staggered 130ms apart (opacity 0→1,
   `translateY(6px)`→0, `blur(3px)`→0). Status `draft · in your voice`, counter drops to
   `24 / 25`, hint `draft saved`. Publish button is filled `--acid`.
4. **queued** — 3350ms later, the handoff: Publish goes inert
   (`background: color-mix(in oklch, var(--muted) 70%, transparent)`, `--dim` text) while the
   `Tue 9:00 AM` button becomes the accent state, the matching queue card (`TUE 9:00`) lights up in
   the accent treatment, status becomes `scheduled · in your voice` in `--acid`, hint
   `queued for Tuesday`. All these transitions are 320–380ms ease.
5. Loops back to step 1 after a 3600ms hold.

The sequence is gated on an `IntersectionObserver` at `threshold: 0.15` on the frame — it only runs
while visible, and all timers are cleared on unmount. Expose an escape hatch (`animateHero: false`)
that renders the final written state statically; use it for reduced-motion and for any static
render.

### Cursor spotlight

`onMouseMove` on the demo frame moves an absolutely positioned overlay's
`radial-gradient(340px 340px at <x>px <y>px, color-mix(in oklch, var(--acid) 11%, transparent), transparent 70%)`
and sets `opacity: 1`; `onMouseLeave` returns it to 0 with a `400ms` opacity transition. Coordinates
are `e.clientX/Y` minus the frame's `getBoundingClientRect()`.

### Scroll reveals

Every major block animates in once: `rise-in 780ms cubic-bezier(0.23,1,0.32,1)` (opacity 0→1,
`translateY(18px)`→0), staggered `index × 70ms` (capped at 8 steps), triggered by an
`IntersectionObserver` with `rootMargin: "-8% 0px -12% 0px"` and `threshold: 0.05`.

**Implement this so content is never gated on JS succeeding** — this bit me twice in the prototype.
The rules that made it safe: visible is the default state; an element is only hidden *after* the
observer is confirmed attached to it; an already-revealed element is never re-hidden (guard on a
`data-revealed` flag) so a remount can't blank the page; unmount clears the inline styles; and two
failsafe timers (1.6s for anything in-viewport, 4s unconditional for anything still computing to
`opacity < 0.99`) clear the hidden state. In a React app the cleanest equivalent is a CSS class
toggled on by the observer, with the base class fully visible.

### Counters

Free-tier figures and the profile score count up once when the stats row hits
`threshold: 0.35` — 26 steps at 34ms (~880ms total), eased with `1 - (1 - t)³`. The score's progress
bar width animates to 82% over the same period.

### Parallax

The hero demo frame translates at `0.11 ×` scrollY, capped at 70px, only while `scrollY < 1400`.
Driven by a passive scroll listener throttled with `requestAnimationFrame`.

### Cursor tilt

Bento and pricing cards carry a `transition: transform 320ms cubic-bezier(0.23,1,0.32,1)` and are
marked `data-tilt`, ready for a small pointer-driven `rotate3d`/`translate` on hover. Keep the
magnitude subtle (≤ 4°) or drop it — the transition is already in the styles.

### Other

- FAQ items and the pricing comparison are simple open/closed toggles with a 240ms chevron rotation.
- Interval toggle switches all four prices and billing notes; no animation.
- Anchor links: `#top`, `#loop`, `#product`, `#pricing`, `#faq`.
- Ticker, halo, scanlines, sheen and pulse loops run continuously — all should stop under
  `prefers-reduced-motion: reduce`.

## State Management

Client state, all local to the page (no server state, no fetching):

| State | Type | Purpose |
|-------|------|---------|
| `phase` | `'typing' \| 'generating' \| 'written' \| 'queued'` | Hero demo stage |
| `typed` | number | Characters of the topic revealed |
| `interval` | `'monthly' \| 'yearly'` | Pricing toggle |
| `openFaq` | record<number, boolean> | FAQ disclosures (index 0 open initially) |
| `compareOpen` | boolean | Comparison table disclosure |
| `count` | number 0→1 | Counter progress, drives free-tier figures and the score |

Plan, limit and FAQ data stays server-side from `plans.ts` / `resources.ts` / `marketing.ts`. Only
the demo, toggles and counters need to be client components — split them out so the page itself
stays a server component.

## Design Tokens

Everything is oklch, consistent with the current `globals.css`. The redesign adds one accent above
the existing brand blue and two neutrals.

| Token | Value | Use |
|-------|-------|-----|
| page background | `oklch(0.015 0 0)` | Body |
| foreground | `oklch(0.99 0 0)` | Primary text |
| `--brand` | `oklch(0.58 0.155 252)` | Existing brand blue; atmospheric glow, avatar |
| `--brand-lift` | `oklch(0.68 0.15 252)` | Brand gradient top |
| `--brand-soft` | `oklch(0.24 0.045 252)` | Avatar background |
| `--brand-soft-fg` | `oklch(0.82 0.085 252)` | Avatar text |
| `--brand-border` | `oklch(0.36 0.065 252)` | Brand-tinted hairlines |
| `--acid` | `oklch(0.74 0.145 252)` | **The accent.** CTAs, italic clauses, active states |
| `--acid-dim` | `oklch(0.62 0.15 252)` | Accent at lower emphasis (checks, ticker) |
| `--acid-soft` | `oklch(0.25 0.055 252)` | Accent surfaces (chips, bubbles, scheduled days) |
| accent foreground | `oklch(0.12 0.03 252)` | Text on filled accent buttons |
| `--card` | `oklch(0.135 0 0)` | Panels |
| `--muted` | `oklch(0.22 0 0)` | Inert fills, tracks |
| `--muted-fg` | `oklch(0.7 0 0)` | Body copy |
| `--dim` | `oklch(0.52 0 0)` | Mono labels, tertiary text |
| `--border` | `oklch(0.25 0 0)` | Panel borders |
| `--rail` | `oklch(0.175 0 0)` | Structural grid lines, section dividers |

**Type.** `Geist` 300–700 (display + UI), `Geist Mono` 400–500 (all labels, buttons, metadata),
`Instrument Serif` italic 400 (display accent clauses — **new, needs adding**; fall back to a
Georgia italic if you'd rather not add a face, accepting a slightly heavier feel).

Display sizes are all fluid: hero `clamp(46px, 8.6vw, 132px)`, section H2
`clamp(34px, 5vw, 68px)`, final CTA `clamp(38px, 6vw, 86px)`, ghost numerals
`clamp(56px, 7vw, 104px)`, counter figures `clamp(40px, 5.4vw, 74px)`. Display tracking runs
-0.035em to -0.06em; display `line-height` 0.86–0.98. Mono labels are 10–12px with
`letter-spacing: 0.05em–0.14em`, uppercase.

**Radii.** 7px (small chips) · 8–9px (buttons, cells) · 11–13px (inputs, inner panels) ·
14–16px (cards) · 18px (demo frame) · 9999px (pills).

**Spacing.** Section padding `clamp(64px, 8vw, 108px)` vertical,
`clamp(20px, 3vw, 44px)` horizontal. Card padding `clamp(20px, 2.2vw, 28px)`. Grid gaps 6 / 13 / 16 /
`clamp(20px, 4vw, 56px)`. Max width 1240px.

**Shadows.**

```
demo frame     inset 0 1px 0 color-mix(in oklch, oklch(1 0 0) 14%, transparent),
               0 50px 130px -50px color-mix(in oklch, var(--brand) 46%, transparent)
bento tile     inset 0 0 0 1px var(--border),
               inset 0 1px 0 color-mix(in oklch, oklch(1 0 0) 15%, transparent)
pro plan       inset 0 0 0 1px color-mix(in oklch, var(--acid) 34%, transparent),
               inset 0 1px 0 color-mix(in oklch, oklch(1 0 0) 16%, transparent),
               0 28px 70px -34px color-mix(in oklch, var(--acid) 40%, transparent)
primary button 0 16px 40px -14px color-mix(in oklch, var(--acid) 70%, transparent),
               inset 0 1px 0 color-mix(in oklch, oklch(1 0 0) 40%, transparent)
header button  0 0 24px -6px color-mix(in oklch, var(--acid) 55%, transparent)
```

**Motion.** Easing `cubic-bezier(0.23, 1, 0.32, 1)` for entrances and layout, plain `ease` for
state changes. Durations: 240ms (chevrons) · 320–380ms (state swaps) · 620ms (post lines) ·
780ms (reveals) · 900ms (score bar). Ambient loops: 1.1s caret and shimmer · 1.6s scanlines ·
2.2–2.4s pulse · 6.5s sheen · 11s halo · 22s (removed sticker) · 46s ticker.

## Assets

- `assets/linkdin-dude.png` — the existing mascot, copied from
  `src/app/assets/images/linkdin-dude.png`. Used at 26px (logo), 58px (loop bubbles) and
  `clamp(88px, 9vw, 116px)` (final CTA). Already in the repo; no new asset needed.
- Icons are `lucide` — `arrow-right`, `arrow-down`, `check`, `chevron-down`, `sparkles`,
  `calendar-days`, `calendar-check`, `file-stack`, `compass`, `user-search`, `layers`. The prototype
  masks the static SVGs; in the app use `lucide-react` components as the codebase already does.
- No photography or illustration. Every "screenshot" in the design is real DOM, so there is nothing
  to export.

## Files

- `Landing Page - Cool v3.dc.html` — the design reference. Open in a browser.
- `support.js` — runtime the prototype needs to render. Not part of the design; do not port.
- `assets/linkdin-dude.png` — mascot, for reference.

## Notes for implementation

- **Keep the data generated.** The current page derives limits and the comparison table from
  `plans.ts` / `resources.ts`. Every number in this document matches those sources — keep the
  bindings rather than hardcoding.
- **Copy is final.** All headings, body copy, bullets, FAQ answers and microcopy above are the
  intended strings. Where they match the existing `marketing.ts` values, they are verbatim; the new
  strings (loop rows, plan pitches, bubble lines) should go into that same config file rather than
  into JSX.
- **The visible rails matter.** The 1240px column with 1px side borders and hairline section
  dividers is what makes the page feel designed. Don't drop it in favour of loose sections.
- Respect `prefers-reduced-motion`: skip the hero sequence to its final state, freeze the ticker and
  ambient loops, and reveal all content immediately.
- Accessibility: decorative layers are `aria-hidden`, the demo frame is presentational (an
  `aria-label` describing it is enough — don't expose the fake app to the a11y tree as interactive
  controls), FAQ triggers should be real `button`s with `aria-expanded`, and check contrast on
  `--dim` text at small mono sizes if you lower it further.

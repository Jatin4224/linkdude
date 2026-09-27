# 24. Carousel templates — slots, blueprints, one renderer

> **Status: phases A and B built on `feature/carousel-templates`.** Slides now carry
> named slots, each template states the argument its deck makes, and slides render
> through the shared design engine rather than a carousel-only component. Not yet
> built: the doodle/handwriting asset kit, the rich illustrated templates, AI
> illustration per slide. Read `16-carousel-generation.md` and `20-studio.md` first.
>
> **Phase C added** the markedText primitive, a font role vocabulary with marker and
> handwriting faces, a decoration block with a hand-drawn SVG kit, and editor fields
> for the new slots.

This is `20-studio.md` phase 5, plus the reason it was worth doing.

---

## 1. The problem

A template could only change the palette, because a slide was `{ kind, heading, body }`
and there was nothing else to lay out. Every deck came back as N interchangeable
paragraphs in one of three colour schemes.

Two things were missing, and only together do they fix it: slides needed **more
slots**, and templates needed to say **what a deck argues**, not just how it looks.

## 2. Slots, and the rule that protects old decks

`carouselSlideSchema` gained `eyebrow`, `bullets`, `callout`, `ctaLabel` and `note`.

**Every one carries a `.default()`, and that is load-bearing.** `parseCarouselSlides`
runs this schema on *every* `getCarousel`. Every deck written before these slots
existed holds only `{ kind, heading, body }`, so one required field would make those
decks fail to parse — not render plainly, but fail to **open**. Verified against the
installed zod before building on it:

```
legacy deck parses: true
{"kind":"cover","heading":"The old deck","body":"","eyebrow":"","bullets":[],...}
```

`createEmptyCarouselSlide` exists because the editor's "add slide" cannot go through
`.parse()` to pick up those defaults — `heading` is `.min(1)` and a new slide is
deliberately headless, which is what blocks Save until someone writes one.

## 3. Emphasis lives in the copy

A heading may mark its claim: `AI is ==changing==`. `parseCarouselHighlights` splits
it into runs.

Inline markup rather than a parallel spans array, because a span array and the string
it indexes into drift apart the moment someone edits the text — and this string is
edited in a plain `<Input>`. An unterminated marker renders as literal text rather
than throwing, because `==chang` exists on the way to `==changing==` and must not
blow up a preview mid-keystroke.

## 4. Blueprints — templates that argue

`CAROUSEL_BLUEPRINTS` gives each template a narrative arc and a voice. Each step
states a **job**, written as an instruction because it is pasted verbatim into the
prompt: *"Show why the obvious answer stopped working"* produces a slide, where
*"Problem"* produces a heading that says Problem.

`expandCarouselBlueprint` cycles the middle steps to whatever deck length was asked
for, so a blueprint states an arc rather than a length — pinning the step count would
make `slideCount` a lie.

The arc is guidance, not validation, for the reason `generateContentPlan` already
documents: a deck that drifts is one the user fixes in the editor, where a rejected
generation gives them nothing and the org has already paid.

## 5. Slides are DesignDocs now

`CarouselSlideView`, `SlideViewProps` and `renderSlidePng` are gone. A slide becomes
a `DesignDoc` and is drawn by `renderDesignPng`.

The engine was already waiting for this. `DESIGN_CANVAS_PRESETS.carouselPortrait` and
`.carouselSquare` already existed and take their dimensions *from*
`CAROUSEL_PAGE_PRESETS`. `DESIGN_COMPUTED_VALUES` was already
`["slideCounter", "deckProgress"]`, whose own comment says it is "the member that
makes phase 5 cheap". `DesignRenderContext.index/total` was documented as existing
so "a carousel slide will pass both".

Three decisions worth keeping:

**The document is derived per render and never stored.** `Carousel.slides` stays the
source of truth, so this mapping can change without a migration and a deck is never
two representations that can disagree.

**Colours come through `paletteOverrides`, not by naming a studio palette.**
`CAROUSEL_PALETTES` holds the exact hexes these decks already render with, so
overriding all five slots reproduces the current output instead of approximating it.
Existing decks keep their colours exactly.

**`hideWhenEmpty` is what lets one layout serve two eras of deck.** A slide stored
before the extra slots existed parses with them empty, so those blocks collapse and
it renders as it always did. A slide written against a blueprint fills them and gains
the blocks. No branch, no migration.

`CAROUSEL_LAYOUTS` is keyed by **slide kind**, which `DesignArchetype.blocks` is not —
it keys by canvas only. Rather than widen that interface and disturb studio, the
carousel keeps its own registry over the same vocabulary and the same renderer. If a
layout ever needs a block type that does not exist, the fix belongs in the block
language, never in the registry.

`pointD` and `pointE` were added to the shared slot vocabulary: a flow list
("attention → trust → authority → clients") is four steps and three slots cannot hold
it. No studio archetype references them.

## 6. The file stopped being `.tsx`

`carousel.service.tsx` carried that extension for exactly one reason — `CarouselSlideView`
was JSX. With the view retired there is no JSX left, so it is `carousel.service.ts`
and the long note explaining the extension is gone with it.

## 7. Still to build

| | Why it is not here |
|---|---|
| Doodle/handwriting asset kit | Fonts and SVGs are their own change; the block language already supports them |
| The rich illustrated templates | Each is a `CAROUSEL_LAYOUTS` + `CAROUSEL_BLUEPRINTS` entry once the assets exist |
| AI illustration per slide | Adds a metered surface — needs its own `resources.ts` entry, permission and audit verb |
| Per-slide regenerate | `create` is the only metered verb; this needs a quota decision |
| Editor fields for the new slots | The editor still shows heading and body only, so slots are AI-filled for now |

## 8. Verification

`typecheck` and `lint` clean. Legacy-deck parsing and the highlight parser were
checked against the installed zod. **Visual fidelity was not machine-verified** — open
a deck created before this work, render it, and confirm it still looks like itself.
That is the gate the `paletteOverrides` and `hideWhenEmpty` decisions exist to pass.

---

# Phase C — the look

## A defect Phase A shipped

`parseCarouselHighlights` was written and **never called**, so `==changing==` would
have rendered with the delimiters visible. Fixing it properly meant admitting the
block language was missing a primitive — which is what `carousel-layouts` own header
says to do — rather than special-casing it in the carousel.

## `markedText`

A separate block type, not a flag on `text`, because the two rasterise by
incompatible routes: `text` leans on `-webkit-line-clamp`, which requires a
`-webkit-box` and therefore forbids the flex layout a row of coloured boxes needs.

**Wrapping is per word.** satori will not break a single flex child across lines, so
one box per word is what lets a swash follow the text through a natural wrap. The
tradeoff is visible and intended: `a ==b c== d` draws two separate marks, which is
how a highlighter behaves anyway.

The CTA slide inverts the pairing — background field, accent ink — because it already
sits on the accent, and reusing the content slide's pairing would paint accent on
accent.

The delimiter lives in `design-block.ts`, not the carousel: that file already supplies
the carousel's canvas dimensions, so the carousel cannot import back without a cycle.
The carousel's duplicate parser was deleted rather than kept in sync.

## Fonts are a role, not a name

`DESIGN_FONT_KEYS = ["sans", "marker", "hand"]`. A layout asks for `marker`;
`RENDER_FONT_FAMILIES` decides which file that is. Swapping the marker face is one
registry entry and no layout changes.

`loadAllRenderFonts()` hands every family to satori in one render, because
`fontFamily` resolves per element against whatever the renderer was given — there is
no per-element font loading to do instead. It is three cache hits after the first
render.

Everything defaults to `sans`, which is what keeps every existing studio archetype
and every stored design rendering exactly as before.

**Fonts are TTF now, beside Geist's WOFF.** satori reads both. It does not read
WOFF2 — the one substitution that fails silently, falling back to a single Regular
face so every weight rasterises identically. `src/app/assets/fonts/README.md` records
this and the OFL licensing.

## `decoration`

Template-owned art, deliberately not an image slot. The two differ in every way that
matters: decoration ships with the app, is chosen by a template, is tinted at render
time and never leaves the server; an image slot is a member's upload on ImageKit.
Sharing one mechanism would have a template's arrow competing with a headshot for
three slots.

Every file is authored in `currentColor` and tinted by string substitution before
encoding, because satori does not inherit `color` into an `<img>` payload. Base64
rather than percent-escaping: an SVG's `#`, `<` and quotes all need escaping in a
data URI and getting one wrong yields a blank image rather than an error.

Width is a fraction of the canvas like every other length here; height follows the
artwork's own aspect rather than being stated twice and allowed to disagree.

`next.config.ts` traces the doodles folder on every satori route, for the same reason
it traces fonts: nothing imports these files, so the tracer cannot infer them.

## Verified

- Every registered font path resolves from `process.cwd()` (5/5).
- Every doodle tints, base64 round-trips, and stays under 500 bytes (5/5).
- Marked-run word splitting across normal, leading, absent, unterminated and
  multi-mark headings.

**Not machine-verified:** how any of it actually looks. That still needs a browser.

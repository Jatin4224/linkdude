# 24. Carousel templates — slots, blueprints, one renderer

> **Status: phases A and B built on `feature/carousel-templates`.** Slides now carry
> named slots, each template states the argument its deck makes, and slides render
> through the shared design engine rather than a carousel-only component. Not yet
> built: the doodle/handwriting asset kit, the rich illustrated templates, AI
> illustration per slide. Read `16-carousel-generation.md` and `20-studio.md` first.

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

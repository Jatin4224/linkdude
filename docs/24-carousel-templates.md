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

---

# Phase D — the illustrated templates

Two new entries: **notebook** (warm paper, marker headlines, navy ink, yellow swash)
and **linkdude** (blue on white, marker headlines, a pill flow list). Each is a
palette, a blueprint and a layout option set. **No renderer change.**

## A template that cannot choose its own field is not a template

The slide background was a hardcoded `isCta ? accent : background` branch in the
service. That works only while every template's accent is a colour text can sit on —
and notebook's is a marker yellow, so a cta filled with it has nothing readable to
put on top.

`CarouselSlideLayout` therefore carries `{ blocks, field, justify }`, and the service
reads all three. notebook inverts onto its ink; the classic three still invert onto
the accent, exactly as before.

## Built from options, not five hand-written triples

The structure of a deck slide does not vary between templates — counter, headline,
supporting copy, list, spine. What varies is the typeface, which colours pair for the
swash, and which drawn marks appear. So those are the options, and a sixth template
is one entry rather than three more arrays to keep in step.

The rule for when to stop: the moment an option appears that only one template uses,
that template should write its own object instead.

## Three contrast bugs the measurements caught

Contrast was computed for every pairing in all five palettes rather than eyeballed,
and it found what eyeballing would not have:

1. **notebook's eyebrow at 1.50:1** — `accent` on `background` is marker yellow on
   cream. Invisible. `eyebrowInk` is now an option; notebook uses `muted` (5.50).
2. **The cta pill drew an invisible label** — it filled with `accent` and labelled
   with the field, which on any template whose cta field *is* the accent is accent on
   accent. It now fills with the ink and labels with the field.
3. **The progress spine vanished on the cta** — Phase B made it always `accent`,
   losing the inversion `CarouselSlideView` had. It now takes its ink from the caller.

Final state: **no pairing below 3:1, and both new templates are AA throughout.**
`minimal` sits at 3.50 across its accent pairings, which is pre-existing — it is
white and brand blue on a near-black field, and passes AA for large text, which is
what a slide heading is.

## Adding template six

1. A palette in `CAROUSEL_PALETTES`
2. An arc and a voice in `CAROUSEL_BLUEPRINTS`
3. An option set in `CAROUSEL_LAYOUTS`
4. A label in `CAROUSEL_TEMPLATE_LABELS`

Adding the id to `CAROUSEL_TEMPLATES` makes the compiler name all four. Nothing else
changes — no renderer, no migration, no UI.

---

# The template picker

Five templates, two of them illustrated, were a dropdown of text labels. "Notebook —
paper, marker headlines" describes a design nobody has seen, and the only way to find
out was to spend a generation.

The create dialog now shows **one real rendered sample slide per template**, drawn
through the same preview route and the same engine that draws the deck.

**Real renders, not mocked swatches.** A hand-built swatch is a second description of
the design, and it drifts silently — nothing would ever compare the two.

**One sample slide across all of them.** Comparison only works with the words held
constant; different copy per card has people choosing on the sentence rather than the
design. It carries a `==marked==` phrase on purpose, so the highlight pairing is
visible before anyone commits to a template.

Thumbnails follow the chosen page shape, so a square deck never previews as five
portraits. Each card renders exactly once: the payload serialises stably and the
fetch is module-scope, so `RenderPreview`'s debounce is not re-armed.

`renderSlidePreview` is exported from `slide-preview.tsx` so the picker reuses the
one fetch rather than owning a second copy of the 401 handling and object-URL
lifetime.

## It also makes the feature self-verifying

Opening the dialog draws five slides through the whole stack — layouts, palettes,
marker and handwriting faces, the marked-text swash, and the decoration kit. A
regression anywhere in phases B–D is visible in one screen, to every user, without
anyone spending a generation to find it.

---

# Long input — paste an article, get a deck

The spec asked for this and it was the one line still unmet:

> *"Extremely long text inputs exceeding standard slide character limits must be
> automatically summarized or split across multiple cards."*

`CAROUSEL_TOPIC_MAX` was 1000, so the most common real input this feature has — an
existing post, a newsletter section, a page of notes — produced a **validation
error** rather than a deck. The ceiling is now 12000.

## The threshold is the interesting part

Raising a number alone would have made it worse, not better. A pasted article given
the "write a carousel about the following" prompt comes back as a deck that walks the
source section by section: every slide a paragraph summary, no single claim. That is
precisely the failure the spec line is about, and a chunking algorithm does not fix
it — an instruction does.

So `CAROUSEL_SOURCE_THRESHOLD` (600) picks the prompt:

- **Below it** the text is an idea, and the model develops it.
- **At or above it** the text already contains the argument. The model is told to
  find the ONE strongest thread, build the whole deck on it, and *cut* everything
  else — explicitly not to summarise section by section, and to keep the source's own
  numbers, names and sharp phrasings rather than paraphrasing them blander.

The form says which mode it is in, because pasting an article and getting a deck
built on one thread is surprising if nothing said that is what happens.

## Pasted text is material, not instructions

Long input is where pasted text starts to resemble instructions, so the source is
fenced between markers and labelled as material to draw from. This is not a security
boundary — nothing downstream trusts the model's output — but it measurably stops a
pasted "ignore the above" from being read as one.

## One consequence worth catching

`CAROUSEL_LIST_SELECT` carries `topic`, and the list draws a single clamped line from
it. At 1000 characters that was free; at 12000 a page of ten decks would ship well
over a hundred kilobytes of text to render ten clamped lines — the same argument that
select already makes for omitting `slides`. Topics are therefore truncated to 200
characters on the way out of `listCarousels`. The editor fetches the whole deck by id
when it needs it.

## Verified

Bounds and mode switching at every boundary: 9 rejected, 10 accepted, 599 brief, 600
source, 12000 accepted, 12001 rejected.

---

# Phase E — AI illustration per slide

The model draws the picture; the renderer draws the words. That division is the whole
feature: image models cannot render legible lettering, so asking one for a finished
slide returns garbled words baked into the pixels. Generating only the illustration
and compositing crisp type beside it is the thing neither a design tool nor an image
model does on its own — the same argument `studioBackdrop` makes.

## Metered separately, and per image

`carouselIllustration` is its own `RESOURCES` key, not a verb on `carousel`. Only
`<resource>.create` spends a slot, and `carousel.create` already spends one on the
deck — so an illustration sharing that key would charge a member an entire deck every
time they regenerated one picture.

Per **image**, because that is what costs money. Allowances are larger than
`studioBackdrop`'s (free 5 / starter 100 / pro 500) because a deck holds three to
twelve slides: three images cannot illustrate one deck, and a limit that cannot
complete a single unit of work reads as broken rather than as a limit.

`permissions: ["create"]` only. A generation is spend and is never refunded —
removing an illustration does not un-spend the model call that made it.

## The endpoint never touches the deck

`carouselIllustration.create` takes a brief and returns a **stored reference**. It
reads and writes no Carousel row.

The client puts the reference on the slide it is editing and saves through
`carousel.update`, so an illustration the member rejects is never persisted. It also
means a ninety-second image call holds no database row — the reason the endpoint is
shaped this way rather than as `carousel.illustrate`.

## Two details that would have been bugs

**The image block is appended, not part of the layout.** There is no `hideWhenEmpty`
for images the way there is for text, so an image block living in the layout
unconditionally would draw an empty frame on every slide nobody illustrated. The
block is added only when the slide actually has one.

**`fit: "contain"`, not `cover`.** The illustration directive asks for a subject with
generous empty space around it; cropping it to fill a box throws exactly that
composition away.

## Backward compatibility

`illustration` is `.optional()` rather than defaulted, and here the distinction
carries meaning where it did not for the text slots: an empty string is a slot nobody
filled, but there is no empty image — absence is the only way to say a slide has
none.

Verified: a pre-slots, pre-illustration deck still parses, its `illustration` reads
`undefined`, a deck carrying one parses, and a malformed reference is rejected.

## Operational note — custom roles

Nothing backfills `OrganizationRole` rows when a permission is added, per the rule
documented on `profileAnalysis`. On the day this ships, **no custom role holds
`carouselIllustration:create`**. Owners bypass and are unaffected; a member on a
custom role sees the control and is refused until their role is granted it.

That is also why the feature has no nav entry to gate — it lives inside the carousel
editor, which those members can already reach.

## Cost shape worth knowing

A slide carrying an illustration makes the live preview fetch that image from
ImageKit on every render, because `resolveDesignImages` resolves references to data
URIs up front. Studio's backdrops behave identically. It is a network round trip on a
debounced path, so an illustrated slide previews measurably slower than a plain one.

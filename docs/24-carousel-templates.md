# 24. Carousel templates — slots, blueprints, one renderer

> **Status: built.** Five templates, slide slots, per-template narrative arcs, the
> shared design renderer, marker and handwriting faces, a hand-drawn decoration kit,
> a live template picker, long-paste input, two metered AI surfaces (illustration
> and per-slide rewrite), deck branding, per-template illustration placement, and a
> reaper for orphaned illustrations.
>
> Read `16-carousel-generation.md` for how a deck is generated, stored and
> published, and `23-carousel-editor.md` for the editor this builds on.
> `20-studio.md` describes the block language; this is its phase 5.

---

## 1. The problem

A template could change the palette and nothing else, because a slide was
`{ kind, heading, body }` — there was nothing else to lay out. Every deck came back
as N interchangeable paragraphs in one of three colour schemes.

Two things were missing, and only together do they fix it: slides needed **more
slots**, and templates needed to say **what a deck argues**, not just how it looks.

## 2. Slots, and the rule that protects old decks

`carouselSlideSchema` carries `eyebrow`, `bullets`, `callout`, `ctaLabel`, `note` and
an optional `illustration` alongside `heading` and `body`.

**Every text slot has a `.default()`, and that is load-bearing.**
`parseCarouselSlides` runs this schema on *every* `getCarousel`. Decks written before
these slots existed hold only `{ kind, heading, body }`, so one required field would
make them fail to parse — not render plainly, but fail to **open**.

`illustration` is `.optional()` rather than defaulted, and there the distinction
carries meaning: an empty string is a slot nobody filled, but there is no empty
image. Absence is the only way to say a slide has none.

`createEmptyCarouselSlide` exists because the editor's "add slide" cannot go through
`.parse()` to pick up those defaults — `heading` is `.min(1)` and a new slide is
deliberately headless, which is what blocks Save until someone writes one.

## 3. Emphasis lives in the copy

A heading may mark its claim: `AI is ==changing==`. `parseDesignMarkedRuns` splits it
into runs and the `markedText` block draws the marked ones on a tinted swash.

Inline markup rather than a parallel spans array, because a span array and the string
it indexes into drift apart the moment someone edits the text — and this string is
edited in a plain `<Input>`. An unterminated marker renders literally rather than
throwing, because `==chang` exists on the way to `==changing==` and must not break a
preview mid-keystroke.

The delimiter lives in `design-block.ts`, not the carousel: that file already supplies
the carousel's canvas dimensions, so the carousel cannot import back without a cycle.

## 4. Blueprints — templates that argue

`CAROUSEL_BLUEPRINTS` gives each template a narrative arc and a voice. Each step
states a **job**, written as an instruction because it is pasted verbatim into the
prompt: *"Show why the obvious answer stopped working"* produces a slide, where
*"Problem"* produces a heading that says Problem.

`expandCarouselBlueprint` cycles the middle steps to whatever length was asked for, so
a blueprint states an arc rather than a length — pinning the step count would make
`slideCount` a lie.

The arc is guidance, not validation, for the reason `generateContentPlan` documents: a
deck that drifts is one the user fixes in the editor, where a rejected generation
gives them nothing and the org has already paid. **Counts stay lenient; maxima stay
strict.** That split is deliberate and applies to the rewrite endpoint too.

## 5. Slides are DesignDocs

`CarouselSlideView`, `SlideViewProps` and `renderSlidePng` are gone. A slide becomes a
`DesignDoc` and is drawn by `renderDesignPng`.

The engine was waiting for this: `DESIGN_CANVAS_PRESETS.carouselPortrait` and
`.carouselSquare` already existed and take their dimensions *from*
`CAROUSEL_PAGE_PRESETS`; `DESIGN_COMPUTED_VALUES` was already
`["slideCounter", "deckProgress"]`, whose comment calls it "the member that makes
phase 5 cheap"; and `DesignRenderContext.index/total` was documented as existing so
"a carousel slide will pass both".

Three decisions worth keeping:

**The document is derived per render and never stored.** `Carousel.slides` stays the
source of truth, so this mapping can change without a migration and a deck is never
two representations that can disagree.

**Colours come through `paletteOverrides`, not by naming a studio palette.**
`CAROUSEL_PALETTES` holds the exact hexes these decks already rendered with, so
overriding all five slots reproduces the old output instead of approximating it.

**`hideWhenEmpty` lets one layout serve two eras of deck.** A slide stored before the
extra slots existed parses with them empty, so those blocks collapse and it renders as
it always did. Image blocks self-collapse the same way — the renderer returns null for
an unresolved slot — which is why the illustration lives in the layout rather than
being appended by the service.

## 6. The layout registry

`CAROUSEL_LAYOUTS` is keyed by **slide kind**, which `DesignArchetype.blocks` is not —
it keys by canvas only. Rather than widen that interface and disturb studio, the
carousel keeps its own registry over the same vocabulary and the same renderer. If a
layout ever needs a block type that does not exist, the fix belongs in the block
language, never in the registry.

Each entry carries `{ blocks, field, justify }`. The field and the placement are the
layout's, not the service's: they were a hardcoded `isCta ? accent : background`
branch, which meant a template could not decide how its own closing slide inverted —
and `notebook`, whose accent is a marker yellow, has nothing readable to put on a full
slide of it.

A template also chooses where a generated illustration **sits** — `below` the copy or
`beside` it, copy left and picture right. Only two, and that is the language's limit
rather than a lack of ambition: a group takes **leaf** children, so "a text stack
beside a picture" is inexpressible — the headline stays full width and the row
carries the body. True corner placement would need `designLayoutOverrideSchema`,
whose `dx`/`dy`/`scale` the schema declares and **the renderer does not read**.

Layouts are built from **options** rather than five hand-written triples. The
structure of a deck slide does not vary between templates — counter, headline,
supporting copy, list, spine. What varies is the typeface, which colours pair for the
swash, which drawn marks appear, and how large a picture gets. The moment an option
appears that only one template uses, that template should write its own object
instead.

## 7. Assets

**Fonts are a role, not a name.** `DESIGN_FONT_KEYS` is `["sans", "marker", "hand"]`;
a layout asks for `marker` and `RENDER_FONT_FAMILIES` decides which file that is.
`loadAllRenderFonts()` hands every family to satori in one render, because
`fontFamily` resolves per element against whatever the renderer was given. Everything
defaults to `sans`, which is what keeps every studio archetype rendering unchanged.

**satori reads TTF, OTF and WOFF. It does not read WOFF2** — the one substitution that
fails silently, falling back to a single Regular face so every weight rasterises
identically. `src/app/assets/fonts/README.md` records this and the OFL licensing for
Permanent Marker and Caveat.

**Decoration is template-owned art**, deliberately not an image slot: it ships with
the app, is chosen by a template, is tinted at render time and never leaves the
server, where an image slot is a member's ImageKit upload. Every file is authored in
`currentColor` and tinted by string substitution before encoding, because satori does
not inherit `color` into an `<img>` payload. Base64 rather than percent-escaping,
because an SVG's `#`, `<` and quotes all need escaping in a data URI and getting one
wrong yields a blank image rather than an error.

`next.config.ts` traces both the fonts and the doodles folder on every satori route —
nothing imports these files, so the tracer cannot infer them.

## 8. The template picker

Five templates, two of them illustrated, were a dropdown of text labels. The create
dialog now shows **one real rendered sample slide per template**, drawn through the
same preview route and engine that draws the deck.

Real renders rather than mocked swatches, because a swatch is a second description of
the design and it drifts silently. **One sample slide across all of them**, because
comparison only works with the words held constant — it carries a `==marked==` phrase
so the highlight pairing is visible before anyone commits.

It also makes the feature self-verifying: opening the dialog draws five slides through
layouts, palettes, both new typefaces, the marked-text swash and the decoration kit. A
regression anywhere is visible in one screen.

## 9. Long input

`CAROUSEL_TOPIC_MAX` is 12000, so pasting a post or a page of notes produces a deck
rather than a validation error.

Raising the number alone would have made things worse. A pasted article given the
"write a carousel about the following" prompt comes back walking the source section by
section — no single claim. `CAROUSEL_SOURCE_THRESHOLD` (600) therefore picks the
prompt: below it the text is an idea to develop, at or above it the model is told to
find the one strongest thread and **cut** everything else.

Pasted source is fenced and labelled as material rather than instructions. Not a
security boundary — nothing downstream trusts model output — but it stops a pasted
"ignore the above" reading as one.

`listCarousels` truncates topics to 200 characters on the way out: the list draws one
clamped line, and a page of decks would otherwise ship over 100 KB of unread text.

## 10. The two metered AI surfaces

Both follow the same shape, and both have their **own** `RESOURCES` key.

| | key | allowance | unit |
|---|---|---|---|
| Illustration | `carouselIllustration` | free 5 / starter 100 / pro 500 | per image |
| Rewrite | `carouselSlideRewrite` | free 20 / starter 200 / pro 1000 | per reroll |

Neither could live on `carousel`: only `<resource>.create` spends a slot and
`carousel.create` already spends one on the deck, so sharing that key would charge a
member an entire deck to reword one slide or regenerate one picture. The rewrite could
not live on `aiGeneration` either — that key's `create` verb is already post copy.

**Neither could be free-but-rate-limited.** Both are paid model calls; unmetered, a
free account holding two carousels could make unlimited calls by rerolling. A rate
limit bounds the burst, not the bill.

`permissions: ["create"]` only, on both. A generation is spend and is never refunded.

**Neither endpoint touches the deck.** Each returns its result and the client writes it
into the draft, so a generation the member rejects is never persisted and a
ninety-second image call holds no database row.

Two things the rewrite protects. `carouselSlideCopySchema` omits `kind` (a position
role the deck's invariant owns) and `illustration` (an image someone paid for); the
router merges onto the existing slide so no caller can drop either. And it overwrites
**only the slots its blueprint step asked for** — every field defaults, so a plain
spread would wipe a hand-written note because of a rule invisible from the editor.

The rewrite reads the editor's **unsaved** slides, not the stored deck: rerolling slide
four against a stale copy of slide three is how a deck loses its thread.

## 11. Illustration lifecycle

`updateCarouselRecord` and `discardCarousel` return `orphanedFileIds`, and the router
deletes them **after** the write — the same post-commit ordering `render` uses, since
deleting first would strand a live slide pointing at a dead file if the write rolled
back.

Two details decide whether that is safe. **Comparison is by file id, not position** —
reordering slides changes every index while keeping the same images, and a positional
diff would delete files a live deck still points at. And **a deck that will not parse
leaks rather than deletes**: `safeParseCarouselSlides` returns `[]` instead of
throwing, because given a choice between orphaning a file and deleting one still
referenced, orphaning is the recoverable mistake.

The rendered PDF is still left behind on discard, and that is not an inconsistency: a
PDF is a finished artifact with its own page, permission and delete verb. An
illustration is a fragment of the deck that referenced it.

### The case no write path can see

Those two cover the moment a save or a discard orphans a file. They cannot cover an
illustration that was **generated and never saved** — nothing was written, so there
is no write to hook.

`asset-reaper.service` handles that on a cron, over every folder in `REAP_FOLDERS` (`REAP_RUN_PATH`, the same Bearer
secret as scheduled publishing). It deletes customer images, so it fails closed on
four rules:

1. **The reference scan runs first and may not fail.** If listing what is referenced
   throws, the run aborts having deleted nothing — reading a failed scan as "nothing
   is referenced" empties the library.
2. **Nothing younger than `REAP_GRACE_MS` (24h) is touched.** Between generating and
   saving, an illustration is referenced by nothing; it is *indistinguishable from an
   orphan*. The grace period is the whole of what makes deleting safe.
3. **Named folders only** — `/carousel` and `/studio`, both of which hold generated
   files whose only reference is a row. Not `/documents`, whose PDFs are owned by
   Document rows with their own delete verb, and not `/linkedin-posts`, which holds
   member uploads.
4. **A cap per run.** A reap that can empty a folder in one pass is one bug away from
   doing so; the backlog clears over several runs and the result says when the cap
   was hit.

**The scan unions every source, and that is what makes `/studio` safe to touch.**
That folder holds AI backdrops referenced by `StudioAsset.doc` AND rendered exports
referenced by a `Document` row — a scan that knew only about backdrops would read
every finished export as an orphan. There are five places a file id can hide
(`Document.fileId`, carousel slide illustrations, studio doc images, and a post image
plus its pre-edit original); the set may be over-inclusive at no cost, and
under-inclusive exactly once before someone loses work.

The scan reads **every organisation**, because the asset library is not partitioned
by tenant — a per-org reap would see another org's files as unreferenced. It walks
the raw JSON rather than the strict parse, since a deck this build cannot fully
understand still holds real file ids, and discarding them would turn an unreadable
deck into one whose pictures get collected.

**Watch the cursor.** Deleting shifts the listing, so pagination advances by *files
left in place*. Using a cumulative delete count steps over one file per earlier
deletion — a bug that reading the loop did not reveal and exercising it did.

## 12. Deck branding

Slides carry a wordmark (the organisation) and a byline (the connected LinkedIn
identity). Notebook and LinkDude sign their slides; the typographic templates do not,
because someone choosing Minimal is choosing for the copy to be the only thing there.

**Derived at render time, never stored on the deck.** Rename the workspace or
reconnect an account and every deck rendered afterwards follows, where a copy written
at create time would freeze whatever was true that day.

The preview route reads no database, so **the client sends the brand in its payload**
while `carousel.render` reads it server-side through `readCarouselBrand`. Same values,
two routes, because only one of them may query.

It is a `name`, not a handle: `LinkedInAccount` carries `name` and `avatarUrl` and no
vanity URL, so calling it a handle would promise an @mention the data cannot supply.

## 13. Adding a template

1. A palette in `CAROUSEL_PALETTES`
2. An arc and a voice in `CAROUSEL_BLUEPRINTS`
3. An option set in `CAROUSEL_LAYOUTS`
4. A label in `CAROUSEL_TEMPLATE_LABELS`

Adding the id to `CAROUSEL_TEMPLATES` makes the compiler name all four. Nothing else
changes — no renderer, no migration, no UI.

**Check the contrast.** Measuring every pairing found three defects that eyeballing
would not have: an eyebrow at 1.5:1 (marker yellow on cream), a cta pill drawing an
accent label on an accent field, and a progress spine that lost its inversion. Current
state: no pairing below 3:1, both illustrated templates AA throughout. `minimal` sits
at 3.50 across its accent pairings — pre-existing, and AA for large text, which is
what a slide heading is.

## 14. Traps

- **WOFF2 anywhere in `RENDER_FONT_FAMILIES`** fails silently and flattens every
  weight.
- **A new satori route needs its own `outputFileTracingIncludes` entry.** The key is
  the route; nothing imports the assets, so the tracer cannot infer them.
- **A new permission reaches no existing role.** Nothing backfills `OrganizationRole`
  rows, so `carouselIllustration:create` and `carouselSlideRewrite:create` are held by
  no custom role. Owners bypass.
- **`{/* … */}` is only valid inside JSX children**, not before a returned element.
- **The `.next` type validator errors mid-rebuild** while `next dev` runs. Filter
  `^\.next/` before believing a red typecheck.

## 15. Still to build

| | Why not here |
|---|---|
| Reaping `/linkedin-posts` | Member uploads rather than generated files. An orphan there is a photo someone chose, and the cost of being wrong is not symmetrical with saving a few kilobytes. |
| Corner / absolute placement | Needs `designLayoutOverrideSchema` implemented in the shared renderer, which changes studio too. |
| The mascot | `public/linkdin-dude.png` is 1024×1024 / 1.4 MB, which is 1.87 MB of base64 **per slide**. It needs a pre-resized asset or `sharp`; neither is in the repo. |
| JPEG export | resvg emits PNG. The spec said PNG/JPEG; we ship PNG. |
| Auto-splitting very long input across decks | The prompt condenses into one deck; it never proposes a second. |

## 16. File map

**New**

```
src/lib/config/carousel-blueprints.ts        arcs and voices per template
src/lib/config/carousel-layouts.ts           blocks, field and justify per kind
src/services/render-decorations.service.ts   doodle SVGs, read once and tinted
src/services/asset-reaper.service.ts         deletes illustrations nothing points at
src/app/api/assets/reap/run/route.ts         the reap trigger, Bearer secret
src/services/carousel.service.ts             was .tsx; no JSX remains
src/app/api/carousel/preview/route.ts        one slide → PNG, no DB
src/components/global/render-preview/        debounce, abort, last good frame
src/trpc/routers/carousel-illustration.ts    brief → stored image reference
src/trpc/routers/carousel-slide-rewrite.ts   one slide's copy, rewritten
.../carousel/_components/slide-preview.tsx   live preview of the open slide
.../carousel/_components/template-picker.tsx five rendered samples
.../carousel/_components/slide-illustration.tsx
.../carousel/_components/slide-rewrite.tsx
.../carousel/_components/slide-image-export.tsx  jszip, per-slide PNGs
src/app/assets/fonts/{Marker-400,Caveat-400,Caveat-700}.ttf
src/app/assets/doodles/*.svg
```

**Edited**

```
src/lib/types/carousel.ts        slots, blueprints, preview/draft/rewrite schemas
src/lib/types/design-block.ts    markedText, decoration, font roles, pointD/E
src/lib/config/carousel-theme.ts notebook and linkdude palettes
src/lib/resources.ts             two AI resources; removed the dead `carousels`
src/services/design-render.service.tsx  markedText and decoration cases, all fonts
src/services/ai.service.ts       blueprint prompt, long-source prompt, rewrite
src/trpc/routers/carousel.ts     list search, orphan cleanup
next.config.ts                   font and doodle tracing on every satori route
```

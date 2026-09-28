# 20. Studio — templates as data

> **Status: built and running. Phase 5 (carousels on this renderer) is now done — see 24-carousel-templates.md.** Banner, headshot and featured cover render and
> export; twelve gallery templates across five layouts; AI backdrops; live
> preview. Not yet built: carousels on this renderer, multiple featured covers,
> the drag editor. The original plan and its reasoning are preserved at the end.

An eleventh feature, and the first one that had to answer a question none of the
others did: **how do you ship twenty designs without writing twenty renderers?**

Read `16-carousel-generation.md` first if you have not. This feature shares its
pipeline, and half the decisions here only make sense against that one.

---

## 1. The problem this feature exists to solve

> **Phase 5 is built — see [24 — Carousel editor templates](./24-carousel-templates.md).**
> `CarouselSlideView` no longer exists; carousel slides render through
> `renderDesignPng` with their own layout registry over this block language. The
> problem statement below is kept as the reason that work happened.

`CarouselSlideView` in `src/services/carousel.service.tsx` hardcodes one layout
and branches on `slide.kind`. The type in `src/lib/types/carousel.ts` says it
plainly:

> adding a design is a config entry plus a renderer branch — never a migration

A renderer branch per design is fine at three. The studio's gallery promises
twenty, and twenty branches in a renderer with no CSS runtime, no grid and no
wrapping control is a maintenance surface nobody would volunteer for.

So the studio inverts it. **A layout is DATA.** One generic renderer walks a
block list; a template is a config object; template twenty-one costs no code.

```
StudioTemplate (config)   archetype + palette + tone + role tags   ← gallery card
        ↓ clone
DesignDoc (Json on a row) blocks + the user's words + overrides
        ↓
renderDesignPng(doc)      ONE renderer → satori tree → PNG
```

Twelve gallery entries today from **five** block lists. The multiplier is
archetype × palette, the same split `CAROUSEL_TEMPLATES` × `CAROUSEL_PALETTES`
already proves.

### Files

| Path | What it owns |
|---|---|
| `src/lib/types/design-block.ts` | The block language and `DesignDoc` |
| `src/lib/config/design-archetypes.ts` | The five layouts, as data |
| `src/lib/config/design-theme.ts` | Palettes, type scale, colour resolution |
| `src/lib/config/design-slots.ts` | Slot labels, placeholders, ceilings |
| `src/lib/config/studio-templates.ts` | The twelve gallery entries |
| `src/services/design-render.service.tsx` | The generic renderer |
| `src/services/render-fonts.service.ts` | Shared font loader |
| `src/services/studio.service.ts` | Prisma access |
| `src/app/api/studio/preview/route.ts` | Live preview — **not** a procedure |

---

## 2. Three properties that are load-bearing

Break any of these and the feature stops being what it is.

**A template cannot contain a colour.** Blocks name a palette SLOT; the only hex
in the language is a user override. That is what lets one archetype render in
four colourways, and it is enforced by the schema having nowhere to put a hex.

**Text is a three-way reference** — a user slot, fixed decoration, or COMPUTED.
The third member looks like overkill until you notice a carousel slide's
`"03 / 08"` counter is neither of the first two. It is what makes phase 5 a pure
function instead of a data migration.

**`group` nests exactly one level.** `children` is typed as the LEAF union, so
there is no `z.lazy()`, no recursive type, and no unbounded render depth. Every
layout in the source corpus fits.

---

## 3. What went wrong, and what fixed it

This is the useful half of the document.

### 3.1 zod 4 silently changed two things the schema depended on

Landing `design-block.ts` and typechecking it **before authoring any template**
was the single highest-value step in the build, because it caught two behaviours
that would have been invisible until data was already stored.

**`z.record` with enum keys demands every key.**

```ts
z.record(designColorSlotSchema, designHexSchema).safeParse({})
// → FAILS: expected string at "background", at "accent", …
```

A design that overrides one colour — which is all of them — would have been
rejected on read. The fix is `z.partialRecord`.

**`.default(value)` returns the value verbatim, without parsing it.**

```ts
const layout = z.object({ dx: z.number().default(0) }).default({});
layout.parse(undefined);   // → {}          ← dx is UNDEFINED
layout.prefault({}).parse(undefined);  // → { dx: 0 }
```

The renderer reads `block.layout.dx`. With `.default({})` that is `undefined`
forever. `.prefault()` runs the value through the schema first.

Both verified against zod 4.4.3 rather than assumed, and both are commented at
the declaration so nobody reverts them.

### 3.2 The first banner layout was built backwards

The first archetype stacked everything in the **left third** of a 1584×396
canvas and put the logo row at the bottom-left.

LinkedIn drops the member's profile photo over the lower left of their cover. The
wordmark was rendering exactly under their own face, and two-thirds of the canvas
was empty.

Reading the actual banners in `research/figma-profile-kit/` settled it in ten
minutes: **every one of them leaves the left third empty** and composes in the
right two-thirds. That is now `insetLeft` on the document — a normalised fraction,
per canvas, because a featured cover has no avatar to clear.

The lesson generalises: the conventions were sitting in the reference material and
the layout was written without reading it.

### 3.3 The type scale was sized for the wrong axis

A banner is 1584 wide, which invites a large display size. It is also only **396
tall**, and the vertical budget is what actually binds: a two-line headline at
72px eats 150 of the 250 usable pixels before the subline and CTA get a row.

The first version overflowed, sliced the top off the headline and pushed the
footer past the bottom edge. Measured against the reference banners, their
headlines run about **45px**, not 70.

Two fixes, and the second matters more:

- Retuned the scale — display 52, padding 44, gap 10, leaving ~38px of headroom.
- `overflow: hidden` on the canvas root, so an over-tall stack is **clipped, not
  bled**. With `justify: center` an over-tall column overflows symmetrically,
  which reads as a broken render rather than a full one.

There is a budget calculation in the comment on `DESIGN_TYPE_SCALE.linkedinBanner`.
Redo it if you change a number there.

### 3.4 The avatar guide promised twice the clear space it should

The safe-zone circle was eyeballed from a mockup. Measured against a real
profile, the centre was almost right (0.135 vs 0.133) but the **diameter was half
what it should be** — 0.11 against a true 0.198.

A guide that promises more clear space than exists is worse than no guide, because
people trust it and put the thing they care about under their own face.

The remaining `mobileCrop` region is still an estimate and is labelled as one.

### 3.5 Live preview took the app down, and the symptom looked like something else

**This is the most instructive failure in the build.**

`preview` shipped as a tRPC mutation. The procedure factory wraps **every**
mutation in a Prisma transaction, so a keystroke-debounced render held a pooled
connection for the ~1–2s satori takes. The pool is 5.

A few seconds of typing exhausted it. The first thing to fail was **Better Auth's
own session lookup** — so the member was treated as signed out and bounced back to
the gallery mid-edit. Nothing in that symptom points at the renderer.

The log named it exactly:

```
Timed out fetching a new connection from the connection pool.
meta: { modelName: 'Session', connection_limit: 5, timeout: 20 }
```

Fixed by moving preview to `POST /api/studio/preview`, a route handler that
touches **no database at all**: read the cached session, validate the posted
document, rasterise, return bytes. Nothing to roll back, no connection to hold.
It answers in ~30ms of overhead instead of holding a transaction.

What that gives up is stated in the route's own header: the factory's quota, rate
limit and audit wiring. A preview spends no quota and writes no audit row by
design, so only the rate limit is a real loss — and the render was always bounded
by `DESIGN_MAX_BLOCKS` and the per-slot ceilings, which is what actually guards
it against hostile input.

### 3.6 The download did not match the preview

The worst class of bug a design tool can have, and it shipped.

`Download` appeared whenever *any* exported file existed. So: edit → Save →
Download handed back the banner from **before** the edits, with no indication
anything was wrong.

The data to prevent it was already there and unused. `status` drops to `"draft"`
on every save and returns to `"ready"` only after a successful export. Download is
now gated on `ready`, and when it is not, the editor says so:

> This design has changed since it was last exported. Export again to download the
> version you can see.

The same rule gates the zip: only `ready` assets are bundled. Including a stale
one would hide the disagreement instead of surfacing it.

### 3.7 A slider default quietly destroyed the type scale

The Style tab's size slider defaulted to a magic `48` whenever a layer's size was
unset. Touching it threw an eyebrow from 16px to 48 and pulled a headline from 52
down toward it — the control destroyed the thing it was meant to adjust.

It now rests at the layer's **actual resolved size** and reads `Auto · 52px`. A
slider whose resting position is not the current value is a trap, not a default.

A **Reset all styling** button was added alongside, because per-layer overrides
are easy to apply and tedious to unpick, and on a free plan of one project
"delete and start again" costs everything.

### 3.8 Three of four background patterns would have rendered as flat colour

satori documents `repeating-linear-gradient` as supported. [vercel/satori#554]
reports it silently failing when the output is **PNG** — which is every render
this app performs.

Grid, Dots and Stripes were all built on it. They would have come out as a flat
field, and nobody could have told whether they were broken or just subtle.

The set is now chosen by **what actually rasterises**:

| Pattern | How |
|---|---|
| Glow | `radial-gradient` — well supported |
| Fade | `linear-gradient` — well supported |
| Grid | Drawn as positioned divs; no non-repeating gradient makes one |

Dots and diagonal stripes were **dropped rather than faked**. Both need
repetition, and a dot field as elements costs hundreds of nodes on a canvas that
re-renders every keystroke.

The grid uses 132px spacing, not 48: twelve verticals and three horizontals read
as the same texture at banner scale for a quarter of the nodes.

### 3.9 Smaller ones, each with a general lesson

| Symptom | Cause | Lesson |
|---|---|---|
| All four gallery buttons greyed at once | `disabled={mutation.isPending}` on every card | Pending state belongs to the item, not the mutation |
| "Failed to fetch" while typing | Superseded renders were never aborted | If you start a request per keystroke, cancel it per keystroke |
| Memory grew while editing | Object URLs created per preview, never revoked | `createObjectURL` always needs a matching `revokeObjectURL` |
| An invisible CTA in one archetype | `buttonPill` has no border, so an opacity-0 fill drew nothing | Know which properties a block type actually reads |
| Turbopack failed on the barrel | `DesignContentFormProps` exported twice | tsc tolerated it; the bundler did not |

---

## 4. The performance misdiagnosis

Worth its own section, because it nearly cost a rewrite.

The app felt unusably slow and the obvious suspect was the renderer. The proposal
on the table was to abandon satori for a canvas library.

The timings said otherwise:

| Procedure | Median | Renders anything? |
|---|---|---|
| `studio.list` | 7,450ms | No |
| `linkedinPosts.list` | 7,338ms | No |
| `postIdeas.list` | 6,142ms | No |
| `usage.getFeatureGates` | 3,635ms | No |
| `studio.preview` | 8,028ms | Yes |

`postIdeas.list` is a `findMany` on a small table, built long before the studio,
and it takes **six seconds**. Every path in the app sits at a 6–7 second floor
whether it draws a pixel or not. Subtract the floor and the actual satori render
is about **one second**.

The cause:

```
db host: ep-…-pooler.c-4.us-east-2.aws.neon.tech
params : connection_limit=5, pool_timeout=20, pgbouncer=true
```

Neon in **Ohio**, developer in **India**. ~250–350ms per round trip, and every
protected request makes several sequentially — session, membership, feature gates,
the handler's own queries, the usage counter on mutations. Five to eight round
trips is your 2-second floor before Neon's autosuspend and pool queuing.

`getFeatureGates` is not even inefficient; it already runs its two queries in
parallel. Two round trips to Ohio is 3.6 seconds from where it was measured.

**None of it is fixable by changing renderers.** In production, deployed next to
the database, those round trips are single-digit milliseconds.

The general lesson: **measure before you attribute.** The slow thing and the
new thing are not automatically the same thing.

---

## 5. Things that will bite the next person

**Never run `prisma migrate dev` in this project.** There is no
`prisma/migrations/` directory; this codebase has always used `db push`. Given an
empty migration history and a full database, `migrate dev` reads the entire schema
as drift and offers to fix it by dropping everything. `docs/10-profile-analyzer.md`
records someone hitting exactly that. The original plan for this feature specified
`migrate dev` and had to be corrected before anyone ran it.

**Every satori node needs an explicit `display: flex`.** It is applied centrally
through one shared constant in the renderer so no block type can forget it. There
is exactly one exception, commented at the emit site: a text block with
`maxLines > 1` uses `-webkit-box` for line clamping, and setting `flex` there
silently disables the clamp.

**Colours must be six-digit sRGB hex.** satori cannot parse `oklch()`, which is
how every theme token in this app is authored. That is why `design-theme.ts`
exists, and why a colour it cannot parse draws nothing rather than erroring.

**WOFF only, never woff2.** Without explicit font buffers, `next/og` falls back to
its bundled Regular face and **silently ignores `fontWeight`** — every weight
renders identically. Flat type, no error.

**Designs are cloned, never referenced.** Editing an archetype does not change any
existing design. That is deliberate — improving a layout must not rewrite someone's
finished banner — but it means template changes are invisible until a new project
is created. Several "the fix did not work" reports during this build were this.

**`insetLeft` and `align` inherit from the default archetype** when a canvas is
not defined. An archetype is a BANNER convention; a headshot is a photo in a
circle whatever style it came from.

---

## 6. What is not built

- **Carousels on this renderer.** `carouselSlideToDesignDoc()` is a ~40-line pure
  function called at render time; `Carousel.slides` is never rewritten and no
  backfill runs. Only possible because `computed` text refs exist from day one.
- **Multiple featured covers.** Needs `addAsset` / `removeAsset` and reordering.
- **Company banner**, added on demand rather than seeded — most members have no
  company page, and an empty asset nobody asked for is a step in a flow.
- **The drag editor.** Deliberately deferred. The reference editors that inspired
  this feature do not have one, and free positioning is how people make ugly
  things. The `layout` field on every block exists and is stored, so the decision
  is reversible; the field shape is the expensive part and it is settled.

---

## 7. The original plan

Kept because the reasoning still holds and several decisions only make sense with
it. Where it disagrees with the sections above, the sections above are what
shipped — notably: `preview` is a route handler and not a procedure, nav order is
9 rather than 7, and the migration command is `db push`.

See `research/feature.md` §2 for the product research this came from, including
the source-kit findings and the licence note that governs how archetypes may be
authored.

[vercel/satori#554]: https://github.com/vercel/satori/issues/554

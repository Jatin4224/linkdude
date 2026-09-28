# 23. Carousel editor — live preview, structure, themes, PNG export

> **Status: built.** The live preview, drag-and-drop reordering, structure controls,
> in-editor template and shape switching and the PNG export all shipped.
>
> Read `16-carousel-generation.md` first — this changes that feature's editor and
> render path. Then `24-carousel-templates.md`, which supersedes parts of this
> document: the render path described here was later moved onto the shared design
> engine, so `CarouselSlideView` and `carousel.service.tsx` no longer exist.
>
> The plan is kept below the build log because its reasoning is still the reason
> these choices were made.


## Context

`linkedin-carousel-generator-feature-specification.md` describes a carousel tool with a split-view editor showing a live slide preview, drag-and-drop reordering, theme switching before export, and PNG image-sequence export. The shipped feature (built 2026-08-16, docs/16-carousel-generation.md) has none of those: the design is **invisible until you render and download the PDF**, reordering is arrow buttons, `templateId`/`pagePreset` are frozen at creation, and the only export is a single multi-page PDF.

This plan closes those four gaps plus the create-dialog polish the spec's Empty/Loading states call for, and fixes three real defects found while reading:

1. **Search lies.** `carousel-workspace.tsx:173-177` filters the current page client-side while `DataTable` shows the server `total` — searching can render 0 rows under "Page 1 of 4".
2. **Download serves a superseded PDF.** `slide-editor.tsx:145` renders the Download link on `documentUrl` alone with no status check, but `updateCarouselRecord` flips `status → "draft"` on every save. Edit + save, and Download hands you the old file. Studio documents this exact failure as "the single worst thing this tool can do."
3. **`/api/studio/preview` has no font tracing entry.** `next.config.ts:17-24` lists only `/api/trpc/[trpc]` and `/opengraph-image`; nothing imports the `.woff` files, so in a traced deploy that route falls back to next/og's single Regular face and every weight rasterises identically. The new carousel preview route would inherit the same hole.

Outcome: you can see a slide while you write it, restructure the deck freely, change the look without regenerating, and download either a PDF or a zip of PNGs — with the toolbar never offering a file that disagrees with the screen.

**Approved decisions:** preview via a new `/api/carousel/preview` **route handler** (not a tRPC mutation, not a DOM approximation, not a migration onto the Studio `DesignDoc` engine); drag-and-drop via **native HTML5 drag events**, no new dependency.

---

## Architecture

Everything reuses what exists. Net-new: two schemas, one route handler, one global component, two route-local components. **No new tRPC verb, no new permission, no `resources.ts` change, no Prisma migration.**

| Need | Reused |
|---|---|
| Preview route shape | `src/app/api/studio/preview/route.ts` — copy verbatim in structure |
| Debounce / abort / last-good-frame | `studio/_components/design-preview.tsx` (globalized, §Phase 5) |
| Preview fetch | `studio-workspace.tsx:217-244` `renderPreview` useCallback |
| Slide rasterisation | private `CarouselSlideView` + `renderSlidePng` in `carousel.service.tsx` |
| Zip export | `studio/_components/export-panel.tsx`; `jszip ^3.10.2` already installed |
| Server search | `listLibraryPostsSchema` (`search: z.string().trim().max(200).optional()`) + `{ contains, mode: "insensitive" }` (`linkedin.service.ts:1193`) |
| Reset page on search | `posts-library.tsx` `setSearch(v); setPage(1)` |
| Empty/no-match states | `DataTable` already branches on `search?.value` (verified `data-table.tsx:198-211`) — no new copy needed |
| Save with template/shape | `updateCarouselSchema` + `updateCarouselRecord` **already accept** `templateId`/`pagePreset` and reset `status → draft` |

Every new file/symbol gets the `SOURCE OF TRUTH KEYWORDS / WHAT / WHY / WHERE` header. All schemas and types go in `src/lib/types/carousel.ts` only.

---

## Branch

Branch off **`feature/app-design-system`, not `main`.** That branch is 30 commits ahead of main and those commits contain `TechSurface` / `TechEmpty` / `tech-scope` and the studio design-system work — which the carousel workspace, the slide editor and the `design-preview.tsx` being globalized in Phase 4 all already depend on. Off `main`, this plan doesn't compile. Commands are in the handover message; you run them.

## Phase 0 — Save the plan into the repo

**NEW `docs/23-carousel-editor.md`** — this plan, committed as the feature's working doc in the next numbered slot (last is `22-design-system.md`). It starts as the approved plan and gets rewritten into built-feature narrative at handover, the way `docs/20-studio.md` and `docs/16-carousel-generation.md` are written. Phase 7 then adds a pointer line from `16-carousel-generation.md` to it.

## Phase 1 — Types

**EDIT `src/lib/types/carousel.ts`** (extend the file's keyword header with every new symbol):

- `carouselSlidePreviewSchema` — `{ slide: carouselSlideSchema, index, total, templateId: carouselTemplateSchema, page: carouselPagePresetSchema }`, bounds from `CAROUSEL_MIN/MAX_SLIDES`, plus `.refine(v => v.index < v.total)`. Export `CarouselSlidePreviewValues` (`z.infer`).
  *Per-slide, not whole-deck: the payload is the debounce dependency, so a deck payload means typing in slide 9 re-renders slide 1 and discards the bytes. The `.refine` buys back the one invariant the narrow payload loses — without it, `index: 8, total: 5` draws "09 / 05" with a progress bar past 100%.*
- `carouselDraftSchema` — `{ slides, templateId, page }`, all required. Declared as the non-optional twin of `updateCarouselSchema` minus `id`, **not** `.omit()`-derived: update's fields are `.optional()` for partial saves, and under `exactOptionalPropertyTypes` an omit-derived type keeps them optional, re-opening the dirty-check hole. Say that in the comment.
- `normalizeCarouselSlideKinds(slides)` and `carouselSlideKindOptionsFor(index, total)` — the position/kind invariant as pure functions (precedent for helpers here: `authSchemaFor`).
- `search: z.string().trim().max(200).optional()` on `listCarouselsSchema`, with the `listLibraryPostsSchema` rationale (capped because it becomes a `contains`; unbounded is a free scan).

**EDIT `src/lib/types/index.ts`** — add to the existing `./carousel` value and type blocks + the barrel keyword header.

## Phase 2 — Config

**EDIT `src/lib/config/carousel.ts`** and export from `src/lib/config/index.ts`:

`CAROUSEL_PNG_MIME_TYPE` (beside the existing `CAROUSEL_PDF_MIME_TYPE`) · `CAROUSEL_PREVIEW_PATH = "/api/carousel/preview"` · `CAROUSEL_PREVIEW_DEBOUNCE_MS = 300` (restated, not imported from studio — a 1080×1350 slide is ~1.46MP vs the banner's 0.6MP, so it's a per-feature budget; `config/studio.ts` already declares it mirrors this file, so the dependency runs that way) · `carouselSlideImageFileName(index, total)` → `slide-01-of-07.png` (zero-padded so an unzipped folder sorts in deck order) · `carouselImagesZipFileName(title)` · `CAROUSEL_SAMPLE_TOPICS` (3–4 real topics, each written to pass `CAROUSEL_TOPIC_MIN` so a click never yields an invalid form) · `CAROUSEL_GENERATION_PHASES` (`{ atMs, label }[]`).

Also **move in** `CAROUSEL_TEMPLATE_LABELS` (from `carousel-form.tsx`) and `CAROUSEL_SLIDE_KIND_LABELS` (from `slide-editor.tsx`) — both gain a second consumer in this work.

## Phase 3 — Server render path

**EDIT `src/services/carousel.service.tsx`**
- Private `resolveSlideRenderContext(templateId, pagePreset) → { preset, palette, scale }`; call it from **both** `renderCarouselPdf` and the new preview export. This three-line dedupe is what makes "the preview is the real render" true rather than aspirational.
- Exported `renderCarouselSlidePreview(input: CarouselSlidePreviewValues): Promise<RenderedCarouselSlide>`. `renderSlidePng` and `CarouselSlideView` stay **private** — this mirrors `renderDesignPng`, where the route hands over a parsed document and the service owns render policy. Exporting `renderSlidePng` would force the route to build `SlideViewProps`, a private interface in a `server-only` file that would then have to be promoted to `lib/types` purely so a transport layer could construct render input.
- `RenderedCarouselSlide` is declared **in the service** beside `RenderedCarousel`, matching `RenderedDesign` in `design-render.service.tsx`. Note the precedent so nobody relocates it.

**NEW `src/app/api/carousel/preview/route.ts`** — `getCachedSession()` → `carouselSlidePreviewSchema.safeParse` → `renderCarouselSlidePreview` → raw PNG bytes, `Cache-Control: no-store`. Header states the connection-pool reason it is a route handler (a tRPC mutation opens a Prisma transaction; a debounced render held a pooled connection long enough to starve Better Auth's Session lookup and sign the member out mid-edit) and what it gives up (quota, rate limit, audit — the schema caps are the bound).

**EDIT `next.config.ts`** — add `"/api/carousel/preview"` **and** `"/api/studio/preview"` to `outputFileTracingIncludes`. The studio entry is missing today; both need it or satori silently ignores `fontWeight`.

## Phase 4 — Server search + list titles

**EDIT `src/services/carousel.service.tsx`** — `listCarousels(organizationId, filters, pagination, db = prisma)` (keep this file's db-last-with-default convention). `filters: Pick<ListCarouselsValues, "search">`, no new type. Build one `const where: Prisma.CarouselWhereInput` and use it in **both** `findMany` and `count` — the shared `where` *is* the fix, since the defect is `total` disagreeing with the rows. Also add `title: true` to `CAROUSEL_LIST_SELECT`'s nested `document` select.

**EDIT `src/trpc/routers/carousel.ts`** — `list` forwards search with a conditional spread (`...(input.search ? { search: input.search } : {})`); a bare `search: input.search` fails `exactOptionalPropertyTypes`. **This is the only router change in the whole plan.**

## Phase 5 — Globalize the preview mechanics ⚠️ *the one step that touches a shipped surface*

**NEW `src/components/global/render-preview/{render-preview.tsx,index.ts}`** — `RenderPreview<TPayload>({ payload, onRender, debounceMs, aspect, alt, caption?, overlay?, className? })`. Mechanics only: debounce, `AbortController`, abort-is-not-an-error, last-good-frame dimmed at `opacity-60` and never blanked, all three `URL.revokeObjectURL` sites, `aspectRatio` reservation, `Skeleton` before the first frame, "Rendering" indicator and errors **beside** the caption never over the canvas.

**EDIT `studio/_components/design-preview.tsx`** — becomes a thin composition with its **public props unchanged** (`doc`, `onRender`, `showSafeZones`, `className`), passing its safe-zone boxes + `SafeZoneDoodle` as `overlay` and its own `caption`. One consumer (`studio-workspace.tsx:527`), zero call-site edits.

Globalized at the second use rather than the fourth (which is the threshold `DataTable`'s own comment argues for) because this code owns **resource lifetimes**: a divergent copy of blob revocation and abort handling doesn't look broken, it leaks a blob per keystroke and flashes "Failed to fetch" while you type, and whoever fixes one copy won't know the other exists. **Mitigation: move, don't rewrite** — lift the effect body verbatim, keep `JSON.stringify(payload)` as the dep with `JSON.parse` inside (works for both shapes). Then load `/dashboard/studio`, type, and confirm the preview still redraws and holds its last good frame **before proceeding**. If it regresses, fall back to a route-local carousel twin and leave studio alone.

## Phase 6 — The editor

**NEW `carousel/_components/slide-preview.tsx`** — composes `RenderPreview`; owns the `React.useCallback(…, [])` fetch to `CAROUSEL_PREVIEW_PATH`. Caption = kind label + `n / total` + shape label.

**NEW `carousel/_components/slide-image-export.tsx`** — `const { default: JSZip } = await import("jszip")`, sequential per-slide POSTs, `Building zip… (3/7)` progress, object URL → synthetic `<a download>` → immediate revoke, `toast.error` on failure. Labelled **"Download PNGs (7)"**, never "Export" — "export" in this app means the stored artifact, and these bytes have no `Document` row. Gated on `!isDirty` like Render and Publish so the toolbar has one rule; **not** gated on `status === "ready"`, since an image sequence is an alternative export, not a derivative of the PDF.

**EDIT `carousel/_components/slide-editor.tsx`** — the bulk of the work:

- **Split view:** `grid lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]`, preview column `order-1 lg:order-2` (studio's mobile-first-preview rule) and `lg:sticky lg:top-6 self-start`, because unlike studio's short form this sits beside a 12-card stack.
- **Selection:** one `selectedIndex` + a numbered filmstrip of compact `aria-pressed` buttons (studio's asset-switcher pattern); clicking a card or focusing its heading also selects. `activeIndex = Math.min(selectedIndex, slides.length - 1)` derived **during render** (no `setState` in an effect, matching the `syncedId` discipline). Rejected N rendered thumbnails: satori is ~50ms/slide single-threaded after a ~2s cold start, so a 12-slide strip is ~600ms of app-server CPU *per debounce tick per user* — and while you type a heading you're looking at one slide. The preview draws the **buffer**, so it must never be gated on `!isDirty`; it's the only surface that shows unsaved work truthfully.
- **Stable keys:** ephemeral `slideKeys: string[]` parallel to the buffer (`slides.map((_, i) => String(i))`, new entries from a `keyCounterRef`). Slides are a bare Json array and **must not gain an `id`** — that changes the stored shape. With `key={index}`, a reorder makes React reuse position 3's DOM node for a different slide: focus lands on the wrong input mid-typing. Content keys are worse (remount per character). All structural mutations go through one `applyReorder(from, to)` / `applyInsert(at, slide)` pair that splices **both** arrays so they can't desync.
- **Native DnD:** `draggable` on a `GripVerticalIcon` **handle only** — a draggable card breaks text selection inside its `Input`/`Textarea` in Firefox and Safari. `onDragStart` must call `dataTransfer.setData("text/plain", …)` or Firefox refuses to start the drag; `effectAllowed = "move"`. Card is the drop target (`onDragOver` + `preventDefault`, `onDragLeave`, `onDrop`, `onDragEnd`). Drop indicator uses theme tokens (`border-primary`), never a hex.
- **A11y:** `aria-live="polite" sr-only` region announcing every reorder, insert, delete and kind correction. Arrow buttons stay as the keyboard path **and the only touch path** — HTML5 DnD has no touch support.
- **Structure controls:** add / duplicate / delete with `canAdd = slides.length < CAROUSEL_MAX_SLIDES` and the existing `canDelete`; toolbar reads `{n} / 12 slides` so the ceiling is visible before it's hit. **Add** inserts `{ kind: "content", heading: "", body: "" }` after the focused slide — or *before* it when the focused slide is last, so the cta is never displaced ("new slides land between the focused slide and the cta"), then autofocuses it and selects it. Heading stays **empty**, not `"New slide"`: `carouselSlideSchema` requires `min(1)`, so Save is correctly blocked, and a placeholder would make a deck titled "New slide" renderable and publishable. Surface it studio-style: disable Save and print "Slide 4 needs a heading to save." **Duplicate** inserts a verbatim copy after its source, no "Copy of" prefix.
- **Kind switcher:** kind is a *position role*. Index 0 locked to `cover` (disabled, with the reason), last locked to `cta`, middle may choose `content` or `cta`. After any structural change, `normalizeCarouselSlideKinds` forces the endpoints and demotes a stray `cover` → `content`, announced in the same live region so the correction is never silent. **Not encoded in `carouselSlidesSchema`**: that schema is the *read* path (`parseCarouselSlides` runs on every `getCarousel`), so a positional refine would make an older deck impossible to *open* — strictly worse than one that renders oddly — and it's also the model-output schema, turning a model slip into a hard generation failure. Existing decks already satisfy the rule, so encoding it buys nothing.
- **Template + shape `Select`s** wired to the draft, reusing the shared label maps. The preview re-renders with no extra wiring because both are in the payload.
- **Download gated on `status === "ready"`**, and when `documentUrl && status !== "ready"`: *"This deck has changed since it was last rendered. Render again to download the version you can see."* (adapted from `studio-workspace.tsx:506-511`). This is defect #2.

**EDIT `carousel/_components/carousel-workspace.tsx`**
- `draftSlides: CarouselSlides | null` → `draft: CarouselDraftValues | null`. Seed template/shape in the existing `syncedId` render-phase block with `carouselTemplateSchema.catch("minimal").parse(row.templateId)` — **no `as` cast**; this is the client twin of the never-throw contract `getCarouselPalette` documents, and the alternative puts an unknown string into a `<Select value>` and renders an empty trigger.
- `isDirty` becomes one compare over `{ slides, templateId, page }`. Today it compares slides only, so changing the template would leave **Save disabled and Render enabled** — click Render and you'd get a PDF of the old template.
- Save payload carries all three. **No backend change needed.**
- `key={openId}` on `SlideEditor` — one attribute resets selection, drag state, announcements and reorder keys at exactly the boundary where `syncedId` resets the buffer. Pass `status` too.
- Delete `visibleRows` and its now-false comment; pass `rows`; add the conditional `search` to the query input; `setSearch(v); setPage(1)` in `onChange`. No `empty` copy change — `DataTable` handles it.
- Topic column renders `row.document?.title ?? row.topic` with the topic as a muted second line, so rendered decks are named by their real public title instead of the raw prompt.

## Phase 7 — Create dialog

**EDIT `carousel/_components/carousel-form.tsx`** — `CAROUSEL_SAMPLE_TOPICS` chips shown only while the topic field is empty, each `form.setValue("topic", sample, { shouldValidate: true, shouldDirty: true })`; template labels imported from config; phased progress copy from `CAROUSEL_GENERATION_PHASES` via one `setInterval` effect keyed on `isGenerating` (a timer subscription — *not* state derived from props, which is what the lint rule forbids).

Copy note: the spec's "Applying design themes…" describes nothing `create` does — templates apply at *render*. Ship `"Structuring slides…"` → `"Applying your design theme…"` (defensible: the deck is written for the chosen shape and stored with the chosen template) → a third label for long waits, with the WHY comment stating the labels are **time-based, not progress-based**, because one opaque model call knows nothing about its own phase. No fake percentage.

## Phase 8 — Docs

**EDIT `docs/23-carousel-editor.md`** — rewrite the Phase 1 plan into built-feature narrative. **EDIT `docs/16-carousel-generation.md`** — the preview route and why it isn't a mutation, the split editor, where the kind invariant lives, the client-side PNG zip, the search fix, and a pointer to `23-carousel-editor.md`. Mirrors how `docs/20-studio.md` documents its preview route.

---

## Deviation from the brief, for your call

**No `Carousel.title` column.** I'd drop the editable deck title. The only title that reaches an audience is `Document.title`, derived by `carouselDocumentTitle(slides[0]?.heading, topic)` from the **cover heading** — which this editor makes fully editable, so you already control the public name one line away. A `title` column would be a second, competing name for the same artifact, and `config/carousel.ts`'s own header documents name-conflation as a real shipped bug. Cost: a `prisma db push` handoff plus six touch points. The Phase 6 substitute (`row.document?.title ?? row.topic` in the list) fixes the actual complaint — that list rows read like prompts — for one field on a select that already exists.

Say the word and I'll add it: `title String?` under `topic`, `title: true` on both select constants, `title` on `updateCarouselSchema`, spread in `updateCarouselRecord`, and the fallback chain widened into `carouselDocumentTitle(deckTitle, coverHeading, topic)` so nothing can disagree — plus `npx prisma db push` for you to run.

**Also honest:** the spec says PNG/JPEG. resvg emits PNG; we ship PNG only.

## Deferred

Rendered-thumbnail filmstrip (N satori passes per tick; needs content-hash caching) · a `carousel.renderImages` verb with a stored zip (new permission, quota and audit surface for bytes the client gets free) · touch drag-reorder (HTML5 DnD is mouse/keyboard only — the reason the arrows stay) · search debounce (belongs inside `DataTable` so every list benefits) · a shared `downloadBlob()` util (not worth touching studio twice in one change) · carousel onto the studio `DesignDoc` engine, docs/20-studio.md phase 5 (the new route is written so that migration replaces exactly one service function) · per-deck palette / "swap background styles" (needs a `paletteOverrides` shape — a feature, not polish) · auto-summarising over-long input across cards (prompt bounds already cover it).

## Verification

```
npm run typecheck   # clean at handover — no any, no `as` on the enum widening
npm run lint        # server-only ordering + import restrictions
```

Then with `next dev` running:
1. `/dashboard/studio` — type in a field; the preview must still redraw and hold its last good frame. **This is the Phase 5 regression gate.**
2. `/dashboard/carousel` — open a deck, type a heading, watch the preview debounce.
3. Drag a card by its handle: focus must not jump, and the live region must announce the move.
4. Switch template → Save enables, Render disables. Save → Download disappears and the stale line shows until you re-render.
5. Search a topic that only exists on page 2 → rows and "Page x of y" agree.
6. Download the PNG zip → files sort in deck order.

**Do not run `npm run build` while `next dev` is running** — the production artifacts collide with Turbopack's output and every route 404s, including `/api/trpc/[trpc]`, until dev restarts. Clear `.next` if it happens.

---

# Build log — what actually shipped

Everything in the plan above was built. No new dependency, no new tRPC verb, no new
permission, no `resources.ts` change, no Prisma migration. Five points where the
implementation had to differ from the plan, each because the codebase pushed back:

### 1. The preview component owns no cast

The plan lifted studio's `JSON.parse(serialized) as DesignDoc` into the global
component. Generic over the payload, that becomes `as TPayload` — a cast in the one
file that should be most defensible. Instead `RenderPreview` closes over `payload`
directly and keys the effect on `serialized`: the closure belongs to the render the
string was computed from, so it is already the right snapshot. That needs an
`exhaustive-deps` disable, which is load-bearing here and annotated (studio's copy
needed none because it referenced only the string).

### 2. Select values are narrowed by lookup, not asserted

Three new `Select`s hand back a value that has to become a union member. The plan
said nothing about it and the obvious `value as CarouselTemplate` is exactly the
bypass CLAUDE.md forbids. The repo already had the answer in
`components/global/image-editor`: `OPTIONS.find((o) => o === String(value)) ?? current`.
Used for kind, template and shape. `carouselPagePresetSchema.options` supplies the
page keys, so nothing needs a new exported tuple.

### 3. `resolveSlideRenderContext` removed a pre-existing cast

`renderCarouselPdf` resolved its preset with `CAROUSEL_PAGE_PRESETS[pagePreset as CarouselPagePreset] ?? …`.
The shared resolver parses instead — `carouselPagePresetSchema.catch("portrait").parse(…)` —
matching the never-throw contract `getCarouselPalette` documents. `CarouselPagePreset`
is no longer imported by the service.

### 4. The generation-phase hook was rewritten twice by the linter

The plan's "one `setInterval` in an effect keyed on `isGenerating`" trips two rules
this project enforces, and both are right:

- `react-hooks/set-state-in-effect` — resetting the elapsed clock in the effect body
  cascades a render every time the dialog opens.
- `react-hooks/purity` — moving the reset into render means calling `Date.now()`
  during render, making a render's output depend on when it happened.

The shipped version stamps each generation with a **run id** incremented during
render via a previous-value marker (pure, an updater function), reads the clock only
inside the effect and its timer callback, and treats a reading from an earlier run as
zero. A second attempt after a failure therefore opens on the first phase instead of
inheriting the last label, with nothing resetting state at the wrong moment.

### 5. An empty heading short-circuits the preview

`carouselSlideSchema` requires a heading, and "Add slide" deliberately inserts an
empty one so Save stays blocked. Posting that would make every debounce tick a
guaranteed 400 and paint the caption red while someone types the first word.
`SlidePreview` therefore renders a framed placeholder — same aspect, so the column
does not resize — naming what is missing.

## Files

**New (5)**

```
src/app/api/carousel/preview/route.ts                    one slide → PNG bytes, no DB
src/components/global/render-preview/render-preview.tsx  debounce, abort, last good frame
src/components/global/render-preview/index.ts            barrel
.../carousel/_components/slide-preview.tsx               composes RenderPreview
.../carousel/_components/slide-image-export.tsx          jszip, per-slide PNGs
```

**Edited (10)**

```
src/lib/types/carousel.ts          + preview & draft schemas, kind helpers, list search
src/lib/types/index.ts             + barrel exports and header keywords
src/lib/config/carousel.ts         + png mime, preview path/debounce, labels, samples, phases
src/lib/config/index.ts            + the above
src/services/carousel.service.tsx  + resolveSlideRenderContext, renderCarouselSlidePreview,
                                     list search, document.title on the list select
src/trpc/routers/carousel.ts       list forwards `search` (the only router change)
next.config.ts                     font tracing for both preview routes
studio/_components/design-preview.tsx   composes RenderPreview; props unchanged
carousel/_components/slide-editor.tsx   split view, DnD, structure, look controls
carousel/_components/carousel-workspace.tsx  draft buffer, one-compare isDirty, server search
carousel/_components/carousel-form.tsx  sample topics, phased label
```

## Defects fixed along the way

1. **Search showed rows and totals that disagreed** — client-side filtering over a
   server-paginated page. Now one `where` feeds both `findMany` and `count`.
2. **Download served a superseded PDF** — the link rendered on `documentUrl` alone,
   but every save resets `status` to `draft`. Now gated on `status === "ready"`, with
   the stale-deck line studio already uses.
3. **`/api/studio/preview` had no font tracing entry** — pre-existing, found while
   adding the carousel's. In a traced deploy that route falls back to next/og's single
   Regular face, so previews render flat while the PDF path renders correctly.

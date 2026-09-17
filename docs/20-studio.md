# LinkDude Studio — spec-driven design board

> **Status: approved plan, not yet built.** Every other document in this folder
> describes a shipped feature; this one describes the next. Approved 2026-09-18.
> Research and reasoning behind it: `research/feature.md` §2 (untracked).

## Context

The app can write a LinkedIn post but cannot make the profile it lands on look
credible. The Figma kit in `research/figma-profile-kit/` solves that badly — it
makes people learn Figma, and its own guide tells users to pay a designer $150
instead. This feature is the same outcome as a 30-minute guided flow: pick a
style, fill in your words, download a banner, headshot and featured covers.

Mockups: `research/design/profile-editor/`. Background and the source-kit
findings: `research/feature.md` §2.

**Two decisions already settled, which shape everything below.**

1. **The Audit screen is not rebuilt.** `/dashboard/profile-analysis` already
   ships a 0-100 score, per-section findings, history and `RESOURCES.profileAnalysis`
   metering. The studio links to it. One score, no duplication.
2. **Templates become data, not code.** Today `src/lib/types/carousel.ts:74`
   says adding a design costs "a config entry plus a renderer branch", and
   `CarouselSlideView` hardcodes its layout. That does not reach 20 templates.
   A declarative block language plus one generic renderer makes template #21
   cost one config object and zero render code.

Answered this session: route is **`/dashboard/studio`**, nav label **"Studio"**;
the gallery is a **browsable wall of ready designs** (no AI layout generation);
**jszip client-side** for "Download all"; metered **per project, free = 1**.

Intended outcome: one renderer and one editor that serve profile assets now and
absorb carousel slides in phase 5, without a data migration.

---

## Architecture

```
StudioTemplate (config)   → archetype + palette + tone + role tags  ← the 20 gallery cards
        ↓ clone
DesignDoc (Json row)      → blocks + user's text slots + palette overrides
        ↓
renderDesignPng(doc)      → ONE generic renderer → satori tree → PNG
```

20+ gallery entries come from **5 archetypes × palettes × tones**, the same split
`CAROUSEL_TEMPLATES × CAROUSEL_PALETTES` already proves. Five archetypes × four
geometries = 20 hand-authored block lists total, forever.

The five archetypes are derived from the source kit's own corpus (see
`research/feature.md` §2): statement+CTA, proof strip, stacked keywords,
offer+guarantee, conversational/DM-first. **Layout conventions only — never a
named creator's design**, per the licence finding recorded in that doc.

### The block language — `src/lib/types/design-block.ts` (new)

One `text` block with a `role`, not separate heading/subheading/eyebrow types.
Three block types differing only by a font size would be three renderer branches
for nothing — the same mistake `slide.kind` made. The role indexes the
per-geometry type scale.

| `type` | Carries |
|---|---|
| `text` | `text: DesignTextRef`, `role: display\|heading\|subheading\|body\|meta`, `weight`, `color`, `align`, `transform`, `maxLines`, `letterSpacing` |
| `badgeRow` | `items: DesignTextRef[]` (1-4), `fill`, `label`, `border?`, `role`, `gap`, `radius` |
| `buttonPill` | `label`, `fill`, `labelColor`, `role`, `radius`, `paddingX/Y` |
| `logoText` | `text`, `mark: none\|square\|circle`, `markFill`, `color`, `role` |
| `image` | `slot`, `fit`, `width`/`height` (normalised 0-1), `radius`, `ringWidth`, `ringColor?` |
| `shape` | `shape: rect\|circle`, `width`/`height` (normalised), `fill`, `radius` |
| `divider` | `thickness`, `length` (normalised), `color` |
| `spacer` | `size` (px) |
| `group` | `direction`, `gap`, `align`, `children: DesignLeafBlock[]` |

Shared base on every variant: `id` (stable, addresses the block from the Layers
list and the layout override), `hidden`, `layout`.

**`group` is one level deep on purpose** — `children` is typed as the *leaf*
union, so no `z.lazy()`, no recursive type, no unbounded render depth. Every
mockup layout fits at one level.

```ts
const DESIGN_LEAF_VARIANTS = [textV, badgeRowV, buttonPillV, logoTextV,
                              imageV, shapeV, dividerV, spacerV] as const;
export const designLeafBlockSchema = z.discriminatedUnion("type", DESIGN_LEAF_VARIANTS);
export const designBlockSchema     = z.discriminatedUnion("type", [...DESIGN_LEAF_VARIANTS, groupV]);
```

**Text is a three-way ref**, and the third member is what makes phase 5 possible:

```ts
export const designTextRefSchema = z.discriminatedUnion("source", [
  z.object({ source: z.literal("slot"),  slot: designTextSlotSchema,
             hideWhenEmpty: z.boolean().default(true) }),   // what the user fills
  z.object({ source: z.literal("fixed"), text: z.string().trim().max(DESIGN_FIXED_TEXT_MAX) }),
  z.object({ source: z.literal("computed"), value: designComputedValueSchema }),
]);
export const DESIGN_COMPUTED_VALUES = ["slideCounter", "deckProgress"] as const;
```

`hideWhenEmpty` lets one archetype serve a template with a proof strip and one
without — the block collapses rather than drawing an empty pill.

**Colour is a slot, never hex.** A template literally cannot contain a colour
literal; the schema has no hex field except the user override.

```ts
export const DESIGN_COLOR_SLOTS = ["background","foreground","muted","border","accent"] as const
  satisfies readonly (keyof DesignPalette)[];      // compile error if the palette grows a 6th
export const designHexSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Colours must be six-digit sRGB hex");
export const designColorRefSchema = z.object({ slot: designColorSlotSchema,
                                               opacity: z.number().min(0).max(1).default(1) });
```

`resolveDesignColor` emits `rgba(r, g, b, a)` — **never an 8-digit hex**, because
satori's colour parser is not CSS Color 4.

### Canvas presets and safe zones

```ts
export const DESIGN_CANVAS_PRESETS = {
  linkedinBanner: { label: "Profile banner", width: 1584, height: 396, safeZones: [
    { id: "avatar", label: "Profile photo safe zone", shape: "circle",
      x: 0.135, y: 0.92, width: 0.11, height: 0.44 },   // ← MEASURE, see Open items
    { id: "mobileCrop", label: "Hidden on mobile", shape: "rect",
      x: 0, y: 0, width: 0.14, height: 1 },             // ← MEASURE
  ]},
  headshot:      { label: "Headshot", width: 400, height: 400, safeZones: [] },
  featuredCover: { ...IMAGE_ASPECT_PRESETS.linkedin, label: "Featured cover", safeZones: [] },
  companyBanner: { label: "Company page banner", width: 1128, height: 191, safeZones: [] },
  carouselPortrait: { ...CAROUSEL_PAGE_PRESETS.portrait, safeZones: [] },
  carouselSquare:   { ...CAROUSEL_PAGE_PRESETS.square,   safeZones: [] },
} as const satisfies Record<DesignCanvasKey, DesignCanvasPreset>;
```

Sizes are **reused, never re-typed**: `IMAGE_ASPECT_PRESETS.linkedin`
(`src/lib/types/imagekit.ts:104`) is already exactly 1200×627, and the carousel
rows spread `CAROUSEL_PAGE_PRESETS` so phase 5 changes no pixel. Safe zones are
normalised 0-1 so one number set drives both the 1584px render and the ~700px
DOM overlay. They are guides — the renderer never draws them.

### The document

```ts
export const designDocSchema = z.object({
  version: z.literal(1).default(1),
  templateId: z.string().min(1).max(60),      // which gallery card
  archetypeId: z.string().min(1).max(60),     // which block list it cloned
  canvas: designCanvasSchema,
  paletteId: z.string().min(1).max(60),
  paletteOverrides: z.record(designColorSlotSchema, designHexSchema).default({}),
  fontFamily: designFontFamilySchema.default("geist"),
  background: designBackgroundSchema,         // solid | gradient | image, .default(solid)
  padding: z.number().int().min(0).max(240).optional(),   // optional ≠ defaulted; see below
  direction: z.enum(["row","column"]).default("column"),
  align: designAlignSchema.default("left"),
  justify: z.enum(["start","center","end","between"]).default("center"),
  blocks: z.array(designBlockSchema).min(1).max(DESIGN_MAX_BLOCKS),   // 24
  content: designContentSchema,               // Record<slot, string>
  images: z.record(designImageSlotSchema, postImageSchema).default({}),
});
export type DesignDoc = z.infer<typeof designDocSchema>;
export type DesignDocInput = z.input<typeof designDocSchema>;
```

`padding` is **optional, not defaulted** — "unset" means "follow this geometry's
own padding from the type scale", a different statement from "the user chose 64".
Renderer does `doc.padding ?? scale.padding`.

`images` reuses `postImageSchema` rather than inventing a second ImageKit
reference shape, so the headshot inherits the AI-edit revert field for free.

### The layout override — settled now, used in phase 4

```ts
export const designLayoutOverrideSchema = z.object({
  dx: z.number().min(-1).max(1).default(0),      // fractions of canvas width/height
  dy: z.number().min(-1).max(1).default(0),
  scale: z.number().min(0.25).max(4).default(1),
  z: z.number().int().min(0).max(99).default(0),
}).default({});
```

Normalised because the editor previews a 1584-wide banner inside a ~700px column
— pixel offsets desynchronise from the render the instant that column resizes.
`.default({})` is legal because every field is itself defaulted, so a row written
today with no `layout` key parses forever. **Phase 1 stores it and ignores it;**
settling the field shape now is the entire point.

Render semantics when it lands: an all-default override stays in the flex stack;
any non-default value lifts the block into an absolutely-positioned layer ordered
by `z`, rather than asking satori's flex subset to honour a transform mid-stack.

### Text slots as a registry — `src/lib/config/design-slots.ts` (new)

The `CONTENT_PLAN_STEPS` / `PROFILE_SECTIONS` pattern:

```ts
export const DESIGN_TEXT_SLOT_KEYS = ["eyebrow","headline","subheadline","body","ctaLabel",
  "proofA","proofB","proofC","name","role","handle","quote","attribution","footnote","logoText"] as const;

export interface DesignTextSlotDefinition {
  readonly label: string; readonly placeholder: string;
  readonly maxChars: number;      // a LAYOUT limit, like CAROUSEL_HEADING_MAX
  readonly multiline: boolean;    // Input vs Textarea
}
export const DESIGN_TEXT_SLOTS: Record<DesignTextSlotKey, DesignTextSlotDefinition> = { … };
```

`designContentSchema` enforces the per-slot `maxChars` via `superRefine` reading
this registry, so the editor's counter and the error that blocks submit quote one
number, on both client and server.

**The editor form is generated from `slotsUsedBy(doc.blocks)`**, not hand-written
per template — which is why template #21 costs no UI code either.

### Type scale — one row per geometry, no magic multiplier

`carousel-theme.ts:128` explicitly rejects "one table plus a magic multiplier". A
1584×396 banner is 4:1; a 1128×191 company banner is 5.9:1.

```ts
export const DESIGN_TYPE_SCALE = {
  linkedinBanner:   { display: 72, heading: 58, subheading: 34, body: 28, meta: 22, padding: 72, gap: 16 },
  companyBanner:    { display: 44, heading: 38, subheading: 24, body: 20, meta: 16, padding: 40, gap: 10 },
  featuredCover:    { display: 88, heading: 68, subheading: 40, body: 32, meta: 24, padding: 72, gap: 20 },
  headshot:         { display: 44, heading: 34, subheading: 24, body: 18, meta: 14, padding: 24, gap:  8 },
  carouselPortrait: { display:104, heading: 84, subheading: 56, body: 38, meta: 28, padding: 96, gap: 24 },
  carouselSquare:   { display: 88, heading: 72, subheading: 48, body: 34, meta: 26, padding: 84, gap: 22 },
} as const satisfies Record<DesignCanvasKey, DesignTypeScale>;

export function getDesignTypeScale(canvas: string): DesignTypeScale {
  return DESIGN_TYPE_SCALE[canvas as DesignCanvasKey] ?? DESIGN_TYPE_SCALE.linkedinBanner;
}
```

Never-throwing getter, same contract as `getCarouselTypeScale`: `canvas` is a
String inside a Json column, so a doc written before a renamed preset must render
*something* rather than fail mid-kit. The two carousel rows are copied from
shipped values so phase 5 is pixel-neutral.

### Palette — share the shape, don't fork it

`src/lib/config/design-theme.ts` (new) owns `DesignPalette` (the same five
fields), `DESIGN_PALETTES`, `getDesignPalette`, `resolveDesignPalette`,
`resolveDesignColor`. Then `carousel-theme.ts` becomes
`export type CarouselPalette = DesignPalette` — a two-line edit that keeps every
existing importer resolving and puts the canonical shape where phase 5 needs it.

### Fonts — lift the loader, don't export it

`loadCarouselFonts` is module-private in `carousel.service.tsx`, and
`src/app/opengraph-image.tsx:66` **already re-implements the same disk read**. A
third copy triples the per-process cache.

New `src/services/render-fonts.service.ts` holds the cached-promise loader and a
keyed family registry; `carousel.service.tsx` drops its local `fontsPromise` and
imports it. Service→service imports are already established (`linkedin.service.ts`,
`portal.service.ts`). Payoff: one cache for both renderers, and a second typeface
becomes a registry entry — `next.config.ts` already globs
`./src/app/assets/fonts/**`, so a new WOFF needs no config change.

Rejected: just exporting `loadCarouselFonts` — cheaper diff, but it names the
shared thing after one consumer and drags `pdf-lib` plus the whole Carousel
Prisma surface into the studio render path.

### Preview — debounced server render

**Chosen.** One 1584×396 frame is 0.63 MP against a carousel's 12 × 1.46 MP —
about 3.5% of one existing deck render, and the ~2s WASM init is already
amortised by the carousel path. Warm cost lands near 50-80 ms.

Rejected: a **DOM twin** means hand-matching satori's flexbox subset and font
metrics in a second renderer; they disagree the first time a headline wraps at 59
characters in one and 61 in the other, invisibly, until a user downloads a file
that doesn't match what they approved. Rejected: **client rasterisation** — satori
and resvg are vendored *inside* `next/og`, so using them in the browser means
adding `satori` + `@resvg/resvg-wasm` and shipping WOFF binaries to the client.

The DOM layer survives for selection handles, the safe-zone circle and hit-testing,
positioned from the same normalised coordinates on top of the returned PNG. Render
at true canvas size, downscale with `width: 100%`, so preview and export are
byte-identical code paths.

**`preview` is a mutation with `audit: false`.** It must be a POST —
`httpBatchLink` sets no `maxURLLength` (`src/trpc/react-provider.tsx:132`), so a
query would put the whole serialised `DesignDoc` in a GET URL against a ~14 KB
header budget. `audit: false` is the factory's own sanctioned escape for
"side-effect-free writes"; without it every debounce tick writes an audit row.
Known cost: `protected.ts:668` opens a transaction for every mutation, so a
preview holds a pooled connection for the render duration — mitigated by the
600 ms debounce, a 30/min rate limit and `txTimeout: 15_000`. **Measure this in
phase 1**; the escape hatch is a dedicated `POST /api/studio/preview` route
handler returning `image/png` (precedent: `/api/scheduled-posts/run`), which also
drops the ~33% base64 inflation.

Security: preview renders unsaved client input, so `DESIGN_MAX_BLOCKS = 24`, the
per-slot `maxChars` and the 1-4 cap on `badgeRow.items` are render-bomb
mitigation, not decoration. Say so in the schema comment.

---

## Files

**New**

```
src/lib/types/design-block.ts             the block language
src/lib/types/studio.ts                   asset kinds, statuses, roles, tones, router inputs
src/lib/config/design-theme.ts            palettes, type scale, colour resolution
src/lib/config/design-slots.ts            DESIGN_TEXT_SLOTS registry
src/lib/config/design-archetypes.ts       DesignBlock[] per archetype × canvas
src/lib/config/studio-templates.ts        the 20+ gallery entries
src/lib/config/studio.ts                  folder, mime, timeouts, file naming
src/lib/config/studio-steps.ts            wizard registry                     (phase 2)
src/services/render-fonts.service.ts      shared cached font loader
src/services/design-render.service.tsx    the generic renderer
src/services/studio.service.ts            Prisma access
src/trpc/routers/studio.ts                the router
src/app/(dashboard)/dashboard/studio/page.tsx
src/app/(dashboard)/dashboard/studio/_components/{studio-workspace,studio-form,
  design-preview,design-content-form,palette-picker,studio-types}.tsx
src/components/global/selectable-grid/    the card wall                        (phase 3)
src/components/global/color-swatches/     promoted on second consumer          (phase 3)
```

**Modified**

```
prisma/schema.prisma                         + 2 models, + 4 back-relation fields
src/lib/resources.ts                         + RESOURCES.studio (+ studioTemplates in ph.3)
src/components/global/sidebar/nav-icons.tsx  + "LayoutTemplate" (+ "Palette" in ph.3)
src/lib/types/index.ts                       + named re-exports + SOT KEYWORDS header
src/lib/config/index.ts                      + barrel exports
src/trpc/routers/_app.ts                     + studio: studioRouter
src/lib/config/carousel-theme.ts             CarouselPalette becomes DesignPalette alias
src/services/carousel.service.tsx            drop local font loader; import loadRenderFonts
```

---

## Phase 1 — prove the spec-driven renderer

**Scope: one archetype, one template, banner only, debounced preview, render →
PNG → download.** No gallery, no wizard stepper, no layer list, no drag, no
headshot. This is the whole risk; everything after is assembly.

### Prisma

```prisma
model StudioProject {
  id             String @id @default(cuid())
  organizationId String
  authorId       String
  name           String
  templateId String        /// owned by the Zod tuple in config/studio-templates — never a migration
  paletteId  String
  tone       String @default("bold")
  role       String @default("founder")
  headline   String? @db.Text   /// pasted into LinkedIn itself, not rendered into any image
  about      String? @db.Text
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  organization Organization  @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  author       User          @relation(fields: [authorId],       references: [id], onDelete: Cascade)
  assets       StudioAsset[]

  @@index([organizationId, updatedAt])
  @@index([authorId])
  @@map("studio_project")
}

model StudioAsset {
  id             String @id @default(cuid())
  organizationId String
  projectId      String
  kind     String   /// STUDIO_ASSET_KINDS — a row per asset, because assets render
  position Int @default(0)   /// independently: status and lastError are per-asset,
  doc      Json     /// featured covers are variable-length, each maps 1-1 to a Document.
  status    String  @default("draft")
  lastError String? @db.Text
  documentId String? @unique
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  organization Organization  @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  project      StudioProject @relation(fields: [projectId],      references: [id], onDelete: Cascade)
  document     Document?     @relation(fields: [documentId],     references: [id], onDelete: SetNull)

  @@index([organizationId])
  @@index([projectId, position])
  @@map("studio_asset")
}
```

**Back-relations are required or `prisma validate` fails:** `Organization` gains
`studioProjects` + `studioAssets`; `User` gains `studioProjects`; `Document`
gains `studioAsset StudioAsset?`.

Rendered PNGs **reuse the existing `Document` model** — its own schema comment
(`prisma/schema.prisma:818-820`) anticipates "a future non-PDF export (PNG
bundle)". `mimeType: "image/png"`, `pageCount: 1`. The `documents` resource then
lists and deletes studio assets with zero new code.

### RESOURCES entry — write this FIRST, nothing else compiles without it

The factory throws on a mutation whose first path segment isn't a registry key.

```ts
studio: {
  name: "Studio",
  description: "Design a LinkedIn banner, headshot and featured covers from a style",
  /* Mirrors `carousel`: `render` is its own verb because local CPU and a model
   * call have different cost and failure modes, and `discard` NOT `delete`
   * because the factory refunds a slot on `.delete` — create → remove → create
   * would be an unlimited free tier. */
  permissions: ["create", "read", "update", "render", "discard"],
  /* Metered per PROJECT, the unit of value the product sells. NOT per render:
   * rendering is local CPU, and charging per render pushes people to accept a
   * worse design. Free = 1 so someone finishes exactly one profile end to end. */
  limit: { perPlan: { free: 1, starter: 5, pro: 25, enterprise: "unlimited", portal: "unlimited" },
           upgradeMessage: "Upgrade to {nextPlan} to build more profiles",
           availableOnFreeTrial: true, unit: "profiles" },
  rateLimit: { create: { count: 5, window: "1 m" }, render: { count: 10, window: "1 m" },
               preview: { count: 30, window: "1 m" } },
  audit: { entity: "studioProject", describe: {
    create: "Created a studio project", update: "Edited a design",
    render: "Exported a design",       discard: "Discarded a studio project" } },
  nav: { label: "Studio", href: "/dashboard/studio", icon: "LayoutTemplate",
         section: "create", order: 7, requirePermission: "create" },
},
```

Then add `LayoutTemplate` to `NAV_ICONS` in `nav-icons.tsx` — **an unmapped icon
string silently renders a circle.** `requirePermission: "create"` follows the
`carousel` / `contentPlan` / `voiceProfile` convention; note the documented
caveat that no existing custom role holds a brand-new resource's permissions, so
owners see it at once and custom roles need an explicit grant.

### Router — `src/trpc/routers/studio.ts`, mounted as `studio`

| Procedure | Type | Notes |
|---|---|---|
| `create` | mutation | **the quota verb.** Clones `DESIGN_ARCHETYPES[archetype].linkedinBanner`, seeds `content` from template placeholders, creates project + one banner asset in one nested write |
| `list` | query, `paginate: true` | `DataTable`; select omits `doc`, the reason `CAROUSEL_LIST_SELECT` omits `slides` |
| `get` | query | assets returned with `doc` already parsed through `designDocSchema` |
| `update` | mutation | whole-doc write, never a patch; resets `status: "draft"`, clears `lastError` |
| `preview` | mutation, `audit: false`, `txTimeout: 15_000` | returns `{ dataUrl, width, height }`; no DB write, no upload, no quota |
| `render` | mutation, `txTimeout: STUDIO_RENDER_TIMEOUT_MS + 30_000` | full order below |
| `discard` | mutation | `deleteMany` → `{ count }`; `count === 0` → NOT_FOUND. Exported Documents survive |

**`render` copies `carousel.render` step for step:**

1. `if (!isImageKitConfigured())` → `PRECONDITION_FAILED`, before any work.
2. Load asset; `NOT_FOUND` if missing. `doc` is already validated on read.
3. `renderDesignPng(doc, ctx)`.
4. `imagekitService.uploadFileBytes(base64, fileName, IMAGEKIT_STUDIO_FOLDER)` —
   **remote leg BEFORE the DB write**, so an upload failure rolls the transaction
   back instead of marking an asset `ready` with no file.
5. `attachStudioAssetDocument(...)` returns `{ asset, supersededFileId }`.
6. `if (supersededFileId) await imagekitService.deleteImage(supersededFileId)` —
   **after the tx commits**, never inside. Skipping this leaks a row and an asset
   on every re-render.
7. On error: `classifyError` once; `` const message = `${cause.message} (ref: ${cause.traceId})` ``;
   `markStudioAssetFailed(...)` **called WITHOUT `ctx.db`** so it survives the
   rollback that reports it; then `createStructuredError(trpcCode, cause.message, cause)`.
   Same sanitized string thrown and persisted.

### Service — `src/services/studio.service.ts`

`import "server-only"` immediately after the licence block, `db: DbClient` first
param, pure Prisma, `const STUDIO_SAFE_SELECT = {…} as const satisfies Prisma.StudioProjectSelect`,
`updateMany`/`deleteMany` returning `{ count }`, `parseDesignDoc(value: Prisma.JsonValue)`
(not `unknown`). Router imports it as `import * as studioService`.

`design-render.service.tsx` touches **no Prisma** — it is the render half only,
so the `db`-first rule does not apply to it.

### Renderer non-negotiables

- **Every emitted node carries explicit `display: "flex"`** — centralised in
  `renderBlock` so template authors never write a style object. One exception,
  comment it at the emit site: a `text` block with `maxLines > 1` emits
  `display: "-webkit-box"` + `WebkitLineClamp` + `textOverflow: "ellipsis"`.
- Every colour goes through `resolveDesignColor`; a raw string cannot reach a
  style object because the block schema has no hex field.
- `image` blocks are **pre-resolved to data URIs before the tree is built**:
  `buildTransformedUrl(url, "w-<boxpx>")` → `imagekitService.fetchFileBinary(url, "image/png")`
  → `data:` URI. Three existing functions, zero new code, and a broken image
  fails through `classifyError` with a legible message instead of rendering blank.
- Exhaustive `switch` on `block.type` with a `never` check, so adding a block
  type is a compile error until it is drawn.

### UI

`studio-workspace.tsx` copies `carousel-workspace.tsx`'s proven shape: list ↔
editor in one route, draft buffer held in the **parent** keyed by asset id, the
render-time `syncedId` reset rather than an effect, derived `isDirty`, and an
`invalidate()` that **returns its promise** so `isPending` stays true until fresh
data lands — the window that otherwise leaves Download pointing at a superseded URL.

- `design-content-form.tsx` — RHF, fields generated from `slotsUsedBy(doc.blocks)`,
  `useForm<DesignDocInput, undefined, DesignDoc>` (three type args, because the
  schema has `.default()` fields), `useWatch` never `form.watch()`, counters
  quoting `DESIGN_TEXT_SLOTS[slot].maxChars`.
- `design-preview.tsx` — `useWatch` → 600 ms debounce → `preview` → `<img src={dataUrl}
  className="w-full" />` with safe zones absolutely positioned from the normalised
  coordinates. Guard against a stale response whose request was superseded.
- `palette-picker.tsx` — named palettes plus five slot swatches. Theme tokens in
  the chrome (`bg-card`, `border-brand-border bg-brand-soft`, `.surface-raised`);
  the hex values it writes are data, validated by `designHexSchema`.
- Download uses `buildAttachmentUrl(document.url)` and `buttonVariants(...)` on an
  `<a>` — `<a download>` is ignored cross-origin, and Button has no `asChild` slot.
- `FeatureGate resource="studio"` around create; `UsageMeter` in the header.

### Risks

| Risk | Mitigation |
|---|---|
| **satori feature support unverified** — `linear-gradient`, `rgba()`, radius on images, `letterSpacing`, `-webkit-line-clamp`, data-URI `<img>`. A silently-ignored property produces a plausible-looking wrong render, the exact failure this plan exists to prevent | First commit ships ONE archetype exercising **every block type**, rendered once and eyeballed. Not a probe script — CLAUDE.md forbids those without permission |
| **`display: flex` omission** — named in `carousel.service.tsx` as the single most common way this renderer breaks | Centralised in `renderBlock` |
| **zod v4 edges**: `.default({})` on an all-optional object, `.default()` on a discriminated union, `z.record(z.enum(...))` partiality, spreading an `as const` tuple into `z.discriminatedUnion` | Land `design-block.ts` and run typecheck **before** authoring a single archetype |
| **Preview holds a pooled connection per render** | Measure in phase 1; route-handler escape hatch already designed |
| `Document.pageCount` means "slides" | Store `1`; verify the documents library doesn't label PNG rows "pages" |

---

## Phase 2 — the other assets, same renderer

New: `config/studio-steps.ts` (`STUDIO_STEPS` + `firstIncompleteStudioStep(project)`
— **derived, no stored cursor**, exactly as `firstUnansweredContentPlanStep` is),
archetype block lists for `headshot` / `featuredCover` / `companyBanner`, router
`addAsset` / `removeAsset` / `reorderAssets`.

Reused: `ImageUpload` + `ImageEditor` for the headshot; `AiImageEdit` for
background removal (already in `RESOURCES.aiImageEdit`, already metered —
ImageKit's transform vocabulary has no removal, so this is the only path);
`CopyButton` for headline/about.

Risks: the `image` data-URI pipeline is first exercised for real here, so the
`buildTransformedUrl(url, "w-<boxpx>")` downscale is load-bearing, not an
optimisation — a 4000px source at full size blows the render budget. Background
removal puts an AI call on the happy path of step 3 of 7, so the step must
degrade through `LockedSection` when `aiImageEdit` quota is gone. Featured covers
are variable-length, so `position` reordering uses whole-array writes.

---

## Phase 3 — the shell

New: `src/components/global/selectable-grid/` — the card wall (`items`,
`renderPreview` slot, `selectedId`, `onSelect`, `aria-pressed`, filter-chip slot).
**Nothing like it exists** — confirmed by exhaustive search. Compose from
`QuickActions`' `grid gap-4 sm:grid-cols-2 lg:grid-cols-4` of `.surface-raised`
cards, `PlanSelector`'s selected-border logic, `ChatOptions`/`HeadlineChoices`'
`aria-pressed`, `Spotlight` for hover, `Reveal delay={index * 70}` for stagger.
Promote `color-swatches` to `components/global/` — phase 3 is the second consumer,
which is the rule's trigger.

Add a `studioTemplates` RESOURCES key (read-only, nav "Templates", icon `"Palette"`)
because **`nav` is one entry per resource** and `studio` already spent its — the
`contentCalendar` / `postLibrary` precedent.

**Gallery thumbnails: do not call `preview` 20 times on mount.** Render the 20
thumbnails once as static assets, or draw the card in DOM from palette + headline
only. This is the one place a DOM approximation is correct — nobody downloads a
gallery card.

**"Download all (ZIP)":** add `jszip`, client-side. Fetches each ImageKit URL and
zips in the browser — no server cost.

**"Fix with this style" hand-off:** a plain `<Link>` from `/dashboard/profile-analysis`
to `/dashboard/studio?template=<id>&headline=<…>`, read once into the create
form's defaults. A link plus an optional prefill — no second scorer, no shared state.

Also phase 3: 20 template names and "why this works" copy blocks. Content work.
Per `research/feature.md` §2, **none may be named after or cloned from a real
creator's design.**

---

## Phases 4 and 5

**Phase 4 — the properties editor.** Turn on `layout`. Layers list from
`doc.blocks` (id + type icon + eye toggle). Selection overlay positioned from the
normalised box on top of the preview PNG. Drag writes `dx`/`dy`. Bounded exactly
as the mockup is: no rotation, no arbitrary layers, no z-reorder control. *Risk:*
the absolute-lift path is untested until here — spike `position: absolute` inside
a `position: relative` flex parent in satori before building the drag UI.

**Phase 5 — carousels onto the same board.** Write
`carouselSlideToDesignDoc(slide, index, total, templateId, preset): DesignDoc` — a
**pure function**, ~40 lines, called at render time. `Carousel.slides` is never
rewritten, no backfill runs, every existing row keeps parsing through
`carouselSlidesSchema` forever. Only possible because `computed` text refs exist
from day one:

| `CarouselSlideView` today | As data |
|---|---|
| `justifyContent: isCover ? flex-end : center` | `doc.direction` / `doc.justify` |
| cta inverts `backgroundColor` | the cta archetype names `accent` — **inversion becomes a palette choice, not an `if`** |
| `"03 / 08"` counter | `text` block, `computed: "slideCounter"`, role `meta` |
| progress rule + fill | two `shape` blocks; the fill's width is `computed: "deckProgress"` |

Then `renderCarouselPdf` becomes a caller of `renderDesignPng` + pdf-lib stapling,
and `carousel.ts:74` can finally drop "plus a renderer branch". *Risk:* pixel
drift — render an existing deck byte-comparably before deleting
`CarouselSlideView`. Keep both for one release.

---

## Verification

**Per phase, before handover:**

1. `npx tsc --noEmit` (or the repo's typecheck script) — zero errors. No `any`,
   no `unknown`, no type assertions added.
2. `npx prisma validate` then `npx prisma migrate dev` — catches the missing
   back-relation fields, which is the easy thing to forget.
3. `npm run lint`.

**Phase 1 end-to-end, in the running app:**

1. Sign in, open `/dashboard/studio`. Confirm the sidebar item renders the
   **LayoutTemplate icon, not a circle** — the silent failure if `NAV_ICONS`
   wasn't updated.
2. Create a project. Confirm `UsageMeter` reads 1 of 1 on free, and that a second
   create opens the upgrade modal rather than failing at the server.
3. Type in the headline slot. Confirm the preview updates ~600 ms after the last
   keystroke, that the safe-zone circle sits where a real LinkedIn avatar does,
   and that the character counter and the submit-blocking error quote the same number.
4. Render. Confirm a `Document` row appears with `mimeType: "image/png"`, that the
   file opens at exactly 1584×396, and that **the PNG matches the preview** —
   this is the assertion the whole spec-driven design exists to make true.
5. Re-render. Confirm the old ImageKit asset is gone (check the ImageKit console)
   and exactly one `Document` row remains — proves `supersededFileId` cleanup ran
   after the commit.
6. Break it on purpose: unset an ImageKit env var and render. Confirm a clean
   `PRECONDITION_FAILED` message, no half-written row, and `status` left usable.
7. Force a render failure. Confirm `lastError` persists **despite** the rolled-back
   transaction — proves `markStudioAssetFailed` was called without `ctx.db`.
8. Download. Confirm the file actually downloads rather than opening in a tab —
   proves `buildAttachmentUrl` is in the path.
9. Check the audit log: one row for create, one for render, **none for preview**.
10. Watch the Prisma pool while typing continuously for a minute — the one number
    that decides whether preview stays a mutation or moves to a route handler.

**Phase 5 regression:** render a pre-existing carousel through both pipelines and
compare the PDFs byte-for-byte before `CarouselSlideView` is deleted.

---

## Open items to settle during the build

1. **Safe-zone geometry is eyeballed from the mockup.** Measure against a real
   LinkedIn profile. It lives in one registry entry, so the correction is one line
   that fixes both the render guidance and the DOM overlay.
2. **Company banner 1128×191** comes from the source kit, not from this repo.
   `research/feature.md` warns the kit's own size labels are wrong elsewhere —
   verify before shipping that asset kind.
3. **Every type-scale number is a first pass** except the two carousel rows, which
   are copied from shipped values. Tune against real renders.
4. **`preview` as a mutation with `audit: false`** is the one place this plan uses
   an escape hatch. Named, measured in step 10 above, with a designed exit.
5. **LinkedIn's "in" glyph appears in several mockup assets.** Rendering a platform
   mark into a file the user downloads and republishes is a different exposure from
   showing it in your own UI chrome. Decide deliberately rather than inheriting it.

---

## Product suggestions — decisions, not build steps

Separate from the plan above, because these are product calls rather than
engineering ones. Each is cheap given the architecture already described.

1. **Ship the banner as a free tool, gate at download.** Let anyone build a
   banner without an account and charge at export. The banner is 80% of the value
   and the cheapest asset to render — one PNG per visitor buys the best
   top-of-funnel asset this product has.

2. **Wire the audit loop in both directions.** The plan covers "Fix with this
   style" going in. The return trip matters more: after export, re-score and show
   `58 → 79`. A number that moves is the most persuasive thing this can show, and
   both scorers already exist.

3. **End the export screen with "write your first post," not "Download all."**
   Fixing a profile is a one-time job; writing posts is the subscription. The
   wizard currently ends in a cul-de-sac, and the user who just felt the product
   work is the easiest one to convert.

4. **Save the palette once, reuse it everywhere.** Colours picked in the studio
   become the member's brand palette for carousels too — a small addition to the
   `StudioProject` row that makes the app feel like one product rather than three
   tools. It also front-runs phase 5.

5. **Feed the headline/About writer from `VoiceProfile`.** "Write with AI" from a
   generic model is a commodity. `readResolvedVoice` already exists and is already
   called by three routers; passing it into the headline generator is nearly free
   and makes the output actually sound like the member.

6. **Do not build the dashboard.** Progress rings and "60% ready" measure
   completion, not quality, sitting beside a real quality score. Two numbers both
   called "score" teaches users that neither means anything. The project list plus
   the audit score is enough.

7. **Three templates at launch, not twenty.** The architecture makes 20 cheap, but
   20 is a decision tax at the moment the user knows least about what they want.
   Ship 3, watch which gets picked, then fill the wall in that direction.

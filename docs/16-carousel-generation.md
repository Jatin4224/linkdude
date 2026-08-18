# Building carousel generation — a complete walkthrough

This is the full build log for the largest feature in the app: **the user types a topic, the model writes a slide deck, they edit it, the app renders it to a real multi-page PDF, stores it, and publishes it to LinkedIn as a swipeable document post.**

It is written so someone who has never touched this codebase can follow along. Every step says *what* we did and *why*. If you already know the codebase, skip to [The 10-second version](#the-10-second-version) or [How one carousel flows end to end](#how-one-carousel-flows-end-to-end).

This feature builds on three earlier ones. Read [09 — LinkedIn post generation](./09-linkedin-post-generation.md) for the registry and the AI provider layer, [12 — Calendar and scheduled posts](./12-calendar-and-scheduled-posts.md) for ImageKit and the publish worker, and [15 — AI image editing](./15-ai-edit-image.md) for the server-side upload path. This document assumes all three.

---

## Table of contents

1. [The 10-second version](#the-10-second-version)
2. [Why a carousel is not a post with pictures](#why-a-carousel-is-not-a-post-with-pictures)
3. [Words you need to know](#words-you-need-to-know)
4. [What you need before you start](#what-you-need-before-you-start)
5. [Step 1 — The registry](#step-1--the-registry)
6. [Step 2 — The database](#step-2--the-database)
7. [Step 3 — Config, and the two files that exist because satori is not a browser](#step-3--config-and-the-two-files-that-exist-because-satori-is-not-a-browser)
8. [Step 4 — Types](#step-4--types)
9. [Step 5 — Services](#step-5--services)
10. [Step 6 — Routers](#step-6--routers)
11. [Step 7 — The UI](#step-7--the-ui)
12. [Step 8 — Phase 2: publishing to LinkedIn](#step-8--phase-2-publishing-to-linkedin)
13. [How one carousel flows end to end](#how-one-carousel-flows-end-to-end)
14. [The four-name problem](#the-four-name-problem)
15. [Testing it](#testing-it)
16. [Mistakes that are easy to make](#mistakes-that-are-easy-to-make)
17. [Known limitations](#known-limitations)
18. [What we deliberately did NOT build](#what-we-deliberately-did-not-build)
19. [File map](#file-map)

---

## The 10-second version

We added **21 new files** and edited **15 existing ones**, across two phases. **One new dependency: `pdf-lib`.**

```
registry → database → config → types → services → routers → UI → LinkedIn
```

The single most important idea: **rendering happens outside a browser.** Every other visual thing in this app is drawn by Chrome from CSS. A carousel is drawn by satori, which has no CSS runtime, no stylesheet, no `oklch()`, and exactly one bundled font. That one difference explains the theme twin file, the font buffers in the repo, the `next.config.ts` change, and half the mistakes table at the bottom.

The second most important idea: **a deck is published as a LinkedIn *post*, not as a carousel.** That is why there is no `carousel.publish` verb.

---

## Why a carousel is not a post with pictures

A LinkedIn carousel is not a carousel widget and not a multi-image post. It is a **PDF**, uploaded through LinkedIn's Documents API, which LinkedIn renders as a swipeable deck. Everything about this feature follows from that sentence.

| If you assumed… | The reality |
|---|---|
| "Multi-image post" | LinkedIn's Posts API takes exactly **one** `content.media`. There is no array. |
| "Upload the images, done" | The asset is a PDF. We have to *make* one. |
| "Same as the image upload" | Documents are **asynchronous** — they process before they are usable. Images are not. |
| "Render it with the browser" | There is no browser on the server. Slides are rasterised by satori. |
| "It's a new kind of thing" | It is a LinkedIn post with a different attachment, and it must spend the same quota. |

That last row is the one that shapes the whole API surface. See [Step 8](#step-8--phase-2-publishing-to-linkedin).

---

## Words you need to know

| Term | What it actually means |
|---|---|
| **satori** | React → SVG renderer. Implements a **flexbox subset**. No CSS files, no classes, no `oklch()`. |
| **resvg** | SVG → PNG rasteriser. Ships with satori inside `next/og`. |
| **`next/og`** | Next's OG-image module. Vendors satori + resvg + one font. Already in Next 16 — **not a dependency we added**. |
| **`ImageResponse`** | The `next/og` entry point. Normally returned from a route; here constructed directly and drained with `.arrayBuffer()`. |
| **`pdf-lib`** | Pure-JS PDF writer. The only new package. Its whole job is stapling PNGs into pages. |
| **Document (ours)** | A row in our `document` table — a file this app generated. |
| **Document (LinkedIn's)** | `urn:li:document:...` — LinkedIn's copy of an uploaded PDF. |
| **Deck** | The slide array. Stored as `Carousel.slides` JSON, never as its own table. |
| **Page preset** | The PDF's pixel geometry. `portrait` 1080×1350 or `square` 1080×1080. |

---

## What you need before you start

### ImageKit, already configured

From [doc 12](./12-calendar-and-scheduled-posts.md). This feature stores PDFs in the same account as post images, in a separate folder.

> **ImageKit accepts non-image files.** This was the single biggest open risk when the feature was planned, and it was verified before the storage layer was built: a PDF uploads as `fileType: non-image`, `mime: application/pdf`, and serves a `200`. No plan upgrade was needed.

### One new package

```
pdf-lib             ^1.17.1     NEW — pure JS, no native bindings
```

And the ones that were already here and did all the heavy lifting:

```
next                16.2.6      next/og vendors satori + resvg + Geist Regular
@imagekit/nodejs    ^7.10.0     uploadFileBytes generalises uploadImageBytes
ai                  ^7.0.48     generateStructured was already the pattern
```

**No Puppeteer, no Playwright, no Chromium.** That was a deliberate rejection — see [Step 5](#why-nextog-and-not-a-headless-browser).

### LinkedIn, already connected

Phase 2 needs **no new OAuth scope**. `w_member_social` — which the app already requests — covers document posts. Nobody has to reconnect.

---

## Step 1 — The registry

**File: `src/lib/resources.ts`**

Two new entries, and the interesting part is that they are **asymmetric**.

### `carousel` — the metered one

```ts
carousel: {
  name: 'Carousels',
  permissions: ['create', 'read', 'update', 'render', 'discard'],
  limit: {
    perPlan: { free: 2, starter: 30, pro: 200, enterprise: 'unlimited', portal: 'unlimited' },
    upgradeMessage: 'Upgrade to {nextPlan} to create more carousels',
    availableOnFreeTrial: true,
    unit: 'carousels',
  },
  rateLimit: {
    create: { count: 3, window: '1 m' },
    render: { count: 5, window: '1 m' },
  },
  nav: { label: 'Carousel', href: '/dashboard/carousel', icon: 'Layers',
         section: 'create', order: 5, requirePermission: 'create' },
},
```

**`discard`, never `delete`.** Same rule `profileAnalysis` and `contentPlan` both document at length: the factory decrements the usage counter on `<resource>.delete`, which is correct for a quota counting *things held* and wrong for one counting *model and render spend*. Under the name `delete`, create → remove → create would be an unlimited free tier.

**`render` is its own verb.** It could have been folded into `create`. It is separate because the two have completely different cost and failure modes — the model call can succeed and the render still fail. Splitting them means a failed render never burns a generation the user already paid for, and **re-rendering an edited deck is free**. That is what makes editing the expected step rather than a luxury.

**Only `create` spends a slot.** The factory bumps the counter on `<resource>.create` and nothing else, so `update`, `render` and `discard` are all free by construction.

### `documents` — the one with no quota at all

```ts
documents: {
  name: 'Documents',
  permissions: ['read', 'delete'],
  audit: { entity: 'documents', describe: { delete: 'Deleted a generated document' } },
  nav: { label: 'Documents', href: '/dashboard/documents', icon: 'FileText',
         section: 'workspace', order: 5, requirePermission: 'read' },
},
```

**No `create` verb and no `limit`, both on purpose.** Documents are created by `carousel.render`, so a `documents` limit would sit on a path nothing calls and silently never fire — a number in the pricing table that means nothing. Storage volume is already bounded by the carousel quota, which is the thing actually being metered.

### The new-resource permission caveat

Both `nav` entries carry `requirePermission`. Note what that does and does not buy on a **brand-new** resource:

> The backfill rule documented on `profileAnalysis` says to gate nav on a verb that already exists in live `OrganizationRole` rows. For a new resource, **no** role row holds any of its permissions — so no choice of verb makes these pages visible to an existing custom-role member.

That is correct, not a bug. Owners bypass the permission gate and see both pages immediately; granting them to a custom role is a deliberate act in the existing role editor.

### Two icons and a mount

`Layers` and `FileText` must be added to `NAV_ICONS` in `src/components/global/sidebar/nav-icons.tsx`, or the sidebar silently falls back to a neutral circle.

```ts
carousel: carouselRouter,
/* `documents`, plural, matching its RESOURCES key. The Prisma model is
 * `Document` singular — the key names the RESOURCE, not the row. */
documents: documentsRouter,
```

`AuditEntityName` needed **no change**: it is `ResourceKey | ...`, so both new keys became valid the moment the registry entries existed.

---

## Step 2 — The database

**File: `prisma/schema.prisma`**

Two new models, plus two columns on `LinkedInPost` in Phase 2.

### `Document` — a file is an artifact, not an attribute

```prisma
model Document {
  id             String @id @default(cuid())
  organizationId String
  fileId         String   // ImageKit handle — required for delete
  url            String
  fileName       String   // slug, for Content-Disposition and filesystems
  title          String?  // human-readable, shown publicly by LinkedIn
  mimeType       String @default("application/pdf")
  byteSize       Int
  pageCount      Int
  createdAt      DateTime @default(now())

  organization  Organization   @relation(...)
  carousel      Carousel?
  linkedinPosts LinkedInPost[]

  @@index([organizationId, createdAt])
  @@map("document")
}
```

A **first-class table**, rather than denormalised columns the way `LinkedInPost` holds its image. The schema comment states the reasoning:

> A file here is an **ARTIFACT, not an attribute**: it has its own byte size, page count and vendor handle, it outlives the thing that made it, and the next exporter this app grows writes rows here instead of adding a second set of columns somewhere else.

`fileName` and `title` are **two different values** and conflating them shipped a real bug. See [The four-name problem](#the-four-name-problem).

### `Carousel` — one row for the whole lifecycle

```prisma
model Carousel {
  id             String @id @default(cuid())
  organizationId String
  authorId       String
  topic          String  @db.Text
  templateId     String  @default("minimal")
  pagePreset     String  @default("portrait")
  status         String  @default("draft")   // draft|rendering|ready|failed
  slides         Json
  documentId     String? @unique
  lastError      String? @db.Text
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  document Document? @relation(fields: [documentId], references: [id], onDelete: SetNull)
  // ...
}
```

**`slides` is `Json`, not a `Slide` table.** Slides are never queried on their own — they are always read, written and rendered as one ordered unit. A table would buy joins nobody needs while making a reorder into a transaction. Order is array position, so moving a slide is a splice, not five `UPDATE`s. This follows the precedent of `ContentPlan.result` and `ProfileAnalysis.result`, including the rule that the JSON is **re-validated on read**.

**`documentId` is `SetNull`.** Same reasoning recorded on `LinkedInPost.accountId`: losing a file must never destroy the content that produced it. Delete a PDF and the deck stays editable and simply re-renders.

**`pagePreset` is persisted**, not chosen at render time, because it is an *editorial* property. Copy written for a 4:5 slide does not fit a square one, so a deck that silently changed shape between renders would break its own text.

**Zero enums**, per the project rule — every status is a `String` whose vocabulary is owned by a Zod tuple in `lib/types`.

### Push it

```bash
npx prisma validate
npx prisma db push
```

> **Do not run `prisma migrate dev`.** There is no `prisma/migrations/` directory in this repo; `migrate dev` reports every existing table as drift and offers to drop the database. See [doc 07](./07-adding-a-feature.md).

To see exactly what a push will do first — read-only and safe:

```bash
npx prisma migrate diff \
  --from-schema-datasource prisma/schema.prisma \
  --to-schema-datamodel   prisma/schema.prisma --script
```

---

## Step 3 — Config, and the two files that exist because satori is not a browser

This is the step that has no analogue in any earlier feature, so it is worth slowing down.

### `src/lib/config/carousel.ts` — literals and budgets

```ts
export const IMAGEKIT_DOCUMENT_FOLDER = '/documents'
export const CAROUSEL_GENERATION_MAX_TOKENS = 8192
export const CAROUSEL_GENERATION_TIMEOUT_MS = 90_000
export const CAROUSEL_RENDER_TIMEOUT_MS = 60_000
export const CAROUSEL_FONT_FAMILY = 'Geist'
export const CAROUSEL_FONT_FILES = [
  { weight: 400, path: 'src/app/assets/fonts/Geist-400.woff' },
  { weight: 700, path: 'src/app/assets/fonts/Geist-700.woff' },
] as const
```

**Why 8192 tokens.** The global `AI_MAX_TOKENS` is 4096, sized for a single LinkedIn post. A whole deck in one object truncates mid-array, and the SDK reports that as a *schema mismatch* rather than the budget overrun it actually is. `CONTENT_PLAN_MAX_TOKENS` exists for exactly the same reason.

**Why the render timeout is 60s.** Measured, not guessed: satori's first rasterisation pays a one-time WASM and font init of roughly two seconds, then settles to **~50 ms per slide**. A 12-slide deck lands near three seconds. The ceiling leaves room for a cold start plus the ImageKit upload without ever being the thing that fails a render.

### The font files, and the bug that makes them mandatory

`next/og` bundles exactly one face: `Geist-Regular.ttf`. And **satori does not synthesise bold.**

Without explicit font buffers, every `fontWeight` from 300 to 900 rasterises **identically**. A 300→900 ladder was rendered to confirm it — all seven rows came out pixel-identical. A deck whose heading cannot outweigh its body reads as one flat block, and nothing errors, nothing warns, and no test fails.

The fix is two WOFF files in the repo, loaded once per process and handed to `ImageResponse`:

```ts
let fontsPromise: Promise<LoadedFont[]> | null = null

async function loadCarouselFonts(): Promise<LoadedFont[]> {
  fontsPromise ??= Promise.all(
    CAROUSEL_FONT_FILES.map(async (font) => ({
      name: CAROUSEL_FONT_FAMILY,
      data: await readFile(path.join(process.cwd(), font.path)),
      weight: font.weight,
      style: 'normal' as const,
    })),
  )
  return fontsPromise
}
```

Cached as the **promise**, not the result, so two concurrent renders share one read instead of racing.

> **WOFF, never WOFF2.** satori reads `ttf`, `otf` and `woff`. It cannot read `woff2`, which is what Google Fonts serves to any modern browser user-agent. The files here are ~35 KB each; the TTF equivalents are ~73 KB.

And because nothing *imports* those files, Next's tracer cannot see them:

```ts
// next.config.ts
outputFileTracingIncludes: {
  '/api/trpc/[trpc]': ['./src/app/assets/fonts/**'],
},
```

Omit this and it works perfectly in dev and silently falls back to one weight in production.

### `src/lib/config/carousel-theme.ts` — the render-time twin of the theme

The second file that exists only because satori is not a browser:

> **satori has no CSS runtime.** The renderer never loads `globals.css`: `bg-background` resolves to nothing, and satori's colour parser does not understand `oklch()` — which is the notation *every* token in this app is authored in. A slide template reaching for a theme token would silently draw transparent on transparent.

So the palette is restated as sRGB, with each value labelled by the token it converts:

```ts
export const CAROUSEL_PALETTES: Record<CarouselTemplate, CarouselPalette> = {
  minimal: {
    background: '#090909',   // .dark --card             oklch(0.14 0 0)
    foreground: '#FFFFFF',   // .dark --foreground       oklch(1 0 0)
    muted:      '#A4A4A4',   // .dark --muted-foreground oklch(0.72 0 0)
    border:     '#242424',   // .dark --border           oklch(0.26 0 0)
    accent:     CAROUSEL_BRAND_HEX,
  },
  // bold, editorial…
}
```

**This is a deliberate, documented duplication.** The project rule "never hardcode theme colours" is about *components*; this is a config file whose entire job is to be the render target's twin. Keeping it here is what keeps hex out of the slide components, where the rule properly applies. Change a token in `globals.css` and you must reconvert it here — that cost is unavoidable when rendering outside the browser, and stating it in one file is the containment.

One honest wrinkle recorded in the file: `--brand` round-trips to `#1972C5`, but `globals.css` names the *intent* as LinkedIn blue `#0A66C2`. A PDF renders inside LinkedIn's own chrome, so the stated intent wins.

Type sizes live here too, in **pixels**, because satori has no `rem` and no root font size — and they are scaled per preset, since a square slide is 270 px shorter than a portrait one and would overflow at the portrait heading size.

---

## Step 4 — Types

**File: `src/lib/types/carousel.ts`**

The slide, and the deck:

```ts
export const carouselSlideSchema = z.object({
  kind: carouselSlideKindSchema,          // cover | content | cta
  heading: z.string().trim().min(1).max(CAROUSEL_HEADING_MAX),
  body: z.string().trim().max(CAROUSEL_BODY_MAX).default(''),
})

export const carouselSlidesSchema = z.array(carouselSlideSchema)
  .min(CAROUSEL_MIN_SLIDES)   // 3
  .max(CAROUSEL_MAX_SLIDES)   // 12
```

**The character ceilings are layout limits, not style advice.** Past them the renderer overflows the page, so they are enforced at the schema boundary where both the model and the editor hit them — and quoted in the prompt, the Zod message and the editor's counter from the same constant.

**`body` defaults to `''` rather than being optional** so the renderer and the editor never branch on nullish.

**Three slide kinds, no more.** Every extra kind is another layout every template must implement.

### The `.default()` trap, and a deliberate divergence

`generateCarouselSchema` uses `.default()` on `slideCount`, `templateId` and `page`. That makes zod's **input** and **output** types differ, and react-hook-form types field state on the input side and the submit handler on the output side. Under `exactOptionalPropertyTypes` the resolver becomes unassignable.

[Doc 10](./10-profile-analyzer.md) hit this and resolved it by banning `.default()` in form-facing schemas. **This feature diverges**, and states why in the type file: it keeps the defaults for API ergonomics and gives the form all three type arguments instead.

```ts
export type GenerateCarouselInput  = z.input<typeof generateCarouselSchema>
export type GenerateCarouselValues = z.infer<typeof generateCarouselSchema>

const form = useForm<GenerateCarouselInput, undefined, GenerateCarouselValues>({
  resolver: zodResolver(generateCarouselSchema),
})
```

Both approaches are valid. If you prefer one convention across the codebase, doc 10's is the older one.

---

## Step 5 — Services

### Why `next/og` and not a headless browser

Four options were weighed:

| Option | Verdict |
|---|---|
| **`next/og` (satori + resvg) → `pdf-lib`** | **Chosen.** Zero new render dependencies — it ships inside Next 16. Slides are React with inline styles. |
| Puppeteer / Playwright | Rejected. Needs `@sparticuz/chromium`, fights serverless bundle limits, slow cold starts, the heaviest thing that could enter this repo. |
| `@react-pdf/renderer` | Rejected. A parallel styling system that shares nothing with the app — every template authored twice. |
| Hand-writing a PDF | Rejected. Custom binary-format code this codebase would own forever. |

The cost of the chosen path is the whole of [Step 3](#step-3--config-and-the-two-files-that-exist-because-satori-is-not-a-browser). The benefit is that a slide template is an ordinary React component.

### `src/services/carousel.service.tsx` — note the extension

The **only** `.tsx` service in the folder. The file comment explains:

> The slide view is JSX, and it lives HERE rather than in `components/` on purpose: it never mounts, never hydrates and never reaches a browser. It is **render input, not UI**, and putting it under `components/` would invite exactly the client import that `server-only` exists to prevent.

#### The slide component, and the rule that breaks it

```tsx
<div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', ... }}>
```

**Every node carries an explicit `display: flex`.** That is not stylistic — satori implements a flexbox subset and **throws** on a container with more than one child that has no `display` set. Omitting it is the single most common way this renderer breaks.

Layout varies by **slide kind**, not by template: a cover is one large statement with no counter (a cover announcing "1/8" wastes the one line people read in the feed); a `cta` **inverts** to the accent colour so the ask is unmissable. Templates vary the *palette*, which is what keeps a deck coherent when the model writes an odd slide.

#### Rasterise, then staple

```ts
export async function renderCarouselPdf(slides, templateId, pagePreset) {
  const preset  = CAROUSEL_PAGE_PRESETS[pagePreset] ?? CAROUSEL_PAGE_PRESETS.portrait
  const pdf     = await PDFDocument.create()

  for (const [index, slide] of slides.entries()) {
    const png      = await renderSlidePng({ slide, index, total: slides.length, palette, scale },
                                          preset.width, preset.height)
    const embedded = await pdf.embedPng(png)
    const page     = pdf.addPage([preset.width, preset.height])
    page.drawImage(embedded, { x: 0, y: 0, width: preset.width, height: preset.height })
  }

  const buffer = Buffer.from(await pdf.save())
  return { base64: buffer.toString('base64'), byteSize: buffer.byteLength, pageCount: slides.length }
}
```

**Sequential, not parallel.** satori's first call pays the one-time init and every call after costs ~50 ms; firing twelve at once multiplies peak memory for no wall-clock gain, because the work is CPU-bound on one thread either way.

**One PNG per page, drawn at exactly page size.** LinkedIn rasterises document posts anyway, so vector text would buy nothing it can display — and it would cost the ability to lay slides out with the same engine that draws the on-screen preview.

**Returns base64**, because that is what `uploadFileBytes` takes.

#### Reads validate; the list does not carry slides

```ts
export async function getCarousel(organizationId, id, db = prisma) {
  const carousel = await db.carousel.findFirst({ where: { id, organizationId }, select: CAROUSEL_SAFE_SELECT })
  if (!carousel) return null
  return { ...carousel, slides: parseCarouselSlides(carousel.slides) }
}
```

Parsing **here** is what keeps the assertion out of every caller. Prisma types `slides` as `JsonValue`; a cast is a promise, not a check. This is the boundary that turns it into one.

The list query uses a **separate select that omits `slides` entirely** — a list row shows a topic, a status and a date, so shipping every deck's full slide array would be payload nobody reads *and* would hand the client a `JsonValue` it would have to assert its way out of.

#### Re-rendering must not leak

```ts
export async function attachCarouselDocument(args, db = prisma) {
  const previous = await db.carousel.findFirst({ ..., select: { document: { select: { id: true, fileId: true } } } })

  const carousel = await db.carousel.update({
    where: { id: args.carouselId },
    data: { status: 'ready', lastError: null, document: { create: { ...args } } },
    select: CAROUSEL_SAFE_SELECT,
  })

  if (previous?.document) await db.document.delete({ where: { id: previous.document.id } })

  return { carousel, supersededFileId: previous?.document?.fileId ?? null }
}
```

**Re-rendering is the expected workflow, not an edge case.** Every re-render points `documentId` at a new row. Without `supersededFileId`, the old `Document` and its ImageKit asset would leak silently, once per edit. The row goes inside the transaction (it is our data and rolls back cleanly); the **remote asset waits for the caller**.

#### Discarding a deck keeps its PDF

```ts
export async function discardCarousel(organizationId, id, db = prisma) {
  const result = await db.carousel.deleteMany({ where: { id, organizationId } })
  return { count: result.count }
}
```

Deliberate: a deck is the draft, the PDF is the artifact with its own page, permission and delete verb. Someone who bins a draft after downloading and posting the file has not asked for the file to disappear. The relation is `SetNull` for exactly this.

`count` is returned because the factory reads it — the DELETE NO-OP rule.

### `src/services/ai.service.ts` — one more task function

`generateCarouselSlides` follows `generateContentPlan` exactly: a system prompt with hard rules, `generateStructured`, a raised token ceiling, and the answer parsed back through the storage schema.

The prompt's rules exist to stop specific failure modes:

```
- The FIRST slide is kind "cover": one promise that makes someone stop scrolling.
- The LAST slide is kind "cta": one specific ask. "Follow for more" is a wasted slide.
- Every slide between them is kind "content": exactly one idea each.
  If a slide needs "and", it is two slides.
- headings are HEADLINES, not sentences. No trailing period. Under 90 characters.
- Never use markdown — the renderer draws text literally.
```

#### The schema must stay lenient — a mistake worth recording

The first version pinned the deck length:

```ts
// WRONG — shipped, then removed
schema: z.object({ slides: carouselSlidesSchema.length(input.slideCount) })
```

That is exactly what `generateContentPlan` already warns against:

> A hard `.min(5)` on hooks means a run that returns four is discarded whole, and the org has already paid for it. **Guidance the model usually follows beats validation that throws away work when it doesn't.**

A six-slide deck is something the user fixes in the editor in two seconds; a rejected generation gives them nothing. The exact count now lives in the **prompt**, and the schema keeps only the storage bounds:

```ts
schema: z.object({ slides: carouselSlidesSchema })
```

### `src/services/imagekit.service.ts` — generalised twice

`uploadImageBytes` became a thin wrapper over `uploadFileBytes(base64, fileName, folder)`, and `fetchImageBinary` over `fetchFileBinary(url, fallbackMimeType)`. Same pattern both times: the image path delegates rather than duplicating, and the only difference is the folder / the fallback MIME.

One new browser-safe helper, and it fixes a real bug:

```ts
export function buildAttachmentUrl(fileUrl: string): string {
  const url = new URL(fileUrl)
  url.searchParams.set('ik-attachment', 'true')
  return url.toString()
}
```

> An `<a download>` attribute is **IGNORED on cross-origin links** — every browser refuses to let one origin name the filename for another. Assets are served from `ik.imagekit.io` and the app is not, so the attribute does nothing and a PDF opens in a viewer tab instead of downloading. `ik-attachment=true` makes ImageKit send `Content-Disposition: attachment`, which is the only thing that actually triggers a save.

---

## Step 6 — Routers

**Files: `src/trpc/routers/carousel.ts`, `src/trpc/routers/documents.ts`**

### `carousel.create` — guard, generate, persist

```ts
create: protectedProcedure({
  requirePermission: permissions.CAROUSEL_CREATE,
  txTimeout: 120_000,   // > CAROUSEL_GENERATION_TIMEOUT_MS (90s)
})
```

The ordering `txTimeout > generation timeout` is the same relationship [doc 15](./15-ai-edit-image.md) documents. Invert it and the user waits two minutes for a Prisma error that says nothing about carousels.

`isAiConfigured()` is checked **before** the quota is spent.

The model call is wrapped, because the dominant real-world failure is vendor capacity:

```ts
const isCapacity = /high demand|overloaded|currently unavailable|try again later|503|UNAVAILABLE|rate.?limit|quota/i.test(raw)

throw new TRPCError({
  code: isCapacity ? 'TOO_MANY_REQUESTS' : 'INTERNAL_SERVER_ERROR',
  message: isCapacity
    ? 'The AI model is busy right now. Nothing was used from your plan — try again in a minute.'
    : /* … */,
})
```

`TOO_MANY_REQUESTS`, not a 500, because this is a **retryable upstream condition** and typing it correctly is what stops it being reported as a bug in the deck. The claim about the plan is true: the usage counter increments *inside* the transaction, so a failed generation rolls it back.

Message matching is normally a bug — [doc 12](./12-calendar-and-scheduled-posts.md) says so. It is used here for the reason doc 15 gives: the SDK wraps the provider error and the structured code does not survive the round trip.

### `carousel.render` — remote first, then the write

```ts
const rendered = await carouselService.renderCarouselPdf(carousel.slides, carousel.templateId, carousel.pagePreset)
const uploaded = await imagekitService.uploadFileBytes(rendered.base64, fileName, IMAGEKIT_DOCUMENT_FOLDER)
const { carousel: updated, supersededFileId } = await carouselService.attachCarouselDocument({ ... }, ctx.db)

if (supersededFileId) await imagekitService.deleteImage(supersededFileId)
```

**The upload happens before the database write**, so an upload failure rolls the whole transaction back rather than leaving a deck marked `ready` with no file behind it. Same ordering `linkedinPosts.create` uses.

#### The failure write that must escape the transaction

```ts
} catch (error) {
  /* DELIBERATELY NOT ctx.db. Every mutation here runs inside the factory's
   * transaction, and the rethrow below rolls it back — a failure written with
   * the tx client would be erased by the very throw that reports it. */
  await carouselService.markCarouselFailed(input.organizationId, input.id, message)
  throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message })
}
```

Omitting the `db` argument uses the service's default (non-transactional) client. This is the **one** place in the router that must escape the transaction, and the first version of this code got it wrong — it passed `ctx.db`, so the `failed` status was rolled back by the same throw that reported it.

### `documents.delete` — the guard that protects the worker

```ts
const blockedBy = await db.linkedInPost.count({
  where: { documentId: id, organizationId, status: { in: ['scheduled', 'publishing'] } },
})
if (blockedBy > 0) return { count: 0, fileId: null, blockedBy }
```

> The relation is `SetNull`, so deleting a PDF that a queued post points at would quietly blank its `documentId` — and the worker, hours later, would publish a **text-only post** where the user expected a carousel. That is both invisible at delete time and impossible to undo once it reaches an audience. Refusing is the only honest option.

A **published** post does not block: LinkedIn holds its own copy, so removing ours changes nothing about what is already live.

The router checks `blockedBy` *before* the not-found branch, because a blocked delete also removed nothing — reporting "no longer exists" for a file that plainly does would send the user after the wrong problem.

---

## Step 7 — The UI

### A global data table, finally

**File: `src/components/global/data-table/data-table.tsx`** (+ `src/components/ui/table.tsx` from the shadcn CLI)

Three hand-rolled tables already existed — audit logs, portal users, portal organizations — each re-implementing the same page/skeleton/empty scaffolding. The carousel list and the documents list would have been the fourth and fifth. That is the threshold the project's globalization rule describes, so `DataTable` was built here.

```ts
export interface DataTableColumn<TRow> {
  id: string
  header: React.ReactNode
  render: (row: TRow) => React.ReactNode
  className?: string
  align?: 'start' | 'end'
}
```

**Generic over the row type**, so a typo in a field name is a compile error rather than `undefined` in a cell. **Search and pagination are controlled**, not internal — the server owns both, and filtering a single page client-side would lie about the result set. The toolbar renders in *every* state, including empty, because hiding it would remove the user's only way to clear a search that matched nothing.

> It was **not** retro-fitted onto the three existing tables in this pass. That is a separate follow-up; doing it here would have made the diff unreviewable.

### The workspace, the editor, the dialogs

`carousel-workspace.tsx` holds the selection state and switches between the list and the editor. One route with two views, rather than a list page plus a detail route, because a deck is edited immediately after it is generated and a navigation in between would throw away the draft on screen.

Two details worth copying:

**Deriving state during render, not in an effect.**

```tsx
const [syncedId, setSyncedId] = React.useState<string | null>(null)
if (openQuery.data && openQuery.data.id !== syncedId) {
  setSyncedId(openQuery.data.id)
  setDraftSlides(openQuery.data.slides)
}
```

An effect would paint one frame of the previous deck's slides under the new deck's header, and the project's lint rule rejects `setState` in an effect body. Comparing **ids**, not data identity, is what makes re-fetching the same deck after a save leave the buffer alone.

**Dirty is computed, not tracked.**

```tsx
const isDirty = draftSlides !== null && openCarousel !== undefined &&
                JSON.stringify(draftSlides) !== JSON.stringify(openCarousel.slides)
```

A boolean flag drifts the moment a save resolves. "Dirty" must mean *the buffer differs from what is stored*, because that is what makes **Render** and **Publish** safe to gate on. Rendering unsaved slides would produce a PDF of the stored deck; publishing them would post the old slides to an audience.

**Invalidation is awaited.**

```tsx
onSuccess: async () => { await invalidate(); toast.success('PDF rendered.') }
```

The previous PDF has already been deleted from ImageKit by the time this resolves, so showing "rendered" before the refetch lands would leave a Download button pointing at a dead file. This was a real reported bug — a 404 on a stale URL.

---

## Step 8 — Phase 2: publishing to LinkedIn

### The API shape, and the one way it differs from images

`POST /rest/documents?action=initializeUpload` takes the same body as the Images API and returns the URN under **`value.document`** rather than `value.image`. The bytes go to `value.uploadUrl` with `PUT`. `restHeaders()` already sends both required headers.

Then the difference that matters:

> LinkedIn's own docs state plainly: **`SYNCHRONOUS_UPLOAD` is not supported in Documents API.** An uploaded asset moves `WAITING_UPLOAD → PROCESSING → AVAILABLE`.

Referencing the asset in a post before it is `AVAILABLE` is what produces a published post **with no deck attached** — intermittently, depending on timing. So `uploadDocument` has a third leg images do not:

```ts
async function waitForDocumentAvailable(accessToken: string, documentUrn: string) {
  const deadline = Date.now() + LINKEDIN_DOCUMENT_POLL_TIMEOUT_MS   // 30s
  for (;;) {
    const { status } = await (await fetch(`${LINKEDIN_ENDPOINTS.documents}/${encodeURIComponent(documentUrn)}`,
                                          { headers: restHeaders(accessToken) })).json()
    if (status === 'AVAILABLE') return
    if (status === 'PROCESSING_FAILED') throw new Error('[linkedin] LinkedIn could not process this PDF…')
    if (Date.now() >= deadline) throw new Error('[linkedin] document was still processing…')
    await new Promise((r) => setTimeout(r, LINKEDIN_DOCUMENT_POLL_INTERVAL_MS))
  }
}
```

`PROCESSING_FAILED` is terminal and surfaced immediately — retrying a rejected file only delays the same answer.

### Publishing routes through `linkedinPosts.create`

**There is no `carousel.publish` verb, and that is the most important API decision in Phase 2.**

The registry already documents why scheduling has no key of its own: only `<resource>.create` spends a slot, so a second publish verb would either double-meter a post or bypass the post quota entirely. Routing a deck through the post resource means **one deck costs one post**, and it inherits scheduling, the publish worker, the calendar and delete with no second code path.

`publishPostSchema` gains one optional field and a refinement:

```ts
documentId: z.string().min(1).optional(),
// …
.refine((values) => !(values.image && values.documentId), {
  message: 'A post can carry either an image or a carousel, not both',
  path: ['documentId'],
})
```

LinkedIn's Posts API takes exactly one `content.media`. Sending both would silently drop one, so the impossible combination is rejected rather than resolved by whichever the publish path happens to check first.

**Only the id crosses the wire.** The router resolves the url and title server-side from the `Document` row, scoped to the organization, so a client cannot point a post at a file another tenant owns.

### The post body

```ts
const content = documentUrn
  ? { content: { media: { id: documentUrn, title: args.document?.title } } }
  : imageUrn
    ? { content: { media: { id: imageUrn } } }
    : {}
```

**A document post carries a `title`; an image post has no such field.** That is why the two branches differ rather than sharing one media object — and that title is rendered publicly, which is the subject of the next section.

### The worker

`LinkedInPost` gains `documentId` (relation, `SetNull`) and `documentUrn`. The worker reads the deck **through the relation**, not from denormalised columns:

```ts
include: { document: { select: { url: true, fileName: true, title: true } } },
```

So a carousel re-rendered between scheduling and publishing goes out as the **current** file. `documents.delete` refusing to remove a PDF a scheduled post points at is what keeps this from ever resolving to null on a document post.

---

## How one carousel flows end to end

**User types a topic and clicks Generate:**

```
1.  carousel-form.tsx → createMutation.mutate({ topic, slideCount, templateId, page, tone })

2.  protectedProcedure wrapper                    ← ALL AUTOMATIC
    ├─ Logged in? Member of this org? carousel:create?
    ├─ Rate limit 3/min?  Plan limit under quota?
    └─ Open a transaction (txTimeout 120s)

3.  carousel.create handler
    ├─ isAiConfigured()?                          → 412 before quota is spent
    ├─ aiService.generateCarouselSlides(input)    → generateStructured, 8192 tokens
    │    └─ on vendor capacity error              → 429 with a retry message
    └─ createCarouselRecord(...)                  → status 'draft'

4.  protectedProcedure wrapper                    ← AUTOMATIC
    ├─ Increment the carousel usage counter
    ├─ Write the audit row
    └─ Commit

5.  The workspace opens the editor. Nothing has been rendered yet.

--- user edits slides, clicks Save, then Render ---

6.  carousel.render handler                       (txTimeout 90s)
    ├─ isImageKitConfigured()?                    → 412
    ├─ getCarousel(...)                           → slides parsed, not cast
    ├─ title    = carouselDocumentTitle(slides[0].heading, topic)
    ├─ fileName = carouselDocumentFileName(title)
    ├─ renderCarouselPdf(...)                     → N × ImageResponse → pdf-lib
    │      first slide ~1900ms, each after ~50ms
    ├─ uploadFileBytes(base64, fileName, '/documents')
    ├─ attachCarouselDocument(...)                → Document created, deck 'ready'
    └─ deleteImage(supersededFileId)              → the previous render's asset

7.  UI awaits invalidation, THEN toasts. Download and Publish appear.

--- user clicks Publish ---

8.  publish-dialog.tsx → linkedinPosts.create.mutate({ commentary, documentId, scheduledFor? })

9.  linkedinPosts.create handler
    ├─ getValidAccessToken(...)                   → refreshes if needed
    ├─ documentsService.getDocument(...)          → org-scoped; url + title from the row
    ├─ pageCount ≤ 300?                           → 400 before any bytes move
    ├─ SCHEDULED?  createScheduledPost({ documentId })  → done, worker takes it
    └─ publishPost({ commentary, document })
         ├─ fetchFileBinary(url, 'application/pdf')      ← LEG 1: down from ImageKit
         ├─ POST /rest/documents?action=initializeUpload ← LEG 2
         ├─ PUT the bytes to uploadUrl                   ← LEG 3
         ├─ waitForDocumentAvailable(urn)                ← LEG 4: THE ONE IMAGES LACK
         └─ POST /rest/posts with content.media.{id,title}
    └─ recordPublishedPost({ postUrn, documentUrn, documentId })
```

**Steps 2 and 4 are entirely free** — they exist because of the `carousel` registry entry.

---

## The four-name problem

A rendered deck has **four** names, and conflating any two of them is a bug. One of these shipped.

| Name | Example | Where it lives | Who sees it |
|---|---|---|---|
| **Topic** | `today i am sharing the llm's prompting patterns…` | `Carousel.topic` | Only the author. It is the *instruction*, not a title. |
| **Cover heading** | `5 Prompting Patterns That Fixed 90% of My AI Output` | `slides[0].heading` | Readers, on slide 1 |
| **Title** | `5 Prompting Patterns That Fixed 90% of My AI Output` | `Document.title` | **Publicly, on the LinkedIn post** |
| **File name** | `5-prompting-patterns-that-fixed-90-of-my-ai-output.pdf` | `Document.fileName` | Downloads folder, `Content-Disposition` |

**The bug that shipped:** `title` was set to `fileName`, and `fileName` was slugged from the **topic**. The result was a live LinkedIn post whose visible document name was `today-i-am-sharing-the-llm-s-promptin…` — the author's raw prompt, published.

Two mistakes compounded:

1. **One field doing two jobs.** A filename wants a lowercase hyphenated slug; a title wants prose. They are different values.
2. **The wrong source.** The topic is what the author typed *to* the model. The cover heading is what the deck calls itself.

Both names now derive from the cover heading, with the topic as a fallback for a deck with no usable cover:

```ts
export function carouselDocumentTitle(coverHeading: string | undefined, topic: string): string {
  const source = coverHeading?.trim() || topic.trim()
  return source.replace(/\s+/g, ' ').slice(0, 200)   // keeps capitals and punctuation
}

export function carouselDocumentFileName(title: string): string {
  return `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')/* … */}.pdf`
}
```

`Document.title` is nullable because rows written before the column existed genuinely have no title; every reader falls back to `fileName`.

> **A published post cannot be fixed.** LinkedIn holds its own copy of the asset *and* its title. Re-render and re-publish.

---

## Testing it

```bash
npx tsc --noEmit     # must print nothing
npm run lint         # must print nothing — including warnings
```

> **Do not run `npm run build` while `next dev` is running.** Production artifacts in `.next` collide with Turbopack and make **every** route 404 — including `/api/trpc/[trpc]`, which is the tell. The fix is `rm -rf .next`. This cost real debugging time during the build.

Then, in the browser:

| # | Do this | Expect |
|---|---|---|
| 1 | Open `/dashboard/carousel` | Empty state, "New carousel" button |
| 2 | Generate a 7-slide deck | Editor opens; slide 1 is `cover`, slide 7 is `cta` |
| 3 | Edit a heading | Render and Publish become **disabled** until Save |
| 4 | Save, then Render | ~3 s, then Download and Publish appear |
| 5 | Download the PDF | It **saves**, does not open in a tab. 7 pages, 1080×1350 |
| 6 | Open it | Headings visibly **bolder** than body — this is the font check |
| 7 | Check `/dashboard/documents` | One row, readable title, correct size and page count |
| 8 | Edit a slide, Save, Render again | Old ImageKit asset gone; Documents still shows one row |
| 9 | Publish now | Feed shows a **swipeable document**, not a link or single image |
| 10 | Read the deck's title in the feed | The cover heading, **not** a slug of your topic |
| 11 | Schedule a deck, then try to delete its PDF | Refused with a `CONFLICT` naming the blocking post |
| 12 | Hit `/api/scheduled-posts/run` with the bearer token | The scheduled deck publishes |
| 13 | Exhaust the carousel quota on `free` | `FeatureGate` intercepts; the server rejects a forced call too |
| 14 | Discard a deck | Its PDF **remains** in Documents |

### The checks that prove the wiring

```sql
SELECT id, "fileName", title, "byteSize", "pageCount" FROM document ORDER BY "createdAt" DESC;
SELECT id, status, "documentId", "documentUrn" FROM linkedin_post ORDER BY "createdAt" DESC LIMIT 5;
SELECT * FROM usage_metrics WHERE "organizationId" = '<your org id>';
```

- After a re-render there is still exactly **one** `document` row per deck.
- `carousel` counter equals the number of **generations**, not renders. Render five times, it stays at 1.
- `discard` does **not** decrement it. That is the point of the verb name.

---

## Mistakes that are easy to make

| Mistake | What happens | Fix |
|---|---|---|
| No explicit font buffers | Every `fontWeight` renders identically. **Nothing errors** | Ship the WOFFs, pass them to `ImageResponse` |
| Using WOFF2 fonts | satori cannot read it | `ttf`, `otf`, or `woff` only |
| Omitting `outputFileTracingIncludes` | Works in dev, one weight in production | Declare the font path in `next.config.ts` |
| A theme token in a slide component | Draws nothing — satori has no CSS runtime and no `oklch()` | Read from `carousel-theme.ts` |
| A flex container without `display: flex` | satori **throws** mid-render | Every node gets it explicitly |
| `.length()` on the model's slide array | A 6-slide answer is discarded whole; the org already paid | Count in the prompt, bounds in the schema |
| `AI_MAX_TOKENS` (4096) for a deck | Truncates mid-array; reported as a schema mismatch | `CAROUSEL_GENERATION_MAX_TOKENS` |
| `markCarouselFailed(..., ctx.db)` | The rethrow rolls back the very failure it reports | Omit `db` so it escapes the transaction |
| Forgetting `supersededFileId` | Every re-render leaks a `Document` row and an ImageKit asset | Return it; delete after commit |
| `<a download>` on the ImageKit URL | Ignored cross-origin — opens in a tab instead of saving | `buildAttachmentUrl()` |
| Fire-and-forget `invalidate()` after render | Download button points at the deleted previous file → 404 | `await` it before the toast |
| Posting a document without polling | Post publishes with **no deck**, intermittently | `waitForDocumentAvailable` |
| `content.media.title` from `fileName` | Publishes a slug of the author's prompt | Use `Document.title` |
| A `carousel.publish` verb | Double-meters, or bypasses the post quota | Route through `linkedinPosts.create` |
| `delete` instead of `discard` | create → delete → create is an unlimited free tier | `discard` |
| Deleting a PDF a scheduled post needs | Worker publishes text-only, hours later, silently | The `blockedBy` guard |
| `npm run build` beside `next dev` | Every route 404s | `rm -rf .next` |

---

## Known limitations

**Re-rendering breaks old links.** A re-render deletes the previous PDF from ImageKit. Anyone holding that URL — a bookmark, an open tab — gets a 404. This is correct (the alternative leaks storage forever) but it is a real consequence.

**The saved filename carries ImageKit's suffix.** Downloads land as `my-deck_Khebl6fUK.pdf`, because `Content-Disposition` comes from ImageKit and the cross-origin rule means we cannot override it client-side. A proxy route on our own origin would fix it.

**No live preview.** The editor shows text fields, not rendered slides. You see the design only after Render. A preview would mean running satori in the browser or an on-demand PNG endpoint.

**Three templates, no customisation.** No custom colours, logo, or headshot. The palette is a config table, so adding a template is cheap; letting *users* define one is not.

**No live LinkedIn preview.** The composer has `LinkedInPostPreview` for image posts; the publish dialog shows no deck preview.

**Failed renders leave a `failed` deck.** Recoverable — edit and re-render — but nothing retries automatically.

**A published post cannot be corrected.** LinkedIn holds its own copy of the asset and its title.

---

## What we deliberately did NOT build

| Not built | Why | When |
|---|---|---|
| **A live slide preview** | Needs satori in the browser or an image endpoint per slide | When the design story matters more than the copy story |
| **Retro-fitting `DataTable` onto the three old tables** | Correct, but it would have made this diff unreviewable | A focused follow-up |
| **A document picker in the post composer** | `post-composer.tsx` is already 22 KB and image-shaped throughout | If decks need to be posted outside the carousel page |
| **Custom branding per organization** | Logo, colours, headshot — needs an asset pipeline and a settings surface | When someone asks |
| **Carousel analytics** | LinkedIn gates read-back behind `r_member_social`, restricted to partners | Probably never |
| **Async rendering via the worker** | Rendering is ~3 s; a queue would add latency and a state machine for no gain | If decks grow past ~30 slides |
| **Editing a published deck** | LinkedIn holds its own copy; changing ours would make the record disagree | Never |

---

## File map

**New files (21):**

```
src/lib/types/carousel.ts                         slide/deck schemas, bounds, router inputs
src/lib/config/carousel.ts                        folder, budgets, fonts, title/filename
src/lib/config/carousel-theme.ts                  sRGB twin of the theme + type scale
src/app/assets/fonts/Geist-400.woff               satori has no access to next/font
src/app/assets/fonts/Geist-700.woff               without this, bold does not exist
src/services/carousel.service.tsx                 render pipeline + Carousel access  (.tsx!)
src/services/documents.service.ts                 Document read/delete + scheduled-post guard
src/trpc/routers/carousel.ts                      create | update | render | list | get | discard
src/trpc/routers/documents.ts                     list | get | delete
src/components/ui/table.tsx                       shadcn primitive (CLI)
src/components/global/data-table/data-table.tsx   the global list surface
src/components/global/data-table/index.ts         barrel
.../dashboard/carousel/page.tsx                   route shell
.../dashboard/carousel/_components/carousel-workspace.tsx
.../dashboard/carousel/_components/carousel-form.tsx
.../dashboard/carousel/_components/slide-editor.tsx
.../dashboard/carousel/_components/publish-dialog.tsx
.../dashboard/carousel/_components/carousel-types.ts
.../dashboard/documents/page.tsx
.../dashboard/documents/_components/documents-library.tsx
.../dashboard/documents/_components/document-types.ts
```

**Edited files (15):**

```
prisma/schema.prisma                    + Carousel, Document; LinkedInPost.documentId/documentUrn
src/lib/resources.ts                    + carousel, documents
src/lib/config/index.ts                 + carousel and carousel-theme exports
src/lib/config/imagekit.ts              + buildAttachmentUrl
src/lib/config/linkedin.ts              + documents endpoint, document limits, poll constants
src/lib/types/index.ts                  + carousel barrel exports
src/lib/types/linkedin.ts               + PostDocumentValues, publishPostSchema.documentId + refine
src/lib/utils.ts                        + toLocalDateTimeInput, earliestSchedule (lifted)
src/services/ai.service.ts              + CAROUSEL_SYSTEM_PROMPT, generateCarouselSlides
src/services/imagekit.service.ts        + uploadFileBytes, fetchFileBinary
src/services/linkedin.service.ts        + uploadDocument, waitForDocumentAvailable,
                                          resolvePostDocument, document columns, worker
src/trpc/routers/_app.ts                + carousel, documents mounted
src/trpc/routers/linkedin-posts.ts      + document resolution in create
src/components/global/sidebar/nav-icons.tsx  + Layers, FileText
next.config.ts                          + outputFileTracingIncludes for the fonts
.../post-generation/_components/post-composer.tsx   imports the lifted date helpers
package.json                            + pdf-lib
```

---

## The one thing to remember

> **The renderer is not a browser, and the deck is not a new kind of post.** Everything satori draws must be handed to it explicitly — fonts, colours, pixel sizes — because no stylesheet exists on the server. And everything LinkedIn publishes goes through `linkedinPosts.create`, because a carousel is a post with a different attachment and must cost the same.

The theme twin, the two WOFF files, the tracing config, and the absence of a `carousel.publish` verb are just where each half is enforced.

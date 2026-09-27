/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "server-only";

/**
 * SOURCE OF TRUTH KEYWORDS: renderCarouselPdf, renderCarouselSlide,
 *   carouselSlideToDesignDoc, RenderedCarousel, listCarousels, getCarousel,
 *   createCarouselRecord, updateCarouselRecord, attachCarouselDocument,
 *   markCarouselFailed, discardCarousel, parseCarouselSlides,
 *   renderCarouselSlidePreview, RenderedCarouselSlide, resolveSlideRenderContext,
 *   CAROUSEL_SAFE_SELECT, CAROUSEL_LIST_SELECT
 *
 * WHAT:  The carousel render pipeline — React slide → PNG (satori/resvg via
 *        next/og) → multi-page PDF (pdf-lib) — plus the Prisma access for the
 *        Carousel table.
 * WHY:   `server-only` because the render is a server capability: it reads font
 *        files off disk and produces multi-megabyte buffers, neither of which
 *        belongs in a browser bundle.
 *
 *        next/og rather than a headless browser because it ships INSIDE Next —
 *        satori and resvg are already vendored, so the whole rasterisation step
 *        costs no dependency, no Chromium binary, and no cold-start penalty
 *        beyond a one-time WASM init. pdf-lib is the only thing added, and it
 *        does exactly one job: staple the PNGs into pages.
 *
 *        The slides are drawn with INLINE STYLES and explicit pixel values, not
 *        Tailwind classes. satori has no CSS runtime — no stylesheet is loaded,
 *        no class resolves, and `oklch()` (which every token in this app uses) is
 *        not a colour it can parse. Everything visual therefore comes from
 *        lib/config/carousel-theme, which is the render-time twin of the theme.
 *
 *        NOTE the `.tsx` extension — the only service in this folder that carries
 *        one. The slide view is JSX, and it lives HERE rather than in components/
 *        on purpose: it never mounts, never hydrates and never reaches a browser.
 *        It is render input, not UI, and putting it under components/ would invite
 *        exactly the client import that `server-only` exists to prevent.
 * WHERE: Called by src/trpc/routers/carousel.ts. The PDF it returns is uploaded
 *        by that router via imagekit.service.uploadFileBytes.
 */

import { PDFDocument } from "pdf-lib";

import type { Prisma } from "@/generated/prisma";

import { prisma, type DbClient } from "@/lib/config/prisma";
import {
  CAROUSEL_PAGE_PRESETS,
  getCarouselPalette,
  getCarouselTypeScale,
  type CarouselPalette,
  type CarouselTypeScale,
} from "@/lib/config";
import {
  carouselPagePresetSchema,
  carouselSlidesSchema,
  carouselTemplateSchema,
  designDocSchema,
  type CarouselPagePreset,
  type CarouselSlide,
  type CarouselSlidePreviewValues,
  type CarouselSlides,
  type CarouselTemplate,
  type DesignCanvasKey,
  type DesignDoc,
  type ListCarouselsValues,
} from "@/lib/types";
import { getCarouselLayout } from "@/lib/config/carousel-layouts";
import { renderDesignPng } from "./design-render.service";

// ---------------------------------------------------------------------------
// Fonts
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Slide rendering
// ---------------------------------------------------------------------------

/* CarouselSlideView, SlideViewProps, renderSlidePng and loadCarouselFonts all
 * lived here until slides moved onto the shared design renderer — the migration
 * docs/20-studio.md called phase 5. Their replacement is the pair below:
 * carouselSlideToDesignDoc turns a slide into blocks, and renderCarouselSlide
 * draws them with renderDesignPng, which loads the same Geist faces itself.
 */


/**
 * SOURCE OF TRUTH KEYWORDS: carouselSlideToDesignDoc, DesignDoc, slot mapping,
 *   paletteOverrides, hideWhenEmpty, phase 5
 *
 * WHAT:  Turns one stored slide into the DesignDoc the shared renderer draws.
 * WHY:   The document is DERIVED PER RENDER and never stored. Carousel.slides
 *        stays the source of truth, so this mapping can change without a
 *        migration, and a deck is never two representations that can disagree.
 *
 *        Colours come through `paletteOverrides` rather than by naming one of
 *        DESIGN_PALETTES, and that is deliberate: CAROUSEL_PALETTES holds the
 *        exact hexes these decks already render with, so overriding all five slots
 *        reproduces the current output rather than approximating it with the
 *        nearest studio palette. Existing decks keep their colours exactly.
 *
 *        Carousel slots map onto design slots by VISUAL ROLE, not by name —
 *        `callout` is a quotable line so it takes `quote`, and `note` is an aside
 *        so it takes `footnote`. Bullets spread across pointA–E; D and E exist for
 *        this. Every one is drawn `hideWhenEmpty`, so a slide stored before those
 *        slots existed simply collapses them.
 * WHERE: renderCarouselSlide, which both the PDF and the live preview go through.
 */
function carouselSlideToDesignDoc(
  slide: CarouselSlide,
  templateId: CarouselTemplate,
  canvas: DesignCanvasKey,
  palette: CarouselPalette,
): DesignDoc {
  const layout = getCarouselLayout(templateId, slide.kind);

  const bulletSlots = ["pointA", "pointB", "pointC", "pointD", "pointE"] as const;
  const bulletContent = Object.fromEntries(
    slide.bullets
      .slice(0, bulletSlots.length)
      .map((text, index) => [bulletSlots[index], text]),
  );

  /* Parsed, not constructed: designDocSchema fills every default — block layout
   * offsets, hideWhenEmpty, opacity — exactly once, which is the same reason
   * DESIGN_ARCHETYPES are authored in the input shape and cloned. */
  return designDocSchema.parse({
    templateId,
    archetypeId: `carousel-${slide.kind}`,
    canvas,
    /* Any valid id: every slot is overridden below, so this names nothing that
     * survives. Stated rather than left to a default so the override is obviously
     * total. */
    paletteId: "midnight",
    paletteOverrides: {
      background: palette.background,
      foreground: palette.foreground,
      muted: palette.muted,
      border: palette.border,
      accent: palette.accent,
    },
    /* The field and the placement are the LAYOUT'S, not this function's. They
     * were a hardcoded `isCta ? accent : background` branch here, which meant a
     * template could not decide how its own closing slide inverted — and a
     * template whose accent is a marker yellow has nothing readable to put on a
     * full slide of it. */
    background: { kind: "solid", color: { slot: layout.field } },
    justify: layout.justify,
    blocks: layout.blocks,
    content: {
      headline: slide.heading,
      body: slide.body,
      eyebrow: slide.eyebrow,
      quote: slide.callout,
      ctaLabel: slide.ctaLabel,
      footnote: slide.note,
      ...bulletContent,
    },
  });
}

export interface RenderedCarousel {
  /* base64 because that is what imagekit.service.uploadFileBytes takes — see the
   * note there on why this vendor boundary speaks base64. */
  base64: string;
  byteSize: number;
  pageCount: number;
}

/* Declared here beside RenderedCarousel rather than in lib/types, matching
 * RenderedDesign in design-render.service: a render RESULT is the shape of what
 * this service produces, not a contract anything else authors. Both existing
 * render results live with their renderer; keep it that way. */
export interface RenderedCarouselSlide {
  base64: string;
  byteSize: number;
  width: number;
  height: number;
}

interface SlideRenderContext {
  preset: (typeof CAROUSEL_PAGE_PRESETS)[keyof typeof CAROUSEL_PAGE_PRESETS];
  palette: CarouselPalette;
  scale: CarouselTypeScale;
  /* The shared renderer's name for the same geometry. DESIGN_CANVAS_PRESETS takes
   * its carousel dimensions FROM CAROUSEL_PAGE_PRESETS, so these two are the same
   * numbers under two vocabularies rather than a pair that could drift. */
  canvas: DesignCanvasKey;
}

/* One place the two vocabularies meet. */
const CAROUSEL_CANVAS_BY_PAGE: Record<CarouselPagePreset, DesignCanvasKey> = {
  portrait: "carouselPortrait",
  square: "carouselSquare",
};

/**
 * SOURCE OF TRUTH KEYWORDS: resolveSlideRenderContext, preset, palette, scale
 *
 * WHAT:  Turns a deck's stored templateId and pagePreset into the geometry,
 *        palette and type scale a slide is drawn with.
 * WHY:   Shared by the PDF export and the live preview, and that sharing is the
 *        whole point: two independent resolutions would let the preview and the
 *        downloaded file disagree, which is the one failure a design tool cannot
 *        have. "The preview is the real render" is only true while exactly one
 *        function decides what real means.
 *
 *        The page id is PARSED with a fallback rather than cast. Both values arrive
 *        as bare Prisma Strings, and `.catch()` mirrors the never-throw contract
 *        getCarouselPalette and getCarouselTypeScale already document — a row
 *        written by an older vocabulary renders in the default shape instead of
 *        throwing inside a rasterisation loop.
 * WHERE: renderCarouselPdf and renderCarouselSlidePreview, and nothing else.
 */
function resolveSlideRenderContext(
  templateId: string,
  pagePreset: string,
): SlideRenderContext {
  const page = carouselPagePresetSchema.catch("portrait").parse(pagePreset);
  return {
    preset: CAROUSEL_PAGE_PRESETS[page],
    palette: getCarouselPalette(templateId),
    scale: getCarouselTypeScale(page),
    canvas: CAROUSEL_CANVAS_BY_PAGE[page],
  };
}

/**
 * SOURCE OF TRUTH KEYWORDS: renderCarouselSlide, renderDesignPng, phase 5
 *
 * WHAT:  Rasterises one slide through the SHARED design renderer.
 * WHY:   The single place a carousel slide becomes pixels, used by both the PDF
 *        and the live preview. Going through renderDesignPng rather than a
 *        carousel-only component is what docs/20-studio.md phase 5 called for: one
 *        renderer, one block language, and a new template that costs a config
 *        entry instead of a JSX branch.
 *
 *        `index` and `total` are handed to the render context, not baked into the
 *        document — that is exactly what DesignRenderContext documents them for,
 *        and it is how the slideCounter and deckProgress blocks resolve.
 */
async function renderCarouselSlide(
  slide: CarouselSlide,
  templateId: CarouselTemplate,
  context: SlideRenderContext,
  index: number,
  total: number,
): Promise<Buffer> {
  const doc = carouselSlideToDesignDoc(
    slide,
    templateId,
    context.canvas,
    context.palette,
  );
  const rendered = await renderDesignPng(doc, { index, total });
  return Buffer.from(rendered.base64, "base64");
}

/**
 * SOURCE OF TRUTH KEYWORDS: renderCarouselSlidePreview, RenderedCarouselSlide
 *
 * WHAT:  Rasterises ONE slide, for the editor's live preview.
 * WHY:   Exported while renderCarouselSlide stays private, which mirrors how
 *        renderDesignPng is exposed to the studio preview route: the transport
 *        layer hands over a parsed payload and the SERVICE owns render policy.
 *
 *        Draws the same element tree as the PDF through the same context resolver,
 *        so the preview cannot drift from the file the member downloads.
 * WHERE: src/app/api/carousel/preview/route.ts.
 */
export async function renderCarouselSlidePreview(
  input: CarouselSlidePreviewValues,
): Promise<RenderedCarouselSlide> {
  const context = resolveSlideRenderContext(input.templateId, input.page);

  const png = await renderCarouselSlide(
    input.slide,
    input.templateId,
    context,
    input.index,
    input.total,
  );

  return {
    base64: png.toString("base64"),
    byteSize: png.byteLength,
    width: context.preset.width,
    height: context.preset.height,
  };
}

/**
 * SOURCE OF TRUTH KEYWORDS: renderCarouselPdf
 *
 * WHAT:  Renders a whole deck to a single multi-page PDF.
 * WHY:   One PNG per page, drawn at exactly the page size, because LinkedIn
 *        rasterises document posts anyway — vector text would buy nothing it can
 *        display, and it would cost the ability to lay slides out with the same
 *        engine that draws the on-screen preview.
 *
 *        Slides are rasterised SEQUENTIALLY on purpose. satori's first call pays a
 *        one-time WASM and font initialisation of roughly two seconds and every
 *        call after it costs ~50ms; firing twelve in parallel multiplies the
 *        memory held at once for no wall-clock gain, because the work is CPU-bound
 *        on one thread either way.
 * WHERE: Called by carousel.render in src/trpc/routers/carousel.ts.
 */
export async function renderCarouselPdf(
  slides: CarouselSlides,
  templateId: string,
  pagePreset: string,
): Promise<RenderedCarousel> {
  /* Same resolver the live preview uses — see the note there on why that sharing
   * is what keeps the two from disagreeing. */
  const context = resolveSlideRenderContext(templateId, pagePreset);
  const preset = context.preset;
  const template = carouselTemplateSchema.catch("minimal").parse(templateId);

  const pdf = await PDFDocument.create();

  for (const [index, slide] of slides.entries()) {
    const png = await renderCarouselSlide(
      slide,
      template,
      context,
      index,
      slides.length,
    );
    const embedded = await pdf.embedPng(png);
    const page = pdf.addPage([preset.width, preset.height]);
    page.drawImage(embedded, {
      x: 0,
      y: 0,
      width: preset.width,
      height: preset.height,
    });
  }

  const bytes = await pdf.save();
  const buffer = Buffer.from(bytes);
  return {
    base64: buffer.toString("base64"),
    byteSize: buffer.byteLength,
    pageCount: slides.length,
  };
}

// ---------------------------------------------------------------------------
// Carousel records
// ---------------------------------------------------------------------------

/* Columns a client may read. Narrow on purpose: the row also carries lastError,
 * which is surfaced deliberately, and nothing else the UI has no use for. */
const CAROUSEL_SAFE_SELECT = {
  id: true,
  topic: true,
  templateId: true,
  pagePreset: true,
  status: true,
  slides: true,
  lastError: true,
  createdAt: true,
  updatedAt: true,
  document: {
    select: {
      id: true,
      url: true,
      fileName: true,
      title: true,
      byteSize: true,
      pageCount: true,
      createdAt: true,
    },
  },
} as const;

/* The list omits `slides` entirely. A list row shows a topic, a status and a
 * date — shipping every deck's full slide array to render four columns is
 * payload nobody reads, and it would hand the client a JsonValue it would have
 * to assert its way out of. The editor fetches one deck by id when it needs the
 * copy. */
const CAROUSEL_LIST_SELECT = {
  id: true,
  topic: true,
  templateId: true,
  pagePreset: true,
  status: true,
  lastError: true,
  createdAt: true,
  updatedAt: true,
  /* `title` rides along so the list can name a rendered deck by the title it
   * actually published under, falling back to the topic. A row's topic is the
   * PROMPT the author typed, which is why an unrendered deck reads like an
   * instruction — the document's title is the name the deck gave itself. Cheap:
   * one more column on a relation this select already loads. */
  document: { select: { id: true, url: true, fileName: true, title: true } },
} as const;

/**
 * SOURCE OF TRUTH KEYWORDS: parseCarouselSlides
 *
 * WHAT:  Re-validates the stored Json deck on the way out of the database.
 * WHY:   Prisma types `slides` as JsonValue, which is not CarouselSlides. Parsing
 *        rather than casting is the rule this codebase already follows for
 *        ProfileAnalysis.result and ContentPlan.result — a row written by an older
 *        shape fails here with a clear message instead of reaching a renderer that
 *        assumes fields it does not have.
 *
 *        Takes `Prisma.JsonValue`, not `unknown`: the input is not arbitrary, it
 *        is exactly what the column can hold, and saying so means a caller cannot
 *        quietly hand this something that was never in the database.
 * WHERE: Called by getCarousel — the one read that returns slides.
 */
function parseCarouselSlides(value: Prisma.JsonValue): CarouselSlides {
  return carouselSlidesSchema.parse(value);
}

/**
 * SOURCE OF TRUTH KEYWORDS: listCarousels, search, CarouselWhereInput
 *
 * WHAT:  A page of decks for the workspace list, optionally narrowed by topic.
 * WHY:   ONE `where`, used by both the page query and the count, and that is the
 *        actual fix rather than a tidiness point. Search used to happen in the
 *        browser over the rows already fetched, so the rows shrank while the
 *        server's `total` did not — a search could render an empty table beneath
 *        "Page 1 of 4". A shared predicate makes that state unreachable.
 *
 *        `contains` with `mode: "insensitive"`, matching the post library and the
 *        idea inbox. Carousel.topic carries no index, so this is a per-org scan
 *        exactly as LinkedInPost.commentary is — acceptable at this table's size,
 *        and the schema caps the term at 200 characters so it stays bounded.
 * WHERE: carousel.list. Filters are separate from pagination because the factory
 *        owns pagination and the router owns the filter.
 */
export async function listCarousels(
  organizationId: string,
  filters: Pick<ListCarouselsValues, "search">,
  pagination: { skip: number; take: number },
  db: DbClient = prisma,
) {
  const where: Prisma.CarouselWhereInput = {
    organizationId,
    ...(filters.search
      ? { topic: { contains: filters.search, mode: "insensitive" } }
      : {}),
  };

  const [items, total] = await Promise.all([
    db.carousel.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      select: CAROUSEL_LIST_SELECT,
      skip: pagination.skip,
      take: pagination.take,
    }),
    db.carousel.count({ where }),
  ]);
  return { items, total };
}

/**
 * SOURCE OF TRUTH KEYWORDS: getCarousel
 *
 * WHAT:  One deck, with its slides already validated into CarouselSlides.
 * WHY:   Parsing HERE rather than returning the raw column is what keeps the
 *        assertion out of every caller. Prisma types `slides` as JsonValue, so a
 *        router or component reading it would have to cast — and a cast is a
 *        promise, not a check. This is the boundary that turns it into one.
 */
export async function getCarousel(
  organizationId: string,
  id: string,
  db: DbClient = prisma,
) {
  const carousel = await db.carousel.findFirst({
    where: { id, organizationId },
    select: CAROUSEL_SAFE_SELECT,
  });
  if (!carousel) return null;
  return { ...carousel, slides: parseCarouselSlides(carousel.slides) };
}

export async function createCarouselRecord(
  args: {
    organizationId: string;
    authorId: string;
    topic: string;
    templateId: string;
    pagePreset: string;
    slides: CarouselSlides;
  },
  db: DbClient = prisma,
) {
  return db.carousel.create({
    data: {
      organizationId: args.organizationId,
      authorId: args.authorId,
      topic: args.topic,
      templateId: args.templateId,
      pagePreset: args.pagePreset,
      slides: args.slides,
      status: "draft",
    },
    select: CAROUSEL_SAFE_SELECT,
  });
}

/**
 * SOURCE OF TRUTH KEYWORDS: updateCarouselRecord
 *
 * WHAT:  Saves edited slides, and resets a failed deck back to draft.
 * WHY:   Editing clears `lastError` and returns the row to `draft`: the error
 *        described the deck as it was, and leaving it visible next to changed
 *        copy would report a failure the user has already addressed.
 */
export async function updateCarouselRecord(
  args: {
    organizationId: string;
    id: string;
    slides: CarouselSlides;
    templateId?: string | undefined;
    pagePreset?: string | undefined;
  },
  db: DbClient = prisma,
) {
  const result = await db.carousel.updateMany({
    where: { id: args.id, organizationId: args.organizationId },
    data: {
      slides: args.slides,
      ...(args.templateId ? { templateId: args.templateId } : {}),
      ...(args.pagePreset ? { pagePreset: args.pagePreset } : {}),
      status: "draft",
      lastError: null,
    },
  });
  return { count: result.count };
}

/**
 * SOURCE OF TRUTH KEYWORDS: attachCarouselDocument
 *
 * WHAT:  Creates the Document row for a finished render, points the deck at it,
 *        and reports which file the PREVIOUS render left behind.
 * WHY:   One nested write rather than two statements, so a deck can never end up
 *        `ready` with no document — the state the UI would render as a download
 *        button that 404s.
 *
 *        The `supersededFileId` return exists because re-rendering is the expected
 *        workflow, not an edge case: every re-render points documentId at a NEW
 *        row, and without this the old Document and its ImageKit asset would leak,
 *        silently, once per edit. The caller deletes it AFTER the transaction
 *        commits — deleting inside would strand a live row pointing at a dead file
 *        if the transaction then rolled back.
 */
export async function attachCarouselDocument(
  args: {
    organizationId: string;
    carouselId: string;
    fileId: string;
    url: string;
    fileName: string;
    title: string;
    mimeType: string;
    byteSize: number;
    pageCount: number;
  },
  db: DbClient = prisma,
) {
  const previous = await db.carousel.findFirst({
    where: { id: args.carouselId, organizationId: args.organizationId },
    select: { document: { select: { id: true, fileId: true } } },
  });

  const carousel = await db.carousel.update({
    where: { id: args.carouselId },
    data: {
      status: "ready",
      lastError: null,
      document: {
        create: {
          organizationId: args.organizationId,
          fileId: args.fileId,
          url: args.url,
          fileName: args.fileName,
          title: args.title,
          mimeType: args.mimeType,
          byteSize: args.byteSize,
          pageCount: args.pageCount,
        },
      },
    },
    select: CAROUSEL_SAFE_SELECT,
  });

  /* The superseded Document row goes now, inside the transaction — it is our own
   * data and rolls back cleanly. Only the remote asset waits for commit. */
  if (previous?.document) {
    await db.document.delete({ where: { id: previous.document.id } });
  }

  return { carousel, supersededFileId: previous?.document?.fileId ?? null };
}

export async function markCarouselFailed(
  organizationId: string,
  id: string,
  message: string,
  db: DbClient = prisma,
) {
  await db.carousel.updateMany({
    where: { id, organizationId },
    data: { status: "failed", lastError: message },
  });
}

/**
 * SOURCE OF TRUTH KEYWORDS: discardCarousel
 *
 * WHAT:  Removes a deck. Its rendered PDF is deliberately LEFT BEHIND.
 * WHY:   Returns `count` because the procedure factory reads it — a discard that
 *        matched nothing must not be reported as success.
 *
 *        The Document survives on purpose. A deck is the draft; the PDF is the
 *        artifact, and it has its own page, its own permission and its own delete
 *        verb. Someone who throws away a draft after downloading and posting the
 *        file has not asked for the file to disappear from their library. The
 *        relation is SetNull for exactly this reason, so the row simply loses its
 *        backlink. Removing the file is `documents.delete`.
 */
export async function discardCarousel(
  organizationId: string,
  id: string,
  db: DbClient = prisma,
) {
  const result = await db.carousel.deleteMany({
    where: { id, organizationId },
  });
  return { count: result.count };
}

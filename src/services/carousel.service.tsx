/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "server-only";

/**
 * SOURCE OF TRUTH KEYWORDS: renderCarouselPdf, renderSlidePng, loadCarouselFonts,
 *   CarouselSlideView, RenderedCarousel, listCarousels, getCarousel,
 *   createCarouselRecord, updateCarouselRecord, attachCarouselDocument,
 *   markCarouselFailed, discardCarousel, parseCarouselSlides,
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

import { ImageResponse } from "next/og";
import { PDFDocument } from "pdf-lib";

import type { Prisma } from "@/generated/prisma";

import { prisma, type DbClient } from "@/lib/config/prisma";
import {
  CAROUSEL_FONT_FAMILY,
  CAROUSEL_PAGE_PRESETS,
  getCarouselPalette,
  getCarouselTypeScale,
  type CarouselPalette,
  type CarouselTypeScale,
} from "@/lib/config";
import {
  carouselSlidesSchema,
  type CarouselPagePreset,
  type CarouselSlide,
  type CarouselSlides,
} from "@/lib/types";

/* The font buffers moved to their own service once the studio renderer needed
 * the same ones — see the note on loadCarouselFonts below. */
import { loadRenderFonts, type LoadedFont } from "./render-fonts.service";

// ---------------------------------------------------------------------------
// Fonts
// ---------------------------------------------------------------------------

/**
 * SOURCE OF TRUTH KEYWORDS: loadCarouselFonts
 *
 * WHAT:  The Geist faces satori draws with.
 * WHY:   Was a local cached-promise loader here until the studio renderer needed
 *        the same buffers. Now a thin alias over the shared one in
 *        render-fonts.service, so both rasterisers hit ONE per-process cache
 *        instead of each paying its own disk read.
 *
 *        The reason the fonts are passed explicitly at all has not changed:
 *        without them satori falls back to the single Regular face bundled in
 *        next/og and SILENTLY IGNORES fontWeight — every weight from 300 to 900
 *        rasterises identically, so a heading cannot outweigh its body. Invisible
 *        in code review, obvious in the output.
 *
 *        Kept as a named local rather than inlining `loadRenderFonts()` at the
 *        call site so this explanation stays attached to the carousel path.
 * WHERE: Called by renderSlidePng on every rasterisation (cached after the first).
 */
async function loadCarouselFonts(): Promise<LoadedFont[]> {
  return loadRenderFonts("geist");
}

// ---------------------------------------------------------------------------
// Slide rendering
// ---------------------------------------------------------------------------

interface SlideViewProps {
  slide: CarouselSlide;
  index: number;
  total: number;
  palette: CarouselPalette;
  scale: CarouselTypeScale;
}

/**
 * SOURCE OF TRUTH KEYWORDS: CarouselSlideView
 *
 * WHAT:  One slide, as the element tree satori rasterises.
 * WHY:   Every node carries an explicit `display: flex`. That is not stylistic —
 *        satori implements a flexbox subset and THROWS on a container with more
 *        than one child that has no display set. Omitting it is the single most
 *        common way this renderer breaks.
 *
 *        Layout differs by slide kind rather than by template: a cover is one
 *        large statement, a cta inverts to the accent so the ask is unmissable,
 *        and content slides carry the counter. Templates vary the PALETTE, which
 *        is what keeps a deck coherent when the model writes an odd slide.
 */
function CarouselSlideView({
  slide,
  index,
  total,
  palette,
  scale,
}: SlideViewProps) {
  const isCover = slide.kind === "cover";
  const isCta = slide.kind === "cta";

  /* The cta inverts: accent becomes the field, background becomes the ink. One
   * slide in the deck reading opposite is what makes the ask register. */
  const field = isCta ? palette.accent : palette.background;
  const ink = isCta ? palette.background : palette.foreground;
  const secondary = isCta ? palette.background : palette.muted;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: isCover ? "flex-end" : "center",
        backgroundColor: field,
        padding: scale.padding,
        fontFamily: CAROUSEL_FONT_FAMILY,
      }}
    >
      {/* Counter. Hidden on the cover — a cover announcing "1/8" wastes the one
          line people actually read in the feed. */}
      {!isCover && (
        <div
          style={{
            display: "flex",
            fontSize: scale.meta,
            fontWeight: 400,
            color: secondary,
            letterSpacing: 2,
            marginBottom: scale.padding / 3,
          }}
        >
          {`${String(index + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}`}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column" }}>
        <div
          style={{
            display: "flex",
            fontSize: isCover ? scale.coverHeading : scale.heading,
            fontWeight: 700,
            color: ink,
            lineHeight: 1.05,
            letterSpacing: -1,
          }}
        >
          {slide.heading}
        </div>

        {slide.body.length > 0 && (
          <div
            style={{
              display: "flex",
              fontSize: scale.body,
              fontWeight: 400,
              color: secondary,
              lineHeight: 1.4,
              marginTop: scale.padding / 3,
            }}
          >
            {slide.body}
          </div>
        )}
      </div>

      {/* Progress rule. Gives the deck a spine and tells the reader how much is
          left without spending a line of copy on it. */}
      {!isCover && (
        <div
          style={{
            display: "flex",
            width: "100%",
            height: 6,
            backgroundColor: isCta ? palette.background : palette.border,
            marginTop: scale.padding / 2,
            opacity: isCta ? 0.35 : 1,
          }}
        >
          <div
            style={{
              display: "flex",
              width: `${Math.round(((index + 1) / total) * 100)}%`,
              height: "100%",
              backgroundColor: isCta ? palette.background : palette.accent,
            }}
          />
        </div>
      )}
    </div>
  );
}

/**
 * SOURCE OF TRUTH KEYWORDS: renderSlidePng
 *
 * WHAT:  Rasterises one slide to PNG bytes.
 * WHY:   ImageResponse is normally returned from a route handler; here it is
 *        constructed directly and drained with .arrayBuffer(), which is supported
 *        and is what lets the render live in a service instead of leaking an HTTP
 *        endpoint into the feature.
 * WHERE: Called once per slide by renderCarouselPdf.
 */
async function renderSlidePng(props: SlideViewProps, width: number, height: number) {
  const response = new ImageResponse(<CarouselSlideView {...props} />, {
    width,
    height,
    fonts: await loadCarouselFonts(),
  });
  return Buffer.from(await response.arrayBuffer());
}

export interface RenderedCarousel {
  /* base64 because that is what imagekit.service.uploadFileBytes takes — see the
   * note there on why this vendor boundary speaks base64. */
  base64: string;
  byteSize: number;
  pageCount: number;
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
  const preset =
    CAROUSEL_PAGE_PRESETS[pagePreset as CarouselPagePreset] ??
    CAROUSEL_PAGE_PRESETS.portrait;
  const palette = getCarouselPalette(templateId);
  const scale = getCarouselTypeScale(pagePreset);

  const pdf = await PDFDocument.create();

  for (const [index, slide] of slides.entries()) {
    const png = await renderSlidePng(
      { slide, index, total: slides.length, palette, scale },
      preset.width,
      preset.height,
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
  document: { select: { id: true, url: true, fileName: true } },
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

export async function listCarousels(
  organizationId: string,
  pagination: { skip: number; take: number },
  db: DbClient = prisma,
) {
  const [items, total] = await Promise.all([
    db.carousel.findMany({
      where: { organizationId },
      orderBy: { updatedAt: "desc" },
      select: CAROUSEL_LIST_SELECT,
      skip: pagination.skip,
      take: pagination.take,
    }),
    db.carousel.count({ where: { organizationId } }),
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

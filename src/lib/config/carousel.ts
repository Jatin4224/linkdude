/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: IMAGEKIT_DOCUMENT_FOLDER, CAROUSEL_PDF_MIME_TYPE,
 *   CAROUSEL_RENDER_TIMEOUT_MS, CAROUSEL_GENERATION_MAX_TOKENS,
 *   CAROUSEL_GENERATION_TIMEOUT_MS, CAROUSEL_FONT_FILES, CAROUSEL_FONT_FAMILY,
 *   carouselDocumentFileName, carouselDocumentTitle
 *
 * WHAT:  Every literal the carousel render path depends on — storage folder,
 *        MIME type, the two model/render budgets, and where the font files live.
 * WHY:   Stated once so the renderer, the router and the prompt cannot disagree.
 *        The token and timeout ceilings are carousel-specific on purpose: the
 *        global AI_MAX_TOKENS (4096) truncates a multi-slide JSON object
 *        mid-object, which surfaces as a schema-validation failure with no
 *        obvious cause. Precedent: CONTENT_PLAN_MAX_TOKENS exists for exactly the
 *        same reason.
 * WHERE: Consumed by src/services/carousel.service.ts, src/services/ai.service.ts
 *        and the carousel router.
 */

import { CAROUSEL_PAGE_PRESETS } from "@/lib/types/carousel";

/* Namespaced away from IMAGEKIT_POST_FOLDER so generated documents can be
 * lifecycled independently of post media — they have different retention needs
 * and a different owner (a Document row, not a LinkedInPost). */
export const IMAGEKIT_DOCUMENT_FOLDER = "/documents";

export const CAROUSEL_PDF_MIME_TYPE = "application/pdf";

/* A deck is one structured generation covering every slide at once, which is a
 * materially larger object than a single post. 4096 truncates it. */
export const CAROUSEL_GENERATION_MAX_TOKENS = 8192;
export const CAROUSEL_GENERATION_TIMEOUT_MS = 90_000;

/* Measured, not guessed: satori's first rasterisation pays a one-time WASM and
 * font initialisation of roughly two seconds, then settles to ~50ms per slide.
 * A full 12-slide deck therefore lands near three seconds; this ceiling leaves
 * room for a cold start plus the ImageKit upload without ever being the thing
 * that fails a render. */
export const CAROUSEL_RENDER_TIMEOUT_MS = 60_000;

/**
 * SOURCE OF TRUTH KEYWORDS: CAROUSEL_FONT_FAMILY, CAROUSEL_FONT_FILES
 *
 * WHAT:  The font family the slide templates render in, and the files backing it.
 * WHY:   satori has NO CSS runtime and no access to next/font — it only draws
 *        with font buffers handed to it explicitly. `next/og` bundles exactly one
 *        face, Geist Regular, and it does NOT synthesise bold: without these
 *        files every weight from 300 to 900 rasterises identically, so a heading
 *        cannot outweigh its body and the deck reads as one flat block.
 *
 *        WOFF rather than TTF because satori reads both and WOFF is half the
 *        size; woff2 is NOT supported and must never be substituted here.
 * WHERE: Loaded by src/services/carousel.service.ts and passed to ImageResponse.
 */
export const CAROUSEL_FONT_FAMILY = "Geist";

/* Paths relative to the project root. Resolved at render time rather than
 * imported so the binaries stay out of the JS bundle; next.config.ts declares
 * them in outputFileTracingIncludes so the tracer ships them to the server. */
export const CAROUSEL_FONT_FILES = [
  { weight: 400, path: "src/app/assets/fonts/Geist-400.woff" },
  { weight: 700, path: "src/app/assets/fonts/Geist-700.woff" },
] as const;

/**
 * SOURCE OF TRUTH KEYWORDS: carouselDocumentTitle, carouselDocumentFileName
 *
 * WHAT:  The two names a rendered deck carries — one for people, one for files.
 * WHY:   They are DIFFERENT VALUES and conflating them is a real bug, not a
 *        tidiness point. LinkedIn renders the title publicly on the document
 *        post, so using the filename there published a slug of the author's raw
 *        prompt as the deck's name ("today-i-am-sharing-the-llm-s-promptin…").
 *
 *        Both derive from the COVER SLIDE'S HEADING rather than the topic. The
 *        topic is the instruction the author typed; the heading is the title the
 *        deck gives itself, and it is what a reader should see. The topic is only
 *        a fallback for a deck with no usable cover.
 * WHERE: Called by carousel.render before uploading to ImageKit; the title is
 *        what the publish path sends as `content.media.title`.
 */
export function carouselDocumentTitle(
  coverHeading: string | undefined,
  topic: string,
): string {
  const source = coverHeading?.trim() || topic.trim();
  if (!source) return "Carousel";
  /* Collapsed whitespace only — this is prose and must keep its capitals,
   * punctuation and spaces. */
  return source.replace(/\s+/g, " ").slice(0, 200);
}

/* Slugged hard: this value reaches a Content-Disposition header and a
 * filesystem, so anything outside [a-z0-9-] is dropped rather than escaped. */
export function carouselDocumentFileName(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${slug || "carousel"}.pdf`;
}

/* Re-exported so the render path has one import for geometry AND budgets, rather
 * than reaching into lib/types for one and lib/config for the other. */
export { CAROUSEL_PAGE_PRESETS };

/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: IMAGEKIT_DOCUMENT_FOLDER, CAROUSEL_PDF_MIME_TYPE,
 *   CAROUSEL_RENDER_TIMEOUT_MS, CAROUSEL_GENERATION_MAX_TOKENS,
 *   CAROUSEL_GENERATION_TIMEOUT_MS, CAROUSEL_FONT_FILES, CAROUSEL_FONT_FAMILY,
 *   carouselDocumentFileName, carouselDocumentTitle, CAROUSEL_PNG_MIME_TYPE,
 *   CAROUSEL_PREVIEW_PATH, CAROUSEL_PREVIEW_DEBOUNCE_MS,
 *   carouselSlideImageFileName, carouselImagesZipFileName,
 *   CAROUSEL_TEMPLATE_LABELS, CAROUSEL_SLIDE_KIND_LABELS, CAROUSEL_SAMPLE_TOPICS,
 *   CAROUSEL_GENERATION_PHASES
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

import {
  CAROUSEL_PAGE_PRESETS,
  type CarouselSlideKind,
  type CarouselTemplate,
} from "@/lib/types/carousel";

/* Namespaced away from IMAGEKIT_POST_FOLDER so generated documents can be
 * lifecycled independently of post media — they have different retention needs
 * and a different owner (a Document row, not a LinkedInPost). */
export const IMAGEKIT_DOCUMENT_FOLDER = "/documents";

export const CAROUSEL_PDF_MIME_TYPE = "application/pdf";

/* The preview route and the slide-image zip both speak PNG. Sits beside the PDF
 * type because a deck now leaves this feature in two formats, and a caller should
 * not have to know which file declares which. */
export const CAROUSEL_PNG_MIME_TYPE = "image/png";

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
 * SOURCE OF TRUTH KEYWORDS: CAROUSEL_PREVIEW_PATH, CAROUSEL_PREVIEW_DEBOUNCE_MS
 *
 * WHAT:  Where the editor posts a slide to see it drawn, and how long it waits
 *        after a keystroke before doing so.
 * WHY:   A ROUTE HANDLER, not a tRPC procedure, and the path is named here so no
 *        component types the literal. The reason for the route is documented at
 *        src/app/api/carousel/preview/route.ts: every tRPC mutation opens a Prisma
 *        transaction, and a debounced render holding a pooled connection starves
 *        Better Auth of one.
 *
 *        The debounce is RESTATED rather than imported from lib/config/studio,
 *        even though both are 300ms today. A 1080×1350 slide is ~1.46 megapixels
 *        against the studio banner's ~0.6, so this is a per-feature budget that
 *        should be tunable without touching the other surface — and studio's own
 *        config declares that it mirrors this file, so the dependency runs that
 *        direction, not back.
 * WHERE: CAROUSEL_PREVIEW_PATH is fetched by the carousel slide preview and by the
 *        PNG zip export; the debounce is handed to the global RenderPreview.
 */
export const CAROUSEL_PREVIEW_PATH = "/api/carousel/preview";
export const CAROUSEL_PREVIEW_DEBOUNCE_MS = 300;

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

/**
 * SOURCE OF TRUTH KEYWORDS: carouselSlideImageFileName, carouselImagesZipFileName
 *
 * WHAT:  The names the per-slide PNGs and their zip carry.
 * WHY:   Zero-padded and stamped with the deck length, so an unzipped folder sorts
 *        in DECK ORDER in every file manager. `slide-9.png` sorting between
 *        slide-1 and slide-10 is the whole reason this is a function and not a
 *        template literal at the call site.
 *
 *        Slugged with the same rules as carouselDocumentFileName — the studio's
 *        export panel builds its zip name with an inline regex, and that inline is
 *        precisely the drift this avoids.
 * WHERE: The carousel slide-image export, per entry and for the archive itself.
 */
export function carouselSlideImageFileName(
  index: number,
  total: number,
): string {
  const width = String(total).length;
  const position = String(index + 1).padStart(width, "0");
  return `slide-${position}-of-${String(total)}.png`;
}

export function carouselImagesZipFileName(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${slug || "carousel"}-slides.zip`;
}

/**
 * SOURCE OF TRUTH KEYWORDS: CAROUSEL_TEMPLATE_LABELS, CAROUSEL_SLIDE_KIND_LABELS
 *
 * WHAT:  How the template and slide-kind vocabularies read to a person.
 * WHY:   Moved here from the two components that used to own one each, because
 *        both gained a second consumer: the generate form and the editor's
 *        template switcher need the same template names, and the editor's kind
 *        control and the preview caption need the same kind names. Two copies of a
 *        label map drift the first time one is reworded.
 *
 *        Typed as Record over the tuples, so adding a template or a kind in
 *        lib/types surfaces here as a type error rather than a missing option.
 * WHERE: carousel-form, slide-editor, slide-preview.
 */
export const CAROUSEL_TEMPLATE_LABELS: Record<CarouselTemplate, string> = {
  minimal: "Minimal — dark, quiet",
  bold: "Bold — brand blue field",
  editorial: "Editorial — light, document-like",
  notebook: "Notebook — paper, marker headlines",
  linkdude: "LinkDude — blue on white, high contrast",
};

export const CAROUSEL_SLIDE_KIND_LABELS: Record<CarouselSlideKind, string> = {
  cover: "Cover",
  content: "Slide",
  cta: "Call to action",
};

/**
 * SOURCE OF TRUTH KEYWORDS: CAROUSEL_SAMPLE_TOPICS
 *
 * WHAT:  Example briefs offered when the topic box is empty.
 * WHY:   An empty prompt box is the hardest screen in the product — it asks for a
 *        format nobody has seen yet. Each of these is written as a REAL brief, the
 *        convention the studio's design slots already follow for placeholders, and
 *        each clears CAROUSEL_TOPIC_MIN comfortably so clicking one can never
 *        populate a form that then fails validation.
 *
 *        Specific on purpose: they double as instruction, showing that a concrete
 *        claim outperforms a broad subject.
 * WHERE: The new-carousel dialog, shown only while the topic field is empty.
 */
export const CAROUSEL_SAMPLE_TOPICS = [
  "Why most technical interviews measure the wrong thing, and the three questions I ask instead",
  "The five-step checklist I run before any feature ships, learned from breaking production twice",
  "How we cut our AWS bill 40% in one quarter without turning off a single service",
  "What six years of freelancing taught me about pricing: raise your rate before you feel ready",
] as const;

/**
 * SOURCE OF TRUTH KEYWORDS: CAROUSEL_GENERATION_PHASES
 *
 * WHAT:  What the generate button says while it waits, and when each label takes
 *        over.
 * WHY:   TIME-BASED, NOT PROGRESS-BASED, and the distinction matters: generation is
 *        one opaque model call that knows nothing about its own phase, so there is
 *        no real percentage to report. These labels exist to show the wait is
 *        bounded and ordered, which is all an honest indicator can claim — hence
 *        `atMs` thresholds rather than a progress bar that would be fiction.
 *
 *        The last label carries the longest stretch on purpose: a slow run is
 *        where a spinner alone starts reading as a hang.
 * WHERE: The generate form's submit button, driven by one interval while the
 *        mutation is pending.
 */
export const CAROUSEL_GENERATION_PHASES = [
  { atMs: 0, label: "Structuring slides…" },
  { atMs: 6_000, label: "Applying your design theme…" },
  { atMs: 15_000, label: "Tightening the copy…" },
] as const;

/* Re-exported so the render path has one import for geometry AND budgets, rather
 * than reaching into lib/types for one and lib/config for the other. */
export { CAROUSEL_PAGE_PRESETS };

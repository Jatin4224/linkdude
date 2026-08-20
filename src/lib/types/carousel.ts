/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: CAROUSEL_STATUSES, CarouselStatus,
 *   CAROUSEL_SLIDE_KINDS, CarouselSlideKind, CAROUSEL_TEMPLATES, CarouselTemplate,
 *   CAROUSEL_PAGE_PRESETS, CarouselPagePreset, carouselSlideSchema,
 *   carouselSlidesSchema, CarouselSlide, CarouselSlides, generateCarouselSchema,
 *   updateCarouselSchema, renderCarouselSchema, discardCarouselSchema,
 *   listCarouselsSchema, getCarouselSchema, deleteDocumentSchema,
 *   listDocumentsSchema, CAROUSEL_MIN_SLIDES, CAROUSEL_MAX_SLIDES
 *
 * WHAT:  The carousel vocabulary — slide shape, deck bounds, page geometry, and
 *        every router input for the carousel and documents resources.
 * WHY:   A deck is persisted as Carousel.slides (Json), so this file is the ONLY
 *        thing standing between the database and an untyped value: the same
 *        schema validates what the model returns, what the editor saves, and
 *        what the renderer reads back. Bounds are constants rather than inline
 *        numbers because the model prompt, the Zod message and the editor's
 *        character counter must all quote the same ceiling or the user is told
 *        one limit and stopped by another.
 * WHERE: Consumed by src/services/ai.service (generation), src/services/
 *        carousel.service (render), the carousel and documents routers, and the
 *        slide editor UI. Re-exported through src/lib/types.
 */

import { z } from "zod";

import { postToneSchema } from "./ai";

/* Reuses postToneSchema rather than declaring a carousel tone: a deck and a post
 * are the same author writing in the same register, and a second tone list would
 * drift from the first the moment either is edited. */

/**
 * SOURCE OF TRUTH KEYWORDS: CAROUSEL_STATUSES, CarouselStatus
 *
 * WHAT:  The legal values of Carousel.status.
 * WHY:   schema.prisma stores it as a bare String — this codebase has no Prisma
 *        enums — so this tuple is the enforcement point. `rendering` exists as a
 *        real state rather than a UI spinner because a render that dies mid-way
 *        must be distinguishable from one that never started.
 */
export const CAROUSEL_STATUSES = [
  "draft",
  "rendering",
  "ready",
  "failed",
] as const;
export const carouselStatusSchema = z.enum(CAROUSEL_STATUSES);
export type CarouselStatus = (typeof CAROUSEL_STATUSES)[number];

/**
 * SOURCE OF TRUTH KEYWORDS: CAROUSEL_SLIDE_KINDS, CarouselSlideKind
 *
 * WHAT:  What job a slide does in the deck.
 * WHY:   Templates render the three differently — a cover is one big statement,
 *        a cta carries the ask — so the renderer needs the role, not just the
 *        position. Kept to three because every extra kind is another layout every
 *        template must implement.
 */
export const CAROUSEL_SLIDE_KINDS = ["cover", "content", "cta"] as const;
export const carouselSlideKindSchema = z.enum(CAROUSEL_SLIDE_KINDS);
export type CarouselSlideKind = (typeof CAROUSEL_SLIDE_KINDS)[number];

/**
 * SOURCE OF TRUTH KEYWORDS: CAROUSEL_TEMPLATES, CarouselTemplate
 *
 * WHAT:  The available slide designs.
 * WHY:   A String on the row (Carousel.templateId) owned by this tuple, so
 *        adding a design is a config entry plus a renderer branch — never a
 *        migration.
 */
export const CAROUSEL_TEMPLATES = ["minimal", "bold", "editorial"] as const;
export const carouselTemplateSchema = z.enum(CAROUSEL_TEMPLATES);
export type CarouselTemplate = (typeof CAROUSEL_TEMPLATES)[number];

/**
 * SOURCE OF TRUTH KEYWORDS: CAROUSEL_PAGE_PRESETS, CarouselPagePreset
 *
 * WHAT:  PDF page geometry in pixels.
 * WHY:   Dimensions, not ratios — the renderer rasterises at exactly these
 *        numbers and pdf-lib sizes the page to match, so stating pixels keeps the
 *        output a deliberate choice. Portrait is the default because 4:5 is the
 *        tallest LinkedIn renders without letterboxing, which means the most
 *        screen area per swipe.
 *
 *        Mirrors IMAGE_ASPECT_PRESETS in ./imagekit deliberately: same idea,
 *        different target, and neither should reach into the other's numbers.
 */
export const CAROUSEL_PAGE_PRESETS = {
  portrait: { label: "Portrait (4:5)", width: 1080, height: 1350 },
  square: { label: "Square (1:1)", width: 1080, height: 1080 },
} as const;
const CAROUSEL_PAGE_KEYS = ["portrait", "square"] as const;
export const carouselPagePresetSchema = z.enum(CAROUSEL_PAGE_KEYS);
export type CarouselPagePreset = (typeof CAROUSEL_PAGE_KEYS)[number];

/* Deck bounds. Three is the fewest that reads as a carousel rather than an image;
 * twelve is where LinkedIn's swipe UI stops being pleasant and where a single
 * structured generation starts truncating. */
export const CAROUSEL_MIN_SLIDES = 3;
export const CAROUSEL_MAX_SLIDES = 12;
export const CAROUSEL_DEFAULT_SLIDES = 7;

/* Per-slide copy ceilings. These are LAYOUT limits, not storage limits: past
 * them the renderer overflows the page rather than wrapping, so they are enforced
 * at the schema boundary where both the model and the editor hit them. */
export const CAROUSEL_HEADING_MAX = 90;
export const CAROUSEL_BODY_MAX = 260;
export const CAROUSEL_TOPIC_MAX = 1000;
export const CAROUSEL_TOPIC_MIN = 10;

/**
 * SOURCE OF TRUTH KEYWORDS: carouselSlideSchema, CarouselSlide,
 *   carouselSlidesSchema, CarouselSlides
 *
 * WHAT:  One slide, and the ordered deck of them.
 * WHY:   The deck is stored as Json (Carousel.slides) and re-validated on read,
 *        the precedent set by ContentPlan.result and ProfileAnalysis.result. No
 *        Slide table: slides are never queried on their own — they are always
 *        read, written and rendered as one ordered unit, and a table would buy
 *        joins nobody needs while making reordering a transaction.
 *
 *        Order is array position, not an index column, for the same reason:
 *        moving a slide is a splice, not five UPDATEs.
 */
export const carouselSlideSchema = z.object({
  kind: carouselSlideKindSchema,
  heading: z
    .string()
    .trim()
    .min(1, "Every slide needs a heading")
    .max(
      CAROUSEL_HEADING_MAX,
      `Keep headings under ${CAROUSEL_HEADING_MAX} characters so they fit the slide`,
    ),
  /* Optional in practice, never absent in storage: a cover slide often carries
   * no body, and defaulting to "" rather than allowing undefined means the
   * renderer and the editor never branch on nullish. */
  body: z
    .string()
    .trim()
    .max(
      CAROUSEL_BODY_MAX,
      `Keep slide text under ${CAROUSEL_BODY_MAX} characters so it fits the slide`,
    )
    .default(""),
});
export type CarouselSlide = z.infer<typeof carouselSlideSchema>;

export const carouselSlidesSchema = z
  .array(carouselSlideSchema)
  .min(CAROUSEL_MIN_SLIDES, `A carousel needs at least ${CAROUSEL_MIN_SLIDES} slides`)
  .max(CAROUSEL_MAX_SLIDES, `A carousel can hold at most ${CAROUSEL_MAX_SLIDES} slides`);
export type CarouselSlides = z.infer<typeof carouselSlidesSchema>;

/**
 * SOURCE OF TRUTH KEYWORDS: generateCarouselSchema, GenerateCarouselValues
 *
 * WHAT:  Input to carousel.create — everything the model needs to draft a deck.
 * WHY:   slideCount is asked for rather than inferred because deck length is an
 *        editorial decision the user owns, and a model left to choose it will
 *        drift with the topic. templateId and page ride along so the draft can be
 *        previewed in its real geometry immediately — a deck written for a square
 *        slide reads differently from one written for 4:5.
 */
export const generateCarouselSchema = z.object({
  topic: z
    .string()
    .trim()
    .min(
      CAROUSEL_TOPIC_MIN,
      `Describe your topic in at least ${CAROUSEL_TOPIC_MIN} characters`,
    )
    .max(CAROUSEL_TOPIC_MAX, `Keep the topic under ${CAROUSEL_TOPIC_MAX} characters`),
  slideCount: z
    .number()
    .int()
    .min(CAROUSEL_MIN_SLIDES)
    .max(CAROUSEL_MAX_SLIDES)
    .default(CAROUSEL_DEFAULT_SLIDES),
  templateId: carouselTemplateSchema.default("minimal"),
  page: carouselPagePresetSchema.default("portrait"),
  tone: postToneSchema,
});
export type GenerateCarouselValues = z.infer<typeof generateCarouselSchema>;

/**
 * SOURCE OF TRUTH KEYWORDS: GenerateCarouselInput
 *
 * WHAT:  The form-facing half of generateCarouselSchema — the same shape, but
 *        with the `.default()` fields still optional.
 * WHY:   `.default()` makes zod's INPUT and OUTPUT types differ: slideCount is
 *        optional going in and guaranteed coming out. react-hook-form types its
 *        field values on the input side and its submit handler on the output
 *        side, so a form declared with only `GenerateCarouselValues` fails to
 *        typecheck under `exactOptionalPropertyTypes`. Exporting both halves is
 *        what lets the form state both without either being restated.
 * WHERE: Used by the carousel generate form as useForm's first type argument,
 *        with GenerateCarouselValues as its third.
 */
export type GenerateCarouselInput = z.input<typeof generateCarouselSchema>;

/**
 * SOURCE OF TRUTH KEYWORDS: updateCarouselSchema, UpdateCarouselValues
 *
 * WHAT:  Input to carousel.update — the edit step between drafting and rendering.
 * WHY:   Sends the WHOLE slide array rather than a per-slide patch. The editor
 *        can reorder, insert and delete, and a patch protocol for that is a
 *        second source of truth about deck order. Whole-array writes also mean
 *        the min/max deck bounds are enforced on every save instead of only at
 *        generation.
 */
export const updateCarouselSchema = z.object({
  id: z.string().min(1),
  slides: carouselSlidesSchema,
  templateId: carouselTemplateSchema.optional(),
  page: carouselPagePresetSchema.optional(),
});
export type UpdateCarouselValues = z.infer<typeof updateCarouselSchema>;

export const renderCarouselSchema = z.object({
  id: z.string().min(1),
});
export type RenderCarouselValues = z.infer<typeof renderCarouselSchema>;

export const getCarouselSchema = z.object({
  id: z.string().min(1),
});
export type GetCarouselValues = z.infer<typeof getCarouselSchema>;

/* `discard`, not `delete` — see the note on the Carousel model and the RESOURCES
 * entry. The verb name is what stops the factory refunding a spent generation. */
export const discardCarouselSchema = z.object({
  id: z.string().min(1),
});
export type DiscardCarouselValues = z.infer<typeof discardCarouselSchema>;

/* Documentary only: page/pageSize are clamped by the procedure factory's
 * `paginate` option, which owns the defaults and the max. Declaring them with
 * .default()/.max() here would create a second, drifting set of limits — the
 * convention established by listAuditLogsSchema. */
export const listCarouselsSchema = z.object({
  page: z.number().int().positive().optional(),
  pageSize: z.number().int().positive().optional(),
});
export type ListCarouselsValues = z.infer<typeof listCarouselsSchema>;

export const listDocumentsSchema = z.object({
  page: z.number().int().positive().optional(),
  pageSize: z.number().int().positive().optional(),
});
export type ListDocumentsValues = z.infer<typeof listDocumentsSchema>;

export const deleteDocumentSchema = z.object({
  id: z.string().min(1),
});
export type DeleteDocumentValues = z.infer<typeof deleteDocumentSchema>;

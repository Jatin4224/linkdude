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
 *   listDocumentsSchema, CAROUSEL_MIN_SLIDES, CAROUSEL_MAX_SLIDES,
 *   carouselDraftSchema, CarouselDraftValues, carouselSlidePreviewSchema,
 *   CarouselSlidePreviewValues, normalizeCarouselSlideKinds,
 *   carouselSlideKindOptionsFor
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
import { postImageSchema } from "./imagekit";

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
export const CAROUSEL_TEMPLATES = [
  "minimal",
  "bold",
  "editorial",
  /* The illustrated pair. Same engine, same slots — they differ in palette,
   * typeface and which hand-drawn marks their layouts place. */
  "notebook",
  "linkdude",
] as const;
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
/**
 * SOURCE OF TRUTH KEYWORDS: CAROUSEL_TOPIC_MAX, CAROUSEL_TOPIC_MIN,
 *   CAROUSEL_SOURCE_THRESHOLD, long input, source material
 *
 * WHAT:  How much someone may paste, and the point at which what they pasted is
 *        treated as SOURCE MATERIAL rather than as a brief.
 * WHY:   The ceiling was 1000, which rejected the most common real input this
 *        feature has: an existing post, a newsletter section, a page of notes.
 *        Someone pasting a draft they already wrote got a validation error rather
 *        than a deck, which is the opposite of what the feature is for.
 *
 *        12000 is a bound, not a comfort limit — roughly a long article. It exists
 *        because the topic is interpolated into a prompt, and an unbounded paste is
 *        an unbounded bill and an unbounded latency on a call that holds a database
 *        transaction open.
 *
 *        The THRESHOLD is the interesting number. Below it, the text is an idea the
 *        model develops; above it, the text already contains the argument and the
 *        model's job is to find the strongest one in it and cut everything else.
 *        Those are different instructions, and giving a pasted article the "develop
 *        this idea" prompt produces a deck that summarises section by section —
 *        the exact failure the spec's summarise-or-split line is about.
 * WHERE: generateCarouselSchema; the branch in generateCarouselSlides; the hint in
 *        the generate form.
 */
export const CAROUSEL_TOPIC_MAX = 12000;
export const CAROUSEL_TOPIC_MIN = 10;
export const CAROUSEL_SOURCE_THRESHOLD = 600;

/* Ceilings for the optional slots, set by the same rule as the two above: the
 * point at which the block overflows its box rather than wrapping. A bullet is
 * capped far shorter than a body because a flow list is read as a glance — five
 * long bullets is a paragraph wearing a list's clothes. */
export const CAROUSEL_EYEBROW_MAX = 60;
export const CAROUSEL_BULLET_MAX = 80;
export const CAROUSEL_MAX_BULLETS = 5;
export const CAROUSEL_CALLOUT_MAX = 200;
export const CAROUSEL_CTA_LABEL_MAX = 40;
export const CAROUSEL_NOTE_MAX = 80;

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

  /* ---------------------------------------------------------------------
   * Optional slots. EVERY ONE carries a default, and that is not a style
   * choice — it is what keeps existing decks openable.
   *
   * parseCarouselSlides runs this schema on EVERY read. Every deck written
   * before these slots existed holds only { kind, heading, body }, so a single
   * required field here would make those decks fail to parse — which is not a
   * deck that renders plainly, it is a deck the user can no longer OPEN.
   * Defaults rather than `.optional()` for the reason already documented on
   * `body`: the renderer and the editor never branch on nullish.
   *
   * A layout decides which of these it draws; a blueprint decides which the
   * model is asked to fill. A slide carrying a slot its template ignores is
   * harmless, which is what makes switching template safe.
   * ------------------------------------------------------------------- */

  /** Small label above the headline — the deck's category or promise. */
  eyebrow: z.string().trim().max(CAROUSEL_EYEBROW_MAX).default(""),
  /** Short steps or key points. A flow list, not a paragraph broken up. */
  bullets: z
    .array(z.string().trim().min(1).max(CAROUSEL_BULLET_MAX))
    .max(CAROUSEL_MAX_BULLETS)
    .default([]),
  /** A boxed aside — the one line that would be quoted out of the slide. */
  callout: z.string().trim().max(CAROUSEL_CALLOUT_MAX).default(""),
  /** Pill text. The ask, in two or three words. */
  ctaLabel: z.string().trim().max(CAROUSEL_CTA_LABEL_MAX).default(""),
  /** A handwritten-looking margin annotation. */
  note: z.string().trim().max(CAROUSEL_NOTE_MAX).default(""),

  /**
   * A generated illustration for this slide.
   *
   * `.optional()` rather than defaulted, and the difference carries meaning here
   * where it did not for the text slots: an empty string is a slot nobody filled,
   * but there is no empty IMAGE — absence is the only way to say "this slide has
   * none", and a default would have to invent a reference pointing at nothing.
   *
   * Reuses postImageSchema rather than declaring a second ImageKit reference
   * shape, which is the same call designDocSchema.images makes — and it means the
   * renderer can hand this straight to the image pipeline.
   */
  illustration: postImageSchema.optional(),
});
export type CarouselSlide = z.infer<typeof carouselSlideSchema>;

/**
 * SOURCE OF TRUTH KEYWORDS: createEmptyCarouselSlide, add slide, empty slot
 *
 * WHAT:  A blank slide of a given kind, with every slot present and empty.
 * WHY:   The editor's "add slide" cannot go through carouselSlideSchema.parse to
 *        pick up the defaults, because `heading` is `.min(1)` and a new slide is
 *        deliberately headless — that is what blocks Save until someone writes one.
 *        So the empty shape is declared ONCE, here beside the schema, rather than
 *        spelled out at the call site where adding a slot would silently miss it.
 * WHERE: slide-editor's add action. Duplicate spreads an existing slide instead.
 */
export function createEmptyCarouselSlide(
  kind: CarouselSlideKind,
): CarouselSlide {
  return {
    kind,
    heading: "",
    body: "",
    eyebrow: "",
    bullets: [],
    callout: "",
    ctaLabel: "",
    note: "",
  };
}

export const carouselSlidesSchema = z
  .array(carouselSlideSchema)
  .min(CAROUSEL_MIN_SLIDES, `A carousel needs at least ${CAROUSEL_MIN_SLIDES} slides`)
  .max(CAROUSEL_MAX_SLIDES, `A carousel can hold at most ${CAROUSEL_MAX_SLIDES} slides`);
export type CarouselSlides = z.infer<typeof carouselSlidesSchema>;

/**
 * SOURCE OF TRUTH KEYWORDS: carouselSlideKindOptionsFor, CarouselSlideKind,
 *   slide kind by position, cover, cta
 *
 * WHAT:  Which kinds a slide at this position is allowed to be.
 * WHY:   Kind is a POSITION ROLE, not a free label. CarouselSlideView keys its
 *        whole layout off it: a cover justifies to flex-end, drops the counter and
 *        the progress rule, and draws at coverHeading size — so a cover at
 *        position five is a mid-deck slide with no position indicator and a hole in
 *        the deck's spine. A cta inverts to the accent field, so one mid-deck makes
 *        the deck read as ending early.
 *
 *        cover is therefore offered ONLY at position one, because it is the one
 *        kind whose layout assumes its position. cta mid-deck stays legal: a
 *        mid-deck ask is a real editorial choice and it degrades into a styled
 *        slide, not a broken one.
 * WHERE: The slide editor's kind control, to scope its options per card.
 */
export function carouselSlideKindOptionsFor(
  index: number,
  total: number,
): readonly CarouselSlideKind[] {
  if (index === 0) return ["cover"];
  if (index === total - 1) return ["cta"];
  return ["content", "cta"];
}

/**
 * SOURCE OF TRUTH KEYWORDS: normalizeCarouselSlideKinds, slide kind invariant,
 *   reorder, cover, cta, auto-correct
 *
 * WHAT:  Forces the deck's endpoints back into their roles — first slide is the
 *        cover, last is the cta, and no other slide is a cover.
 * WHY:   Run after every structural change (drag, arrows, add, duplicate, delete),
 *        because the alternative is a deck whose first slide renders "01 / 07"
 *        where the hook belongs. It also keeps the POSITIONAL readers honest:
 *        carouselDocumentTitle takes slides[0].heading as the deck's public name
 *        and the publish dialog seeds its commentary from the same slide.
 *
 *        Deliberately NOT a refine on carouselSlidesSchema. That schema is the
 *        READ path — parseCarouselSlides runs on every getCarousel — so a
 *        positional rule there would make an older or hand-edited deck impossible
 *        to OPEN, which is strictly worse than one that renders oddly. It is also
 *        the model-output schema, so the same rule would turn a model slip into a
 *        hard generation failure instead of this one-line correction.
 * WHERE: The slide editor, after every reorder or insert. The correction is
 *        announced in the editor's live region so it is never silent.
 */
export function normalizeCarouselSlideKinds(
  slides: CarouselSlides,
): CarouselSlides {
  const lastIndex = slides.length - 1;

  return slides.map((slide, index) => {
    /* First wins the cover when a deck is somehow one slide long, so the two
     * branches can never both claim the same card. */
    const kind: CarouselSlideKind =
      index === 0
        ? "cover"
        : index === lastIndex
          ? "cta"
          : slide.kind === "cover"
            ? "content"
            : slide.kind;

    return kind === slide.kind ? slide : { ...slide, kind };
  });
}

/**
 * SOURCE OF TRUTH KEYWORDS: CAROUSEL_SLOT_KEYS, CarouselSlotKey,
 *   CarouselBlueprintStep, CarouselBlueprint, expandCarouselBlueprint,
 *   narrative arc, slide job
 *
 * WHAT:  The vocabulary a template uses to say what each slide is FOR and which
 *        slots the model should fill on it.
 * WHY:   A template used to vary only the palette, so every deck was seven
 *        interchangeable paragraphs. A blueprint makes the template an argument
 *        structure: slide three knows it is the mechanism slide, and asks for the
 *        slots that carry a mechanism. That is the difference between a deck that
 *        was generated and one that reads as though it was authored.
 *
 *        Slots are named rather than free-form so the blueprint, the layout and
 *        the schema cannot disagree about what a slide can hold — adding a slot is
 *        one entry in this tuple and a type error everywhere it must be handled.
 *
 *        The types live here and the DATA lives in lib/config/carousel-blueprints,
 *        which is the split CLAUDE.md asks for. (StudioTemplate and DesignArchetype
 *        keep their interfaces beside their data; that is the older convention and
 *        this file does not extend it.)
 * WHERE: CAROUSEL_BLUEPRINTS in lib/config; the generation prompt in ai.service;
 *        the layouts in lib/config/carousel-layouts.
 */
export const CAROUSEL_SLOT_KEYS = [
  "eyebrow",
  "heading",
  "body",
  "bullets",
  "callout",
  "ctaLabel",
  "note",
] as const;
export type CarouselSlotKey = (typeof CAROUSEL_SLOT_KEYS)[number];

export interface CarouselBlueprintStep {
  /** What this slide must accomplish, phrased as an instruction to the writer. */
  readonly job: string;
  readonly kind: CarouselSlideKind;
  /** Which slots the model is asked to fill. A layout may still draw fewer. */
  readonly slots: readonly CarouselSlotKey[];
}

export interface CarouselBlueprint {
  readonly label: string;
  /** A directive paragraph — how this template sounds, not what it looks like. */
  readonly voice: string;
  readonly cover: CarouselBlueprintStep;
  /* Cycled to fill whatever deck length the user asked for. A blueprint states an
   * ARC, not a length: pinning the step count would make slideCount a lie. */
  readonly middle: readonly CarouselBlueprintStep[];
  readonly cta: CarouselBlueprintStep;
}

/**
 * SOURCE OF TRUTH KEYWORDS: expandCarouselBlueprint
 *
 * WHAT:  Stretches an arc to the requested deck length.
 * WHY:   Cycles the middle steps rather than truncating, so a 12-slide deck keeps
 *        the whole argument instead of stopping after the arc runs out — and a
 *        5-slide deck still opens and closes correctly, because the cover and cta
 *        are never drawn from the cycle.
 */
export function expandCarouselBlueprint(
  blueprint: CarouselBlueprint,
  slideCount: number,
): readonly CarouselBlueprintStep[] {
  const middleCount = Math.max(slideCount - 2, 0);
  const middle = Array.from({ length: middleCount }, (_, index) => {
    const step = blueprint.middle[index % blueprint.middle.length];
    /* noUncheckedIndexedAccess: middle is never empty by construction, but the
     * fallback keeps that a local guarantee rather than an assertion. */
    return step ?? blueprint.cover;
  });

  return [blueprint.cover, ...middle, blueprint.cta];
}

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

/**
 * SOURCE OF TRUTH KEYWORDS: carouselDraftSchema, CarouselDraftValues,
 *   editing buffer, isDirty, templateId, pagePreset
 *
 * WHAT:  Everything the editor holds as unsaved work — the slides AND the look.
 * WHY:   The editing buffer used to be the slide array alone, which meant
 *        `isDirty` could not see a template change: Save stayed disabled while
 *        Render stayed enabled, so one click produced a PDF of the OLD template.
 *        Making the buffer one object is what collapses the dirty check back to a
 *        single comparison that cannot miss a field.
 *
 *        Declared here rather than derived as `updateCarouselSchema.omit({id})`,
 *        and that is deliberate: update's templateId and page are `.optional()`
 *        because a save may be slides-only, whereas a draft is ALWAYS fully
 *        populated from the row. Under exactOptionalPropertyTypes an omit-derived
 *        type would keep them optional and re-open exactly the hole above.
 * WHERE: carousel-workspace holds one of these per open deck; slide-editor reads
 *        it and the preview payload is built from it.
 */
export const carouselDraftSchema = z.object({
  slides: carouselSlidesSchema,
  templateId: carouselTemplateSchema,
  page: carouselPagePresetSchema,
});
export type CarouselDraftValues = z.infer<typeof carouselDraftSchema>;

export const renderCarouselSchema = z.object({
  id: z.string().min(1),
});
export type RenderCarouselValues = z.infer<typeof renderCarouselSchema>;

/**
 * SOURCE OF TRUTH KEYWORDS: carouselSlidePreviewSchema, CarouselSlidePreviewValues,
 *   preview payload, debounce dependency, index, total
 *
 * WHAT:  The body POSTed to /api/carousel/preview — one slide, drawn in its deck's
 *        context.
 * WHY:   ONE SLIDE, not the whole deck. This payload is the preview's debounce
 *        dependency, so a deck-shaped body would re-render slide one every time a
 *        character lands in slide nine and throw the identical bytes away — a
 *        wasted satori pass per keystroke. These fields are exactly the inputs that
 *        change the drawn pixels: the slide itself, the deck length that feeds the
 *        counter and the progress rule, and the template and shape.
 *
 *        `index < total` is the one invariant a per-slide payload loses, so the
 *        refine buys it back. Without it a client could send index 8 of total 5 and
 *        get a counter reading "09 / 05" over a progress bar past 100%.
 *
 *        The route draws UNTRUSTED input, and it runs outside the procedure
 *        factory — no quota, no rate limit. These caps, inherited from
 *        carouselSlideSchema, are therefore the real bound on the renderer.
 * WHERE: Parsed by src/app/api/carousel/preview/route.ts; built by the carousel
 *        slide preview component from the editing draft.
 */
/**
 * SOURCE OF TRUTH KEYWORDS: generateCarouselIllustrationSchema,
 *   GenerateCarouselIllustrationValues, illustration brief
 *
 * WHAT:  Input to carouselIllustration.create — what the image should show.
 * WHY:   A BRIEF, not a slide id. The endpoint generates and stores an image and
 *        hands the reference back; it never touches the deck. The client writes it
 *        onto the slide and saves through carousel.update, so an illustration the
 *        member does not like is never persisted — the contract studioBackdrop
 *        already establishes, and the reason a rejected generation costs a quota
 *        slot but never corrupts a deck.
 *
 *        Capped short on purpose: this is a subject, not a prompt. The rules that
 *        make an illustration usable on a slide — no text, leave room for type —
 *        belong in the service beside the model call, where a member cannot
 *        accidentally override them.
 * WHERE: The illustrate control in the slide editor.
 */
export const generateCarouselIllustrationSchema = z.object({
  brief: z
    .string()
    .trim()
    .min(3, "Say what the illustration should show")
    .max(300, "Keep the brief under 300 characters"),
});
export type GenerateCarouselIllustrationValues = z.infer<
  typeof generateCarouselIllustrationSchema
>;

export const carouselSlidePreviewSchema = z
  .object({
    slide: carouselSlideSchema,
    index: z.number().int().min(0).max(CAROUSEL_MAX_SLIDES - 1),
    total: z.number().int().min(CAROUSEL_MIN_SLIDES).max(CAROUSEL_MAX_SLIDES),
    templateId: carouselTemplateSchema,
    page: carouselPagePresetSchema,
  })
  .refine((value) => value.index < value.total, {
    message: "A slide cannot sit past the end of its deck",
    path: ["index"],
  });
export type CarouselSlidePreviewValues = z.infer<
  typeof carouselSlidePreviewSchema
>;

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
  /* Capped because it becomes a `contains` the database has to interpret, and an
   * unbounded term is a free table scan — the bound listLibraryPostsSchema sets
   * on the post library's search for the same reason. Filtering happens HERE
   * rather than on the returned page: the client-side filter this replaced left
   * the row count and the server's total disagreeing, so a search could render no
   * rows under "Page 1 of 4". */
  search: z.string().trim().max(200).optional(),
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

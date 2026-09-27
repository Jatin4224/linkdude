/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: DESIGN_CANVAS_KEYS, DesignCanvasKey,
 *   designCanvasSchema, DESIGN_CANVAS_PRESETS, DesignCanvasPreset,
 *   DesignSafeZone, DESIGN_COLOR_SLOTS, DesignColorSlot, designColorSlotSchema,
 *   designHexSchema, designColorRefSchema, DesignColorRef,
 *   DESIGN_TEXT_ROLES, DesignTextRole, DESIGN_COMPUTED_VALUES,
 *   designTextRefSchema, DesignTextRef, designBlockSchema, DesignBlock,
 *   designLeafBlockSchema, DesignLeafBlock, designLayoutOverrideSchema,
 *   DesignLayoutOverride, designBackgroundSchema, DesignBackground,
 *   designDocSchema, DesignDoc, DesignDocInput, DESIGN_MAX_BLOCKS,
 *   slotsUsedBy, DESIGN_PATTERNS, DesignPattern, designPatternSchema,
 *   block language, design studio, satori element tree
 *
 * WHAT:  The declarative block language a studio design is authored in, and the
 *        document shape that gets stored on StudioAsset.doc.
 * WHY:   Templates are DATA, not code. Before this file, adding a design cost
 *        "a config entry plus a renderer branch" (see CAROUSEL_TEMPLATES in
 *        ./carousel) — which does not reach twenty templates. One generic
 *        renderer walks these blocks, so template twenty-one costs a config
 *        object and no render code at all.
 *
 *        Three properties are load-bearing and easy to break later:
 *
 *        1. A template CANNOT contain a colour literal. Blocks name a palette
 *           SLOT; the only hex in the language is a user override. That is what
 *           lets one archetype serve every palette, and it is enforced by the
 *           schema having nowhere to put a hex.
 *        2. Text is a three-way reference — user slot, fixed decoration, or
 *           COMPUTED. The third member is what makes a carousel slide
 *           expressible ("03 / 08" is neither), so phase 5 of docs/20-studio.md
 *           is a pure function rather than a data migration.
 *        3. `group` nests exactly one level. `children` is typed as the LEAF
 *           union, so there is no z.lazy(), no recursive type, and no unbounded
 *           render depth. Every layout in research/design/profile-editor fits.
 * WHERE: Stored as StudioAsset.doc and re-parsed on read by
 *        src/services/studio.service.ts; walked by
 *        src/services/design-render.service.tsx; authored in
 *        src/lib/config/design-archetypes.ts.
 */

import { z } from "zod";

import { CAROUSEL_PAGE_PRESETS } from "./carousel";
import { IMAGE_ASPECT_PRESETS, postImageSchema } from "./imagekit";

/**
 * SOURCE OF TRUTH KEYWORDS: DESIGN_CANVAS_KEYS, DesignCanvasKey, designCanvasSchema
 *
 * WHAT:  Every geometry this renderer can draw.
 * WHY:   The carousel members exist from day one even though nothing renders
 *        them yet. They are what makes phase 5 a re-point rather than a rewrite,
 *        and declaring them now costs two tuple entries.
 */
export const DESIGN_CANVAS_KEYS = [
  "linkedinBanner",
  "headshot",
  "featuredCover",
  "companyBanner",
  "carouselPortrait",
  "carouselSquare",
] as const;
export const designCanvasSchema = z.enum(DESIGN_CANVAS_KEYS);
export type DesignCanvasKey = (typeof DESIGN_CANVAS_KEYS)[number];

/**
 * SOURCE OF TRUTH KEYWORDS: DesignSafeZone
 *
 * WHAT:  A region of the canvas the user should keep clear, drawn as a guide in
 *        the editor and never rendered into the exported file.
 * WHY:   Normalised 0-1 rather than pixels so ONE set of numbers positions both
 *        the 1584px render and the ~700px DOM overlay sitting on top of it.
 *        Pixels would desynchronise the moment the editor column resized.
 */
export interface DesignSafeZone {
  readonly id: string;
  readonly label: string;
  readonly shape: "circle" | "rect";
  /** Circle: centre. Rect: top-left corner. */
  readonly x: number;
  readonly y: number;
  /** Circle: `width` is the diameter and `height` is ignored. */
  readonly width: number;
  readonly height: number;
}

export interface DesignCanvasPreset {
  readonly label: string;
  readonly width: number;
  readonly height: number;
  readonly safeZones: readonly DesignSafeZone[];
}

/**
 * SOURCE OF TRUTH KEYWORDS: DESIGN_CANVAS_PRESETS
 *
 * WHAT:  Pixel geometry per canvas, plus the editor's guide regions.
 * WHY:   Dimensions, not ratios — the renderer rasterises at exactly these
 *        numbers, the same contract CAROUSEL_PAGE_PRESETS states.
 *
 *        Sizes are REUSED rather than re-typed wherever one already exists in
 *        this codebase: IMAGE_ASPECT_PRESETS.linkedin is already 1200x627, and
 *        the carousel rows spread their existing preset so phase 5 cannot drift
 *        by a pixel from what ships today.
 *
 *        NOTE the featured and company sizes do NOT come from
 *        research/figma-profile-kit — that kit labels every featured frame
 *        "1584 x 396px", which is a copy-paste error repeated twenty-two times.
 *        They come from the export mockup.
 */
export const DESIGN_CANVAS_PRESETS = {
  linkedinBanner: {
    label: "Profile banner",
    width: 1584,
    height: 396,
    safeZones: [
      /* MEASURED against a real LinkedIn profile, not eyeballed. The centre was
       * close on the first pass; the DIAMETER was half what it should be, which
       * is the error that mattered — a guide promising more clear space than the
       * avatar actually takes is worse than no guide, because people trust it and
       * put the thing they care about underneath their own face. */
      {
        id: "avatar",
        label: "Profile photo safe zone",
        shape: "circle",
        x: 0.133,
        y: 0.89,
        /* Diameter as a fraction of WIDTH; the height twin is the same length
         * expressed against the 4:1 canvas, which is why the two differ. */
        width: 0.198,
        height: 0.792,
      },
      {
        id: "mobileCrop",
        /* Still an estimate — LinkedIn crops the cover on narrow viewports, but
         * the exact fraction has not been measured the way the avatar now has.
         * Treat it as a hint rather than a boundary. */
        label: "Tight on mobile",
        shape: "rect",
        x: 0,
        y: 0,
        width: 0.14,
        height: 1,
      },
    ],
  },
  headshot: {
    label: "Headshot",
    width: 400,
    height: 400,
    safeZones: [],
  },
  featuredCover: {
    label: "Featured cover",
    width: IMAGE_ASPECT_PRESETS.linkedin.width,
    height: IMAGE_ASPECT_PRESETS.linkedin.height,
    safeZones: [],
  },
  companyBanner: {
    label: "Company page banner",
    width: 1128,
    height: 191,
    safeZones: [],
  },
  carouselPortrait: {
    label: CAROUSEL_PAGE_PRESETS.portrait.label,
    width: CAROUSEL_PAGE_PRESETS.portrait.width,
    height: CAROUSEL_PAGE_PRESETS.portrait.height,
    safeZones: [],
  },
  carouselSquare: {
    label: CAROUSEL_PAGE_PRESETS.square.label,
    width: CAROUSEL_PAGE_PRESETS.square.width,
    height: CAROUSEL_PAGE_PRESETS.square.height,
    safeZones: [],
  },
} as const satisfies Record<DesignCanvasKey, DesignCanvasPreset>;

/**
 * SOURCE OF TRUTH KEYWORDS: DESIGN_COLOR_SLOTS, DesignColorSlot, designHexSchema
 *
 * WHAT:  The five colour roles a design can name, and the only place a literal
 *        colour is legal.
 * WHY:   Five, matching the carousel palette, and for the reason stated there: a
 *        template needing a sixth is a template doing too much.
 *
 *        Six-digit sRGB hex ONLY. satori has no CSS runtime and cannot parse
 *        oklch(), which is how every theme token in this app is authored — a
 *        colour it cannot parse draws nothing, silently, which is the worst
 *        failure this renderer has.
 */
export const DESIGN_COLOR_SLOTS = [
  "background",
  "foreground",
  "muted",
  "border",
  "accent",
] as const;
export const designColorSlotSchema = z.enum(DESIGN_COLOR_SLOTS);
export type DesignColorSlot = (typeof DESIGN_COLOR_SLOTS)[number];

export const designHexSchema = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, "Colours must be six-digit sRGB hex, like #0A66C2");

/**
 * SOURCE OF TRUTH KEYWORDS: designColorRefSchema, DesignColorRef
 *
 * WHAT:  How a block points at a colour: a slot, optionally softened.
 * WHY:   `opacity` rather than an eight-digit hex, because satori's colour
 *        parser is not CSS Color 4 — the renderer resolves this to rgba().
 */
export const designColorRefSchema = z.object({
  slot: designColorSlotSchema,
  opacity: z.number().min(0).max(1).default(1),
});
export type DesignColorRef = z.infer<typeof designColorRefSchema>;

/**
 * SOURCE OF TRUTH KEYWORDS: DESIGN_TEXT_ROLES, DesignTextRole
 *
 * WHAT:  What size a piece of text is, named by intent rather than by pixels.
 * WHY:   The role indexes DESIGN_TYPE_SCALE, which has one row per geometry. A
 *        separate block type per size would be several renderer branches that
 *        differ only by a number — the mistake CarouselSlideView's `slide.kind`
 *        branching made, and the reason this file exists.
 */
export const DESIGN_TEXT_ROLES = [
  "display",
  "heading",
  "subheading",
  "body",
  "meta",
] as const;
export const designTextRoleSchema = z.enum(DESIGN_TEXT_ROLES);
export type DesignTextRole = (typeof DESIGN_TEXT_ROLES)[number];

/**
 * SOURCE OF TRUTH KEYWORDS: DESIGN_TEXT_SLOT_KEYS, DesignTextSlotKey
 *
 * WHAT:  Every named hole a user's words can go into.
 * WHY:   The tuple lives here with the language; the LABELS, placeholders and
 *        per-slot character ceilings live in lib/config/design-slots, because
 *        those are editorial and this file is structural. The editor's form is
 *        generated from whichever of these an archetype actually uses, which is
 *        why a new template costs no UI code.
 */
export const DESIGN_TEXT_SLOT_KEYS = [
  "eyebrow",
  "headline",
  "subheadline",
  "body",
  "ctaLabel",
  "proofA",
  "proofB",
  "proofC",
  "name",
  "role",
  "handle",
  "quote",
  "attribution",
  "footnote",
  "logoText",
  /* Lines in a list, NOT badges. Split from proofA–C after the stacked layout
   * reused those chip slots as full lines and inherited their 24-character
   * ceiling — so its own sample copy was over the limit and the design could not
   * be saved. A slot's ceiling belongs to the VISUAL ROLE it fills, so two roles
   * need two slots even when both hold a short phrase. */
  "pointA",
  "pointB",
  "pointC",
  /* D and E exist for carousel slides, which carry a flow list — "attention →
   * trust → authority → clients" is four steps, and three slots cannot hold it.
   * No studio archetype references them, so they cost that feature nothing. */
  "pointD",
  "pointE",
] as const;
export const designTextSlotSchema = z.enum(DESIGN_TEXT_SLOT_KEYS);
export type DesignTextSlotKey = (typeof DESIGN_TEXT_SLOT_KEYS)[number];

export const DESIGN_IMAGE_SLOT_KEYS = ["photo", "logo", "backdrop"] as const;
export const designImageSlotSchema = z.enum(DESIGN_IMAGE_SLOT_KEYS);
export type DesignImageSlotKey = (typeof DESIGN_IMAGE_SLOT_KEYS)[number];

/**
 * SOURCE OF TRUTH KEYWORDS: DESIGN_COMPUTED_VALUES, DesignComputedValue
 *
 * WHAT:  Text the RENDERER supplies, which is neither the user's nor the
 *        template's.
 * WHY:   This is the member that makes phase 5 cheap. A carousel slide's
 *        "03 / 08" counter and its progress bar are computed from the deck, so
 *        without this the block language could express a banner but not a slide,
 *        and unifying the two renderers would need a second mechanism bolted on
 *        later. Two entries today, and they are the whole reason.
 */
export const DESIGN_COMPUTED_VALUES = ["slideCounter", "deckProgress"] as const;
export const designComputedValueSchema = z.enum(DESIGN_COMPUTED_VALUES);
export type DesignComputedValue = (typeof DESIGN_COMPUTED_VALUES)[number];

/** A ceiling on template-owned decoration. Not a user-facing limit. */
export const DESIGN_FIXED_TEXT_MAX = 80;

/**
 * SOURCE OF TRUTH KEYWORDS: designTextRefSchema, DesignTextRef
 *
 * WHAT:  Where a block's words come from.
 * WHY:   `hideWhenEmpty` is what lets ONE archetype serve a template that shows
 *        a proof strip and one that does not — the block collapses instead of
 *        drawing an empty pill. Without it, "same layout minus the badges" would
 *        be a second archetype.
 */
export const designTextRefSchema = z.discriminatedUnion("source", [
  z.object({
    source: z.literal("slot"),
    slot: designTextSlotSchema,
    hideWhenEmpty: z.boolean().default(true),
  }),
  z.object({
    source: z.literal("fixed"),
    text: z.string().trim().max(DESIGN_FIXED_TEXT_MAX),
  }),
  z.object({
    source: z.literal("computed"),
    value: designComputedValueSchema,
  }),
]);
export type DesignTextRef = z.infer<typeof designTextRefSchema>;

/**
 * SOURCE OF TRUTH KEYWORDS: designLayoutOverrideSchema, DesignLayoutOverride
 *
 * WHAT:  A per-block nudge away from the template's own placement.
 * WHY:   Normalised fractions of the canvas, never pixels: the editor previews a
 *        1584-wide banner inside a ~700px column, and a pixel offset would
 *        desynchronise from the render the instant that column resized.
 *
 *        STORED AND IGNORED until the drag editor lands (phase 4 of
 *        docs/20-studio.md). Settling the field shape now is the entire point —
 *        it is the thing that is expensive to change once rows exist.
 *
 *        `.prefault` rather than `.default`: in zod v4 a `.default(value)` is
 *        returned VERBATIM without being parsed, so `.default({})` would hand
 *        the renderer `{}` and `dx` would read undefined. `.prefault({})` runs
 *        the object through its own field defaults and yields a complete value.
 *        Verified against zod 4.4.3, not assumed.
 */
export const designLayoutOverrideSchema = z
  .object({
    dx: z.number().min(-1).max(1).default(0),
    dy: z.number().min(-1).max(1).default(0),
    scale: z.number().min(0.25).max(4).default(1),
    z: z.number().int().min(0).max(99).default(0),
  })
  .prefault({});
export type DesignLayoutOverride = z.infer<typeof designLayoutOverrideSchema>;

/* Every block carries these. `id` is human-authored in the archetype and stable,
 * because the Layers list, the selection overlay and the layout override all
 * address a block by it. */
const designBlockBase = {
  id: z.string().min(1).max(40),
  hidden: z.boolean().default(false),
  layout: designLayoutOverrideSchema,
};

const designTextBlockSchema = z.object({
  ...designBlockBase,
  type: z.literal("text"),
  text: designTextRefSchema,
  role: designTextRoleSchema,
  weight: z.union([z.literal(400), z.literal(700)]).default(400),
  color: designColorRefSchema,
  align: z.enum(["left", "center", "right"]).default("left"),
  transform: z.enum(["none", "uppercase"]).default("none"),
  /* Renders as -webkit-line-clamp. The ONE place the renderer must not emit
   * `display: flex` — see the note in design-render.service. */
  maxLines: z.number().int().min(1).max(6).default(3),
  letterSpacing: z.number().min(-4).max(12).default(0),
  /* Absolute px, overriding the role's entry in DESIGN_TYPE_SCALE.
   *
   * OPTIONAL rather than defaulted, and the distinction carries meaning: unset
   * means "whatever this geometry says a heading is", so one archetype still
   * scales correctly across a 396px banner and a 1350px slide. A number means
   * the member overrode it and their choice must survive a canvas change. */
  fontSize: z.number().int().min(8).max(200).optional(),
  lineHeight: z.number().min(0.8).max(2.5).optional(),
});

const designBadgeRowBlockSchema = z.object({
  ...designBlockBase,
  type: z.literal("badgeRow"),
  /* Four is the ceiling because a proof strip is a glance, not a list — and
   * because this block multiplies nodes, it is also the render-bomb cap for a
   * preview drawn from unsaved client input. */
  items: z.array(designTextRefSchema).min(1).max(4),
  fill: designColorRefSchema,
  label: designColorRefSchema,
  border: designColorRefSchema.optional(),
  role: designTextRoleSchema.default("meta"),
  gap: z.number().int().min(0).max(64).default(12),
  radius: z.number().int().min(0).max(999).default(999),
});

const designButtonPillBlockSchema = z.object({
  ...designBlockBase,
  type: z.literal("buttonPill"),
  label: designTextRefSchema,
  fill: designColorRefSchema,
  labelColor: designColorRefSchema,
  role: designTextRoleSchema.default("body"),
  radius: z.number().int().min(0).max(999).default(999),
  paddingX: z.number().int().min(0).max(160).default(36),
  paddingY: z.number().int().min(0).max(120).default(18),
});

const designLogoTextBlockSchema = z.object({
  ...designBlockBase,
  type: z.literal("logoText"),
  text: designTextRefSchema,
  mark: z.enum(["none", "square", "circle"]).default("none"),
  markFill: designColorRefSchema,
  color: designColorRefSchema,
  role: designTextRoleSchema.default("meta"),
});

const designImageBlockSchema = z.object({
  ...designBlockBase,
  type: z.literal("image"),
  slot: designImageSlotSchema,
  fit: z.enum(["cover", "contain"]).default("cover"),
  /* Normalised against the canvas, like every other geometry in this language,
   * so one archetype scales across the four asset sizes. */
  width: z.number().min(0).max(1).default(0.2),
  height: z.number().min(0).max(1).default(0.6),
  radius: z.number().int().min(0).max(999).default(0),
  ringWidth: z.number().int().min(0).max(40).default(0),
  ringColor: designColorRefSchema.optional(),
});

const designShapeBlockSchema = z.object({
  ...designBlockBase,
  type: z.literal("shape"),
  shape: z.enum(["rect", "circle"]),
  /* A shape whose width is computed is how a carousel progress bar is expressed
   * without a renderer branch. */
  width: z.union([z.number().min(0).max(1), designComputedValueSchema]).default(1),
  height: z.number().min(0).max(1).default(0.01),
  fill: designColorRefSchema,
  radius: z.number().int().min(0).max(999).default(0),
});

const designDividerBlockSchema = z.object({
  ...designBlockBase,
  type: z.literal("divider"),
  thickness: z.number().int().min(1).max(24).default(2),
  length: z.number().min(0).max(1).default(1),
  color: designColorRefSchema,
});

const designSpacerBlockSchema = z.object({
  ...designBlockBase,
  type: z.literal("spacer"),
  size: z.number().int().min(0).max(400).default(24),
});

/* The leaf variants, as a tuple, so the same list builds both unions below and
 * a new block type cannot be added to one and forgotten in the other. */
const DESIGN_LEAF_VARIANTS = [
  designTextBlockSchema,
  designBadgeRowBlockSchema,
  designButtonPillBlockSchema,
  designLogoTextBlockSchema,
  designImageBlockSchema,
  designShapeBlockSchema,
  designDividerBlockSchema,
  designSpacerBlockSchema,
] as const;

/**
 * SOURCE OF TRUTH KEYWORDS: designLeafBlockSchema, DesignLeafBlock
 *
 * WHAT:  Everything that can sit inside a group.
 * WHY:   Named separately so `group.children` is typed as leaves only. That is
 *        what keeps the language non-recursive: no z.lazy(), no self-referential
 *        TypeScript, and a render depth bounded at two by construction.
 */
export const designLeafBlockSchema = z.discriminatedUnion(
  "type",
  DESIGN_LEAF_VARIANTS,
);
export type DesignLeafBlock = z.infer<typeof designLeafBlockSchema>;

const designGroupBlockSchema = z.object({
  ...designBlockBase,
  type: z.literal("group"),
  direction: z.enum(["row", "column"]).default("row"),
  gap: z.number().int().min(0).max(120).default(16),
  align: z.enum(["start", "center", "end"]).default("center"),
  children: z.array(designLeafBlockSchema).min(1).max(6),
});

export const designBlockSchema = z.discriminatedUnion("type", [
  ...DESIGN_LEAF_VARIANTS,
  designGroupBlockSchema,
]);
export type DesignBlock = z.infer<typeof designBlockSchema>;
/* The INPUT half, which is what an archetype is authored in: every defaulted
 * field is optional on the way in and guaranteed on the way out. Exported so
 * config/design-archetypes can type its literals without restating them — the
 * same input/output split GenerateCarouselInput draws for react-hook-form. */
export type DesignBlockInput = z.input<typeof designBlockSchema>;

/**
 * SOURCE OF TRUTH KEYWORDS: DESIGN_PATTERNS, DesignPattern, designPatternSchema
 *
 * WHAT:  The decorative fields a design can sit on, drawn rather than generated.
 * WHY:   THE SET IS CHOSEN BY WHAT SATORI ACTUALLY RASTERISES. It documents
 *        `repeating-linear-gradient` as supported, but vercel/satori#554 reports
 *        it silently failing when the output is PNG — which is every render here.
 *        `glow` and `fade` are therefore plain radial and linear gradients, and
 *        `grid` is drawn as nodes because no non-repeating gradient produces one.
 *
 *        Dots and diagonal stripes were dropped rather than faked: both need
 *        repetition, and a dot field as elements costs hundreds of nodes on a
 *        canvas that re-renders on every keystroke.
 */
export const DESIGN_PATTERNS = ["grid", "glow", "fade"] as const;
export const designPatternSchema = z.enum(DESIGN_PATTERNS);
export type DesignPattern = (typeof DESIGN_PATTERNS)[number];

/**
 * SOURCE OF TRUTH KEYWORDS: designBackgroundSchema, DesignBackground
 *
 * WHAT:  The full-bleed field a design sits on.
 * WHY:   `.prefault` for the same zod-v4 reason as the layout override: a plain
 *        `.default` would store the literal object and leave `opacity`
 *        unfilled, and the renderer resolves rgba() from it.
 */
export const designBackgroundSchema = z
  .discriminatedUnion("kind", [
    z.object({ kind: z.literal("solid"), color: designColorRefSchema }),
    z.object({
      kind: z.literal("gradient"),
      from: designColorRefSchema,
      to: designColorRefSchema,
      angle: z.number().min(0).max(360).default(135),
    }),
    z.object({
      /* A drawn pattern rather than a generated image: crisp at any size, costs
       * no model call and no quota, and — unlike an AI backdrop — is guaranteed
       * not to fight the text for attention. The reference editors all ship one
       * of these ("Grid", waves) as the default, and it is what makes an empty
       * design look composed rather than blank. */
      kind: z.literal("pattern"),
      pattern: designPatternSchema,
      /* The field behind the pattern. */
      color: designColorRefSchema,
      /* The pattern's own ink. Kept as a separate ref rather than derived, so a
       * light pattern on a dark field and the reverse are both expressible. */
      ink: designColorRefSchema,
    }),
    z.object({
      kind: z.literal("image"),
      slot: designImageSlotSchema,
      overlay: designColorRefSchema.optional(),
    }),
  ])
  .prefault({ kind: "solid", color: { slot: "background" } });
export type DesignBackground = z.infer<typeof designBackgroundSchema>;

/**
 * Twenty-four. A ceiling rather than a guess: the richest layout in
 * research/figma-profile-kit uses nine blocks, so this is generous for authored
 * templates while staying a hard cap on a preview rendered from unsaved client
 * input. It is render-bomb mitigation, not decoration.
 */
export const DESIGN_MAX_BLOCKS = 24;

/**
 * SOURCE OF TRUTH KEYWORDS: designDocSchema, DesignDoc, DesignDocInput
 *
 * WHAT:  One rendered asset, whole: which template it came from, how it looks,
 *        and what the user typed into it.
 * WHY:   Stored as Json on StudioAsset.doc and re-parsed through this schema on
 *        every read, the contract Carousel.slides already follows — a Json
 *        column is untyped until something validates it, and that something
 *        belongs here rather than in each caller.
 *
 *        `paletteOverrides` and `images` use z.partialRecord, NOT z.record. In
 *        zod v4 an enum-keyed z.record demands EVERY key, so z.record here would
 *        reject any design that overrides fewer than all five colours — which is
 *        all of them. Verified against zod 4.4.3.
 * WHERE: src/services/studio.service.ts parses it; design-render.service.tsx
 *        walks it; the studio editor form is generated from it.
 */
export const designDocSchema = z.object({
  /* Bumped only if the block language changes shape, so a future reader can
   * DETECT an old document rather than infer it from missing fields. */
  version: z.literal(1).default(1),
  templateId: z.string().min(1).max(60),
  archetypeId: z.string().min(1).max(60),
  canvas: designCanvasSchema,
  paletteId: z.string().min(1).max(60),
  paletteOverrides: z.partialRecord(designColorSlotSchema, designHexSchema).default({}),
  background: designBackgroundSchema,
  /* OPTIONAL, deliberately not defaulted. "Unset" means "use this geometry's own
   * padding from the type scale", which is a different statement from "the user
   * chose 64" — the renderer reads `doc.padding ?? scale.padding`. */
  padding: z.number().int().min(0).max(240).optional(),
  /* A LEFT inset as a fraction of canvas width, on top of padding.
   *
   * Exists because of one platform fact that shapes every banner: LinkedIn drops
   * the profile photo over the lower LEFT of the cover, so anything placed there
   * is covered by the member own face. Every banner in research/figma-profile-kit
   * solves it the same way — the left third is left empty and the composition
   * lives in the right two-thirds.
   *
   * A normalised fraction rather than pixels so one archetype holds across the
   * four canvas sizes, and optional so a canvas with no avatar (a featured cover)
   * simply omits it. */
  insetLeft: z.number().min(0).max(0.8).optional(),
  direction: z.enum(["row", "column"]).default("column"),
  align: z.enum(["left", "center", "right"]).default("left"),
  justify: z.enum(["start", "center", "end", "between"]).default("center"),
  blocks: z.array(designBlockSchema).min(1).max(DESIGN_MAX_BLOCKS),
  /* The user's words. Per-slot ceilings are enforced in lib/config/design-slots,
   * where the labels live, so the editor's counter and the error that blocks
   * submit quote one number on both client and server. */
  content: z.partialRecord(designTextSlotSchema, z.string()).default({}),
  /* Reuses postImageSchema rather than inventing a second ImageKit reference
   * shape — which also means an uploaded headshot inherits the AI-edit revert
   * field for free. */
  images: z.partialRecord(designImageSlotSchema, postImageSchema).default({}),
});
export type DesignDoc = z.infer<typeof designDocSchema>;
/* The INPUT half. Several fields are defaulted, so react-hook-form must be told
 * both types — see the three-argument useForm in the studio editor. */
export type DesignDocInput = z.input<typeof designDocSchema>;

/**
 * SOURCE OF TRUTH KEYWORDS: slotsUsedBy
 *
 * WHAT:  Which text slots a block list actually fills in.
 * WHY:   The editor renders one field per slot a template USES, rather than a
 *        fixed form per template. That is the reason template twenty-one costs
 *        no UI code — and it is here, beside the language, so a new block type
 *        that carries text cannot be added without this being updated.
 * WHERE: The studio content form; the create procedure when seeding placeholders.
 */
export function slotsUsedBy(
  blocks: readonly DesignBlock[],
): readonly DesignTextSlotKey[] {
  const found = new Set<DesignTextSlotKey>();

  const collect = (ref: DesignTextRef): void => {
    if (ref.source === "slot") found.add(ref.slot);
  };

  for (const block of blocks) {
    switch (block.type) {
      case "text":
      case "logoText":
        collect(block.text);
        break;
      case "buttonPill":
        collect(block.label);
        break;
      case "badgeRow":
        block.items.forEach(collect);
        break;
      case "group":
        for (const child of block.children) {
          if (child.type === "text" || child.type === "logoText") collect(child.text);
          else if (child.type === "buttonPill") collect(child.label);
          else if (child.type === "badgeRow") child.items.forEach(collect);
        }
        break;
      default:
        break;
    }
  }

  /* Ordered by the tuple, not by discovery, so the generated form does not
   * reshuffle when a template's block order changes. */
  return DESIGN_TEXT_SLOT_KEYS.filter((key) => found.has(key));
}

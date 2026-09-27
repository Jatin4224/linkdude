/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: CAROUSEL_LAYOUTS, getCarouselLayout, CLASSIC_COVER,
 *   CLASSIC_CONTENT, CLASSIC_CTA, carousel blocks, slide layout, templates as data
 *
 * WHAT:  What each template draws on each kind of slide, as DesignBlock lists.
 * WHY:   These replace the hand-written CarouselSlideView. A slide is now the same
 *        block language a studio design is, drawn by the same renderer — which is
 *        what docs/20-studio.md phase 5 planned, and what the `slideCounter` and
 *        `deckProgress` computed values were added for.
 *
 *        KEYED BY SLIDE KIND, which DesignArchetype.blocks is not — it keys by
 *        canvas only. Rather than widen that interface and disturb studio, the
 *        carousel keeps its own registry over the same vocabulary and the same
 *        renderer. Reuse without coupling: if this ever needs a block type that
 *        does not exist, the fix belongs in the block language, never here.
 *
 *        Every optional slot is drawn with `hideWhenEmpty`, and that single
 *        property is what makes one layout serve two eras of deck: a slide stored
 *        before the extra slots existed parses with them empty, so those blocks
 *        collapse and it renders exactly as it always did. A slide written against
 *        a blueprint fills them and gains the blocks. No branch, no migration.
 *
 *        All three current templates share these lists because they differ only in
 *        PALETTE today — the same product CAROUSEL_TEMPLATES and CAROUSEL_PALETTES
 *        already express. A template with its own composition gets its own arrays;
 *        that is the whole cost of adding one.
 * WHERE: carouselSlideToDesignDoc in services/carousel.service.
 */

import type { DesignBlockInput } from "@/lib/types/design-block";
import type {
  CarouselSlideKind,
  CarouselTemplate,
} from "@/lib/types/carousel";

/* The counter, as "03 / 08". Never on a cover: a cover announcing its own
 * position wastes the one line people actually read in the feed. */
const COUNTER_BLOCK: DesignBlockInput = {
  id: "counter",
  type: "text",
  text: { source: "computed", value: "slideCounter" },
  role: "meta",
  weight: 400,
  color: { slot: "muted" },
  maxLines: 1,
  letterSpacing: 2,
};

/* The spine. A shape whose width is computed — the exact case the block
 * language's own comment cites as why `computed` exists. */
const PROGRESS_BLOCK: DesignBlockInput = {
  id: "progress",
  type: "shape",
  shape: "rect",
  /* The computed value directly — `shape.width` is a union of a fraction and a
   * computed name, not a text ref. */
  width: "deckProgress",
  height: 0.005,
  fill: { slot: "accent" },
};

const EYEBROW_BLOCK: DesignBlockInput = {
  id: "eyebrow",
  type: "text",
  text: { source: "slot", slot: "eyebrow", hideWhenEmpty: true },
  role: "meta",
  weight: 700,
  color: { slot: "accent" },
  transform: "uppercase",
  maxLines: 1,
  /* Wide tracking is what makes a small line read as a label rather than as body
   * copy set too small — the same trick every studio archetype uses. */
  letterSpacing: 4,
};

/* The flow list. Five separate blocks rather than one list primitive, because
 * each hides independently: a three-step flow gives three lines, not three lines
 * and two gaps. */
const POINT_BLOCKS: readonly DesignBlockInput[] = (
  ["pointA", "pointB", "pointC", "pointD", "pointE"] as const
).map((slot) => ({
  id: slot,
  type: "text",
  text: { source: "slot", slot, hideWhenEmpty: true },
  role: "subheading",
  weight: 400,
  color: { slot: "foreground" },
  maxLines: 2,
}));

/* The quotable line, boxed. `quote` rather than a second body slot because that
 * is the visual role it fills, and the slot vocabulary is organised by role. */
const CALLOUT_BLOCK: DesignBlockInput = {
  id: "callout",
  type: "text",
  text: { source: "slot", slot: "quote", hideWhenEmpty: true },
  role: "subheading",
  weight: 700,
  color: { slot: "foreground" },
  maxLines: 4,
};

/* The margin aside. Muted and small: it is an annotation on the slide, not part
 * of the argument. */
const NOTE_BLOCK: DesignBlockInput = {
  id: "note",
  type: "text",
  text: { source: "slot", slot: "footnote", hideWhenEmpty: true },
  role: "meta",
  weight: 400,
  color: { slot: "muted" },
  maxLines: 2,
};

/* A cover is one large statement sitting on the baseline — the doc's `justify`
 * puts it there, so the block list carries no spacer to fake it. */
const CLASSIC_COVER: readonly DesignBlockInput[] = [
  EYEBROW_BLOCK,
  {
    id: "headline",
    type: "text",
    text: { source: "slot", slot: "headline" },
    role: "display",
    weight: 700,
    color: { slot: "foreground" },
    maxLines: 4,
    letterSpacing: -1,
    lineHeight: 1.05,
  },
  {
    id: "body",
    type: "text",
    text: { source: "slot", slot: "body", hideWhenEmpty: true },
    role: "body",
    weight: 400,
    color: { slot: "muted" },
    maxLines: 3,
    lineHeight: 1.4,
  },
  NOTE_BLOCK,
];

const CLASSIC_CONTENT: readonly DesignBlockInput[] = [
  COUNTER_BLOCK,
  EYEBROW_BLOCK,
  {
    id: "headline",
    type: "text",
    text: { source: "slot", slot: "headline" },
    role: "heading",
    weight: 700,
    color: { slot: "foreground" },
    maxLines: 3,
    letterSpacing: -1,
    lineHeight: 1.05,
  },
  {
    id: "body",
    type: "text",
    text: { source: "slot", slot: "body", hideWhenEmpty: true },
    role: "body",
    weight: 400,
    color: { slot: "muted" },
    maxLines: 4,
    lineHeight: 1.4,
  },
  ...POINT_BLOCKS,
  CALLOUT_BLOCK,
  NOTE_BLOCK,
  { id: "progressGap", type: "spacer", size: 24 },
  PROGRESS_BLOCK,
];

/* The cta INVERTS — the doc swaps its background to the accent and these blocks
 * read against it. One slide in the deck reading opposite is what makes the ask
 * register, and it is the behaviour CarouselSlideView had. */
const CLASSIC_CTA: readonly DesignBlockInput[] = [
  COUNTER_BLOCK,
  {
    id: "headline",
    type: "text",
    text: { source: "slot", slot: "headline" },
    role: "heading",
    weight: 700,
    color: { slot: "background" },
    maxLines: 3,
    letterSpacing: -1,
    lineHeight: 1.05,
  },
  {
    id: "body",
    type: "text",
    text: { source: "slot", slot: "body", hideWhenEmpty: true },
    role: "body",
    weight: 400,
    color: { slot: "background" },
    maxLines: 4,
    lineHeight: 1.4,
  },
  {
    id: "cta",
    type: "buttonPill",
    label: { source: "slot", slot: "ctaLabel", hideWhenEmpty: true },
    fill: { slot: "background" },
    labelColor: { slot: "accent" },
    role: "body",
    paddingX: 28,
    paddingY: 13,
  },
  { id: "progressGap", type: "spacer", size: 24 },
  PROGRESS_BLOCK,
];

const CLASSIC_LAYOUT: Record<CarouselSlideKind, readonly DesignBlockInput[]> = {
  cover: CLASSIC_COVER,
  content: CLASSIC_CONTENT,
  cta: CLASSIC_CTA,
};

export const CAROUSEL_LAYOUTS: Record<
  CarouselTemplate,
  Record<CarouselSlideKind, readonly DesignBlockInput[]>
> = {
  minimal: CLASSIC_LAYOUT,
  bold: CLASSIC_LAYOUT,
  editorial: CLASSIC_LAYOUT,
};

/**
 * SOURCE OF TRUTH KEYWORDS: getCarouselLayout
 *
 * WHAT:  The block list for a template and slide kind.
 * WHY:   Falls back rather than throwing, for the reason every carousel getter
 *        does: templateId is a bare String on the row, and a deck written under an
 *        older vocabulary must still render.
 */
export function getCarouselLayout(
  templateId: CarouselTemplate,
  kind: CarouselSlideKind,
): readonly DesignBlockInput[] {
  return (CAROUSEL_LAYOUTS[templateId] ?? CAROUSEL_LAYOUTS.minimal)[kind];
}

/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: CAROUSEL_LAYOUTS, getCarouselLayout,
 *   CarouselSlideLayout, buildSlideLayouts, SlideLayoutOptions, carousel blocks,
 *   slide layout, templates as data
 *
 * WHAT:  What each template draws on each kind of slide — its blocks, the colour
 *        its field is filled with, and where the content sits.
 * WHY:   These replace the hand-written CarouselSlideView. A slide is the same
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
 *        THE FIELD AND THE JUSTIFY LIVE HERE, not in the service. They used to be
 *        a hardcoded `isCta ? accent : background` branch, which meant a template
 *        could not decide how its own closing slide inverted — and `notebook`
 *        needs to invert onto its ink rather than onto a yellow marker colour that
 *        nothing readable sits on. A template that cannot choose its own field is
 *        not really a template.
 *
 *        Every optional slot is drawn with `hideWhenEmpty`, and that single
 *        property is what makes one layout serve two eras of deck: a slide stored
 *        before the extra slots existed parses with them empty, so those blocks
 *        collapse and it renders exactly as it always did. A slide written against
 *        a blueprint fills them and gains the blocks. No branch, no migration.
 *
 *        Built from OPTIONS rather than five hand-written triples. The structure
 *        of a deck slide does not vary between templates — a counter, a headline,
 *        supporting copy, a list, a spine — what varies is the typeface, which
 *        colours pair for the marker swash, and which hand-drawn marks appear. So
 *        those are the options, and a sixth template is one entry rather than
 *        three more arrays to keep in step.
 * WHERE: carouselSlideToDesignDoc in services/carousel.service.
 */

import type { DesignBlockInput } from "@/lib/types/design-block";
import type {
  CarouselSlideKind,
  CarouselTemplate,
  DesignColorSlot,
  DesignDecorationKey,
  DesignFontKey,
} from "@/lib/types";

export interface CarouselSlideLayout {
  readonly blocks: readonly DesignBlockInput[];
  /** The palette slot this slide's background is filled with. */
  readonly field: DesignColorSlot;
  readonly justify: "start" | "center" | "end";
}

interface SlideLayoutOptions {
  /** The headline face. Everything else stays sans for legibility at a glance. */
  readonly headlineFont: DesignFontKey;
  /** Asides and labels. `hand` reads as an annotation; `sans` as a caption. */
  readonly asideFont: DesignFontKey;
  /** Swash and ink for a marked word on an ordinary slide. */
  readonly mark: readonly [swash: DesignColorSlot, ink: DesignColorSlot];
  /** The closing slide inverts onto this, with this ink. */
  readonly cta: readonly [field: DesignColorSlot, ink: DesignColorSlot];
  /** Swash and ink for a marked word once inverted. */
  readonly ctaMark: readonly [swash: DesignColorSlot, ink: DesignColorSlot];
  /** A drawn mark under the cover's claim. Omitted means none. */
  readonly coverMark?: DesignDecorationKey;
  /** Points as plain lines, or as filled pills for a flow. */
  readonly points: "lines" | "pills";
  /**
   * Ink for the eyebrow label.
   *
   * An option rather than always `accent`, because an accent is not always a
   * colour text can sit in: notebook's is a marker yellow, and yellow on its
   * cream field measures 1.5:1 — a label nobody can read. A template whose accent
   * is a brand colour keeps using it.
   */
  readonly eyebrowInk: DesignColorSlot;
  /**
   * Ink for drawn marks and the progress spine on ordinary slides.
   *
   * Separate from `eyebrowInk` because a hairline and a word have different
   * contrast needs, and separate from `accent` for the same reason as above.
   */
  readonly lineInk: DesignColorSlot;
  /**
   * How much of the slide a generated illustration takes, as a fraction of the
   * canvas width.
   *
   * A template decision rather than a fixed size in the service, because how
   * large a picture should be IS the template's opinion: a quiet document style
   * wants a small mark, an illustrated one wants the picture to carry the slide.
   */
  readonly illustrationWidth: number;
  /**
   * Whether slides carry the deck's wordmark and byline.
   *
   * Per template, because signing a slide is a stylistic choice as much as an
   * attribution one: a quiet document-style deck reads better unsigned, and a
   * deck built to travel wants its name on every frame. Both values hide
   * themselves when empty, so this only decides whether the block exists.
   */
  readonly showBrand: boolean;
}

/**
 * SOURCE OF TRUTH KEYWORDS: buildSlideLayouts
 *
 * WHAT:  The three slide kinds for one template.
 * WHY:   One function so the shared structure is stated once. A template that
 *        needs a genuinely different composition writes its own object rather than
 *        growing this with a flag — the moment an option only one template uses
 *        appears here, that is the signal.
 */
function buildSlideLayouts(
  options: SlideLayoutOptions,
): Record<CarouselSlideKind, CarouselSlideLayout> {
  const [markSwash, markInk] = options.mark;
  const [ctaField, ctaInk] = options.cta;
  const [ctaSwash, ctaMarkInk] = options.ctaMark;

  /* The counter, as "03 / 08". Never on a cover: a cover announcing its own
   * position wastes the one line people actually read in the feed. */
  const counter: DesignBlockInput = {
    id: "counter",
    type: "text",
    text: { source: "computed", value: "slideCounter" },
    role: "meta",
    font: options.asideFont,
    weight: 400,
    color: { slot: "muted" },
    maxLines: 1,
    letterSpacing: 2,
  };

  /* The spine. A shape whose width is computed — the exact case the block
   * language's own comment cites as why `computed` exists.
   *
   * Takes its ink from the caller because the closing slide is filled with a
   * different colour: a spine drawn in the same slot as the field it sits on is
   * a spine nobody can see, which is what an always-accent fill produced on any
   * template whose cta field IS the accent. */
  const progress = (ink: DesignColorSlot): DesignBlockInput => ({
    id: "progress",
    type: "shape",
    shape: "rect",
    width: "deckProgress",
    height: 0.005,
    fill: { slot: ink },
  });

  const eyebrow: DesignBlockInput = {
    id: "eyebrow",
    type: "text",
    text: { source: "slot", slot: "eyebrow", hideWhenEmpty: true },
    role: "meta",
    font: options.asideFont,
    weight: 700,
    color: { slot: options.eyebrowInk },
    /* Handwriting is already distinct enough; uppercasing it fights the face. */
    transform: options.asideFont === "hand" ? "none" : "uppercase",
    maxLines: 1,
    letterSpacing: options.asideFont === "hand" ? 0 : 4,
  };

  const note = (ink: DesignColorSlot): DesignBlockInput => ({
    id: "note",
    type: "text",
    text: { source: "slot", slot: "footnote", hideWhenEmpty: true },
    role: "meta",
    font: options.asideFont,
    weight: 400,
    color: { slot: ink },
    maxLines: 2,
  });

  const headline = (
    role: "display" | "heading",
    ink: DesignColorSlot,
    swash: DesignColorSlot,
    swashInk: DesignColorSlot,
  ): DesignBlockInput => ({
    id: "headline",
    /* markedText, not text: a headline is where the model puts its ==marked==
     * claim, and a plain text block would draw the delimiters literally. */
    type: "markedText",
    text: { source: "slot", slot: "headline" },
    role,
    font: options.headlineFont,
    weight: 700,
    color: { slot: ink },
    highlight: { slot: swash },
    highlightColor: { slot: swashInk },
    letterSpacing: -1,
    lineHeight: 1.05,
  });

  const body = (ink: DesignColorSlot, maxLines: number): DesignBlockInput => ({
    id: "body",
    type: "text",
    text: { source: "slot", slot: "body", hideWhenEmpty: true },
    role: "body",
    weight: 400,
    color: { slot: ink },
    maxLines,
    lineHeight: 1.4,
  });

  /* Five blocks rather than one list primitive, because each hides
   * independently: a three-step flow gives three lines, not three lines and two
   * gaps. Pills use buttonPill rather than badgeRow, which caps at four items —
   * a flow can be five. */
  const points: readonly DesignBlockInput[] = (
    ["pointA", "pointB", "pointC", "pointD", "pointE"] as const
  ).map((slot) =>
    options.points === "pills"
      ? {
          id: slot,
          type: "buttonPill",
          label: { source: "slot", slot, hideWhenEmpty: true },
          fill: { slot: "accent" },
          labelColor: { slot: "background" },
          role: "subheading",
          paddingX: 26,
          paddingY: 12,
        }
      : {
          id: slot,
          type: "text",
          text: { source: "slot", slot, hideWhenEmpty: true },
          role: "subheading",
          weight: 400,
          color: { slot: "foreground" },
          maxLines: 2,
        },
  );

  /* The quotable line. `quote` rather than a second body slot because that is the
   * visual role it fills, and the slot vocabulary is organised by role. */
  const callout: DesignBlockInput = {
    id: "callout",
    type: "text",
    text: { source: "slot", slot: "quote", hideWhenEmpty: true },
    role: "subheading",
    weight: 700,
    color: { slot: "foreground" },
    maxLines: 4,
  };

  /* Always present in the block list. The renderer returns null for an image
   * whose slot is unresolved, so a slide with no illustration draws one block
   * fewer rather than an empty frame — which is what lets this live in the
   * layout, where the size and placement belong, instead of being appended by
   * the service at a size every template has to share.
   *
   * `contain`, not `cover`: the illustration directive asks for a subject with
   * generous empty space around it, and cropping it to fill a box throws exactly
   * that composition away. */
  const illustration: DesignBlockInput = {
    id: "illustration",
    type: "image",
    slot: "photo",
    fit: "contain",
    width: options.illustrationWidth,
    /* Squarer than it is wide on a portrait slide: the height fraction is of the
     * CANVAS, which is taller than it is wide, so matching the width fraction
     * would reserve a band far deeper than the picture needs. */
    height: options.illustrationWidth * 0.6,
    radius: 16,
  };

  /* The signature: wordmark and byline on one row, at the foot of the slide.
   *
   * A row rather than two stacked lines, because this is the quietest thing on the
   * slide and two lines of it start competing with the copy. Each half hides
   * independently, so a workspace with no connected account shows the wordmark
   * alone rather than a stray separator. */
  const brandRow = (ink: DesignColorSlot): readonly DesignBlockInput[] =>
    options.showBrand
      ? [
          {
            id: "brand",
            type: "group",
            direction: "row",
            gap: 12,
            align: "center",
            children: [
              {
                id: "wordmark",
                type: "logoText",
                text: { source: "slot", slot: "logoText", hideWhenEmpty: true },
                /* A small square in the same ink as the text. It turns a word at
                 * the foot of the slide into something that reads as a mark —
                 * and taking the ink rather than the accent keeps it legible on
                 * the inverted closing slide, where accent is the field. */
                mark: "square",
                markFill: { slot: ink },
                color: { slot: ink },
                role: "meta",
              },
              {
                id: "byline",
                type: "text",
                text: { source: "slot", slot: "name", hideWhenEmpty: true },
                role: "meta",
                font: options.asideFont,
                weight: 400,
                color: { slot: ink },
                maxLines: 1,
              },
            ],
          },
        ]
      : [];

  const coverMark: readonly DesignBlockInput[] = options.coverMark
    ? [
        {
          id: "coverMark",
          type: "decoration",
          art: options.coverMark,
          color: { slot: options.lineInk },
          width: 0.42,
        },
      ]
    : [];

  return {
    /* A cover is one large statement on the baseline — `justify` puts it there,
     * so the block list carries no spacer to fake it. */
    cover: {
      field: "background",
      justify: "end",
      blocks: [
        eyebrow,
        headline("display", "foreground", markSwash, markInk),
        ...coverMark,
        illustration,
        body("muted", 3),
        note("muted"),
        ...brandRow("muted"),
      ],
    },

    content: {
      field: "background",
      justify: "center",
      blocks: [
        counter,
        eyebrow,
        headline("heading", "foreground", markSwash, markInk),
        body("muted", 4),
        illustration,
        ...points,
        callout,
        note("muted"),
        ...brandRow("muted"),
        { id: "progressGap", type: "spacer", size: 24 },
        progress(options.lineInk),
      ],
    },

    /* The closing slide inverts. One slide in the deck reading opposite is what
     * makes the ask register, and it is the behaviour CarouselSlideView had —
     * except the field is now the template's choice rather than always the
     * accent. */
    cta: {
      field: ctaField,
      justify: "center",
      blocks: [
        counter,
        headline("heading", ctaInk, ctaSwash, ctaMarkInk),
        body(ctaInk, 4),
        {
          id: "cta",
          type: "buttonPill",
          label: { source: "slot", slot: "ctaLabel", hideWhenEmpty: true },
          /* Filled with the INK and labelled with the FIELD — the pill has to
           * contrast with the slide it sits on, and this slide is already filled
           * with `ctaField`. Filling it with the accent instead looks right until
           * a template whose cta field IS the accent draws an invisible label. */
          fill: { slot: ctaInk },
          labelColor: { slot: ctaField },
          role: "body",
          paddingX: 28,
          paddingY: 13,
        },
        note(ctaInk),
        ...brandRow(ctaInk),
        { id: "progressGap", type: "spacer", size: 24 },
        progress(ctaInk),
      ],
    },
  };
}

/* The original three. They differ only in palette, which is the product
 * CAROUSEL_TEMPLATES and CAROUSEL_PALETTES already expressed — so they share one
 * option set and render exactly as they did before this file existed. */
const CLASSIC = buildSlideLayouts({
  headlineFont: "sans",
  asideFont: "sans",
  mark: ["accent", "background"],
  cta: ["accent", "background"],
  ctaMark: ["background", "accent"],
  eyebrowInk: "accent",
  lineInk: "accent",
  /* Modest: these templates are typographic, and a picture that competes with
   * the headline is not what someone picked "Minimal" for. */
  illustrationWidth: 0.4,
  /* Unsigned. These are the typographic templates; someone choosing "Minimal"
   * is choosing for the copy to be the only thing on the slide. */
  showBrand: false,
  points: "lines",
});

export const CAROUSEL_LAYOUTS: Record<
  CarouselTemplate,
  Record<CarouselSlideKind, CarouselSlideLayout>
> = {
  minimal: CLASSIC,
  bold: CLASSIC,
  editorial: CLASSIC,

  /* Paper and marker. The swash is the yellow accent with the navy ink on top —
   * the pairing the classic set inverts, and the only one that is readable when
   * the accent is a highlighter colour rather than a brand colour.
   *
   * Its cta inverts onto the INK, not the accent: a full slide of marker yellow
   * has nothing readable to put on it. */
  notebook: buildSlideLayouts({
    headlineFont: "marker",
    asideFont: "hand",
    mark: ["accent", "foreground"],
    cta: ["foreground", "background"],
    ctaMark: ["accent", "foreground"],
    /* Not the accent: marker yellow on cream measures 1.5:1. */
    eyebrowInk: "muted",
    lineInk: "foreground",
    illustrationWidth: 0.52,
    showBrand: true,
    coverMark: "underline",
    points: "lines",
  }),

  /* Blue on white, with the flow list as pills — the one structural difference
   * between the two illustrated templates, and the reason `points` is an option
   * rather than a constant. */
  linkdude: buildSlideLayouts({
    headlineFont: "marker",
    asideFont: "hand",
    mark: ["accent", "background"],
    cta: ["foreground", "background"],
    ctaMark: ["accent", "background"],
    eyebrowInk: "accent",
    lineInk: "accent",
    /* The illustrated templates let the picture carry more of the slide. */
    illustrationWidth: 0.55,
    showBrand: true,
    coverMark: "starburst",
    points: "pills",
  }),
};

/**
 * SOURCE OF TRUTH KEYWORDS: getCarouselLayout
 *
 * WHAT:  The layout for a template and slide kind.
 * WHY:   Falls back rather than throwing, for the reason every carousel getter
 *        does: templateId is a bare String on the row, and a deck written under an
 *        older vocabulary must still render.
 */
export function getCarouselLayout(
  templateId: CarouselTemplate,
  kind: CarouselSlideKind,
): CarouselSlideLayout {
  return (CAROUSEL_LAYOUTS[templateId] ?? CAROUSEL_LAYOUTS.minimal)[kind];
}

/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: DESIGN_ARCHETYPES, DESIGN_ARCHETYPE_KEYS,
 *   DesignArchetypeKey, DesignArchetype, getDesignArchetype, buildDesignDoc,
 *   statement-cta, studio layouts, block lists
 *
 * WHAT:  The layouts themselves — a block list per archetype per canvas, and the
 *        function that clones one into a fresh DesignDoc.
 * WHY:   This file is the entire reason the block language exists. A layout here
 *        is DATA: adding one costs an entry, not a renderer branch, which is what
 *        the note on CAROUSEL_TEMPLATES ("a config entry plus a renderer branch")
 *        could not offer and what twenty templates makes unaffordable.
 *
 *        Archetypes are LAYOUT CONVENTIONS, drawn from the corpus surveyed in
 *        research/feature.md §2 — a value-prop headline, a proof strip, a blunt
 *        CTA. They are deliberately NOT reproductions of any specific designer's
 *        work, and none is named after a person. See the licence finding in that
 *        document before adding more.
 *
 *        Note what is absent: no colour literal appears anywhere below. Blocks
 *        name a palette SLOT, which is what lets one archetype render in all four
 *        colourways and is enforced by the schema having nowhere to put a hex.
 * WHERE: Cloned by the studio's create procedure; the resulting doc is stored on
 *        StudioAsset.doc and walked by design-render.service.
 */

import {
  designDocSchema,
  type DesignBlockInput,
  type DesignCanvasKey,
  type DesignDoc,
  type DesignTextSlotKey,
} from "@/lib/types/design-block";

export const DESIGN_ARCHETYPE_KEYS = ["statementCta"] as const;
export type DesignArchetypeKey = (typeof DESIGN_ARCHETYPE_KEYS)[number];

/**
 * SOURCE OF TRUTH KEYWORDS: DesignArchetype
 *
 * WHAT:  One layout, expressed per canvas it supports.
 * WHY:   Partial over the canvases rather than complete: an archetype that reads
 *        well on a 4:1 banner may have nothing sensible to say at 400x400, and
 *        forcing every archetype to fill every geometry would produce filler
 *        layouts nobody chose. The create procedure fails loudly on a missing
 *        pair rather than rendering an empty canvas.
 */
export interface DesignArchetype {
  readonly label: string;
  readonly description: string;
  /* Authored in the schema's INPUT shape and parsed on clone, so every default —
   * layout offsets, colour opacity, hideWhenEmpty — is filled exactly once by
   * zod rather than restated on every block below. That is why these literals
   * are so much shorter than the DesignBlock they become. */
  readonly blocks: Partial<Record<DesignCanvasKey, readonly DesignBlockInput[]>>;
  /* Per CANVAS, because only some have something to clear: a profile banner has
   * the avatar over its lower left, a featured cover has nothing over it at all. */
  readonly insetLeft?: Partial<Record<DesignCanvasKey, number>>;
  /* Per canvas, because the right answer differs: a banner reads left-aligned
   * beside an avatar, a featured cover is a standalone card and reads centred. */
  readonly align?: Partial<Record<DesignCanvasKey, "left" | "center" | "right">>;
}

/**
 * SOURCE OF TRUTH KEYWORDS: DESIGN_ARCHETYPES
 *
 * WHAT:  Every layout the studio can draw.
 * WHY:   One entry today, on purpose. Phase 1 of docs/20-studio.md proves the
 *        renderer; the other four archetypes are phase 3, and each is a literal
 *        in this file rather than a code change anywhere else. If adding the
 *        second one requires touching design-render.service, the block language
 *        is missing a primitive and THAT is the thing to fix.
 */
export const DESIGN_ARCHETYPES: Record<DesignArchetypeKey, DesignArchetype> = {
  /* Statement + CTA: a claim, the proof that makes it credible, and one thing to
   * do about it. The most common shape in the surveyed corpus and the safest
   * default, because it degrades gracefully — with the proof and footnote slots
   * left empty it is still a clean banner rather than a broken one. */
  statementCta: {
    label: "Statement",
    description: "A clear claim, supporting proof, and one call to action.",
    blocks: {
      linkedinBanner: [
        /* Ordered top to bottom in one centred column that sits in the RIGHT
         * two-thirds — see `insetLeft` on the doc below. That is the single
         * strongest convention in research/figma-profile-kit: every banner there
         * leaves the left third empty, because LinkedIn drops the profile photo
         * over it. */
        {
          id: "eyebrow",
          type: "text",
          text: { source: "slot", slot: "eyebrow" },
          role: "meta",
          weight: 700,
          color: { slot: "accent" },
          transform: "uppercase",
          maxLines: 1,
          /* Wide tracking is what makes a 16px line read as a label rather than
           * as small body copy. Every reference banner does this. */
          letterSpacing: 4,
        },
        {
          id: "headline",
          type: "text",
          text: { source: "slot", slot: "headline" },
          role: "display",
          weight: 700,
          color: { slot: "foreground" },
          maxLines: 2,
          letterSpacing: -1,
        },
        {
          id: "subheadline",
          type: "text",
          text: { source: "slot", slot: "subheadline" },
          role: "subheading",
          /* Muted, never foreground — supporting copy that competes with the
           * headline means neither gets read. */
          color: { slot: "muted" },
          maxLines: 1,
        },
        { id: "gap", type: "spacer", size: 8 },
        /* CTA and proof on ONE row, so the banner reads as "here is the offer,
         * here is why to trust it" rather than as two stacked afterthoughts.
         * Both references put the pill and the credibility marks on a shared
         * baseline. */
        {
          id: "actionRow",
          type: "group",
          direction: "row",
          gap: 16,
          align: "center",
          children: [
            {
              id: "cta",
              type: "buttonPill",
              label: { source: "slot", slot: "ctaLabel" },
              fill: { slot: "accent" },
              labelColor: { slot: "background" },
              role: "body",
              paddingX: 28,
              paddingY: 13,
            },
            {
              id: "proof",
              type: "badgeRow",
              /* Each item hides when empty, so filling one proof chip gives one
               * chip rather than one chip and two empty pills. */
              items: [
                { source: "slot", slot: "proofA" },
                { source: "slot", slot: "proofB" },
              ],
              /* Outlined, not filled: the pill beside it is the only thing on a
               * banner that should look pressable. */
              fill: { slot: "background", opacity: 0 },
              label: { slot: "muted" },
              border: { slot: "border" },
              role: "meta",
              gap: 10,
            },
          ],
        },
      ],

      /* 400x400, rendered by LinkedIn as a ~150px circle and cropped to it. So
       * everything lives dead centre with generous margin: a ring that reaches
       * the square's edge loses its corners to the crop, and anything in a corner
       * is simply gone. The photo is the design; the blocks around it are trim. */
      headshot: [
        {
          id: "photo",
          type: "image",
          slot: "photo",
          fit: "cover",
          /* Nearly full-bleed. LinkedIn's circular crop removes the corners
           * anyway, so leaving a square margin only shrinks the face. */
          width: 1,
          height: 1,
          radius: 999,
          ringWidth: 10,
          ringColor: { slot: "accent" },
        },
      ],

      /* 1200x627, and the thing that makes this canvas different: LinkedIn shows
       * it at roughly a third of its size in the Featured rail. Type therefore
       * runs LARGE relative to the canvas — a subline that reads fine at full
       * size disappears in the rail, which is why there isn't one. */
      featuredCover: [
        {
          id: "eyebrow",
          type: "text",
          text: { source: "slot", slot: "eyebrow" },
          role: "meta",
          weight: 700,
          color: { slot: "accent" },
          transform: "uppercase",
          maxLines: 1,
          letterSpacing: 4,
        },
        {
          id: "headline",
          type: "text",
          text: { source: "slot", slot: "headline" },
          role: "display",
          weight: 700,
          color: { slot: "foreground" },
          /* Three, not two: this canvas is nearly square, so it has the vertical
           * room a banner does not. */
          maxLines: 3,
          letterSpacing: -1,
        },
        { id: "gap", type: "spacer", size: 12 },
        {
          id: "rule",
          type: "divider",
          thickness: 4,
          length: 0.22,
          color: { slot: "accent" },
        },
        { id: "gapB", type: "spacer", size: 12 },
        {
          id: "cta",
          type: "buttonPill",
          label: { source: "slot", slot: "ctaLabel" },
          fill: { slot: "accent" },
          labelColor: { slot: "background" },
          role: "body",
          paddingX: 32,
          paddingY: 16,
        },
      ],
    },
    /* Reserve the left third of the BANNER. This is the correction that mattered
     * most: the first version of this archetype stacked everything on the left,
     * which put the wordmark exactly where the avatar lands. */
    insetLeft: { linkedinBanner: 0.34 },
    align: { featuredCover: "center", headshot: "center" },
  },
};

/**
 * SOURCE OF TRUTH KEYWORDS: getDesignArchetype
 *
 * WHAT:  Archetype lookup that always returns something.
 * WHY:   Same never-throw contract as getDesignPalette and getDesignTypeScale,
 *        and for the same reason: `archetypeId` is a bare String inside a Json
 *        column, so a document written before an archetype was renamed must
 *        still render rather than fail mid-kit.
 */
export function getDesignArchetype(archetypeId: string): DesignArchetype {
  return (
    DESIGN_ARCHETYPES[archetypeId as DesignArchetypeKey] ??
    DESIGN_ARCHETYPES.statementCta
  );
}

/**
 * SOURCE OF TRUTH KEYWORDS: buildDesignDoc
 *
 * WHAT:  Clones an archetype's block list into a fresh, validated DesignDoc.
 * WHY:   CLONES rather than references. A stored design must keep rendering
 *        exactly as the member left it even after the archetype it came from is
 *        edited — otherwise improving a layout silently rewrites everyone's
 *        finished banner, which is the one thing a design tool must never do.
 *        `archetypeId` is kept purely as provenance.
 *
 *        Parsing here rather than trusting the literals is what fills every
 *        default once, and it means a malformed archetype fails at create time
 *        with a zod path rather than at render time as a blank PNG.
 * WHERE: The studio create procedure, and the seed for each new asset.
 */
export function buildDesignDoc(args: {
  templateId: string;
  archetypeId: DesignArchetypeKey;
  canvas: DesignCanvasKey;
  paletteId: string;
  content?: Partial<Record<DesignTextSlotKey, string>>;
}): DesignDoc {
  const archetype = getDesignArchetype(args.archetypeId);
  const blocks = archetype.blocks[args.canvas];

  if (!blocks) {
    /* Loud, not silent. A missing pair is an authoring bug, and an empty canvas
     * is the hardest kind of render bug to trace back to its cause. */
    throw new Error(
      `Archetype "${args.archetypeId}" has no layout for canvas "${args.canvas}"`,
    );
  }

  const insetLeft = archetype.insetLeft?.[args.canvas];
  const align = archetype.align?.[args.canvas];

  return designDocSchema.parse({
    templateId: args.templateId,
    archetypeId: args.archetypeId,
    canvas: args.canvas,
    paletteId: args.paletteId,
    blocks,
    content: args.content ?? {},
    ...(insetLeft === undefined ? {} : { insetLeft }),
    ...(align === undefined ? {} : { align }),
  });
}

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
        /* Right-aligned stack. The canvas is 4:1 and LinkedIn drops the avatar
         * over the lower LEFT, so the type lives right of centre — see the
         * `avatar` safe zone in DESIGN_CANVAS_PRESETS. */
        {
          id: "eyebrow",
          type: "text",
          text: { source: "slot", slot: "eyebrow" },
          role: "meta",
          weight: 700,
          color: { slot: "accent" },
          align: "left",
          transform: "uppercase",
          maxLines: 1,
          letterSpacing: 3,
        },
        {
          id: "headline",
          type: "text",
          text: { source: "slot", slot: "headline" },
          role: "display",
          weight: 700,
          color: { slot: "foreground" },
          align: "left",
          maxLines: 2,
          letterSpacing: -1,
        },
        {
          id: "subheadline",
          type: "text",
          text: { source: "slot", slot: "subheadline" },
          role: "subheading",
          weight: 400,
          /* Muted, never foreground — the rule the palette states: supporting
           * copy that competes with the headline means neither is read. */
          color: { slot: "muted" },
          align: "left",
          maxLines: 1,
        },
        { id: "gapA", type: "spacer", size: 8 },
        /* The proof strip and the CTA sit on one row, so they read as a single
         * "here is why, here is what next" gesture rather than two stacked
         * afterthoughts. */
        {
          id: "actionRow",
          type: "group",
          direction: "row",
          gap: 20,
          align: "center",
          children: [
            {
              id: "cta",
              type: "buttonPill",
              label: { source: "slot", slot: "ctaLabel" },
              fill: { slot: "accent" },
              labelColor: { slot: "background" },
              role: "body",
            },
            {
              id: "proof",
              type: "badgeRow",
              /* Every item is `hideWhenEmpty`, so a member who fills one proof
               * chip gets one chip — not one chip and two empty pills. */
              items: [
                { source: "slot", slot: "proofA" },
                { source: "slot", slot: "proofB" },
                { source: "slot", slot: "proofC" },
              ],
              fill: { slot: "background", opacity: 0.001 },
              label: { slot: "muted" },
              border: { slot: "border" },
              role: "meta",
            },
          ],
        },
        { id: "gapB", type: "spacer", size: 12 },
        {
          id: "rule",
          type: "divider",
          thickness: 2,
          length: 0.28,
          color: { slot: "border" },
        },
        { id: "gapC", type: "spacer", size: 10 },
        {
          id: "footer",
          type: "group",
          direction: "row",
          gap: 16,
          align: "center",
          children: [
            {
              id: "logo",
              type: "logoText",
              text: { source: "slot", slot: "logoText" },
              mark: "square",
              markFill: { slot: "accent" },
              color: { slot: "foreground" },
              role: "meta",
            },
            {
              id: "handle",
              type: "text",
              text: { source: "slot", slot: "handle" },
              role: "meta",
              color: { slot: "muted" },
              maxLines: 1,
            },
          ],
        },
      ],
    },
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

  return designDocSchema.parse({
    templateId: args.templateId,
    archetypeId: args.archetypeId,
    canvas: args.canvas,
    paletteId: args.paletteId,
    blocks,
    content: args.content ?? {},
  });
}

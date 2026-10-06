/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: PaperDisplay, PaperDisplayProps, PaperDisplayWord,
 *   PaperWordVariant, boxed word, Archivo Black, font-paper-display, rule 5,
 *   display type, headline, blue box, ink box, paper design system
 *
 * WHAT:  Renders a display line as individually boxed words in Archivo Black.
 * WHY:   This is rule 5 of the design system in one place: Archivo Black,
 *        uppercase, line-height 0.82–0.86, letter-spacing -0.05em, with each
 *        word boxed at `0.07em 0.13em 0.11em`. Every headline on the landing
 *        page and the sign-in brand panel goes through it, so they all break the
 *        same way and the em-based padding scales with whatever font-size the
 *        caller sets — which is what keeps the box tight to the letterforms at
 *        40px and at 186px alike.
 *
 *        The caller owns only the SIZE (`className`) and the element
 *        (`as`), because size is the one thing that genuinely differs per
 *        section: the hero bounds its type by viewport HEIGHT as well as width,
 *        the closing band does not. Everything else is fixed here on purpose —
 *        a headline that sets its own tracking is a headline that has left the
 *        design system.
 * WHERE: The hero, the blue statement band, the composer heading, the dark
 *        how-it-works rows, the closing CTA, and the sign-in brand panel.
 */

import * as React from "react";

import type { PaperDisplayLine, PaperWordVariant } from "@/lib/types";
import { cn } from "@/lib/utils";

/* The box treatment per variant. `plain` is deliberately unboxed — it inherits
 * the band's own colour, which is what lets one line read across a paper, a blue
 * and a dark section without a per-section override. */
const WORD_VARIANTS: Record<PaperWordVariant, string> = {
  plain: "",
  ink: "bg-ink text-ink-foreground",
  blue: "bg-blue text-blue-foreground",
  paper: "bg-paper-raised text-blue",
};

export interface PaperDisplayProps
  extends Omit<React.ComponentPropsWithoutRef<"p">, "children" | "style"> {
  words: PaperDisplayLine;
  /** Heading level, or `p` where the line is not a document heading. */
  as?: "h1" | "h2" | "h3" | "p";
  /** Size and alignment only — the type treatment is owned by this component. */
  className?: string;
  /**
   * For custom properties the caller drives per render — the hero's
   * `--frag-delay`. Not an escape hatch for type: `className` cannot reach a
   * value that changes on every beat, and a style prop is the only way to hand
   * one in without generating a class per delay.
   */
  style?: React.CSSProperties;
}

export function PaperDisplay({
  words,
  as: Tag = "p",
  className,
  style,
  ...props
}: PaperDisplayProps) {
  return (
    <Tag
      style={style}
      {...props}
      /* `items-baseline` with a wrapping flex row rather than inline text: the
         boxes must align on the baseline, not on their own box edges, or a blue
         word sits visibly lower than the plain word beside it. */
      /* `paper-display-type` (globals.css, components layer) carries the family,
         the casing, the 0.84 leading and the -0.05em tracking. It is a plain
         class rather than four utilities on purpose: cn() runs tailwind-merge,
         which treats a caller's arbitrary `text-[…]` as a font-size/line-height
         shorthand and silently deleted a `leading-[0.84]` written here — leaving
         display type at body-copy leading. See the rule's comment for the full
         reasoning; a caller that genuinely needs 0.82 still overrides it with a
         utility, because utilities outrank the components layer. */
      className={cn(
        "m-0 flex flex-wrap items-baseline gap-x-[0.14em] gap-y-[0.05em] paper-display-type",
        className,
      )}
    >
      {words.map((word, index) => (
        /* `data-paper-word` carries the variant into the DOM so a CALLER can
         * reach the boxed and unboxed fragments separately. It changes nothing
         * on its own and exists for one real problem: every word carries
         * `px-[0.13em]`, so on a LEFT-ALIGNED line a boxed fragment shows its
         * box at the column edge while a plain one shows its glyph 0.13em
         * further in, and a stack of alternating lines reads as ragged. The fix
         * is the caller's because it depends on alignment — centred lines are
         * already optically even and must not be touched — so the hook lives
         * here and the compensation lives in sticky-hero.tsx. */
        <span
          key={`${word.text}-${index}`}
          data-paper-word={word.variant}
          className={cn(
            "inline-block px-[0.13em] pt-[0.07em] pb-[0.11em]",
            WORD_VARIANTS[word.variant],
          )}
        >
          {word.text}
        </span>
      ))}
    </Tag>
  );
}

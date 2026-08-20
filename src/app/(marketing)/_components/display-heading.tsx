/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: DisplayHeading, DisplayHeadingProps, SectionKicker,
 *   MarketingHeading, font-display, Instrument Serif, italic clause, two-part
 *   heading, display type, text-acid, headingVariants
 *
 * WHAT:  The page's heading pair — an uppercase Geist clause followed by an
 *        italic serif one in the accent colour — plus the small mono kicker that
 *        labels each numbered section.
 * WHY:   This pairing is the typographic idea the whole design rests on, and it
 *        repeats in the hero, all four section headings and the closing band.
 *        One component means the two clauses can never drift apart in size,
 *        tracking or colour, and a copy edit is a data change in marketing.ts
 *        (MarketingHeading) rather than hand-written markup. The sizes are a
 *        variant table rather than per-call-site classes for the same reason:
 *        display type is a scale, and a scale kept in one place is a scale.
 *
 *        The accent clause is NOT uppercased — that is deliberate and the reason
 *        `normal-case` is stated rather than inherited. An italic serif set in
 *        caps loses the handwritten quality that makes the pairing work.
 * WHERE: Every section under src/app/(marketing)/_components.
 */

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import type { MarketingHeading } from "@/lib/config";
import { cn } from "@/lib/utils";

/* Fluid across the board: the design is a single column that has to hold its
 * proportions from a phone to a wide desktop, and a stepped `sm:`/`lg:` scale
 * visibly snaps at the breakpoints while the rules around it slide. */
const headingVariants = cva(
  "text-balance font-semibold uppercase [text-wrap:balance]",
  {
    variants: {
      size: {
        hero: "max-w-[13em] text-[clamp(46px,8.6vw,132px)] leading-[0.86] tracking-[-0.055em]",
        loop: "max-w-[20em] text-[clamp(36px,5.4vw,72px)] leading-[0.9] tracking-[-0.055em]",
        section:
          "max-w-[17em] text-[clamp(34px,5vw,68px)] leading-[0.9] tracking-[-0.055em]",
        compact:
          "max-w-[20em] text-[clamp(30px,4vw,50px)] leading-[0.94] tracking-[-0.045em]",
        closing:
          "max-w-[15em] text-[clamp(38px,6vw,86px)] leading-[0.88] tracking-[-0.06em]",
      },
    },
    defaultVariants: { size: "section" },
  },
);

export interface DisplayHeadingProps
  extends VariantProps<typeof headingVariants> {
  heading: MarketingHeading;
  /** `h1` for the hero, `h2` everywhere else. */
  as?: "h1" | "h2";
  className?: string | undefined;
}

export function DisplayHeading({
  heading,
  as: Tag = "h2",
  size,
  className,
}: DisplayHeadingProps) {
  return (
    <Tag className={cn(headingVariants({ size }), className)}>
      {heading.lead}{" "}
      {/* Rendered as one inline run, not a block: the two clauses have to be
          able to share a line when the column is wide enough, and only break
          where the text itself runs out. */}
      <span className="font-display font-normal normal-case italic tracking-[-0.02em] text-acid">
        {heading.accent}
      </span>
    </Tag>
  );
}

export interface SectionKickerProps {
  children: React.ReactNode;
  className?: string | undefined;
}

/* The "01 / The loop" label. Mono, wide-tracked and small — it reads as a
 * document's section marker, which is what keeps the page feeling edited rather
 * than assembled. */
export function SectionKicker({ children, className }: SectionKickerProps) {
  return (
    <p
      className={cn(
        "font-mono text-[11px] uppercase tracking-[0.14em] text-acid",
        className,
      )}
    >
      {children}
    </p>
  );
}

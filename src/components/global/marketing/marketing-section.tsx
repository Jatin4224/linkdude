/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: MarketingSection, MarketingSectionProps, rail,
 *   border-rail, --gutter, --section-y, landing-shell, section divider,
 *   editorial grid, section anchor, marketing layout, vertical rhythm
 *
 * WHAT:  The shell every public section sits in — anchor id, the hairline that
 *        divides it from the next section, and the page's shared gutter and
 *        vertical rhythm.
 * WHY:   The visible grid is the structural idea of this design: a 1240px column
 *        with ruled edges, divided by hairlines. Without it the page reads as a
 *        stack of loose cards. Owning the divider here rather than in each
 *        section is what guarantees there is exactly one hairline between any
 *        two sections and never two stacked or none at all. Rhythm and gutters
 *        come from --section-y / --gutter (set once on .landing-shell) so a
 *        section component contains only its own content.
 * WHERE: Every section under src/app/(marketing)/_components.
 */

import * as React from "react";

import { cn } from "@/lib/utils";

export interface MarketingSectionProps {
  children: React.ReactNode;
  /** Anchor target — pass a value from MARKETING_SECTION_IDS. */
  id?: string | undefined;
  /**
   * Drops the horizontal gutter so the child paints to the column rails.
   * For the bands that are themselves full-bleed (the ticker, the counter row).
   */
  bleed?: boolean;
  /** Overrides the default `py-(--section-y)` rhythm. */
  spacingClassName?: string | undefined;
  /**
   * Removes the bottom hairline. Set on the last section before the footer,
   * which already has a top border of its own.
   */
  flush?: boolean;
  className?: string | undefined;
}

export function MarketingSection({
  children,
  id,
  bleed = false,
  spacingClassName,
  flush = false,
  className,
}: MarketingSectionProps) {
  return (
    <section
      id={id}
      /* scroll-mt clears the sticky header, so an anchor jump doesn't park the
         heading underneath it. */
      className={cn(
        "relative scroll-mt-20",
        !flush && "border-b border-rail",
        !bleed && "px-(--gutter)",
        spacingClassName ?? "py-(--section-y)",
        className,
      )}
    >
      {children}
    </section>
  );
}

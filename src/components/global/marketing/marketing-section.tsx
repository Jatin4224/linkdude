/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: MarketingSection, MarketingSectionProps,
 *   MarketingContainer, SectionHeader, marketing layout, vertical rhythm,
 *   max-width container, section anchor
 *
 * WHAT:  The shell every public section sits in — anchor id, vertical rhythm,
 *        max-width container, and an optional SectionHeader block.
 * WHY:   Rhythm and gutters are the two things that break first when a page is
 *        assembled from a dozen independently written sections. Owning them here
 *        means a section component contains only its own content, and a change
 *        to the page's spacing scale is one edit rather than eleven. `bare`
 *        exists for the full-bleed bands (marquee, final CTA) that need the
 *        rhythm but paint edge to edge.
 * WHERE: Every section under src/app/(marketing)/_components.
 */

import * as React from "react";

import { SectionHeader } from "@/components/global/section-header";
import { cn } from "@/lib/utils";

export interface MarketingSectionProps {
  children: React.ReactNode;
  /** Anchor target — pass a value from MARKETING_SECTION_IDS. */
  id?: string | undefined;
  eyebrow?: string | undefined;
  title?: string | undefined;
  description?: string | undefined;
  /** Centres the header block above the content. */
  headerAlign?: "left" | "center";
  /** Drops the max-width container so the child can paint full-bleed. */
  bare?: boolean;
  className?: string | undefined;
  /** Overrides the default `py-24 sm:py-32` rhythm. */
  spacingClassName?: string | undefined;
}

export function MarketingSection({
  children,
  id,
  eyebrow,
  title,
  description,
  headerAlign = "center",
  bare = false,
  className,
  spacingClassName,
}: MarketingSectionProps) {
  const header = title ? (
    <SectionHeader
      title={title}
      size="display"
      align={headerAlign}
      {...(eyebrow ? { eyebrow } : {})}
      {...(description ? { description } : {})}
    />
  ) : null;

  return (
    <section
      id={id}
      /* scroll-mt clears the sticky navbar, so an anchor jump doesn't park the
         heading underneath it. */
      className={cn(
        "relative scroll-mt-20",
        spacingClassName ?? "py-24 sm:py-32",
        className,
      )}
    >
      {bare ? (
        <>
          {header}
          {children}
        </>
      ) : (
        <div className="mx-auto w-full max-w-6xl px-6">
          {header ? <div className="mb-14">{header}</div> : null}
          {children}
        </div>
      )}
    </section>
  );
}

/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: PaperMascot, PaperMascotProps, PaperLockup,
 *   PaperLockupProps, PAPER_MASCOT_SRC, BrandMark, linkdin-dude, mascot,
 *   brand lockup, wordmark, 4px radius exception, paper design system
 *
 * WHAT:  The mascot artwork at any size, and the brand lockup (mark + wordmark)
 *        as the paper surfaces set it.
 * WHY:   The mascot appears at three wildly different scales on these pages — a
 *        780px hero figure cropped by its stage, a 460px panel figure hanging
 *        off an edge, a 240px closing-band figure — so what is shared is the
 *        SOURCE and the alt/priority handling, not a size. Wrapping it keeps
 *        those three call sites from each deciding again whether the mascot is
 *        decorative (it is: every instance is aria-hidden, and a mascot
 *        announced three times per page is three pieces of noise for a screen
 *        reader).
 *
 *        The lockup is the one place rule 1 has an exception: the 28–30px mark
 *        takes a 4px radius, and nothing else on either page is round. Owning
 *        that here is what stops the exception from spreading.
 * WHERE: PaperMascot — the landing hero, the closing CTA, the sign-in brand
 *        panel. PaperLockup — the landing header and footer, and both columns of
 *        the sign-in screen.
 */

import * as React from "react";
import Image from "next/image";
import Link from "next/link";

import { APP_NAME } from "@/lib/config";
import { cn } from "@/lib/utils";

/**
 * SOURCE OF TRUTH KEYWORDS: PAPER_MASCOT_SRC
 *
 * WHAT:  Where the mascot artwork is served from on the public surfaces.
 * WHY:   A /public path rather than the `src/app/assets` static import the
 *        in-app BrandMark uses: these renders are 240–780px of a 1024px source
 *        and are sized in svh/vw, so they want the plain optimiser pipeline
 *        rather than a build-time import whose intrinsic dimensions are then
 *        overridden by CSS at every call site.
 */
export const PAPER_MASCOT_SRC = "/linkdin-dude.png";

export interface PaperMascotProps {
  /** Rendered size in px — the intrinsic hint. CSS in `className` may override. */
  width: number;
  height: number;
  /** Mirrors the figure. The brand panel faces it back toward the copy. */
  flipped?: boolean;
  /** Set on the one instance above the fold. */
  priority?: boolean;
  /**
   * The hero reads this element's box every beat to find the point its copy
   * orbits around — see sticky-hero.tsx. A ref rather than a shared constant
   * because the mascot is sized in svh, so its centre moves on every resize.
   */
  ref?: React.Ref<HTMLImageElement>;
  className?: string;
}

export function PaperMascot({
  width,
  height,
  flipped = false,
  priority = false,
  ref,
  className,
}: PaperMascotProps) {
  return (
    <Image
      ref={ref}
      src={PAPER_MASCOT_SRC}
      alt=""
      aria-hidden="true"
      width={width}
      height={height}
      priority={priority}
      className={cn("max-w-none object-contain", flipped && "-scale-x-100", className)}
    />
  );
}

export interface PaperLockupProps {
  /** Omit to render the lockup as plain text rather than a link. */
  href?: string;
  /** Overrides the wordmark colour — the header inverts it over the hero. */
  className?: string;
}

export function PaperLockup({ href, className }: PaperLockupProps) {
  const content = (
    <>
      <Image
        src={PAPER_MASCOT_SRC}
        alt=""
        aria-hidden="true"
        width={64}
        height={64}
        /* Rule 1's only exception, and it lives here so it cannot spread. */
        className="size-[28px] flex-none rounded-[4px] object-cover"
      />
      {APP_NAME}
    </>
  );

  const classes = cn(
    "inline-flex w-fit items-center gap-[9px] text-[18px] font-semibold tracking-[-0.03em]",
    className,
  );

  if (href) {
    return (
      <Link href={href} className={classes}>
        {content}
      </Link>
    );
  }
  return <span className={classes}>{content}</span>;
}

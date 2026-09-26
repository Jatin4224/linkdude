/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: PaperMascot, PaperMascotProps, PaperMascotEyes,
 *   PAPER_MASCOT_EYES, PAPER_MASCOT_PUPILS, PaperLockup, PaperLockupProps,
 *   PAPER_MASCOT_SRC, BrandMark, linkdin-dude, mascot, brand lockup, wordmark,
 *   4px radius exception, paper design system
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
  className?: string;
}

export function PaperMascot({
  width,
  height,
  flipped = false,
  priority = false,
  className,
}: PaperMascotProps) {
  return (
    <Image
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

/**
 * SOURCE OF TRUTH KEYWORDS: PaperMascotEyes, PAPER_MASCOT_EYES,
 *   PAPER_MASCOT_PUPILS, mascot eyes, pupil, glint, gaze, cursor tracking,
 *   eye overlay, linkdin-dude
 *
 * WHAT:  Where the mascot's pupils are in the artwork, and how far they may
 *        travel from there.
 * WHY:   MEASURED FROM THE PNG, not eyeballed. Every number was read off
 *        /public/linkdin-dude.png at its native 1024×1024: the pupils are the
 *        two dark discs strictly inside the white, at r≈42 and r≈40, and the
 *        glint is the crescent bitten out of each one's upper left by a white
 *        circle at 0.56 of the pupil's radius. Redrawing them by eye would
 *        have been visible the moment the overlay sat on the original.
 *
 *        `travel` IS BOUNDED BY THE ARTWORK, not by taste, and the bound is
 *        tight. Sweeping every non-white pixel near the eyes finds exactly two
 *        features in reach: the brow wedge between the eyes, 58.5px from the
 *        right pupil's centre, and a wedge tip 83.4px from the left's. The
 *        cover disc that hides the drawn pupil is r + travel + pad, so the
 *        brow fixes the ceiling at travel + pad <= 18.2 — and the right
 *        pupil's own radius is most of the budget.
 *
 *        AN EARLIER PASS USED 26 AND WAS WRONG. It looked clean at full size
 *        and was not: composited against the original at 3x, the cover had
 *        bitten the tip off the brow wedge. Nothing about a rendered page
 *        showed it. If you change these numbers, re-run the sweep and diff the
 *        crop against the untouched PNG — a screenshot of the hero will not
 *        tell you.
 *
 *        Both pupils move TOGETHER, as one group: eyes tracking one point do
 *        not diverge, and one transform is also one tween rather than four.
 * WHERE: PaperMascotEyes below; driven by the pointer in
 *        src/app/(marketing)/_components/sticky-hero.tsx.
 */
export const PAPER_MASCOT_EYES = {
  /** The artwork's own box. The overlay's viewBox, so every number below is
   *  in artwork pixels and scales with whatever size the mascot is drawn at. */
  box: 1024,
  /** Maximum pupil offset from rest, in artwork units. See the note above. */
  travel: 12,
  /** Clearance kept between the cover disc and the surrounding line art. */
  coverPad: 5,
  /** The highlight, as fractions of the pupil's own radius. */
  glint: { dx: -0.3, dy: -0.46, r: 0.56 },
  pupils: [
    { name: "left", cx: 509, cy: 318.5, r: 42.3 },
    { name: "right", cx: 585, cy: 363.5, r: 40.3 },
  ],
} as const;

/**
 * The element the hero retargets. A constant rather than a literal in two
 * files, because a selector that stops matching fails silently — the eyes
 * would simply never move and nothing would say why.
 */
export const PAPER_MASCOT_PUPILS = "data-mascot-pupils";

/* ARTWORK COLOURS, NOT THEME TOKENS — sampled from the PNG (the eye white and
 * the pupil ink). They are deliberately not `--background`/`--foreground`: this
 * overlay has to match a bitmap that does not change with the theme, and a
 * token would drift away from the drawing the first time the palette moved. */
const EYE_WHITE = "#fffeff";
const EYE_INK = "#0a152e";

export interface PaperMascotEyesProps {
  className?: string;
}

/**
 * SOURCE OF TRUTH KEYWORDS: PaperMascotEyes, mascot pupils, eye tracking,
 *   svg overlay, cover disc
 *
 * WHAT:  An SVG laid over the mascot that hides the drawn pupils and redraws
 *        them as elements something else can move.
 * WHY:   The artwork is a PNG, so the eyes cannot be animated in place. Each
 *        drawn pupil is covered by a white disc — safe because both eye whites
 *        are one flat white region — and redrawn on top, glint and all, at the
 *        exact position it was drawn. AT REST THE OVERLAY IS INDISTINGUISHABLE
 *        FROM THE ARTWORK, which is the whole test: a visitor with no pointer,
 *        no JS or reduced motion sees the character unchanged.
 *
 *        BOTH COVERS ARE PAINTED BEFORE EITHER PUPIL. Drawn eye-by-eye, the
 *        second cover erased the first pupil whenever the two came close,
 *        which they do — their centres are only 88 units apart.
 *
 *        Needs a POSITIONED PARENT that wraps the artwork tightly; it fills
 *        that box, and the shared viewBox is what keeps it registered with the
 *        drawing at every size.
 * WHERE: The landing hero. The closing band and the auth panels render the
 *        mascot without it — nothing there drives a gaze.
 */
export function PaperMascotEyes({ className }: PaperMascotEyesProps) {
  const { box, travel, coverPad, glint, pupils } = PAPER_MASCOT_EYES;

  return (
    <svg
      viewBox={`0 0 ${String(box)} ${String(box)}`}
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 size-full",
        className,
      )}
    >
      {pupils.map((pupil) => (
        <circle
          key={pupil.name}
          cx={pupil.cx}
          cy={pupil.cy}
          r={pupil.r + travel + coverPad}
          fill={EYE_WHITE}
        />
      ))}

      <g {...{ [PAPER_MASCOT_PUPILS]: "" }}>
        {pupils.map((pupil) => (
          <React.Fragment key={pupil.name}>
            <circle cx={pupil.cx} cy={pupil.cy} r={pupil.r} fill={EYE_INK} />
            <circle
              cx={pupil.cx + pupil.r * glint.dx}
              cy={pupil.cy + pupil.r * glint.dy}
              r={pupil.r * glint.r}
              fill={EYE_WHITE}
            />
          </React.Fragment>
        ))}
      </g>
    </svg>
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

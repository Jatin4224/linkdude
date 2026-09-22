/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use client";

/**
 * SOURCE OF TRUTH KEYWORDS: HeroContextCard, HeroContextCardProps, setup card,
 *   lead, aside, beat transition, gsap, PAPER_EASE, PaperLabel, sticky hero
 *
 * WHAT:  The card to the right of the mascot — the beat's setup line, with its
 *        connector underneath.
 *
 * WHY:   This copy used to be loose text in the top corners of the stage, which
 *        is why the hero read as four separate things shouting at once: a line
 *        top left, a fragment top right, display type across the middle and a
 *        character behind all of it. Giving it the SAME card as the note turns
 *        two of those into one pair of objects the mascot is standing between,
 *        and the corners go quiet.
 *
 *        Set in the UI sans, NOT the display face. The card on the other side
 *        carries the punch line and has to win; two cards both set in Archivo
 *        Black would simply tie. The connector below it is the one mono line, so
 *        the setup reads as a caption rather than as a second headline.
 * WHERE: src/app/(marketing)/_components/sticky-hero.tsx, right of the mascot.
 */

import * as React from "react";

import { PAPER_EASE, gsap, useGSAP } from "@/lib/gsap";
import { PaperLabel } from "@/components/global/paper";
import { cn } from "@/lib/utils";

export interface HeroContextCardProps {
  /** The beat's setup sentence. */
  lead: string;
  /** The short line that hands over to the note. */
  aside: string;
  className?: string | undefined;
}

export function HeroContextCard({
  lead,
  aside,
  className,
}: HeroContextCardProps) {
  const card = React.useRef<HTMLDivElement | null>(null);

  /* The card holds still between beats; only its words change, so they fade
   * through rather than the object moving. It is the fixed half of the pair —
   * the note beside it is the one that has something happen to it. */
  useGSAP(
    () => {
      if (!card.current) return;
      gsap.fromTo(
        card.current,
        { opacity: 0, y: 12 },
        {
          opacity: 1,
          y: 0,
          duration: 0.55,
          ease: PAPER_EASE,
          overwrite: "auto",
        },
      );
    },
    { dependencies: [lead, aside] },
  );

  return (
    <div className={cn("pointer-events-none relative", className)}>
      {/* The same offset sheet as the note, so the two read as one family. */}
      <span
        aria-hidden="true"
        className="absolute inset-0 translate-x-[7px] translate-y-[7px] border border-ink"
      />

      <div
        ref={card}
        className="relative flex flex-col gap-[clamp(8px,1vw,14px)] border border-ink bg-paper-raised px-[clamp(15px,1.7vw,24px)] py-[clamp(13px,1.4vw,20px)]"
      >
        <p className="m-0 text-[clamp(15px,min(1.8vw,2.5svh),23px)] leading-[1.15] tracking-[-0.025em] text-balance text-ink">
          {lead}
        </p>

        <span className="flex items-center gap-2.5">
          <span aria-hidden="true" className="h-px w-[22px] bg-ink" />
          <PaperLabel as="span" tone="grey" className="text-[10.5px]">
            {aside}
          </PaperLabel>
        </span>
      </div>
    </div>
  );
}

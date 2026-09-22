/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use client";

/**
 * SOURCE OF TRUTH KEYWORDS: HeroNote, HeroNoteProps, note card, dead note,
 *   idea dies, beat transition, gsap, PAPER_EASE, PaperDisplay, sticky hero
 *
 * WHAT:  The hero's line, written on a note the mascot is presenting — which
 *        tips over, greys out and drops as the reader scrolls into the second
 *        beat.
 *
 * WHY:   THE MOTION CARRIES THE COPY. The hero already tells a small story: an
 *        idea worth posting turns up on Tuesday and is dead in a notes app by
 *        Friday. Two earlier passes animated that line as pure decoration —
 *        orbiting the character, then stacked around it — and both fought the
 *        mascot for the same attention in the same place, because display type
 *        at that size and a large, brightly coloured character cannot both be
 *        the subject. Here the type is an OBJECT in the scene at a readable
 *        size, and the one animation in the hero is the thing the sentence
 *        describes: the note dying.
 *
 *        THE SAME NOTE, NOT TWO. The card is never swapped or cross-faded — the
 *        words change on it while it tips, because it has to be the same piece
 *        of paper for the story to land. Swapping cards would read as two
 *        unrelated notes, which is a slideshow rather than a consequence.
 *
 *        Everything is a token from the paper palette, so the dead state is a
 *        change of MATERIAL rather than a filter: the live note sits on raised
 *        paper with an ink rule, the dead one on flat paper with a hairline and
 *        grey type. `filter: grayscale()` would have been one line and would
 *        have dimmed the ink box along with it, which is the one part that
 *        should still read after the idea is gone.
 * WHERE: src/app/(marketing)/_components/sticky-hero.tsx, over the mascot.
 */

import * as React from "react";

import type { PaperDisplayLine } from "@/lib/types";
import { PAPER_EASE, gsap, useGSAP } from "@/lib/gsap";
import { PaperDisplay } from "@/components/global/paper";
import { cn } from "@/lib/utils";

/* Where the note rests, and where it ends up once the idea is gone. A fall
 * rather than a fade: something that dims is a styling change, something that
 * tips and drops has had an event happen to it. */
const ALIVE = { rotation: -2.5, y: 0, x: 0, scale: 1 };
/* It tips and SETTLES rather than travelling. The note sits in the left-hand
 * column now, so the sideways fall that kept it clear of the centred call to
 * action when it lived in the middle simply carried it off the edge of the
 * screen — half a card cropped against x=0, which reads as a layout fault
 * rather than as a note going quiet. */
const DEAD = { rotation: -11, y: 52, x: -12, scale: 0.93 };

export interface HeroNoteProps {
  words: PaperDisplayLine;
  /** True once the reader has scrolled past the opening beat. */
  isDead: boolean;
  /** Heading level — the note carries the hero's real heading, not a copy. */
  as?: "h1" | "p" | undefined;
  className?: string | undefined;
}

export function HeroNote({
  words,
  isDead,
  as = "p",
  className,
}: HeroNoteProps) {
  const card = React.useRef<HTMLDivElement | null>(null);

  useGSAP(
    () => {
      if (!card.current) return;
      gsap.to(card.current, {
        ...(isDead ? DEAD : ALIVE),
        duration: 0.72,
        ease: PAPER_EASE,
        /* Retargets from wherever the card actually is, so a reader scrubbing
           back and forth across the beat boundary never sees it jump. */
        overwrite: "auto",
      });
    },
    { dependencies: [isDead] },
  );

  return (
    /* Positioned by the CALLER. The note used to centre itself on the stage,
       which stopped being its business the moment the hero put it in a column
       beside the mascot rather than on top of one. */
    <div className={cn("pointer-events-none relative", className)}>
      {/* The shadow sheet. One offset rectangle, not a box-shadow: this design
          has no soft edges anywhere, and a second sheet of paper is also the
          more honest reading — a note sitting on the pad it was torn from. */}
      <span
          aria-hidden="true"
        className={cn(
          "absolute inset-0 translate-x-[7px] translate-y-[7px] border transition-colors duration-500",
          isDead ? "border-hair" : "border-ink",
        )}
      />

      <div
        ref={card}
        className={cn(
          "relative border px-[clamp(16px,1.9vw,28px)] py-[clamp(14px,1.5vw,22px)] transition-colors duration-500",
            /* The material changes, not just the colour — see the note at the
               top of this file. */
            isDead
              ? "border-hair bg-paper text-grey"
              : "border-ink bg-paper-raised text-ink",
          )}
        >
          <PaperDisplay
            as={as}
            words={words}
            className={cn(
              "max-w-[10ch] justify-center text-center text-[clamp(22px,min(2.9vw,4.2svh),40px)] leading-[0.86] tracking-[-0.045em]",
              /* The boxed word keeps its fill while the note dies around it:
                 the phrase the reader is meant to leave with is the one thing
                 that should not grey out. */
              isDead && "opacity-90",
            )}
          />
        </div>
      </div>
  );
}

/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use client";

/**
 * SOURCE OF TRUTH KEYWORDS: PaperReveal, PaperRevealProps, PaperRevealEffect,
 *   gsap, ScrollTrigger, useGSAP, PAPER_EASE, SCRUB, stagger, wipe, clip-path,
 *   section entrance, scroll reveal, prefers-reduced-motion
 *
 * WHAT:  The scroll entrance every landing section uses — either a staggered
 *        rise of its direct children, or a clip-path wipe of the whole block.
 * WHY:   One component so the page has ONE entrance vocabulary. Sections that
 *        each rolled their own reveal are how a landing page ends up with six
 *        durations and four curves, and the reader feels the inconsistency long
 *        before they can name it.
 *
 *        Both effects animate `transform`/`opacity` or `clip-path` only — never
 *        height, margin or top — so they skip layout and paint entirely.
 *
 *        The pre-JS state is the FINISHED state. Every tween is a `gsap.from()`,
 *        so the server HTML renders the section fully visible and gsap moves it
 *        backwards to animate it in. A JS failure, a blocked bundle or a crawler
 *        therefore sees the complete page rather than a blank one — the failure
 *        mode of writing `opacity: 0` into the markup and hoping JS arrives.
 *
 *        `once: true` on the stagger: a section that re-animates every time it
 *        re-enters the viewport is an interface fighting its reader on the way
 *        back up the page.
 * WHERE: Wraps the content of every section under
 *        src/app/(marketing)/_components except the hero, which owns its own
 *        scroll choreography.
 */

import * as React from "react";

import { PAPER_EASE, SCRUB, gsap, useGSAP } from "@/lib/gsap";
import { cn } from "@/lib/utils";

/**
 * SOURCE OF TRUTH KEYWORDS: PaperRevealEffect
 *
 * WHAT:  Which entrance this block gets.
 * WHY:   Two, not six. `stagger` is the page's default — the quiet one that
 *        carries every ordinary section. `wipe` is the loud one, and it is
 *        rationed to the full-bleed colour bands where a section genuinely
 *        arrives OVER the one before it; using it on a paper section would be
 *        a wipe with nothing to wipe against.
 */
export type PaperRevealEffect = "stagger" | "wipe";

export interface PaperRevealProps {
  children: React.ReactNode;
  effect?: PaperRevealEffect;
  /**
   * Distance in px the staggered children rise from. Larger for big display
   * blocks, smaller for dense rows — the same offset on a 12px label and a
   * 150px headline reads as two different animations.
   */
  distance?: number;
  className?: string;
}

export function PaperReveal({
  children,
  effect = "stagger",
  distance = 26,
  className,
}: PaperRevealProps) {
  const scope = React.useRef<HTMLDivElement | null>(null);

  useGSAP(
    () => {
      const root = scope.current;
      if (!root) return;

      /* gsap.matchMedia is the reduced-motion gate: everything registered in
         the `reduce` branch is reverted automatically when the query stops
         matching, so a visitor who changes the OS setting mid-session gets the
         other treatment without a reload. */
      const mm = gsap.matchMedia();

      mm.add(
        {
          motion: "(prefers-reduced-motion: no-preference)",
          reduce: "(prefers-reduced-motion: reduce)",
        },
        (context) => {
          const { reduce } = context.conditions as {
            motion: boolean;
            reduce: boolean;
          };

          /* Reduced motion keeps a fade — it aids comprehension and carries no
             movement — and drops the travel and the wipe entirely. */
          if (reduce) {
            gsap.from(effect === "wipe" ? root : Array.from(root.children), {
              opacity: 0,
              duration: 0.3,
              ease: "none",
              scrollTrigger: { trigger: root, start: "top 90%", once: true },
            });
            return;
          }

          if (effect === "wipe") {
            /* clip-path rather than a height or a translated overlay: the band
               below stays exactly where it is while the colour arrives over it,
               which is what makes it read as one surface sliding up rather than
               two blocks swapping places. Scrubbed, so the reader drives it. */
            gsap.from(root, {
              clipPath: "inset(100% 0% 0% 0%)",
              ease: "none",
              scrollTrigger: {
                trigger: root,
                start: "top bottom",
                end: "top 35%",
                scrub: SCRUB,
              },
            });
            return;
          }

          gsap.from(Array.from(root.children), {
            opacity: 0,
            /* Full transform string, not gsap's `y` shorthand: the shorthand is
               not hardware-accelerated and drops frames while the page is still
               loading images. */
            transform: `translateY(${distance}px)`,
            duration: 0.7,
            ease: PAPER_EASE,
            stagger: 0.06,
            scrollTrigger: { trigger: root, start: "top 85%", once: true },
          });
        },
      );

      return () => mm.revert();
    },
    { scope, dependencies: [effect, distance] },
  );

  return (
    <div ref={scope} className={cn(effect === "wipe" && "will-change-[clip-path]", className)}>
      {children}
    </div>
  );
}

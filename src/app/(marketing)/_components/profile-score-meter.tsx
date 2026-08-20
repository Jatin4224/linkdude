/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use client";

/**
 * SOURCE OF TRUTH KEYWORDS: ProfileScoreMeter, PROFILE_DEMO_SCORE, CountUp,
 *   useInView, useReducedMotion, score bar, progress fill, prefers-reduced-motion
 *
 * WHAT:  The mock profile score in the bento — the figure counts up and the bar
 *        fills to match, once, the first time the tile is scrolled to.
 * WHY:   A bare "82 / 100" is a number on a card; watching it arrive is what
 *        makes it read as a measurement the product took. The width is written
 *        imperatively to the DOM rather than held in state for the same reason
 *        CountUp writes textContent: nothing in React's tree depends on it, and
 *        a state-driven fill would re-render the tile for a value only CSS uses.
 *
 *        The element ships at its FINAL width in the server HTML, so a visitor
 *        without JS, a crawler, or anyone on reduced motion sees a full bar
 *        rather than an empty one that never fills.
 * WHERE: src/app/(marketing)/_components/inside-bento.tsx.
 */

import * as React from "react";
import { useInView, useReducedMotion } from "motion/react";

import { CountUp } from "@/components/global/count-up";

/* Illustrative, not a claim — this is a mock of the analysis screen, and the
 * scale it is out of is the only part a reader could hold us to. */
export const PROFILE_DEMO_SCORE = 82;
const PROFILE_SCORE_MAX = 100;

/* Matches the count's duration so the number and the bar finish together —
 * two timings here would read as two separate animations. */
const FILL_MS = 900;

export function ProfileScoreMeter() {
  const wrapperRef = React.useRef<HTMLDivElement | null>(null);
  const fillRef = React.useRef<HTMLSpanElement | null>(null);
  const reduceMotion = useReducedMotion();
  const inView = useInView(wrapperRef, { once: true, margin: "-80px" });

  React.useEffect(() => {
    if (!inView || reduceMotion) return;
    const node = fillRef.current;
    if (!node) return;

    /* Collapse, then expand on the next frame. Setting both widths in the same
     * frame would produce no transition at all — the browser only interpolates
     * between two values it has actually laid out. */
    node.style.width = "0%";
    const frame = window.requestAnimationFrame(() => {
      node.style.width = `${PROFILE_DEMO_SCORE}%`;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [inView, reduceMotion]);

  return (
    <div ref={wrapperRef} className="flex flex-col gap-3">
      <p className="flex items-baseline gap-1.5">
        <span className="text-[clamp(44px,4.6vw,62px)] font-semibold leading-none tracking-[-0.06em] tabular-nums text-acid">
          <CountUp value={PROFILE_DEMO_SCORE} />
        </span>
        <span className="font-mono text-[11px] text-dim">
          / {PROFILE_SCORE_MAX}
        </span>
      </p>

      <span
        aria-hidden="true"
        className="block h-[5px] w-full overflow-hidden rounded-full bg-muted"
      >
        <span
          ref={fillRef}
          style={{
            width: `${PROFILE_DEMO_SCORE}%`,
            transitionDuration: `${FILL_MS}ms`,
          }}
          className="block h-full rounded-full bg-[linear-gradient(to_right,var(--acid-dim),var(--acid))] transition-[width] ease-out"
        />
      </span>
    </div>
  );
}

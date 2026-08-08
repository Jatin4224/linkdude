/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use client";

/**
 * SOURCE OF TRUTH KEYWORDS: CountUp, CountUpProps, useInView, useMotionValue,
 *   animate, number ticker, stat animation, prefers-reduced-motion, tabular-nums
 *
 * WHAT:  Counts a number up from zero to its real value the first time it
 *        scrolls into view, then stops.
 * WHY:   A quota is an abstract number; watching it climb makes the size of it
 *        register. Fires once — a stat that re-counts every time it passes the
 *        fold is an interface fighting its reader. The DOM text is written
 *        imperatively rather than through state so a 900ms count doesn't push
 *        900ms of React renders through the page while it is still loading, and
 *        the element ships with the FINAL value in its server HTML, so a reader
 *        without JS, a crawler, or anyone on reduced motion sees the real number
 *        rather than a zero.
 * WHERE: The free-tier stat band on the landing page.
 */

import * as React from "react";
import { animate, useInView, useReducedMotion } from "motion/react";

export interface CountUpProps {
  /** The real value. Rendered as-is on the server and at the end of the count. */
  value: number;
  /** Rendered instead of the number when the value isn't countable (e.g. "Unlimited"). */
  fallback?: string | undefined;
  className?: string | undefined;
}

/* Long for a UI animation, but this is marketing/explanatory motion — the count
 * has to be legible, and legibility is the whole point of it. */
const COUNT_DURATION_SECONDS = 1.1;

export function CountUp({ value, fallback, className }: CountUpProps) {
  const ref = React.useRef<HTMLSpanElement | null>(null);
  const reduceMotion = useReducedMotion();
  const inView = useInView(ref, { once: true, margin: "-80px" });

  React.useEffect(() => {
    if (!inView || reduceMotion || fallback !== undefined) return;
    const node = ref.current;
    if (!node) return;

    const controls = animate(0, value, {
      duration: COUNT_DURATION_SECONDS,
      ease: [0.23, 1, 0.32, 1],
      onUpdate: (latest) => {
        node.textContent = Math.round(latest).toLocaleString();
      },
    });

    return () => controls.stop();
  }, [inView, reduceMotion, value, fallback]);

  return (
    <span ref={ref} className={className}>
      {fallback ?? value.toLocaleString()}
    </span>
  );
}

/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use client";

/**
 * SOURCE OF TRUTH KEYWORDS: HeroPostMockup, LinkedInPostPreview, useSpring,
 *   useMotionValue, useMotionTemplate, useReducedMotion, mouse tracking, tilt,
 *   MARKETING_HERO_POST, spring animation
 *
 * WHAT:  The hero's post card with a spring-damped tilt that follows the cursor.
 * WHY:   This is the one interaction on the page a motion library earns: tying a
 *        transform straight to pointer position feels artificial because it has
 *        no momentum, and a spring is the only thing that fixes that — CSS
 *        transitions chase the value instead of carrying velocity through it.
 *        It is purely decorative, which is why it is confined to a marketing
 *        surface and skipped entirely for reduced-motion users and for anyone
 *        without a fine pointer (a tilt that tracks a finger is just a jitter).
 *        Everything else on this page stays on CSS, which keeps running smoothly
 *        while the page is still loading.
 * WHERE: src/app/(marketing)/_components/hero.tsx.
 */

import * as React from "react";
import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from "motion/react";

import { MARKETING_HERO_POST } from "@/lib/config";
import { LinkedInPostPreview } from "@/components/global/linkedin";

/* Traditional physics rather than a duration: the card should still be settling
 * when the cursor moves again, which is what reads as weight. */
const TILT_SPRING = { mass: 1, stiffness: 100, damping: 10 } as const;

/* Degrees at the far edge. Past ~7° the text starts to distort and the card
 * stops looking like a card. */
const MAX_TILT = 6;

export function HeroPostMockup() {
  const reduceMotion = useReducedMotion();
  const ref = React.useRef<HTMLDivElement | null>(null);

  const tiltX = useSpring(useMotionValue(0), TILT_SPRING);
  const tiltY = useSpring(useMotionValue(0), TILT_SPRING);

  /* A full transform string, not the x/y/rotate shorthands: the shorthands run
   * on the main thread and drop frames while the rest of the page is loading. */
  const transform = useMotionTemplate`perspective(1200px) rotateX(${tiltX}deg) rotateY(${tiltY}deg)`;

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    /* Mouse only. On touch the "pointer" is wherever the finger last was, so
     * the card would sit tilted at a random angle after every tap. */
    if (reduceMotion || event.pointerType !== "mouse") return;
    const bounds = ref.current?.getBoundingClientRect();
    if (!bounds) return;

    const px = (event.clientX - bounds.left) / bounds.width - 0.5;
    const py = (event.clientY - bounds.top) / bounds.height - 0.5;
    /* Inverted on X so the card leans toward the cursor rather than away. */
    tiltX.set(-py * MAX_TILT * 2);
    tiltY.set(px * MAX_TILT * 2);
  }

  function handlePointerLeave() {
    tiltX.set(0);
    tiltY.set(0);
  }

  if (reduceMotion) {
    return <LinkedInPostPreview {...MARKETING_HERO_POST} className="shadow-xl" />;
  }

  return (
    <motion.div
      ref={ref}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      style={{ transform }}
      className="will-change-transform"
    >
      <LinkedInPostPreview {...MARKETING_HERO_POST} className="shadow-xl" />
    </motion.div>
  );
}

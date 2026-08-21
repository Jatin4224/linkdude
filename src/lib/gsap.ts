/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use client";

/**
 * SOURCE OF TRUTH KEYWORDS: gsap, ScrollTrigger, CustomEase, useGSAP,
 *   PAPER_EASE, PAPER_EASE_PATH, SCRUB, registerPlugin, scroll animation,
 *   landing motion, --ease-out, reduced motion
 *
 * WHAT:  The single place gsap is configured — plugins registered once, and the
 *        app's easing curve published as a named gsap ease.
 * WHY:   `gsap.registerPlugin` is idempotent but the CURVE is not: defining the
 *        ease at each call site is how an app ends up with four nearly-identical
 *        cubic-beziers and no way to retune them. `paperOut` is built from the
 *        SAME control points as --ease-out in globals.css, so CSS transitions
 *        and gsap tweens on these pages share one curve by construction rather
 *        than by somebody remembering to keep two numbers in sync.
 *
 *        Registration is guarded on `window` because this module is imported by
 *        client components that still render on the server: ScrollTrigger reads
 *        the document when it installs, and registering during SSR throws.
 *
 *        Deliberately NOT a barrel over the whole of gsap — call sites import
 *        `gsap` from here so the plugins are guaranteed registered before the
 *        first tween, which is the failure mode of importing gsap directly and
 *        getting a silently ignored `scrollTrigger` config.
 * WHERE: src/app/(marketing)/_components/sticky-hero.tsx and
 *        src/components/global/paper/paper-reveal.tsx.
 */

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { CustomEase } from "gsap/CustomEase";
import { useGSAP } from "@gsap/react";

/**
 * SOURCE OF TRUTH KEYWORDS: PAPER_EASE_PATH, --ease-out, cubic-bezier
 *
 * WHAT:  --ease-out — cubic-bezier(0.23, 1, 0.32, 1) — as a CustomEase path.
 * WHY:   CustomEase takes an SVG cubic path, and `M0,0 C<x1>,<y1> <x2>,<y2> 1,1`
 *        is the exact translation of a CSS cubic-bezier's two control points.
 *        Written out here so the relationship to the CSS token is visible rather
 *        than encoded in four loose numbers.
 */
const PAPER_EASE_PATH = "M0,0 C0.23,1 0.32,1 1,1";

/** Name to pass as `ease:` in any tween on the public surfaces. */
export const PAPER_EASE = "paperOut";

/**
 * SOURCE OF TRUTH KEYWORDS: SCRUB
 *
 * WHAT:  The smoothing applied to every scroll-linked tween.
 * WHY:   `scrub: true` maps motion to scroll position with zero lag, which reads
 *        as mechanical — the element is welded to the scrollbar. A small numeric
 *        scrub gives gsap that many seconds to catch up, which is what makes
 *        scroll-driven motion feel like it has weight. One constant so every
 *        scrubbed element on the page shares the same inertia; two different
 *        values in one viewport read as a bug.
 */
export const SCRUB = 0.6;

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger, CustomEase, useGSAP);
  CustomEase.create(PAPER_EASE, PAPER_EASE_PATH);
}

export { gsap, ScrollTrigger, useGSAP };

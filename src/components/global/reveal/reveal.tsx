/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use client";

/**
 * SOURCE OF TRUTH KEYWORDS: Reveal, RevealProps, IntersectionObserver,
 *   scroll reveal, data-reveal, data-reveal-armed, data-reveal-failsafe,
 *   reveal-delay, stagger, prefers-reduced-motion, scroll animation, fade in
 *
 * WHAT:  Wraps children and flips them from the pre-enter state to the revealed
 *        state the first time they scroll into view.
 * WHY:   The app ships no animation library, and adding one for a fade would be
 *        ~35kb of client JS for an effect that is four CSS declarations. The
 *        observer only toggles data attributes — globals.css owns the motion,
 *        which is also what lets a single media query cancel it for
 *        reduced-motion users without a JS branch. Reveal-once by design: the
 *        observer disconnects on first intersection, so a long page does no
 *        scroll work after its content has been seen.
 *
 *        This component is load-bearing for whether the landing page has any
 *        content on it, so every path out of the hidden state is deliberate and
 *        there are four of them — see REVEAL SAFETY below.
 * WHERE: Every section under src/app/(marketing)/_components.
 */

import * as React from "react";

export interface RevealProps {
  children: React.ReactNode;
  /** Transition delay in ms — the stagger knob. Pass `index * 70` in a list. */
  delay?: number;
  /** Fraction of the element that must be visible before it reveals. */
  threshold?: number;
  className?: string | undefined;
}

/* REVEAL SAFETY — the four independent ways an element leaves the hidden state.
 * Any ONE of them is enough, which is the point: a hidden element is invisible
 * content, so the question is never "does this work" but "what is left if it
 * doesn't".
 *
 *   1. The observer fires.                          (the normal path)
 *   2. It was already on screen at mount.           (below)
 *   3. A JS timer gives up waiting.                 (FAILSAFE_* below)
 *   4. A CSS animation resolves it after 4s.        (globals.css, no JS at all)
 *
 * 4 is the one that matters most and the only one that survives the bundle
 * never arriving; 3 covers a mounted-but-misbehaving observer, which is the
 * likelier bug. Nothing anywhere sets an element back to hidden. */

/* Long enough that a slow first paint doesn't trip it before the observer has
 * had a fair chance, short enough that a reader never sees the hole. */
const FAILSAFE_ONSCREEN_MS = 1600;
const FAILSAFE_ABSOLUTE_MS = 4000;

export function Reveal({
  children,
  delay = 0,
  /* Zero, with the timing handled by rootMargin below. A fractional threshold
   * looks tidier but silently strands any element taller than the viewport can
   * show that fraction of. */
  threshold = 0,
  className,
}: RevealProps) {
  const ref = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const node = ref.current;
    if (!node) return;

    /* Disarms the CSS failsafe in globals.css. FIRST statement in the effect, so
     * the 4s pop-in only ever happens when this code genuinely did not run. */
    node.setAttribute("data-reveal-armed", "true");

    /* The revealed flag is written straight to the DOM instead of held in
     * state. Nothing in React's tree depends on it — only CSS does — so state
     * would buy a re-render per element for an attribute swap the browser can
     * do alone. It also keeps the no-observer fallback below out of the
     * "setState synchronously in an effect" trap.
     *
     * `data-reveal-failsafe` is a SECOND attribute rather than another value of
     * data-reveal because React owns data-reveal (it renders "hidden") and will
     * reset it on any re-render that touches this element. An attribute React
     * has never heard of cannot be reverted, so a remount can't blank a section
     * that was already on screen. */
    let revealed = false;
    function reveal() {
      if (revealed || !node) return;
      revealed = true;
      node.setAttribute("data-reveal", "shown");
      node.setAttribute("data-reveal-failsafe", "true");
    }

    /* No observer (a very old browser, or a non-DOM test renderer) → show the
     * content rather than leaving the page permanently invisible. */
    if (typeof IntersectionObserver === "undefined") {
      reveal();
      return;
    }

    /* Anything already on screen at mount is revealed outright, WITHOUT waiting
     * for the observer. This is not an optimisation — it is the fix for a real
     * failure: the observer's first callback can land before layout has settled
     * and report "not intersecting", and an element that is already fully
     * visible then never crosses a threshold again, so no second callback ever
     * comes and the content stays invisible forever. Above the fold that means
     * a blank hero. The transition still plays, because the element painted in
     * its hidden state before this effect ran. */
    const rect = node.getBoundingClientRect();
    const onScreen = rect.top < window.innerHeight && rect.bottom > 0;
    /* Already scrolled past before this mounted — a restored scroll position, or
     * a fast scroll during hydration. The observer would only fire if the reader
     * scrolled back up, leaving a hole behind them, so reveal it now. */
    const scrolledPast = rect.bottom <= 0;
    if (onScreen || scrolledPast) {
      reveal();
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          reveal();
          observer.disconnect();
        }
      },
      /* The negative margins fire the reveal slightly after the element crosses
       * the fold, which reads as intentional rather than as content racing the
       * scroll. */
      { threshold, rootMargin: "-8% 0px -12% 0px" },
    );

    observer.observe(node);

    /* Timer failsafes (path 3). The first only rescues an element the reader can
     * actually see — an observer that mounted but never reported. The second
     * gives up on the observer entirely; by then a still-hidden element is a bug
     * whatever the cause, and a section that fades in unprompted is strictly
     * better than one that is not there. */
    const onScreenTimer = window.setTimeout(() => {
      const box = node.getBoundingClientRect();
      if (box.top < window.innerHeight && box.bottom > 0) reveal();
    }, FAILSAFE_ONSCREEN_MS);

    const absoluteTimer = window.setTimeout(reveal, FAILSAFE_ABSOLUTE_MS);

    return () => {
      observer.disconnect();
      window.clearTimeout(onScreenTimer);
      window.clearTimeout(absoluteTimer);
    };
  }, [threshold]);

  /* Built as a variable, not an inline literal: a literal object would trip the
   * excess-property check on CSSProperties, and a cast is not an option here. */
  const style: React.CSSProperties & { "--reveal-delay": string } = {
    "--reveal-delay": `${delay}ms`,
  };

  return (
    <div ref={ref} data-reveal="hidden" style={style} className={className}>
      {children}
    </div>
  );
}

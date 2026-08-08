/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use client";

/**
 * SOURCE OF TRUTH KEYWORDS: Reveal, RevealProps, IntersectionObserver,
 *   scroll reveal, data-reveal, reveal-delay, stagger, prefers-reduced-motion,
 *   scroll animation, fade in
 *
 * WHAT:  Wraps children and flips them from the pre-enter state to the revealed
 *        state the first time they scroll into view.
 * WHY:   The app ships no animation library, and adding one for a fade would be
 *        ~35kb of client JS for an effect that is four CSS declarations. The
 *        observer only toggles a data attribute — globals.css owns the motion,
 *        which is also what lets a single media query cancel it for
 *        reduced-motion users without a JS branch. Reveal-once by design: the
 *        observer disconnects on first intersection, so a long page does no
 *        scroll work after its content has been seen.
 * WHERE: Every section under src/app/(marketing)/_components.
 */

import * as React from "react";

export interface RevealProps {
  children: React.ReactNode;
  /** Transition delay in ms — the stagger knob. Pass `index * 90` in a list. */
  delay?: number;
  /** Fraction of the element that must be visible before it reveals. */
  threshold?: number;
  className?: string | undefined;
}

export function Reveal({
  children,
  delay = 0,
  threshold = 0.15,
  className,
}: RevealProps) {
  const ref = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const node = ref.current;
    if (!node) return;

    /* The revealed flag is written straight to the DOM instead of held in
     * state. Nothing in React's tree depends on it — only CSS does — so state
     * would buy a re-render per element for an attribute swap the browser can
     * do alone. It also keeps the no-observer fallback below out of the
     * "setState synchronously in an effect" trap. React never fights the change:
     * it diffs against the "hidden" it last rendered, sees no difference, and
     * leaves the attribute alone. */
    function reveal() {
      node?.setAttribute("data-reveal", "shown");
    }

    /* No observer (a very old browser, or a non-DOM test renderer) → show the
     * content rather than leaving the page permanently invisible. */
    if (typeof IntersectionObserver === "undefined") {
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
      /* The negative bottom margin fires the reveal slightly after the element
       * crosses the fold, which reads as intentional rather than as content
       * racing the scroll. */
      { threshold, rootMargin: "0px 0px -10% 0px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
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

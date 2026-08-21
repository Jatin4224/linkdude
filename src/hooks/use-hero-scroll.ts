/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use client";

/**
 * SOURCE OF TRUTH KEYWORDS: useHeroScroll, HeroScrollState, sticky hero,
 *   scroll beat, beat index, isPastHero, requestAnimationFrame, passive
 *   listener, MARKETING_SECTION_IDS, landing hero, header blend
 *
 * WHAT:  Maps scroll progress through the tall hero track onto a beat index and
 *        a "the hero is behind us" flag.
 * WHY:   The sticky hero is the page's one real mechanic: a 280svh section
 *        containing a 100svh sticky stage, where how far you are THROUGH the
 *        section — not how far down the page — decides which beat shows. That is
 *        `-rect.top / (rect.height - innerHeight)`, and getting it from the
 *        element's own rect rather than from window.scrollY is what makes it
 *        correct regardless of what is rendered above the hero.
 *
 *        It is a hook rather than state inside the hero because TWO components
 *        need the same reading and they are in different trees: the hero (which
 *        beat) and the header in the layout (has the hero been passed, so should
 *        the difference-blend give way to a solid bar). Looking the track up by
 *        ID rather than passing a ref is what lets the header watch an element
 *        the layout never renders — and a page with no such element resolves to
 *        "past the hero", so the header is simply solid there instead of
 *        blending against nothing.
 *
 *        Reads are rAF-throttled and the listener is passive, so scrolling never
 *        waits on this; setState is guarded on an actual change, so a scroll
 *        within one beat costs one rect read and no render.
 * WHERE: src/app/(marketing)/_components/sticky-hero.tsx and
 *        src/components/global/marketing/marketing-navbar.tsx.
 */

import * as React from "react";

/* How close to the end of the track counts as "past it". The header swaps a
 * little before the hero fully clears, so the bar is already solid by the time
 * the next section slides under it rather than changing while it is visible. */
const PAST_HERO_SLACK_PX = 60;

export interface HeroScrollState {
  /** Index into the beats array — always in range, even mid-resize. */
  beat: number;
  /** The sticky stage has been scrolled through, or there is no hero here. */
  isPastHero: boolean;
}

export function useHeroScroll(
  trackId: string,
  beatCount: number,
): HeroScrollState {
  const [state, setState] = React.useState<HeroScrollState>({
    beat: 0,
    isPastHero: false,
  });

  React.useEffect(() => {
    let queued = false;

    const read = () => {
      queued = false;
      const track = document.getElementById(trackId);
      /* No hero on this page: nothing to blend over, so report it as passed. */
      if (!track) {
        setState((prev) =>
          prev.isPastHero ? prev : { beat: 0, isPastHero: true },
        );
        return;
      }

      const rect = track.getBoundingClientRect();
      const span = rect.height - window.innerHeight;
      /* A track shorter than the viewport has no progress to measure — happens
         while fonts/images settle, and dividing by it would be Infinity. */
      if (span <= 0) return;

      const progress = Math.min(Math.max(-rect.top / span, 0), 0.999);
      const beat = Math.min(
        Math.floor(progress * beatCount),
        Math.max(beatCount - 1, 0),
      );
      const isPastHero = -rect.top > span - PAST_HERO_SLACK_PX;

      setState((prev) =>
        prev.beat === beat && prev.isPastHero === isPastHero
          ? prev
          : { beat, isPastHero },
      );
    };

    const onScroll = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(read);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    /* Resize matters as much as scroll here: the track is sized in svh, so a
       viewport change moves every beat boundary under the reader's feet. */
    window.addEventListener("resize", onScroll, { passive: true });
    /* Read once on mount — a reload part-way down the page must land on the
       right beat rather than on beat zero until the first scroll event. */
    read();

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [trackId, beatCount]);

  return state;
}

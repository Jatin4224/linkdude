/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use client";

/**
 * SOURCE OF TRUTH KEYWORDS: useHeroScroll, isPastHero, sticky hero, hero track,
 *   requestAnimationFrame, passive listener, MARKETING_SECTION_IDS, landing
 *   hero, header blend, mix-blend-difference, navbar solid
 *
 * WHAT:  Whether the reader has scrolled past the landing hero's track.
 * WHY:   The navbar is drawn OVER the hero in `mix-blend-difference` and has to
 *        become a solid bar the moment the hero is behind it. That is the only
 *        question left in this file. It used to answer a second one — which of
 *        the hero's four scroll beats was live — and that mechanic is gone: the
 *        hero now states its claim on first paint rather than assembling it
 *        across three viewports, so there is no beat to report and no caller
 *        left that asked for one. Returning a bare boolean rather than an
 *        object is what keeps a `beat` nobody reads from growing back.
 *
 *        Progress is read from the track's OWN rect — `-rect.top / (height -
 *        innerHeight)` — not from window.scrollY, which is what makes it
 *        correct regardless of what is rendered above the hero. Looking the
 *        track up by ID rather than taking a ref is what lets the header watch
 *        an element the layout never renders; a page with no such element
 *        resolves to "past the hero", so the header is simply solid there
 *        instead of blending against nothing.
 *
 *        Reads are rAF-throttled and the listener is passive, so scrolling
 *        never waits on this, and setState is guarded on an actual change — a
 *        whole scroll through the hero costs one render, at the boundary.
 * WHERE: src/components/global/marketing/marketing-navbar.tsx.
 */

import * as React from "react";

/* How close to the end of the track counts as "past it". The header swaps a
 * little before the hero fully clears, so the bar is already solid by the time
 * the next section slides under it rather than changing while it is visible. */
const PAST_HERO_SLACK_PX = 60;

export function useHeroScroll(trackId: string): boolean {
  const [isPastHero, setIsPastHero] = React.useState(false);

  React.useEffect(() => {
    let queued = false;

    const read = () => {
      queued = false;
      const track = document.getElementById(trackId);
      /* No hero on this page: nothing to blend over, so report it as passed. */
      if (!track) {
        setIsPastHero(true);
        return;
      }

      const rect = track.getBoundingClientRect();
      const span = rect.height - window.innerHeight;
      /* A track shorter than the viewport has no progress to measure — happens
         while fonts/images settle, and dividing by it would be Infinity. */
      if (span <= 0) return;

      setIsPastHero(-rect.top > span - PAST_HERO_SLACK_PX);
    };

    const onScroll = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(read);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    /* Resize matters as much as scroll here: the track is sized in svh, so a
       viewport change moves the boundary under the reader's feet. */
    window.addEventListener("resize", onScroll, { passive: true });
    /* Read once on mount — a reload part-way down the page must land solid
       rather than blended until the first scroll event. */
    read();

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [trackId]);

  return isPastHero;
}

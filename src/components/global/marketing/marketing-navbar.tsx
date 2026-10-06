/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use client";

/**
 * SOURCE OF TRUTH KEYWORDS: MarketingNavbar, useHeroScroll, mix-blend-difference,
 *   PaperLockup, PaperButton, GET_STARTED_HREF, GET_STARTED_LABEL,
 *   MARKETING_SECTION_IDS, fixed header, hero blend, solid bar
 *
 * WHAT:  The public site header — the brand lockup and one CTA, fixed over the
 *        hero and switching to a solid paper bar once the hero is behind it.
 * WHY:   Over the hero the bar has NO background at all: it uses
 *        `mix-blend-mode: difference`, so white type inverts against whatever
 *        the mascot and the display line put underneath it. That is what lets a
 *        header sit on top of a full-bleed hero without either a scrim or a
 *        colour that only works for one beat.
 *
 *        Difference-blend is also exactly why it has to STOP. Past the hero the
 *        header would be blending against unpredictable content — a blue band, a
 *        white composer panel, a dark band — and "inverted" stops meaning
 *        "legible". So at that point it becomes an opaque paper bar with an ink
 *        bottom rule and the CTA takes its solid blue fill, which is the state
 *        it keeps for the rest of the page.
 *
 *        A client component for that one boolean, which is the smallest it can
 *        be: the reading comes from useHeroScroll, shared with the hero itself,
 *        so the page runs ONE rAF-throttled scroll listener's worth of work per
 *        frame rather than two independent ones.
 *
 *        There is no nav: the design gives the header a wordmark and a single
 *        call to action, and the page is a scroll sequence rather than a set of
 *        destinations. A menu here would be a list of anchors into a story that
 *        only reads in order.
 * WHERE: src/app/(marketing)/layout.tsx.
 */

import {
  GET_STARTED_HREF,
  GET_STARTED_LABEL,
  MARKETING_HEADER_ATTR,
  MARKETING_SECTION_IDS,
} from "@/lib/config";
import { PaperButton, PaperLockup } from "@/components/global/paper";
import { useHeroScroll } from "@/hooks/use-hero-scroll";
import { cn } from "@/lib/utils";

export function MarketingNavbar() {
  const isPastHero = useHeroScroll(MARKETING_SECTION_IDS.top);

  return (
    <header
      /* Marked so the pinned product tour can MEASURE this bar rather than
         assume its height — see MARKETING_HEADER_ATTR. */
      {...{ [MARKETING_HEADER_ATTR]: "" }}
      className={cn(
        "fixed inset-x-0 top-0 z-40 flex items-center justify-between gap-4 border-b px-(--gutter) transition-[padding,background-color] duration-200 ease-out",
        isPastHero
          ? "border-ink bg-paper py-3"
          : "border-transparent py-[18px] mix-blend-difference",
      )}
    >
      <PaperLockup
        href={`#${MARKETING_SECTION_IDS.top}`}
        className={cn(
          "text-[19px]",
          /* Over the hero the type must be white for difference to invert it;
             on the solid bar it is ordinary ink. */
          isPastHero ? "text-ink" : "text-ink-foreground",
        )}
      />

      <PaperButton
        href={GET_STARTED_HREF}
        size="sm"
        arrow
        variant={isPastHero ? "blue" : "outline"}
        className={cn(
          !isPastHero &&
            "border-ink-foreground text-ink-foreground hover:bg-ink-foreground hover:text-ink",
        )}
      >
        {GET_STARTED_LABEL}
      </PaperButton>
    </header>
  );
}

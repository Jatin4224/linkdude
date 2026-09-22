/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use client";

/**
 * SOURCE OF TRUTH KEYWORDS: StickyHero, MARKETING_HERO_BEATS, useHeroScroll,
 *   gsap, ScrollTrigger, useGSAP, SCRUB, HeroNote, HeroContextCard, PaperOrbit,
 *   PaperMascot, sticky stage, 280svh
 *
 * WHAT:  The first screen — a 280svh track containing a 100svh sticky stage
 *        holding three objects: the mascot, the setup card to its right, and the
 *        note to its left that dies as the reader scrolls.
 *
 * WHY:   THREE OBJECTS, NOT SEVEN. The hero used to put a line in the top left
 *        corner, a fragment in the top right, display type across the middle and
 *        a character behind all of it, each swinging in on its own arc around
 *        the mascot's centre. Every one of them was competing for the same
 *        moment, and the screen read as noise rather than as a composition. The
 *        corner copy now lives in a card, the display line lives on a note, and
 *        the character stands between them — so the stage has a left, a middle
 *        and a right, and nothing overlaps anything.
 *
 *        That also removed the machinery this file was mostly made of: the
 *        per-line swing, its arc-length maths and its perspective constants went
 *        with the lines they were animating. What is left is ONE scroll-linked
 *        tween — the mascot's swell — and two cards that own their own beat
 *        transitions.
 *
 *        Two decisions survive from the previous version and both are easy to
 *        undo by accident:
 *
 *        1. The stage stays `position: sticky` and is NOT ScrollTrigger-pinned.
 *           Pinning would inject a spacer and take over the layout; sticky
 *           already does the job, works with JS switched off, and leaves
 *           ScrollTrigger with one job — reading progress.
 *
 *        2. The resting layout is what the server renders, and every tween is a
 *           `from`. If the bundle never arrives the hero is a finished, legible
 *           screen rather than a blank one.
 * WHERE: src/app/(marketing)/page.tsx, first. Its id is the element
 *        src/components/global/marketing/marketing-navbar.tsx watches.
 */

import * as React from "react";
import { ArrowRightIcon, ChevronDownIcon } from "lucide-react";

import {
  GET_STARTED_HREF,
  GET_STARTED_LABEL,
  MARKETING_HERO_BEATS,
  MARKETING_HERO_ORBIT,
  MARKETING_REASSURANCE,
  MARKETING_SECTION_IDS,
} from "@/lib/config";
import {
  PaperLabel,
  PaperButton,
  PaperMascot,
  PaperOrbit,
} from "@/components/global/paper";
import { SCRUB, gsap, useGSAP } from "@/lib/gsap";
import { useHeroScroll } from "@/hooks/use-hero-scroll";
import { cn } from "@/lib/utils";

import { HeroContextCard } from "./hero-context-card";
import { HeroNote } from "./hero-note";

export function StickyHero() {
  const { beat } = useHeroScroll(
    MARKETING_SECTION_IDS.top,
    MARKETING_HERO_BEATS.length,
  );

  const stage = React.useRef<HTMLDivElement | null>(null);
  const mascot = React.useRef<HTMLImageElement | null>(null);

  const isLastBeat = beat === MARKETING_HERO_BEATS.length - 1;
  const current = MARKETING_HERO_BEATS[beat] ?? MARKETING_HERO_BEATS[0];

  useGSAP(
    () => {
      const stageEl = stage.current;
      if (!stageEl) return;

      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const track = document.getElementById(MARKETING_SECTION_IDS.top);
        if (!track) return;

        /* The mascot swells slightly through the section. It is the fixed point
           the cards are arranged around, so it moves least — a background that
           moves as much as the foreground flattens the whole stage. */
        gsap.fromTo(
          mascot.current,
          { transform: "translateX(-50%) scale(1)" },
          {
            transform: "translateX(-50%) scale(1.06)",
            ease: "none",
            scrollTrigger: {
              trigger: track,
              start: "top top",
              end: "bottom bottom",
              scrub: SCRUB,
            },
          },
        );

        /* The decorative marks are NOT driven from here — PaperOrbit projects
           them onto a sphere centred on this same mascot and spins it against
           the same scroll range. */
      });

      return () => mm.revert();
    },
    { scope: stage },
  );

  return (
    <section id={MARKETING_SECTION_IDS.top} className="relative h-[280svh]">
      <div ref={stage} className="sticky top-0 h-svh overflow-hidden">
        {/* Bottom-anchored and cropped by the stage: the mascot is taller than
            the space it is given, which is what stops it reading as a sticker
            dropped onto the page.

            The `105vw` term in the height is the phone fix, and it is doing more
            than it looks. The artwork is square, so bounding only its HEIGHT
            bounds nothing on a narrow screen: at 390×844 the original
            `min(86svh, 780px)` resolved to 726px — a 726px-wide character on a
            390px viewport, which reads as a cropped face rather than as a
            mascot. Adding a viewport-WIDTH term makes the narrow case bind on
            width and the wide case still bind on height. */}
        <PaperMascot
          ref={mascot}
          width={780}
          height={780}
          priority
          className="absolute bottom-[-5%] left-1/2 z-[1] h-[min(80svh,720px,96vw)] w-auto -translate-x-1/2"
        />

        {/* The two cards, with the mascot standing between them. A three-column
            grid whose MIDDLE column is empty: the character is positioned
            independently, and reserving its column is what guarantees neither
            card can ever reach it, at any width, without a breakpoint per card.

            Below the breakpoint the columns collapse and the cards stack at the
            top of the stage, over the mascot's head — side by side they would
            each be about 150px wide on a phone. */}
        {/* ABOVE the decorative marks, which sort themselves to z-index 3 when
            their sphere brings them to the front. At the same level the marks
            won on DOM order and landed an arrow across the setup card's second
            line — texture over type, which is the wrong way round. */}
        <div className="absolute inset-0 z-[4] grid content-start items-center gap-[clamp(14px,2vw,32px)] px-[clamp(16px,4vw,72px)] pt-[clamp(28px,8svh,80px)] min-[900px]:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_minmax(0,1fr)] min-[900px]:content-center min-[900px]:pt-0">
          {/* The setup is written FIRST for a screen reader — it is the opening
              of the sentence — and placed in the right-hand column. The note
              carries the heading, so the order a reader hears is the order the
              copy was written in, whichever side each card is painted on. */}
          <HeroContextCard
            lead={current?.lead ?? ""}
            aside={current?.aside ?? ""}
            className="w-full max-w-[21rem] justify-self-center min-[900px]:col-start-3 min-[900px]:justify-self-start"
          />

          <HeroNote
            words={current?.punch ?? []}
            isDead={beat > 0}
            as={beat === 0 ? "h1" : "p"}
            className="w-fit justify-self-center min-[900px]:col-start-1 min-[900px]:row-start-1 min-[900px]:justify-self-end"
          />
        </div>

        {/* The ask, on the closing beat only — so there is exactly ONE call to
            action in the hero's DOM, and it arrives once the setup has paid
            off. */}
        <div
          className={cn(
            "absolute inset-x-0 bottom-[clamp(52px,9svh,110px)] z-[6] flex flex-wrap items-center justify-center gap-3.5 px-[clamp(16px,4vw,72px)] transition-[opacity,transform] duration-[420ms] ease-out",
            isLastBeat
              ? "pointer-events-auto opacity-100"
              : "pointer-events-none translate-y-2.5 opacity-0",
          )}
        >
          {/* On its own sheet of paper. The ask sits at the foot of the stage,
              which is exactly where the mascot's dark trousers are — a blue
              button and a grey line laid straight over that artwork were both
              close to unreadable. Giving the row the same paper plate the cards
              use puts it back on the page's own ground, so its contrast no
              longer depends on what happens to be behind it. */}
          <span className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2.5 border border-ink bg-paper px-[clamp(14px,1.6vw,22px)] py-[clamp(12px,1.4vw,18px)]">
            <PaperButton href={GET_STARTED_HREF}>
              {GET_STARTED_LABEL}
              <ArrowRightIcon className="size-[15px]" />
            </PaperButton>
            {/* Ink, not grey: grey is for metadata on cream, and this line is
                the one that removes the last objection before the click. */}
            <PaperLabel tone="ink" as="span">
              {MARKETING_REASSURANCE}
            </PaperLabel>
          </span>
        </div>

        {/* The sphere. Centred on the mascot and spun by the same scroll range
            as everything else on this stage; its marks sort themselves in front
            of and behind the character by their own depth. */}
        <PaperOrbit
          marks={MARKETING_HERO_ORBIT}
          centerRef={mascot}
          triggerId={MARKETING_SECTION_IDS.top}
        />

        {/* Progress dots + the scroll cue. The dots are the only thing telling a
            reader that the tall section is a sequence and not a stall. */}
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 z-[6] flex items-center justify-center gap-3.5 p-3.5"
        >
          {MARKETING_HERO_BEATS.map((item, index) => (
            <span
              key={item.lead}
              className={cn(
                "h-2 rounded-full transition-[width,background-color] duration-300 ease-out",
                index === beat ? "w-[26px] bg-blue" : "w-2 bg-ink/20",
              )}
            />
          ))}
          <ChevronDownIcon className="animate-paper-cue size-3.5 text-grey" />
        </div>
      </div>
    </section>
  );
}

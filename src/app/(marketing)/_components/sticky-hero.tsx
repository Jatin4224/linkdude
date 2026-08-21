/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use client";

/**
 * SOURCE OF TRUTH KEYWORDS: StickyHero, MARKETING_HERO_BEATS, useHeroScroll,
 *   gsap, ScrollTrigger, useGSAP, PAPER_EASE, SCRUB, transformOrigin,
 *   transformPerspective, rotationY, 3D swing, sphere, PaperOrbit, PaperDisplay,
 *   PaperMascot, sticky stage, 280svh
 *
 * WHAT:  The first screen — a 280svh track containing a 100svh sticky stage, in
 *        which the copy swings in and out AROUND the mascot in three dimensions
 *        while a sphere of decorative marks turns about the same centre.
 *
 * WHY:   The orbit is the whole idea, and it is one trick: every animated line
 *        gets its `transform-origin` set to the MASCOT'S CENTRE — with a Z of
 *        zero, so the axis runs vertically THROUGH the character — and then only
 *        `rotationY` is animated. Rotating about an origin outside the element
 *        sweeps it around that point in DEPTH: copy left of the mascot travels
 *        away from the camera while copy on the right swings toward it, which is
 *        what makes the line appear to pass behind the character rather than
 *        slide across it. One transform per element, no path plugin, no
 *        per-frame trigonometry, and it stays on the compositor.
 *
 *        `transformPerspective` is set per element rather than `perspective` on
 *        a shared parent on purpose: a parent perspective establishes ONE
 *        vanishing point for every child, so lines far from the centre shear
 *        toward it. Per-element perspective gives each line its own camera and
 *        keeps the type square to the reader.
 *
 *        Three decisions hold the rest up:
 *
 *        1. BOTH beats are in the DOM, stacked, and gsap cross-fades them. The
 *           previous version swapped text inside one node and alternated between
 *           two identical keyframes to force a restart — which meant a fast
 *           scroll restarted the entrance from opacity 0 and flashed. gsap
 *           tweens the real elements with `overwrite: "auto"`, so an interrupted
 *           beat change retargets from wherever it actually is.
 *
 *        2. The stage stays `position: sticky` and is NOT ScrollTrigger-pinned.
 *           Pinning would inject a spacer and take over the layout; sticky
 *           already does the job, works with JS switched off, and leaves
 *           ScrollTrigger with one job — reading progress.
 *
 *        3. Every tween is a `from`, and the resting layout is what the server
 *           renders. If the bundle never arrives the hero is a finished, legible
 *           screen rather than a blank one.
 *
 *        The text layer is pointer-events-none so the mascot behind it is never
 *        what a click lands on; the CTA re-enables pointers on itself.
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
  PaperDisplay,
  PaperMascot,
  PaperOrbit,
} from "@/components/global/paper";
import { PAPER_EASE, SCRUB, gsap, useGSAP } from "@/lib/gsap";
import { useHeroScroll } from "@/hooks/use-hero-scroll";
import { cn } from "@/lib/utils";

/* How far a line should TRAVEL sideways on its way in or out, in px, rather
 * than how many degrees it should turn.
 *
 * Degrees are the wrong unit here and it shows immediately: every line rotates
 * about the same distant pivot, so a fixed angle moves a line near the mascot a
 * few dozen px and a line out at the corner nearly four hundred — the corner
 * copy flies off the edge while the centred display line barely leaves home.
 * Fixing the arc LENGTH instead and deriving each line's angle from its own
 * radius gives them all the same apparent journey. */
const SWING_IN_TRAVEL = 190;
const SWING_OUT_TRAVEL = 130;

/* ...within these bounds. The floor keeps a line that happens to sit almost on
 * the pivot from barely moving; the ceiling stops one very close to it from
 * spinning through a quarter turn and reading as a flipping card. */
const SWING_MIN_DEGREES = 16;
const SWING_MAX_DEGREES = 54;

/* Camera distance for the swing. Shorter is a wider lens: below about 700 the
 * near edge of a full-width display line balloons and the text distorts, above
 * about 1400 the rotation flattens into a fade. */
const SWING_PERSPECTIVE = 1000;

/**
 * SOURCE OF TRUTH KEYWORDS: swingDegreesFor, arc length, radius
 *
 * WHAT:  The turn angle that moves a line `travel` px sideways, given how far it
 *        sits from the pivot.
 * WHERE: The beat-change choreography below.
 */
function swingDegreesFor(distanceFromPivot: number, travel: number): number {
  const radius = Math.max(distanceFromPivot, 1);
  const degrees = (Math.atan(travel / radius) * 180) / Math.PI;
  return Math.min(Math.max(degrees, SWING_MIN_DEGREES), SWING_MAX_DEGREES);
}

export function StickyHero() {
  const { beat } = useHeroScroll(
    MARKETING_SECTION_IDS.top,
    MARKETING_HERO_BEATS.length,
  );

  const stage = React.useRef<HTMLDivElement | null>(null);
  const mascot = React.useRef<HTMLImageElement | null>(null);
  const previousBeat = React.useRef(beat);

  const isLastBeat = beat === MARKETING_HERO_BEATS.length - 1;

  /* ---------- The continuous, scroll-linked layer ---------- */
  useGSAP(
    () => {
      const stageEl = stage.current;
      if (!stageEl) return;

      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const track = document.getElementById(MARKETING_SECTION_IDS.top);
        if (!track) return;

        const scrollTrigger = {
          trigger: track,
          start: "top top",
          end: "bottom bottom",
          scrub: SCRUB,
        } as const;

        /* The mascot swells slightly through the section. It is the fixed point
           everything else orbits, so it moves least — a background that moves as
           much as the foreground flattens the whole stage. */
        gsap.fromTo(
          mascot.current,
          { transform: "translateX(-50%) scale(1)" },
          {
            transform: "translateX(-50%) scale(1.09)",
            ease: "none",
            scrollTrigger,
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

  /* ---------- The beat change ---------- */
  useGSAP(
    () => {
      const stageEl = stage.current;
      const mascotEl = mascot.current;
      if (!stageEl || !mascotEl) return;

      const from = previousBeat.current;
      previousBeat.current = beat;

      const mm = gsap.matchMedia();

      mm.add(
        {
          motion: "(prefers-reduced-motion: no-preference)",
          reduce: "(prefers-reduced-motion: reduce)",
        },
        (context) => {
          const { reduce } = context.conditions as {
            motion: boolean;
            reduce: boolean;
          };

          const layers = gsap.utils.toArray<HTMLElement>("[data-beat]");

          /* The pivot, in stage coordinates. Read per run rather than cached:
             the mascot is sized in svh, so its centre moves on every resize and
             on mobile browser-chrome show/hide. */
          const stageBox = stageEl.getBoundingClientRect();
          const mascotBox = mascotEl.getBoundingClientRect();
          const pivotX = mascotBox.left + mascotBox.width / 2 - stageBox.left;
          const pivotY = mascotBox.top + mascotBox.height / 2 - stageBox.top;

          layers.forEach((layer) => {
            const index = Number(layer.dataset["beat"]);
            const active = index === beat;
            const lines = gsap.utils.toArray<HTMLElement>(
              "[data-beat-line]",
              layer,
            );

            gsap.set(layer, { pointerEvents: active ? "auto" : "none" });

            if (reduce) {
              gsap.to([layer, ...lines], {
                opacity: active ? 1 : 0,
                duration: 0.25,
                ease: "none",
                overwrite: "auto",
              });
              return;
            }

            /* Origin at the mascot's centre EXPRESSED RELATIVE TO EACH LINE,
               with a Z of 0 so the axis passes THROUGH the character. This is
               the line that turns a rotation into a 3D orbit: rotationY about
               an origin outside the element sweeps it around that point in
               depth, so copy to the left of the mascot travels away from the
               camera while copy to the right swings toward it. */
            const radii = new Map<HTMLElement, number>();
            lines.forEach((line) => {
              const box = line.getBoundingClientRect();
              const offsetX = pivotX - (box.left - stageBox.left);
              const offsetY = pivotY - (box.top - stageBox.top);
              radii.set(
                line,
                Math.hypot(offsetX - box.width / 2, offsetY - box.height / 2),
              );
              gsap.set(line, {
                transformPerspective: SWING_PERSPECTIVE,
                transformOrigin: `${offsetX}px ${offsetY}px 0px`,
              });
            });

            if (!active) {
              /* Leaving copy keeps travelling the way it came, so the two beats
                 read as one continuous rotation rather than a swap. */
              const direction = index < beat ? -1 : 1;
              gsap.to(lines, {
                rotationY: (_i, target: HTMLElement) =>
                  direction *
                  swingDegreesFor(radii.get(target) ?? 0, SWING_OUT_TRAVEL),
                opacity: 0,
                duration: 0.42,
                ease: PAPER_EASE,
                overwrite: "auto",
              });
              return;
            }

            const entryDirection = index > from ? 1 : -1;
            gsap.fromTo(
              lines,
              {
                rotationY: (_i, target: HTMLElement) =>
                  entryDirection *
                  swingDegreesFor(radii.get(target) ?? 0, SWING_IN_TRAVEL),
                opacity: 0,
              },
              {
                rotationY: 0,
                opacity: 1,
                duration: 0.72,
                ease: PAPER_EASE,
                stagger: 0.07,
                overwrite: "auto",
              },
            );
          });
        },
      );

      return () => mm.revert();
    },
    { scope: stage, dependencies: [beat] },
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
            width and the wide case still bind on height, so the figure lands at
            roughly 105% of the screen on a phone and 54% on a desktop without a
            breakpoint anywhere. */}
        <PaperMascot
          ref={mascot}
          width={780}
          height={780}
          priority
          className="absolute bottom-[-5%] left-1/2 z-[1] h-[min(86svh,780px,105vw)] w-auto -translate-x-1/2"
        />

        {/* Both beats live here, stacked in the same grid, so each one keeps the
            exact three-band layout and gsap can cross-fade the real elements
            rather than swapping text inside one node. Inactive layers are
            `inert`: that takes them out of the tab order AND the accessibility
            tree in one attribute, which is what stops a screen reader hearing
            two contradictory headlines at the same scroll position. */}
        {MARKETING_HERO_BEATS.map((current, index) => (
          <div
            key={current.lead}
            data-beat={index}
            inert={index !== beat}
            className={cn(
              "pointer-events-none absolute inset-0 z-[2] grid grid-rows-[auto_minmax(0,1fr)_auto] px-[clamp(14px,2.5vw,34px)] pt-[clamp(66px,9.5vh,112px)] pb-[clamp(46px,7vh,94px)]",
              index !== beat && "opacity-0",
            )}
          >
            <div className="flex items-start justify-between gap-[clamp(12px,3vw,40px)]">
              <p
                data-beat-line
                className="m-0 max-w-[min(54%,12em)] text-[clamp(22px,min(4.6vw,7.2svh),68px)] leading-none tracking-[-0.038em] text-balance"
              >
                {current.lead}
              </p>
              <p
                data-beat-line
                className="m-0 mt-[clamp(14px,5vh,68px)] max-w-[min(34%,7em)] text-right text-[clamp(20px,min(4vw,6.2svh),58px)] leading-none tracking-[-0.038em]"
              >
                {current.aside}
              </p>
            </div>

            {/* The slack band. Empty on purpose — it is the reason the light
                copy and the display line can never meet at any viewport size. */}
            <span aria-hidden="true" />

            <div className="flex flex-col items-center gap-[clamp(16px,2.8vh,32px)]">
              <PaperDisplay
                as={index === 0 ? "h1" : "p"}
                words={current.punch}
                data-beat-line
                className="justify-center text-center text-[clamp(40px,min(12.4vw,19svh),186px)] leading-[0.82] tracking-[-0.052em]"
              />

              {/* Rendered only on the closing beat — so there is exactly ONE
                  call to action in the whole hero's DOM, and the ask arrives
                  only once the setup has paid off. */}
              {index === MARKETING_HERO_BEATS.length - 1 ? (
                <div
                  className={cn(
                    "flex flex-wrap items-center justify-center gap-3.5 transition-[opacity,transform] duration-[420ms] ease-out",
                    isLastBeat
                      ? "pointer-events-auto opacity-100"
                      : "translate-y-2.5 opacity-0",
                  )}
                >
                  <PaperButton href={GET_STARTED_HREF}>
                    {GET_STARTED_LABEL}
                    <ArrowRightIcon className="size-[15px]" />
                  </PaperButton>
                  <PaperLabel tone="grey" as="span">
                    {MARKETING_REASSURANCE}
                  </PaperLabel>
                </div>
              ) : null}
            </div>
          </div>
        ))}

        {/* The sphere. Centred on the mascot and spun by the same scroll range
            as everything else on this stage; its marks sort themselves in front
            of and behind the character by their own depth, which is why it is a
            single layer here rather than the two the flat scatter needed. */}
        <PaperOrbit
          marks={MARKETING_HERO_ORBIT}
          centerRef={mascot}
          triggerId={MARKETING_SECTION_IDS.top}
        />

        {/* Progress dots + the scroll cue. The dots are the only thing telling a
            reader that the tall section is a sequence and not a stall. */}
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 z-[4] flex items-center justify-center gap-3.5 p-3.5"
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

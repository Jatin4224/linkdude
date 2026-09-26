/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use client";

/**
 * SOURCE OF TRUTH KEYWORDS: StickyHero, MARKETING_HERO_INTRO,
 *   MARKETING_HERO_SIGNOFF, MARKETING_HERO_BEAT_COUNT, useHeroScroll, gsap,
 *   ScrollTrigger, SCRUB, quickTo, MASCOT_LEAN, pointer lean, PaperOrbit,
 *   PaperMascot, PaperMascotEyes, sticky stage, call and
 *   response, accumulate
 *
 * WHAT:  The first screen — a sticky stage where the product introduces itself
 *        as three call-and-response pairs assembling around the mascot, closed
 *        by its own name.
 *
 * WHY:   THE PAIRS ACCUMULATE. Each beat adds a line to each side and dims what
 *        came before rather than replacing it, so by the last beat the whole
 *        promise is on screen and the sign-off lands on top of everything it
 *        summarises. Swapping one pair for the next — which is how this hero
 *        used to work — leaves the closing line standing alone, with the claims
 *        it refers to already gone.
 *
 *        THE SPLIT IS THE ARGUMENT. Calls sit left of the character, responses
 *        right of it: what the reader already does on one side, what the product
 *        adds on the other, with the thing being introduced standing between
 *        them. A centred stack would say the same words and none of that.
 *
 *        The middle column is EMPTY and reserved. The mascot is positioned
 *        independently, so keeping a column for it is what guarantees no line
 *        can reach it at any width without a breakpoint per line.
 *
 *        Three decisions carry over from the version before this one:
 *
 *        1. The stage stays `position: sticky` and is NOT ScrollTrigger-pinned.
 *           Pinning injects a spacer and takes over the layout; sticky already
 *           does the job, works with JS switched off, and leaves ScrollTrigger
 *           one job — reading progress.
 *
 *        2. The reveal is CSS transitions on a data attribute, not a tween per
 *           beat. A reader scrubbing back and forth crosses beats faster than a
 *           tween resolves, and transitions simply retarget; they also mean the
 *           resting state is what the server renders.
 *
 *        3. Reduced motion gets every line at once. The pairs are the content,
 *           so hiding them until a scroll that never animates would leave the
 *           hero empty rather than calm.
 * WHERE: src/app/(marketing)/page.tsx, first. Its id is the element
 *        src/components/global/marketing/marketing-navbar.tsx watches.
 */

import * as React from "react";
import { ChevronDownIcon } from "lucide-react";

import {
  GET_STARTED_HREF,
  GET_STARTED_LABEL,
  MARKETING_HERO_BEAT_COUNT,
  MARKETING_HERO_INTRO,
  MARKETING_HERO_ORBIT,
  MARKETING_HERO_SIGNOFF,
  MARKETING_REASSURANCE,
  MARKETING_SECTION_IDS,
} from "@/lib/config";
import {
  PaperLabel,
  PaperButton,
  PaperDisplay,
  PaperMascot,
  PaperMascotEyes,
  PaperOrbit,
  PAPER_MASCOT_EYES,
  PAPER_MASCOT_PUPILS,
} from "@/components/global/paper";
import { PAPER_EASE, SCRUB, gsap, useGSAP } from "@/lib/gsap";
import { useHeroScroll } from "@/hooks/use-hero-scroll";
import { cn } from "@/lib/utils";

/* What a line looks like before it has arrived, once it is the live one, and
 * after the next pair has taken over. Written as one lookup so the three states
 * cannot drift apart across the four places they are applied. */
const LINE_STATE = {
  waiting: "translate-y-3 opacity-0",
  live: "translate-y-0 opacity-100",
  /* Still readable, clearly finished — and MEASURED, not guessed. At 0.4 the
     past calls came out at 2.58:1 against the cream and the white text inside
     their ink boxes at 1.61:1, both under the 3:1 that WCAG AA asks of large
     text. On the closing beat six of the seven lines on screen are in this
     state, so that was most of the hero failing contrast. 0.62 clears it while
     still letting the live pair win the eye. */
  past: "translate-y-0 opacity-[0.62]",
} as const;

/**
 * SOURCE OF TRUTH KEYWORDS: MASCOT_LEAN, pointer lean, cursor tracking, quickTo,
 *   mascot sway, micro interaction
 *
 * WHAT:  How far the mascot leans toward the pointer, and how long it takes to
 *        get there.
 * WHY:   SMALL ENOUGH TO BE FELT RATHER THAN WATCHED. The figure is the fixed
 *        point the whole hero assembles around — the swell above already moves
 *        it less than anything else on the stage for that reason — so the lean
 *        has to stay under the threshold where it becomes the thing you are
 *        looking at. A 1.2° sway pivoting at the feet moves the head about
 *        12px at hero size, which reads as attention rather than animation.
 *
 *        The duration is the damping. Tracking the pointer with no lag makes
 *        the character feel welded to the cursor; six tenths of a second on
 *        the page's own curve makes it feel like it noticed.
 */
const MASCOT_LEAN = {
  /** Horizontal drift at the edge of the viewport, in px. */
  shift: 5,
  /** Vertical drift, smaller: the figure is standing, not floating. */
  rise: 4,
  /** Sway in degrees, pivoting at the feet — see `origin-bottom` below. */
  tilt: 1.2,
  /** Seconds to catch up. */
  duration: 0.6,
  /* THE EYES GO FURTHER AND GET THERE FIRST. The body is a lean the reader
     should feel without noticing; the eyes are the part that is supposed to
     read as looking, and an eye that drifts at the body's pace looks sleepy.
     The distance is in artwork units and is capped by PAPER_MASCOT_EYES —
     see the measurement note there before raising it. */
  gaze: PAPER_MASCOT_EYES.travel,
  gazeDuration: 0.35,
} as const;

/** Keeps a pointer beyond the viewport's midpoint from over-driving the lean. */
function clampUnit(value: number): number {
  return Math.min(1, Math.max(-1, value));
}

function lineState(index: number, beat: number): string {
  if (beat < index) return LINE_STATE.waiting;
  return beat === index ? LINE_STATE.live : LINE_STATE.past;
}

/**
 * SOURCE OF TRUTH KEYWORDS: usePrefersReducedMotion, prefers-reduced-motion
 *
 * WHAT:  Whether this reader has asked for less motion.
 * WHY:   The rest of the stage hands the question to `gsap.matchMedia`, which
 *        cannot help here: the pairs are revealed by React state, not by a
 *        tween, so without asking directly a reduced-motion reader would still
 *        have three quarters of the hero's copy hidden behind a scroll that
 *        never animates. False on the server and on first paint, which is the
 *        honest default — the query cannot be answered until the client runs.
 */
function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = React.useState(false);

  React.useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  return reduced;
}

export function StickyHero() {
  const { beat } = useHeroScroll(
    MARKETING_SECTION_IDS.top,
    MARKETING_HERO_BEAT_COUNT,
  );

  const stage = React.useRef<HTMLDivElement | null>(null);
  /* The WRAPPER, not the image: it is the box gsap transforms, the box the
   * orbit centres on, and the box the eye overlay fills. */
  const mascot = React.useRef<HTMLDivElement | null>(null);

  /* Reduced motion reads the hero as ONE composition: every pair present, the
   * sign-off with them, nothing waiting on a scroll position. */
  const reducedMotion = usePrefersReducedMotion();
  const revealed = reducedMotion ? MARKETING_HERO_BEAT_COUNT : beat;

  /* The sign-off is the beat after the last pair. Derived rather than a flag,
   * so adding a fourth pair moves it without touching this file. */
  const signoffBeat = MARKETING_HERO_INTRO.length;
  const isSignoff = revealed >= signoffBeat;

  useGSAP(
    () => {
      const stageEl = stage.current;
      if (!stageEl) return;

      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const track = document.getElementById(MARKETING_SECTION_IDS.top);
        if (!track) return;

        const mascotEl = mascot.current;
        if (!mascotEl) return;

        /* The mascot swells slightly through the section. It is the fixed point
           the lines assemble around, so it moves least — a subject that moves as
           much as the copy flattens the whole stage.

           WRITTEN AS GSAP PROPERTIES, NOT A `transform` STRING. It used to
           tween `transform: "translateX(-50%) scale(…)"`, which hands gsap one
           opaque value and makes every scroll tick overwrite the whole matrix —
           including whatever the pointer lean below had just put in it. As
           separate channels in gsap's transform cache, the swell and the lean
           can share the element without either erasing the other.

           The centring is SET, not tweened. In a fromTo, a property given a
           start but no end tweens back to whatever the element currently has,
           so an `xPercent: -50` in the from-vars alone would have walked the
           figure off centre as the section scrolled. It is `xPercent` here and
           `-translate-x-1/2` in the markup: the class centres the server HTML,
           and gsap zeroes the CSS translate when it takes the element over on
           mount. */
        gsap.set(mascotEl, { xPercent: -50 });

        gsap.fromTo(
          mascotEl,
          { scale: 1 },
          {
            scale: 1.06,
            ease: "none",
            scrollTrigger: {
              trigger: track,
              start: "top top",
              end: "bottom bottom",
              scrub: SCRUB,
            },
          },
        );

        /* IT LOOKS AT YOU. The one piece of motion on this page a reader drives
           with something other than the scrollbar — a character that ignores
           the cursor entirely is a picture, and this one is the brand.

           quickTo rather than a tween per event: it keeps one interpolator per
           property alive and re-aims it, which is the difference between
           retargeting a value and allocating a tween sixty times a second.
           Registered inside the no-preference branch, so a reduced-motion
           reader never even gets the listener, and matchMedia's revert takes
           the cleanup below with it. */
        const leanX = gsap.quickTo(mascotEl, "x", {
          duration: MASCOT_LEAN.duration,
          ease: PAPER_EASE,
        });
        const leanY = gsap.quickTo(mascotEl, "y", {
          duration: MASCOT_LEAN.duration,
          ease: PAPER_EASE,
        });
        const leanTilt = gsap.quickTo(mascotEl, "rotation", {
          duration: MASCOT_LEAN.duration,
          ease: PAPER_EASE,
        });

        /* The pupils, as ONE group — see PAPER_MASCOT_EYES. Queried rather
           than passed as a ref because the overlay is the mascot component's
           business, not this file's; all this file needs is something to aim. */
        const pupils = mascotEl.querySelector(`[${PAPER_MASCOT_PUPILS}]`);
        const gazeX = pupils
          ? gsap.quickTo(pupils, "x", {
              duration: MASCOT_LEAN.gazeDuration,
              ease: PAPER_EASE,
            })
          : null;
        const gazeY = pupils
          ? gsap.quickTo(pupils, "y", {
              duration: MASCOT_LEAN.gazeDuration,
              ease: PAPER_EASE,
            })
          : null;

        /* One rect read per FRAME, not per event. The pointer fires faster than
           the screen refreshes, and the rect is a forced layout — on a sticky
           stage it also changes with the scroll, so it cannot simply be cached
           at mount. */
        let frame = 0;
        let pointer: { x: number; y: number } | null = null;

        const applyLean = () => {
          frame = 0;
          if (!pointer) return;
          const rect = mascotEl.getBoundingClientRect();
          const fromCentreX = clampUnit(
            (pointer.x - (rect.left + rect.width / 2)) / (window.innerWidth / 2),
          );
          const fromCentreY = clampUnit(
            (pointer.y - (rect.top + rect.height / 2)) / (window.innerHeight / 2),
          );
          leanX(fromCentreX * MASCOT_LEAN.shift);
          leanY(fromCentreY * MASCOT_LEAN.rise);
          leanTilt(fromCentreX * MASCOT_LEAN.tilt);
          gazeX?.(fromCentreX * MASCOT_LEAN.gaze);
          gazeY?.(fromCentreY * MASCOT_LEAN.gaze);
        };

        const handleMove = (event: PointerEvent) => {
          /* A finger is not a cursor: on touch there is nothing to follow, and
             a tap would leave the figure leaning at whatever angle the last
             contact happened to be. */
          if (event.pointerType !== "mouse") return;
          pointer = { x: event.clientX, y: event.clientY };
          if (!frame) frame = requestAnimationFrame(applyLean);
        };

        /* Stands back up when the pointer leaves the document entirely —
           otherwise it holds a lean toward a cursor that is no longer there. */
        const handleLeave = () => {
          pointer = null;
          leanX(0);
          leanY(0);
          leanTilt(0);
          gazeX?.(0);
          gazeY?.(0);
        };

        window.addEventListener("pointermove", handleMove, { passive: true });
        document.documentElement.addEventListener("pointerleave", handleLeave);

        return () => {
          if (frame) cancelAnimationFrame(frame);
          window.removeEventListener("pointermove", handleMove);
          document.documentElement.removeEventListener(
            "pointerleave",
            handleLeave,
          );
        };

        /* The decorative marks are NOT driven from here — PaperOrbit projects
           them onto a sphere centred on this same mascot and spins it against
           the same scroll range. */
      });

      return () => mm.revert();
    },
    { scope: stage },
  );

  return (
    /* Taller than the two-beat version it replaced: four beats need room to
       land one at a time, and at 280svh two of them changed in the same flick
       of a trackpad. */
    <section id={MARKETING_SECTION_IDS.top} className="relative h-[440svh]">
      <div ref={stage} className="sticky top-0 h-svh overflow-hidden">
        {/* Bottom-anchored and cropped by the stage: the mascot is taller than
            the space it is given, which is what stops it reading as a sticker
            dropped onto the page.

            The `vw` term in the height is the phone fix. The artwork is square,
            so bounding only its HEIGHT bounds nothing on a narrow screen — at
            390×844 a height-only clamp resolved to a 726px-wide character on a
            390px viewport. A viewport-WIDTH term makes the narrow case bind on
            width and the wide case still bind on height. */}
        {/* A WRAPPER, not the bare image. It carries every class the image
            used to and is the element gsap transforms, so the eye overlay —
            which fills this box — travels with the figure through the swell
            and the lean instead of sliding off its face. The image is the only
            thing in it, so the box is still exactly the artwork's. */}
        <div
          ref={mascot}
          /* Lifted off the floor from the breakpoint up, and standing on the
              closing block rather than behind it. Anchored at -5% the character
              was cropped by the stage AND had the sign-off and the ask laid
              across its chest — the three things that close the hero were all
              in the same 200px. On a phone it stays low: there is one column
              there, so the copy runs over it whatever the offset. */
          /* `origin-bottom` is load-bearing, not tidiness. The swell below
              scales the figure, and about its centre that pushes the FEET down
              as much as it lifts the head — which ate the clearance to the
              sign-off and put the two back in contact at the last beat, the
              exact moment the swell is largest. Anchored at the feet the bottom
              edge is wherever this offset says it is, at every scroll position.
              It is also what lets the figure grow without moving: raising it off
              the floor cost it most of its presence, and with the feet pinned
              the extra height goes up into empty stage rather than back down
              onto the sign-off.

              The `vw` term caps the WIDTH against the middle column. The figure
              is square, so a height clamp alone lets it spill sideways into the
              copy on a wide, short screen — exactly the collision the reserved
              column exists to prevent. */
          className="absolute bottom-[-5%] left-1/2 z-[1] h-[min(58svh,520px,84vw)] w-auto -translate-x-1/2 origin-bottom min-[900px]:bottom-[clamp(200px,33svh,330px)] min-[900px]:h-[min(52svh,480px,38vw)]"
        >
          <PaperMascot
            width={780}
            height={780}
            priority
            className="h-full w-auto"
          />
          <PaperMascotEyes />
        </div>

        {/* The pairs. Above the decorative marks, which sort themselves to
            z-index 3 when their sphere brings them to the front — at the same
            level a mark lands an arrow across a line of type. */}
        {/* The bottom padding clears the ask, which is drawn on its own sheet
            of paper further down the stage. Too little and the sign-off — the
            last thing the hero says — ends up behind that sheet on a short
            screen, which is where it was. */}
        {/* The top padding clears the FIXED navbar, which is drawn over this
            stage rather than above it — at less than its height the first pair
            arrives already cut in half. */}
        <div className="absolute inset-0 z-[6] flex flex-col px-[clamp(16px,4vw,72px)] pt-[clamp(88px,14svh,152px)] pb-[clamp(44px,7svh,78px)]">
          {/* Spread down the stage rather than stacked at the top. Bunched
              under the navbar with a fixed gap, the three pairs left a large
              hole between the last call and the sign-off — a composition that
              was top-heavy on the left and bottom-heavy on the right.
              `justify-evenly` distributes whatever height is left after the
              closing block takes its share, so the rhythm holds on a laptop and
              on a tall monitor without a breakpoint. */}
          <div className="flex flex-1 flex-col justify-evenly gap-[clamp(14px,2vh,26px)]">
          {MARKETING_HERO_INTRO.map((pair, index) => (
            <div
              key={pair.call}
              /* The middle column is the mascot's, and stays empty. Below the
                 breakpoint there is no left and right, so the pair becomes two
                 stacked lines with the response indented and set to the right —
                 the call and the answer still read as two voices. */
              /* The middle track is WIDER than it looks like it needs to be,
                 and the lines are capped on top of that. The mascot is sized in
                 svh and vw and is drawn independently of this grid, so at
                 1440×900 it spanned 648px while the reserved column was 401 —
                 the third pair, which wraps to two lines, ran straight across
                 its head. Reserving more than the character can occupy is what
                 makes the clearance hold at every viewport instead of at the
                 one that was tested. */
              className="grid grid-cols-1 items-baseline gap-x-[clamp(16px,3vw,48px)] gap-y-1 min-[900px]:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_minmax(0,1fr)]"
            >
              {/* The leader. At 1900px a call ends around x=540 and its answer
                  starts around x=1350, with the character between them — far
                  enough apart that the eye reads two lists rather than three
                  pairs. A rule reaching out of each half toward the other is
                  the page's own way of saying these belong together, and it
                  stops SHORT on both sides rather than crossing the middle: the
                  copy layer sits above the mascot, so a rule spanning the gap
                  would be drawn over the character's chest. */}
              <div
                className={cn(
                  "flex items-start justify-end gap-[clamp(10px,1.4vw,22px)] transition-[opacity,transform] duration-[520ms] ease-out",
                  lineState(index, revealed),
                )}
              >
                <p
                  data-state={beat === index ? "live" : undefined}
                  className="paper-display-type m-0 max-w-[20ch] text-[clamp(19px,min(2.5vw,3.7svh),38px)] leading-[0.95] tracking-[-0.04em] min-[900px]:text-right"
                >
                  {pair.call}
                </p>
                <span
                  aria-hidden="true"
                  className="mt-[0.55em] hidden h-px w-[clamp(18px,3vw,70px)] shrink-0 bg-ink/30 min-[900px]:block"
                />
              </div>

              {/* On one column the two voices need telling apart some other way
                  than by side, so the response answers from the right —
                  restored to the left of its own column, behind its own leader,
                  once there is a left and a right to use. */}
              <div
                className={cn(
                  "flex items-start justify-end gap-[clamp(10px,1.4vw,22px)] transition-[opacity,transform] duration-[520ms] ease-out min-[900px]:col-start-3 min-[900px]:justify-start",
                  lineState(index, revealed),
                )}
              >
                <span
                  aria-hidden="true"
                  className="mt-[0.55em] hidden h-px w-[clamp(18px,3vw,70px)] shrink-0 bg-ink/30 min-[900px]:block"
                />
                <PaperDisplay
                  words={pair.response}
                  className="max-w-[24ch] justify-end text-right text-[clamp(19px,min(2.5vw,3.7svh),38px)] leading-[0.95] tracking-[-0.04em] min-[900px]:justify-start min-[900px]:text-left"
                />
              </div>
            </div>
          ))}
          </div>

          {/* The closing block: the name, then the ask. ONE element at the foot
              of the stage, because as two absolutely-positioned things they were
              measured against different edges and overlapped each other and the
              mascot at any height nobody had checked. Stacked in flow they
              cannot collide, and the mascot's bottom offset is set to clear
              them. */}
          <div className="mt-auto flex flex-col items-center gap-[clamp(14px,2.4vh,30px)]">
            <PaperDisplay
              as="h1"
              words={MARKETING_HERO_SIGNOFF}
              className={cn(
                "justify-center text-center text-[clamp(28px,min(5.2vw,7svh),72px)] leading-[0.9] tracking-[-0.05em] transition-[opacity,transform] duration-[560ms] ease-out",
                isSignoff ? LINE_STATE.live : LINE_STATE.waiting,
              )}
            />

            {/* The ask, on the closing beat only — so there is exactly ONE call
                to action in the hero's DOM, and it arrives once the
                introduction has paid off. On its own sheet of paper, because on
                a phone it still lands on the artwork. */}
            <span
              className={cn(
                "flex flex-wrap items-center justify-center gap-x-5 gap-y-2.5 border border-ink bg-paper px-[clamp(14px,1.6vw,22px)] py-[clamp(12px,1.4vw,18px)] transition-[opacity,transform] duration-[420ms] ease-out",
                isSignoff
                  ? "pointer-events-auto opacity-100"
                  : "pointer-events-none translate-y-2.5 opacity-0",
              )}
            >
              <PaperButton href={GET_STARTED_HREF} arrow>
                {GET_STARTED_LABEL}
              </PaperButton>
              <PaperLabel tone="ink" as="span">
                {MARKETING_REASSURANCE}
              </PaperLabel>
            </span>
          </div>
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
          {Array.from({ length: MARKETING_HERO_BEAT_COUNT }, (_, index) => (
            <span
              key={index}
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

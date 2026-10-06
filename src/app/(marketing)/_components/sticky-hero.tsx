/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use client";

/**
 * SOURCE OF TRUTH KEYWORDS: StickyHero, MARKETING_HERO_HEADLINE,
 *   MARKETING_HERO_TRACK_SVH, gsap, ScrollTrigger, SCRUB, quickTo, MASCOT_LEAN,
 *   pointer lean, PaperOrbit, PaperMascot, PaperMascotEyes, sticky stage,
 *   sr-only h1, mascot only, first paint, above the fold
 *
 * WHAT:  The first screen — the mascot, centred, standing on the stage's floor,
 *        with the decorative sphere turning around it. Nothing else is drawn.
 *
 * WHY:   IT IS A PICTURE, BY REQUEST. Every piece of copy this hero used to
 *        carry — the headline, the line explaining it, the ask and its
 *        reassurance — was removed deliberately. What that costs is worth
 *        writing down, because the cost is not obvious from the markup: the
 *        first screen no longer says what the product is, and the first time a
 *        reader is told lands about eleven screens down, in the blue statement.
 *        The navbar's button is the only call to action above the fold.
 *
 *        THE <h1> SURVIVES THE REMOVAL, as `sr-only`. A page whose opening
 *        screen is an image still owes a crawler and a screen reader a document
 *        heading; without one an audit reports no h1 and the <title> becomes the
 *        only description of the product anywhere in the markup. It renders the
 *        same MARKETING_HERO_HEADLINE the visible headline used, so restoring
 *        the visible version later cannot put two different claims on one page.
 *
 *        THE SIZING RULES COLLAPSED WITH THE COPY. Four media queries used to
 *        referee the figure against the type — a stacked layout competing on
 *        HEIGHT, a two-column one competing on WIDTH, and two more for short and
 *        sideways phones. With nothing left to collide with, one breakpoint
 *        remains and it exists only to let a wide screen be generous.
 *
 *        THE TRACK IS SHORT ON PURPOSE, AND ITS LENGTH IS LOAD-BEARING
 *        ELSEWHERE. See MARKETING_HERO_TRACK_SVH: the product tour derives its
 *        own entry from this section's height, so this hero's 180svh is what
 *        pulls the first frame of the actual product up to roughly a third of a
 *        screen in. At the old 440svh it arrived three viewports down.
 *
 *        Two decisions carry over from the versions before this one:
 *
 *        1. The stage stays `position: sticky` and is NOT ScrollTrigger-pinned.
 *           Pinning injects a spacer and takes over the layout; sticky already
 *           does the job, works with JS switched off, and leaves ScrollTrigger
 *           one job — reading progress.
 *
 *        2. Reduced motion needs no special case. Nothing here is revealed by
 *           scrolling, so a reader who asks for less motion loses the swell, the
 *           lean and the orbit and loses no content at all.
 * WHERE: src/app/(marketing)/page.tsx, first, wrapped by ProductTour. Its id is
 *        the element src/components/global/marketing/marketing-navbar.tsx
 *        watches and the one product-tour.tsx measures its entry against.
 */

import * as React from "react";
import { ChevronDownIcon } from "lucide-react";

import {
  MARKETING_HERO_HEADLINE,
  MARKETING_HERO_ORBIT,
  MARKETING_HERO_TRACK_SVH,
  MARKETING_SECTION_IDS,
} from "@/lib/config";
import {
  PaperMascot,
  PaperMascotEyes,
  PaperOrbit,
  PAPER_MASCOT_EYES,
  PAPER_MASCOT_PUPILS,
} from "@/components/global/paper";
import { PAPER_EASE, SCRUB, gsap, useGSAP } from "@/lib/gsap";

/**
 * SOURCE OF TRUTH KEYWORDS: MASCOT_LEAN, pointer lean, cursor tracking, quickTo,
 *   mascot sway, micro interaction
 *
 * WHAT:  How far the mascot leans toward the pointer, and how long it takes to
 *        get there.
 * WHY:   SMALL ENOUGH TO BE FELT RATHER THAN WATCHED. The figure is the fixed
 *        point the composition stands on, so the lean has to stay under the
 *        threshold where it becomes the thing you are looking at. A 1.2° sway
 *        pivoting at the feet moves the head about 12px at hero size, which
 *        reads as attention rather than animation.
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

export function StickyHero() {
  const stage = React.useRef<HTMLDivElement | null>(null);
  /* The WRAPPER, not the image: it is the box gsap transforms, the box the
   * orbit centres on, and the box the eye overlay fills. */
  const mascot = React.useRef<HTMLDivElement | null>(null);

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
           the copy stands on, so it moves least — a subject that moves as much
           as the type flattens the whole stage.

           WRITTEN AS GSAP PROPERTIES, NOT A `transform` STRING. It used to
           tween `transform: "translateX(-50%) scale(…)"`, which hands gsap one
           opaque value and makes every scroll tick overwrite the whole matrix —
           including whatever the pointer lean below had just put in it. As
           separate channels in gsap's transform cache, the swell and the lean
           can share the element without either erasing the other.

           NO CENTRING IS SET FROM HERE ANY MORE. It used to need an
           `xPercent: -50`, because the layout offset and these tweens shared one
           element and gsap's `transform` erases a Tailwind translate on the same
           box. The figure now sits inside a positioning wrapper that owns the
           offset — see the markup — so this element is free to carry nothing but
           the swell and the lean, and the breakpoint can move the character from
           centre to right without JavaScript knowing about it. */
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
            (pointer.y - (rect.top + rect.height / 2)) /
              (window.innerHeight / 2),
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
    <section
      id={MARKETING_SECTION_IDS.top}
      className="relative"
      /* Inline, and from the config constant, because the TOUR reads the same
         number to place its entry — see MARKETING_HERO_TRACK_SVH. As a Tailwind
         arbitrary value it would be a second literal, which is exactly how the
         tour's own copy of this height ended up stale at 440. */
      style={{ height: `${String(MARKETING_HERO_TRACK_SVH)}svh` }}
    >
      {/* The figure's size, declared on the STAGE rather than on the figure,
          because the orbit measures against the same stage and a second literal
          is how the two drift apart.

          IT ANSWERS TO NOTHING BUT THE VIEWPORT NOW. Every earlier version of
          this line was a negotiation with the copy: stacked, the headline sat
          above the character and reserved its HEIGHT, so each pixel the figure
          gained was a pixel the type lost — that competition is what once
          forced it to 420px and still left the ask 9px inside its head on a
          1600×560 window. Two columns moved the contest to WIDTH. With the copy
          gone there is no contest at all, so the four media queries that used to
          referee it are gone with it and one breakpoint remains, purely to let a
          wide screen give the character more room than a phone can.

          The `vw` term is still load-bearing. The artwork is SQUARE, so bounding
          only its height bounds nothing on a narrow screen — at 390×844 a
          height-only clamp resolved to a 726px-wide character on a 390px
          viewport. */}
      <div
        ref={stage}
        className="sticky top-0 h-svh overflow-hidden [--hero-mascot:min(62svh,420px,78vw)] min-[900px]:[--hero-mascot:min(76svh,720px,44vw)]"
      >
        {/* THE DOCUMENT'S HEADING, CARRIED BUT NOT DRAWN. The hero is a picture
            now, and a page whose first screen is a picture still needs an <h1>:
            without one a crawler has no heading to read and a screen reader
            lands on a section with no name, which is also what an audit flags.
            It reads the SAME constant the visible headline used, so the two can
            never say different things, joined back into a sentence because
            PaperDisplay's word boxes are a visual device and a screen reader
            should hear one line, not three fragments. */}
        <h1 className="sr-only">
          {MARKETING_HERO_HEADLINE.map((word) => word.text).join(" ")}
        </h1>

        {/* THE FIGURE, CENTRED ON X AND STANDING ON THE STAGE'S FLOOR. It keeps
            its own layer at z-1 rather than sitting in flow, because the orbit's
            marks sort themselves in FRONT of and behind the character by their
            own depth — anything higher in the stack and nothing could ever pass
            in front of it.

            Bottom-anchored and cropped by the stage: the figure is taller than
            the space it is given, which is what stops it reading as a sticker
            dropped onto the page. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-[1]"
        >
          {/* POSITION HERE, TRANSFORM INSIDE. The layout offset and the gsap
              channels used to share one element, which is why an older version
              had to set `xPercent: -50` from JavaScript: gsap writes the whole
              `transform`, so a Tailwind `-translate-x-1/2` on the same element is
              erased the moment the swell takes it over. With the centring on this
              wrapper and the tweens on the box inside it, neither can overwrite
              the other and the centring is plain CSS at every width. */}
          <div className="absolute bottom-[-4%] left-1/2 h-[var(--hero-mascot)] w-auto -translate-x-1/2">
            {/* `origin-bottom` is load-bearing, not tidiness. The swell scales
                the figure, and about its centre that pushes the FEET down as
                much as it lifts the head, so the character would sink into the
                stage's floor at the exact moment it is largest. Anchored at the
                feet the bottom edge stays where the offset above puts it at
                every scroll position, and the extra height goes up into empty
                stage.

                `relative` is what the eye overlay fills — it is absolutely
                positioned and needs a positioned ancestor that is exactly the
                artwork's box, or the pupils land somewhere else entirely. */}
            <div ref={mascot} className="relative h-full w-auto origin-bottom">
              <PaperMascot
                width={780}
                height={780}
                priority
                className="h-full w-auto"
              />
              <PaperMascotEyes />
            </div>
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

        {/* The scroll cue. The progress dots that used to sit beside it are
            gone with the beats — they told the reader a tall section was a
            sequence and not a stall, and there is no sequence left to track. */}
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 z-[6] flex items-center justify-center p-3.5"
        >
          <ChevronDownIcon className="animate-paper-cue size-3.5 text-grey" />
        </div>
      </div>
    </section>
  );
}

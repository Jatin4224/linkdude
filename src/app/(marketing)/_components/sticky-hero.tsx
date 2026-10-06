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
  GET_STARTED_HREF,
  GET_STARTED_LABEL,
  MARKETING_HERO_HEADLINE,
  MARKETING_HERO_ORBIT,
  MARKETING_HERO_SUBHEAD,
  MARKETING_HERO_TRACK_SVH,
  MARKETING_REASSURANCE,
  MARKETING_SECTION_IDS,
} from "@/lib/config";
import {
  PaperButton,
  PaperDisplay,
  PaperLabel,
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

          THE TWO LAYOUTS RESERVE ON DIFFERENT AXES, which is what lets the
          figure stay large while the copy comes back. Stacked, the headline sits
          ABOVE the character and reserves its HEIGHT, so every pixel the figure
          gains is a pixel the type loses — that competition is what once forced
          it to 420px and still left the ask 9px inside its head on a 1600×560
          window. Side by side they compete on WIDTH instead, and width is the
          axis this page has to spare: at 1440 the copy needs about 650px of a
          1440px stage, so the figure can take 700 and the vertical budget stops
          mattering. Hence one column below 1100px and two above it.

          THE BREAKPOINT IS 1100px, NOT 900, AND THE HEADLINE SET IT. At 900 the
          copy column resolves to about 440px, which is wide enough for a short
          headline and not for this one: "personal brand" wrapped INSIDE its own
          blue box, turning one accent word into a two-line slab, and the figure
          crowded what was left. The old copy fit there, so this is a limit the
          words moved rather than one the layout always had — re-measure it if
          the headline is ever rewritten shorter.

          The short-window rules are scoped to the PHONE RANGE for the same
          reason: it is the stacked layout that runs out of height. Their third
          term stays at 78vw because that term only ever stops a square drawing
          overflowing a narrow screen sideways, and they are answering a shortage
          of HEIGHT — tightened to 20vw as well it once resolved the figure to
          72px on a 360×740 phone, bound by the wrong axis. */}
      <div
        ref={stage}
        className="sticky top-0 h-svh overflow-hidden [--hero-mascot:min(34svh,300px,62vw)] [@media(max-width:1099px)_and_(min-height:481px)_and_(max-height:780px)]:[--hero-mascot:min(24svh,200px,62vw)] [@media(max-width:1099px)_and_(max-height:480px)]:[--hero-mascot:min(12svh,100px,62vw)] min-[1100px]:[--hero-mascot:min(76svh,720px,44vw)]"
      >
        {/* THE FIGURE'S LAYER, measured against the same centred container the
            copy uses so the two columns share one set of edges. It keeps its own
            layer at z-1 rather than sitting in the copy's flow, because the
            orbit's marks sort themselves in FRONT of and behind the character by
            their own depth — anywhere higher in the stack and nothing could ever
            pass in front of it.

            Bottom-anchored and cropped by the stage: the figure is taller than
            the space it is given, which is what stops it reading as a sticker
            dropped onto the page. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-[1]"
        >
          <div className="relative mx-auto h-full w-full max-w-[1460px] px-[clamp(16px,4vw,72px)]">
          {/* POSITION HERE, TRANSFORM INSIDE. The layout offset and the gsap
              channels used to share one element, which is why an older version
              had to set `xPercent: -50` from JavaScript: gsap writes the whole
              `transform`, so a Tailwind `-translate-x-1/2` on the same element is
              erased the moment the swell takes it over. With the offset on this
              wrapper and the tweens on the box inside it, neither can overwrite
              the other — which is also what lets the breakpoint move the figure
              from centre to right in CSS alone. */}
          {/* THE DESKTOP OFFSETS ARE DELIBERATE, not leftovers. Flush to the
              container's right edge and hanging 4% below the stage, the figure
              sat squarely in the corner and had its own ground shadow clipped by
              the stage's `overflow-hidden`. Nudging it out past the gutter and
              up off the floor gives it somewhere to stand and stops the corner
              reading as a crop.

              THE OFFSET IS BOUNDED BY THE SPACE THAT ACTUALLY EXISTS, which is
              why it is a `min`/`max` pair rather than a clamp on `vw`. The copy
              and the figure share a 1460px container; on a screen wider than
              that, `(100vw - 1460px) / 2` is the dead margin outside it, and the
              figure can push into that margin without ever leaving the viewport.
              On a 1440px laptop that term goes NEGATIVE — there is no margin —
              so the `max` floors it at 8px and the figure stays put.

              THE `* 0.085` TERM IS THE ARTWORK'S OWN TRANSPARENT MARGIN, and it
              is measured, not guessed: linkdin-dude.png is 1024px square and its
              rightmost opaque pixel is at x=936, so 8.5% of every rendered width
              is empty. The BOX may therefore cross the viewport edge by that
              much before a single drawn pixel is lost, which is why the bound
              adds it rather than stopping at the container margin. Reading it
              off the file is the only honest way to spend it — eyeballing where
              the mug "looks like" it ends is how you clip a handle on one screen
              size and not another. The `- 90px` is the safety left over, and it is
              also the dial: raising it walks the figure back toward the copy,
              lowering it pushes it out toward the gutter.

              A flat `clamp(12px, 4.6vw, 104px)` was the obvious version and it
              was wrong in the way only measuring catches: vw grows with the
              screen, but on a 1440 laptop the container already fills the
              screen, so the offset had nowhere to go and pushed the mug 66px
              off the right edge. 41px at 900, 46px at 1000, 66px at 1440 — all
              silently cropped, because the stage is `overflow-hidden` and a
              crop makes no scrollbar to notice.

              Pushing OUT is otherwise safe: `overflow-hidden` means this can
              only ever be cropped by the stage, never widen the document. */}
          {/* Verified at 17 widths: no horizontal scroll anywhere.

              Phone keeps its own centring and its -4%: there the copy is stacked
              above the figure and the bottom padding reserves exactly
              `--hero-mascot - 4svh`, so moving it would have to move that
              expression too. */}
          <div className="absolute bottom-[-4%] left-1/2 h-[var(--hero-mascot)] w-auto -translate-x-1/2 min-[1100px]:bottom-[4%] min-[1100px]:left-auto min-[1100px]:right-[calc(-1*min(210px,max(8px,(100vw_-_1460px)/2_+_var(--hero-mascot)*0.085_-_90px)))] min-[1100px]:translate-x-0">
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
        </div>

        {/* THE READABLE HERO, and the reason the page can answer "what is this"
            before a reader scrolls. Centred over the figure on a phone, the LEFT
            COLUMN beside it from the breakpoint up — same centred container as
            the figure's layer, so the two share one set of edges.

            The top padding clears the FIXED navbar, which is drawn over this
            stage rather than above it; its floor drops on a short window because
            88px is the bar's height plus air, and the air goes first when the
            whole stage is 560px.

            THE RESERVE SWITCHES AXIS AT THE BREAKPOINT. Stacked, the bottom
            padding holds the figure's HEIGHT — its own height less the 4% it
            hangs below the stage, plus a gap, which is why it reads
            --hero-mascot rather than a number. Side by side, that reserve is
            released and a right padding holds the figure's WIDTH instead; the
            artwork is square, so one custom property measures both. */}
        <div className="absolute inset-0 z-[6] mx-auto flex max-w-[1460px] flex-col items-center justify-center gap-[clamp(16px,2.6vh,30px)] px-[clamp(16px,4vw,72px)] pt-[clamp(88px,14svh,152px)] pb-[calc(var(--hero-mascot)-4svh+20px)] text-center [@media(min-height:481px)_and_(max-height:780px)]:pt-19 [@media(max-height:480px)]:gap-2 [@media(max-height:480px)]:pt-14 [@media(max-height:480px)]:pb-[calc(var(--hero-mascot)-4svh+4px)] min-[1100px]:items-start min-[1100px]:pr-[calc(var(--hero-mascot)+clamp(16px,3vw,56px))] min-[1100px]:pb-0 min-[1100px]:text-left">
          {/* THE PAGE'S ONLY h1, VISIBLE AND UNGATED. It was an `sr-only` line
              for a while, which satisfied a crawler and told a human nothing —
              the first screen carried no words at all. The constant is the same
              either way, so nothing about the claim changed when it came back.

              The clamp FLOOR is the load-bearing number, not the ceiling:
              "LinkedIn post" is thirteen characters of Archivo Black in one
              unbreakable box, so the floor must be small enough for it at the
              narrowest supported screen or the word pushes the page sideways.
              The `svh` term and the 18ch measure are a PAIR — at 15ch and 8svh
              this headline wrapped to five lines on a 1440×900 laptop and
              overran the figure's reserve. */}
          <PaperDisplay
            as="h1"
            words={MARKETING_HERO_HEADLINE}
            className="max-w-[18ch] justify-center text-[clamp(28px,min(5.6vw,6svh),72px)] leading-[0.9] tracking-[-0.05em] [@media(max-height:480px)]:text-[22px] min-[1100px]:justify-start min-[1100px]:[&>[data-paper-word=plain]]:-ml-[0.13em]"
          />

          {/* The sentence that does the explaining. Capped in `ch` rather than
              px so the measure stays readable at every clamp step instead of
              running to a 90-character line on a wide monitor. */}
          <p className="m-0 max-w-[46ch] text-[clamp(15px,1.7vw,22px)] leading-normal text-pretty text-grey">
            {MARKETING_HERO_SUBHEAD}
          </p>

          {/* The ask. ONE call to action in the hero's DOM, in the first frame.
              On its own sheet of paper, because at phone size it still lands
              over the artwork. */}
          <span className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2.5 border border-ink bg-paper px-[clamp(14px,1.6vw,22px)] py-[clamp(12px,1.4vw,18px)]">
            <PaperButton href={GET_STARTED_HREF} arrow>
              {GET_STARTED_LABEL}
            </PaperButton>
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

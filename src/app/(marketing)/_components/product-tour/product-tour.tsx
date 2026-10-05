/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use client";

/**
 * SOURCE OF TRUTH KEYWORDS: ProductTour, ProductTourMock, buildTourPoses, frameAt,
 *   panelBoxAt, TOUR_TRACK, TOUR_STOPS, TOUR_DEMO, TOUR_STAGE, createTourWriter,
 *   damped progress, requestAnimationFrame, sticky stage, scroll camera, pinned
 *   section, tour-scope, black section, MARKETING_HEADER_ATTR
 *
 * WHAT:  The scroll-driven product tour — a black, pinned stage where one mock
 *        of the app stays on screen while a camera moves between poses, playing
 *        a small demo at each. Four stops: Write, Voice, Schedule, Profile.
 *
 * WHY:   EVERYTHING IS A PURE FUNCTION OF ONE NUMBER. `render(p)` is the whole
 *        component: given progress through the section it writes the camera's
 *        transform, every caption's opacity, and every demo's state. Nothing
 *        accumulates and nothing is a tween in flight, so scrolling BACKWARDS
 *        plays the tour in reverse for free and landing mid-section on a reload
 *        draws the correct frame immediately. The alternative — a timeline of
 *        tweens fired at thresholds — desyncs the moment a reader scrubs faster
 *        than a tween resolves, which on a trackpad is most of the time.
 *
 *        FIVE ENGINEERING CHOICES CARRY OVER FROM THE TESTED PROTOTYPE, each
 *        because it fixed a real problem:
 *
 *        1. THE MOCK HAS A FIXED DESIGN SIZE and is only ever scaled. Nothing
 *           inside it depends on the viewport, so a zoom cannot reflow it.
 *        2. ONLY `transform` AND `opacity` CHANGE per frame. Both are
 *           composited; anything touching layout would make a wheel gesture
 *           stutter at the exact moment the reader is looking closely.
 *        3. DOM WRITES ARE SKIPPED when the value has not changed — see
 *           product-tour-writer.ts.
 *        4. SCALE IS INTERPOLATED GEOMETRICALLY, so zooms cover equal ratios in
 *           equal time — see product-tour-camera.ts.
 *        5. PROGRESS IS DAMPED in a rAF loop rather than read straight off the
 *           scrollbar, which is what gives the camera weight on a mouse wheel.
 *
 *        PROGRESS IS MEASURED FROM THIS SECTION, NOT THE DOCUMENT. `scrollY -
 *        track.offsetTop` over the track's own range, so the hero above it can
 *        change height — and it is 440svh of sticky stage that may well change
 *        — without retiming a single stop.
 *
 *        THE CAPTIONS ARE POSITIONED BY THE CAMERA, which is the one thing here
 *        that is not a per-frame write. At the two tight stops a caption sits
 *        INSIDE the app window, in the space the faded panels have vacated,
 *        vertically centred on the focused panel — so its box is derived from
 *        that stop's settled pose, in `measure`. Doing it per frame would mean
 *        writing `left`/`top`/`width` sixty times a second, which is layout;
 *        doing it once per resize is free, and correct because a caption only
 *        becomes readable after the camera has nearly stopped.
 *
 *        THE SITE'S HEADER IS LEFT ALONE. It is shared with every public route
 *        and is not the tour's to hide. The stage MEASURES it and offsets every
 *        pose and caption below it instead, so neither the mock nor a caption is
 *        ever drawn under the navigation.
 *
 *        THE SECTION IS BLACK IN EVERY THEME. `.tour-scope` does that, and does
 *        it by sharing the token ramp `.dark` already declares rather than by
 *        restating a palette — see the rule in globals.css. The bands above and
 *        below are cream, so two short gradient strips ease the page into the
 *        black and out of it rather than cutting.
 *
 *        THE READABLE PART IS REAL HTML. The captions are a label, an h2 and a
 *        p; the mock is `aria-hidden`. A reader who never sees the animation
 *        still gets the same four claims, and a dimmed caption is `inert`, so
 *        the section adds no tab stop into copy nobody can read.
 * WHERE: src/app/(marketing)/page.tsx, directly after StickyHero and before
 *        BlueStatement.
 */

import * as React from "react";

import {
  LINKEDIN_MAX_COMMENTARY,
  MARKETING_COMPOSER,
  MARKETING_HEADER_ATTR,
  MARKETING_PROFILE_SCORE,
  MARKETING_SECTION_IDS,
  MARKETING_TOUR,
  MARKETING_TOUR_PHASES,
  MARKETING_TOUR_RANGE_SVH,
  TOUR_ENTRY,
  TOUR_MARKS,
  TOUR_DEMO,
  TOUR_DESIGN,
  TOUR_DRAFT,
  TOUR_POSE_FOCUS,
  TOUR_RECTS,
  TOUR_STAGE,
  TOUR_STOPS,
} from "@/lib/config";
import type {
  TourNodeKey,
  TourPose,
  TourPoseKey,
} from "@/lib/types/marketing-tour";
import { getRawResourceLimit } from "@/lib/resources";
import { PaperDisplay } from "@/components/global/paper";
import { cn } from "@/lib/utils";
import {
  buildTourPoses,
  clamp,
  frameAt,
  isNarrow,
  lerp,
  panelBoxAt,
  pulse,
  stepRange,
} from "./product-tour-camera";
import { createTourWriter } from "./product-tour-writer";
import { ProductTourMock, TOUR_RING_LENGTH } from "./product-tour-mock";

/** How fast the damped progress catches the scrollbar, per frame. */
const DAMPING = 0.16;

/** Below this difference the damping snaps, so the loop can stop. */
const SETTLED = 0.0002;

/** The gap between a focused panel and the caption beside it, in px. */
const CAPTION_GAP = 36;

/* The free plan's real generation cap. The mock prints it and the Generate beat
 * takes one off it, so the readout moves for the same reason the real one would.
 * An 'unlimited' plan has no counter — the mock drops the readout entirely in
 * that case, and this renderer then writes to nothing. */
const FREE_GENERATIONS = getRawResourceLimit("aiGeneration", "free");
const GENERATION_TOTAL =
  FREE_GENERATIONS === "unlimited" ? null : FREE_GENERATIONS;

/** Spreads a config `[from, to]` pair into `stepRange`'s two arguments. */
function windowOf(pair: readonly [number, number]): [number, number] {
  return [pair[0], pair[1]];
}

/**
 * SOURCE OF TRUTH KEYWORDS: heroDimAt, TOUR_ENTRY.heroDim, dim curve, lerp table
 *
 * WHAT:  The hero's opacity at one point of the entry.
 * WHY:   A TABLE, NOT A FORMULA. The measured curve drops a fifth before the
 *        window has visibly moved, reaches two thirds a tenth of the way in and
 *        then fades slowly — no cubic matches that, and the shape is the part
 *        that reads as the page making room rather than being switched off.
 *        Linear between breakpoints is enough: they are close together exactly
 *        where the curve bends.
 */
function heroDimAt(u: number): number {
  const table = TOUR_ENTRY.heroDim;
  for (let i = 0; i < table.length - 1; i += 1) {
    const a = table[i];
    const b = table[i + 1];
    if (!a || !b) break;
    if (u <= b[0]) {
      const span = b[0] - a[0];
      return span <= 0 ? b[1] : lerp(a[1], b[1], (u - a[0]) / span);
    }
  }
  return table[table.length - 1]?.[1] ?? 0;
}

export function ProductTour({ children }: { children: React.ReactNode }) {
  const track = React.useRef<HTMLDivElement | null>(null);
  const stage = React.useRef<HTMLDivElement | null>(null);
  const camera = React.useRef<HTMLDivElement | null>(null);
  const heroShift = React.useRef<HTMLDivElement | null>(null);
  const heroDim = React.useRef<HTMLDivElement | null>(null);
  const captions = React.useRef<(HTMLDivElement | null)[]>([]);

  React.useEffect(() => {
    const trackEl = track.current;
    const stageEl = stage.current;
    const cameraEl = camera.current;
    if (!trackEl || !stageEl || !cameraEl) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const write = createTourWriter();

    /* ---------- handles, resolved once ---------- */
    /* Every one of these is written to sixty times a second; a querySelector
       per frame would be the most expensive line in the loop. */
    const node = (key: TourNodeKey): HTMLElement | null =>
      cameraEl.querySelector<HTMLElement>(`[data-tour="${key}"]`);
    const list = (key: string): HTMLElement[] => [
      ...cameraEl.querySelectorAll<HTMLElement>(`[data-tour-item="${key}"]`),
    ];

    const el: Record<TourNodeKey, HTMLElement | null> = {
      chrome: node("chrome"),
      sidebar: node("sidebar"),
      paneCompose: node("paneCompose"),
      paneVoice: node("paneVoice"),
      panePost: node("panePost"),
      paneCalendar: node("paneCalendar"),
      paneProfile: node("paneProfile"),
      generations: node("generations"),
      typed: node("typed"),
      caret: node("caret"),
      placeholder: node("placeholder"),
      generate: node("generate"),
      draftEmpty: node("draftEmpty"),
      draftHead: node("draftHead"),
      draftFoot: node("draftFoot"),
      characters: node("characters"),
      trained: node("trained"),
      voiceBadge: node("voiceBadge"),
      emoji: node("emoji"),
      schedule: node("schedule"),
      dayRing: node("dayRing"),
      dayCell: node("dayCell"),
      nextUp: node("nextUp"),
      scheduledCount: node("scheduledCount"),
      scoreValue: node("scoreValue"),
      scoreArc: node("scoreArc"),
      rewrite: node("rewrite"),
      rewriteOld: node("rewriteOld"),
      rewriteNew: node("rewriteNew"),
    };

    const lines = list("line");
    const traitTicks = list("tick");
    const swapOld = list("swapOld");
    const swapNew = list("swapNew");
    const dots = list("dot");
    const verdicts = list("verdict");

    /* Everything a tight stop fades out, paired with whether this stop is the
       one that keeps it. Built once; the renderer only writes the numbers. */
    const fadeable: readonly (readonly [TourNodeKey, HTMLElement | null])[] = [
      ["paneCompose", el.paneCompose],
      ["paneVoice", el.paneVoice],
      ["panePost", el.panePost],
      ["paneCalendar", el.paneCalendar],
      ["paneProfile", el.paneProfile],
    ];

    /* ---------- measurement: on mount and on resize, never per frame ------- */
    let poses: Readonly<Record<TourPoseKey, TourPose>> | null = null;

    const measure = () => {
      /* The site header is fixed and drawn over this section, so every pose and
         every caption starts below it. Measured, never assumed. */
      const header = document.querySelector<HTMLElement>(
        `[${MARKETING_HEADER_ATTR}]`,
      );
      const headerHeight = header?.getBoundingClientRect().height ?? 0;

      const vw = stageEl.clientWidth;
      const vh = stageEl.clientHeight;
      const narrow = isNarrow(vw);

      poses = buildTourPoses({ width: vw, height: vh, headerHeight });
      const resolved = poses;

      /* THE CAPTION BOXES. On a narrow screen every caption is the same band in
         the bottom half, whatever the stop — there is no room beside anything.
         On a wide one each stop places its own: the tight stops measure against
         the focused panel, the wide stops take the half of the screen the app
         has slid away from. */
      TOUR_STOPS.forEach((stop, index) => {
        const target = captions.current[index];
        if (!target) return;

        if (narrow) {
          const bandTop = headerHeight + (vh - headerHeight) * 0.5;
          target.style.left = "var(--gutter)";
          target.style.right = "var(--gutter)";
          target.style.width = "auto";
          target.style.top = `${String(Math.round(bandTop))}px`;
          target.style.height = `${String(Math.round(vh - bandTop))}px`;
          return;
        }

        target.style.right = "auto";
        target.style.height = "auto";

        if (stop.framing === "inside-right") {
          /* Beside the focused panel, inside the window, vertically centred on
             it — which is where the faded panels have just left a hole. */
          const rect =
            stop.pose === "voice" ? TOUR_RECTS.voice : TOUR_RECTS.write;
          const box = panelBoxAt(resolved[stop.pose], rect);
          const left = box.left + box.width + CAPTION_GAP;
          target.style.left = `${String(Math.round(left))}px`;
          target.style.width = `${String(Math.round(Math.min(vw - left - 48, 460)))}px`;
          target.style.top = `${String(Math.round(box.top + box.height / 2))}px`;
        } else {
          /* Outside the app, on plain black, CENTRED IN THE BAND THE APP HAS
             VACATED — not hugging the screen edge. The two wide stops free
             different amounts of room (the app sits against the right edge at
             one and hangs off the left at the other), so a fixed margin leaves
             a hole in the middle of one composition and a cramped column in the
             other. Measuring the band against the app's own box is what keeps
             both halves of the second movement balanced. */
          const appPose = resolved[stop.pose];
          const appW = TOUR_DESIGN.width * appPose.scale;
          const appLeft = appPose.anchorX - appW / 2;
          const margin = vw * 0.05;

          const bandFrom =
            stop.framing === "outside-left" ? margin : appLeft + appW + CAPTION_GAP;
          const bandTo =
            stop.framing === "outside-left" ? appLeft - CAPTION_GAP : vw - margin;

          const width = Math.min(Math.max(bandTo - bandFrom, 240), 460);
          target.style.left = `${String(
            Math.round(bandFrom + (bandTo - bandFrom - width) / 2),
          )}px`;
          target.style.width = `${String(Math.round(width))}px`;
          target.style.top = `${String(Math.round(headerHeight + (vh - headerHeight) / 2))}px`;
        }
      });
    };

    /* ---------- one frame ---------- */
    const render = (p: number) => {
      if (!poses) return;

      /* --- the hero: dimmed and drifting, for the length of the entry --- */
      /* REDUCED MOTION KEEPS THIS. The brief is explicit that the pinning and
         the dimming stay and only the camera's flights become cuts — the hero
         going dark is what hands the screen over, not decoration. */
      const entry = clamp(
        (p - TOUR_MARKS.peekEnd) / (TOUR_MARKS.entryEnd - TOUR_MARKS.peekEnd),
      );
      const heroOpacity = heroDimAt(entry);
      write.opacity(heroDim.current, 1 - heroOpacity);
      /* The drift is front-loaded the way the dimming is, so the hero settles
         into its final position while it is still bright enough to read. */
      write.transform(
        heroShift.current,
        `translate3d(0,${(-TOUR_ENTRY.heroDriftVh * stageEl.clientHeight * (1 - (1 - entry) ** 2.2)).toFixed(2)}px,0)`,
      );
      /* Nothing in the hero may be tabbed to or clicked once it is more than
         half dark — a button nobody can read is still a button that steals a
         click, and the mock is drawn over it by then. */
      write.inert(heroShift.current, heroOpacity < TOUR_ENTRY.heroInertAt);

      /* --- the camera --- */
      const view = frameAt(p, poses, reduced);
      write.transform(
        cameraEl,
        `translate(${view.x.toFixed(2)}px,${view.y.toFixed(2)}px) scale(${view.scale.toFixed(4)})`,
      );
      write.opacity(cameraEl, view.opacity);

      /* --- focus: at a tight stop everything but one panel fades out --- */
      /* THE FADE IS WHAT CLEARS THE SPACE THE CAPTION USES. It is not a
         decoration on top of the zoom — it is the zoom's other half, and it is
         why there is no scrim anywhere in this section. */
      const focused =
        stepRange(...windowOf(TOUR_STAGE.focusIn), p) *
        (1 - stepRange(...windowOf(TOUR_STAGE.focusOut), p));

      /* Which panel keeps the floor: whichever the live tight stop frames. */
      let keep: TourNodeKey | null = null;
      for (const stop of TOUR_STOPS) {
        if (p >= stop.from && p < stop.to) {
          keep = TOUR_POSE_FOCUS[stop.pose] ?? null;
        }
      }

      for (const [key, element] of fadeable) {
        const held = key === keep ? 1 : TOUR_STAGE.paneFloor;
        write.opacity(element, 1 - focused * (1 - held));
      }
      /* The window's own frame dims but stays: the brief asks for the app's
         top-left corner and frame to be visible beside the focused panel. */
      write.opacity(
        el.chrome,
        1 - focused * (1 - TOUR_STAGE.chromeFloor),
      );
      write.opacity(
        el.sidebar,
        1 - focused * (1 - TOUR_STAGE.chromeFloor),
      );

      /* --- the captions --- */
      TOUR_STOPS.forEach((stop, index) => {
        const target = captions.current[index];
        if (!target) return;
        const fade = TOUR_STAGE.captionFade;
        const arriving = stepRange(stop.captionFrom, stop.captionFrom + fade, p);
        const leaving = stepRange(stop.captionTo - fade, stop.captionTo, p);
        const visible = arriving * (1 - leaving);
        write.opacity(target, visible);
        write.custom(
          target,
          "--tour-shift",
          `${((1 - arriving) * 14 - leaving * 14).toFixed(1)}px`,
        );
        write.inert(target, visible < 0.5);
      });

      /* --- 1 · write: a topic is typed, a draft comes back --- */
      const d1 = TOUR_DEMO.write;
      const q1 = clamp((p - d1.from) / (d1.to - d1.from));
      const typedCount = Math.round(
        TOUR_DRAFT.topic.length * clamp(q1 / d1.typedBy),
      );
      write.text(el.typed, TOUR_DRAFT.topic.slice(0, typedCount));
      write.display(el.placeholder, typedCount ? "none" : "inline");
      write.display(
        el.caret,
        q1 > 0 && q1 < d1.typedBy + 0.04 ? "inline-block" : "none",
      );
      const writing =
        q1 >= d1.writing[0] && q1 < d1.writing[1];
      write.text(
        el.generate,
        writing ? MARKETING_TOUR.writingLabel : MARKETING_COMPOSER.generateLabel,
      );
      if (GENERATION_TOTAL !== null) {
        const spent = q1 >= d1.writing[0];
        write.text(
          el.generations,
          `${String(spent ? GENERATION_TOTAL - 1 : GENERATION_TOTAL)} / ${String(GENERATION_TOTAL)} generations left`,
        );
      }
      write.opacity(el.draftEmpty, 1 - stepRange(...windowOf(d1.emptyOut), q1));
      write.rise(el.draftHead, stepRange(...windowOf(d1.headIn), q1), 6);
      /* The lines come up one after another — a draft arriving, not a paragraph
         fading in. The first one's value is kept, because the character count
         below reads zero until there is a draft to count. */
      let firstLineShown = 0;
      lines.forEach((lineEl, index) => {
        const shown = stepRange(
          d1.lineIn[0] + index * d1.lineStep,
          d1.lineIn[1] + index * d1.lineStep,
          q1,
        );
        write.opacity(lineEl, shown);
        if (index === 0) firstLineShown = shown;
      });
      write.opacity(el.draftFoot, stepRange(...windowOf(d1.footIn), q1));

      /* --- 2 · voice: habits are learned, then applied to the draft --- */
      const d2 = TOUR_DEMO.voice;
      const q2 = clamp((p - d2.from) / (d2.to - d2.from));
      write.text(
        el.trained,
        String(
          Math.round(
            MARKETING_TOUR.voiceTrainedCount *
              stepRange(...windowOf(d2.trainedIn), q2),
          ),
        ),
      );
      /* Each trait's mark strikes as it is learned — the closest thing the app
         can show to watching it read. */
      traitTicks.forEach((tick, index) => {
        write.opacity(tick, q2 >= d2.traitFrom + index * d2.traitStep ? 1 : 0);
      });
      write.opacity(el.voiceBadge, stepRange(...windowOf(d2.badgeIn), q2));

      /* ONE EDIT PER LEARNED TRAIT, and each edit LIGHTS THE LINE IT CHANGES as
         it changes it. Looked up BY LINE, not by position: which trait edits
         which line is declared in TOUR_DEMO.voice.edits and is deliberately not
         the identity, so walking two lists in parallel is exactly the mistake
         this avoids. */
      let lastEdit = 0;
      for (const edit of d2.edits) {
        const done = stepRange(edit.from, edit.to, q2);
        lastEdit = Math.max(lastEdit, done);

        const rewriteIndex = TOUR_DRAFT.rewrites.findIndex(
          (rewrite) => rewrite.line === edit.line,
        );
        if (rewriteIndex < 0) {
          /* No replacement text for this line: the edit is the emoji coming off
             the opening line. */
          write.opacity(el.emoji, 1 - done);
        } else {
          write.opacity(swapOld[rewriteIndex], 1 - done);
          write.opacity(swapNew[rewriteIndex], done);
        }

        write.custom(
          lines[edit.line],
          "--tour-lit",
          pulse(edit.highlightAt, d2.highlightWidth, q2).toFixed(3),
        );
      }

      /* The count is the real length of whichever version is on screen, and
         reads zero until there is a draft to count. */
      write.text(
        el.characters,
        `${String(
          firstLineShown < 0.5
            ? 0
            : lastEdit > 0.5
              ? TOUR_DRAFT.charactersAfter
              : TOUR_DRAFT.charactersBefore,
        )} / ${String(LINKEDIN_MAX_COMMENTARY)}`,
      );

      /* --- 3 · schedule: the month fills and the post takes a Tuesday --- */
      const d3 = TOUR_DEMO.schedule;
      const q3 = clamp((p - d3.from) / (d3.to - d3.from));
      const booked = q3 >= d3.bookedAt;
      write.text(
        el.schedule,
        booked ? MARKETING_TOUR.scheduledLabel : MARKETING_TOUR.scheduleLabel,
      );
      write.opacity(el.dayRing, stepRange(...windowOf(d3.ringIn), q3));
      /* The outline is drawn first and FILLS as the day is taken — two states of
         one element rather than two elements, so there is nothing to align. */
      write.toggle(el.dayRing, "bg-transparent", !booked);
      write.toggle(el.dayCell, "tour-booked", booked);
      write.rise(el.nextUp, stepRange(...windowOf(d3.nextIn), q3), 8);
      let taken = booked ? 1 : 0;
      dots.forEach((dot, index) => {
        const shown = stepRange(
          d3.dotIn[0] + index * d3.dotStep,
          d3.dotIn[1] + index * d3.dotStep,
          q3,
        );
        write.opacity(dot, shown);
        if (shown > 0.5) taken += 1;
      });
      write.text(el.scheduledCount, String(taken));

      /* --- 4 · profile: scored, critiqued, rewritten --- */
      const d4 = TOUR_DEMO.profile;
      const q4 = clamp((p - d4.from) / (d4.to - d4.from));
      const score =
        MARKETING_PROFILE_SCORE.value * stepRange(...windowOf(d4.scoreIn), q4);
      write.text(el.scoreValue, String(Math.round(score)));
      /* The ring grows by dash offset, which is a paint change. The numeral and
         the arc read the same number, so the two cannot drift. */
      write.dashOffset(
        el.scoreArc,
        TOUR_RING_LENGTH * (1 - score / MARKETING_PROFILE_SCORE.outOf),
      );
      verdicts.forEach((verdict, index) => {
        write.opacity(
          verdict,
          stepRange(
            d4.verdictIn[0] + index * d4.verdictStep,
            d4.verdictIn[1] + index * d4.verdictStep,
            q4,
          ),
        );
      });
      write.opacity(el.rewrite, stepRange(...windowOf(d4.rewriteIn), q4));
      write.toggle(el.rewriteOld, "line-through", q4 >= d4.strikeAt);
      write.rise(el.rewriteNew, stepRange(...windowOf(d4.rewriteNewIn), q4), 4);
    };

    /* ---------- scroll → damped progress → render ---------- */
    let current = 0;
    let target = 0;
    let frame = 0;
    let range = 1;

    /* MEASURED FROM THE STAGE'S OWN TRACK, not from the component's top. The
       component starts at the hero, which is 440svh of someone else's scroll
       sequence; progress 0 is the instant the stage pins, which is where its
       track begins. Using the component's top would put the whole entry inside
       the hero's first beat. */
    const stageTrack = () => stageEl.parentElement;

    const readRange = () => {
      const parent = stageTrack();
      range = Math.max(
        (parent?.offsetHeight ?? 0) - stageEl.clientHeight,
        1,
      );
    };

    const read = () => {
      const parent = stageTrack();
      if (!parent) return 0;
      return clamp((window.scrollY - parent.offsetTop) / range);
    };

    const tick = () => {
      frame = 0;
      const delta = target - current;
      current =
        reduced || Math.abs(delta) < SETTLED
          ? target
          : current + delta * DAMPING;
      render(current);
      if (current !== target) frame = requestAnimationFrame(tick);
    };

    const onScroll = () => {
      target = read();
      if (!frame) frame = requestAnimationFrame(tick);
    };

    const reset = () => {
      measure();
      readRange();
      current = target = read();
      render(current);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", reset);
    reset();

    /* Fonts change nothing the camera measures, but they do change the caption
       boxes' content — and a cold load that settles after the first paint
       leaves them placed against a stage that has since resized. */
    let stopped = false;
    void document.fonts.ready.then(() => {
      if (!stopped) reset();
    });

    return () => {
      stopped = true;
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", reset);
    };
  }, []);

  return (
    /* ONE TRACK FOR THE HERO AND THE TOUR. The component wraps the hero so a
       single scroll timeline drives the dimming, the entry and the stops —
       which is the only way the mock can rise OVER a hero that is still on
       screen without two components agreeing about scroll position. */
    <div
      ref={track}
      id={MARKETING_SECTION_IDS.tour}
      /* NO `tour-scope` HERE. The hero renders inside this wrapper, and that
         class remaps --ink / --blue / --paper to the dark ramp — on the
         wrapper it repaints the hero's whole palette, which is the one thing
         this section may not do. It goes on the STAGE instead, which is the
         only subtree that should be dark. Nor may this wrapper carry a
         background, for the same reason: the hero has none of its own and
         takes the layout's cream from above. */
      className="relative z-4"
    >
      {/* THE HERO, UNCHANGED, PINNED BY ITS BOTTOM EDGE.

          `sticky bottom-0` is the whole trick, and it is why nothing inside the
          hero had to change. The hero is a 440svh scroll sequence with its own
          sticky stage; a box taller than the viewport with `bottom: 0` behaves
          STATICALLY until its bottom edge reaches the bottom of the viewport,
          so the hero plays its four beats exactly as it always did. At that
          moment — 340svh in, the instant its own sequence finishes — it pins,
          and its last frame stays on screen for the whole entry. Pinning it
          with `top: 0` instead would freeze it on beat one. */}
      <div className="sticky bottom-0 z-0">
        {/* The drift is on a WRAPPER, never on the hero: the hero's own stage
            is transformed by gsap, and a second transform on the same element
            would be overwritten sixty times a second. */}
        <div ref={heroShift} className="will-change-transform">
          {children}
        </div>

      </div>

      {/* THE STAGE. Pulled up by one viewport so it pins at the same instant
          the hero does — any later and the mock would have to appear from
          nowhere, any earlier and it would cover a hero still mid-sequence. */}
      <div
        /* `tour-scope` lives HERE, not on the wrapper above: only the stage
           and its captions are dark, and the hero keeps the page's palette. */
        className="tour-scope relative z-1"
        style={{
          height: `calc(100svh + ${String(MARKETING_TOUR_RANGE_SVH)}svh)`,
          /* Pulled up by a viewport PLUS the peek, so the stage pins while the
             hero is still being read and the title bar has somewhere to sit
             still before the rise. */
          marginTop: `calc(-100svh - ${String(MARKETING_TOUR_PHASES.peek)}svh)`,
        }}
      >
        <div
          ref={stage}
          /* `overflow-hidden` crops the mock to the STAGE, so a wide stop may
             run the window off the edge without ever widening the document. */
          className="sticky top-0 h-svh overflow-hidden"
        >
          {/* THE BLACK SHEET, and it does two jobs with one element. Over the
              hero it IS the dimming — a sheet rather than an opacity on the
              hero itself, because fading the hero would fade it against
              whatever is behind it, while a sheet gives the recording's result
              on a dark hero and still works if the hero is ever made light.
              Once the entry is done it stays at full strength and becomes the
              tour's pure-black ground, so the section never needs a background
              of its own and the hand-off from dimming to ground has no seam. */}
          <div
            ref={heroDim}
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-0 bg-black opacity-0"
          />

          {/* The camera. `origin-top-left` is load-bearing: it is what lets a
              frame be written as a plain translate+scale of the window's
              top-left corner. Any other origin makes the anchor maths depend on
              the scale, and the fit in buildTourPoses stops being true. */}
          <div
            ref={camera}
            className="absolute top-0 left-0 z-1 origin-top-left will-change-transform"
          >
            <ProductTourMock />
          </div>

          {/* The captions — the section's whole readable content, and all a
              reader who never sees the animation is left with. Placed by the
              camera; see `measure`. */}
          {TOUR_STOPS.map((stop, index) => (
            <div
              key={stop.key}
              ref={(element) => {
                captions.current[index] = element;
              }}
              className={cn(
                "absolute z-3 flex flex-col gap-3 opacity-0",
                "translate-y-[calc(-50%+var(--tour-shift,0px))]",
                /* On a phone the caption is a band in the bottom half and is
                   aligned to its top, not centred on a panel. */
                "max-[819px]:translate-y-[var(--tour-shift,0px)] max-[819px]:justify-start max-[819px]:pt-6",
              )}
            >
              <span className="font-mono text-[11px] tracking-[0.16em] text-[var(--mac-faint)] uppercase">
                {stop.label}
              </span>

              <PaperDisplay
                as="h2"
                words={stop.heading}
                className="text-[clamp(26px,3.2vw,46px)] leading-[0.92] tracking-[-0.04em]"
              />

              <p className="m-0 max-w-[34em] text-[clamp(13.5px,1.1vw,16px)] leading-relaxed text-pretty text-[var(--mac-dim)]">
                {stop.body}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* The page eases out of the black rather than cutting: the band below is
          cream, and a hard edge against a pinned stage reads as a seam. On the
          track rather than in the stage — inside it, it would be pinned to the
          bottom of the VIEWPORT and so wash the black out for the whole tour. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-[12svh] bg-[linear-gradient(to_top,var(--paper),transparent)]"
      />
    </div>
  );
}

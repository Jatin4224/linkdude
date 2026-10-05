/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: MARKETING_TOUR, TOUR_DESIGN, TOUR_RECTS, TOUR_TRACK,
 *   TOUR_STOPS, TOUR_DEMO, TOUR_STAGE, TOUR_DRAFT, TOUR_CALENDAR, TOUR_FRAMING,
 *   MARKETING_TOUR_HEIGHT_SVH, product tour, scroll camera, pinned stage,
 *   camera timeline, tight stop, wide stop, black section
 *
 * WHAT:  Every number and every word the landing page's scroll-driven product
 *        tour is made of — the mock's design size, the regions the camera
 *        frames, how each pose is framed against the viewport, the scroll
 *        timeline, the four stops' captions and the per-demo sub-timings.
 *
 * WHY:   THE TOUR IS A PURE FUNCTION OF SCROLL PROGRESS, so it is a table, not
 *        code. Keeping the table here means the whole sequence can be retuned —
 *        a stop lengthened, a caption reworded, a zoom reframed — without
 *        opening the renderer, and it means the only thing in the .tsx files is
 *        the mechanism.
 *
 *        THE SHAPE OF THE CHOREOGRAPHY IS THE POINT, and it is not the
 *        prototype's. The prototype flew to a different corner at every stop,
 *        which reads as a tour of a map. This one is two movements: TWO TIGHT
 *        STOPS down one column of the app, joined by a straight pan at a shared
 *        zoom, then TWO WIDE STOPS where the whole app is back and slides
 *        sideways so the caption can swap from one half of the screen to the
 *        other. A reader learns the rule in the first movement and can follow
 *        the second without looking for the camera.
 *
 *        THE COPY IS NOT WRITTEN HERE. Three of the four stops reuse
 *        MARKETING_STEPS verbatim and the fourth reuses the Voice row of
 *        MARKETING_FEATURES, because those are the claims the page already
 *        makes further down. A tour with its own wording would be the same four
 *        promises stated twice, free to drift apart — and the drift would land
 *        on two sections a reader sees within one screen of each other. What IS
 *        declared here is the geometry, which has no other home.
 *
 * WHERE: src/app/(marketing)/_components/product-tour/*. Nothing else may read
 *        it — these numbers only mean anything against that mock.
 */

import type {
  TourNodeKey,
  TourPoseKey,
  TourRect,
  TourStop,
  TourTrackStop,
} from "@/lib/types/marketing-tour";
import type { PaperDisplayLine } from "@/lib/types/paper";
import {
  MARKETING_CALENDAR,
  MARKETING_COMPOSER,
  MARKETING_FEATURES,
  MARKETING_FEATURE_PREVIEWS,
  MARKETING_POST_LINES,
  MARKETING_STEPS,
  type MarketingStep,
  type MarketingStepArtifact,
} from "./marketing";

/**
 * SOURCE OF TRUTH KEYWORDS: TOUR_DESIGN, design size, fixed layout, reflow
 *
 * WHAT:  The mock's own coordinate system — the size it is laid out at, always,
 *        at every viewport.
 * WHY:   THE MOCK NEVER REFLOWS. It is laid out once at this size and then only
 *        ever scaled by the camera, which is what makes a zoom a transform
 *        rather than a relayout: no text re-wraps, no panel changes height, and
 *        the focus rectangles below stay correct on a phone and on a 4K monitor.
 *        A mock sized in percentages would need its rectangles re-measured per
 *        breakpoint, and the camera would be framing a layout it could not
 *        predict.
 *
 *        Carried over from the prototype unchanged, because the rectangles below
 *        were measured against these two numbers.
 */
export const TOUR_DESIGN = { width: 1200, height: 740 } as const;

/**
 * SOURCE OF TRUTH KEYWORDS: MARKETING_TOUR_PHASES, TOUR_ENTRY, entry transition,
 *   peek pose, settled pose, hero dim, hero drift, scroll budget, stop pace
 *
 * WHAT:  How much SCROLL each phase of the section gets, in svh. These are the
 *        tuning dials: change one number and the whole timeline re-derives.
 * WHY:   THE BUDGET IS THE PACING. The entry gets one viewport of scroll and the
 *        hold a quarter of one, which is what the effect was specified at and
 *        what the reference recording plays at. Each of the four stops gets a
 *        viewport, split about evenly between the camera move and the hold, so
 *        a reader always has as long to read a caption as the camera took to
 *        arrive at it.
 *
 *        `heroTrack` is NOT a dial — it is the hero's own height, and it is here
 *        only so the arithmetic below can be read in one place. The hero is a
 *        440svh scroll sequence of its own; the transition begins where that
 *        sequence ends, which is 100svh before the hero's section does (its last
 *        viewport is the sticky stage's final frame). See ProductTour.
 */
export const MARKETING_TOUR_PHASES = {
  /** The hero's own track, from StickyHero. Read, never set, by the tour. */
  heroTrack: 440,
  /**
   * The window's title bar sits above the bottom edge, doing nothing, while the
   * hero is still being read. This phase is what makes the strip a PEEK rather
   * than a pop: the stage pins this far before the rise begins, so the bar is
   * on screen and still for most of a viewport of scroll first.
   */
  peek: 40,
  /** The mock rises from the bottom edge and shrinks into its settled pose. */
  entry: 100,
  /** It holds there, whole and still, before the first zoom. */
  hold: 25,
  /** One per stop: Write, Voice, Schedule, Profile. */
  stop: 100,
  /** It drifts and fades as the section lets go. */
  exit: 60,
} as const;

/** Total scroll the pinned stage owns, in svh. */
export const MARKETING_TOUR_RANGE_SVH =
  MARKETING_TOUR_PHASES.peek +
  MARKETING_TOUR_PHASES.entry +
  MARKETING_TOUR_PHASES.hold +
  MARKETING_TOUR_PHASES.stop * 4 +
  MARKETING_TOUR_PHASES.exit;

/** A phase boundary, in svh from the start of the stage's track, as progress. */
const at = (svh: number): number =>
  Math.round((svh / MARKETING_TOUR_RANGE_SVH) * 1000) / 1000;

const P = MARKETING_TOUR_PHASES;

/** Where a stop's camera finishes arriving — the move takes the first 52%. */
const MOVE = 0.52;
const settleOf = (from: number, to: number) =>
  +(from + (to - from) * MOVE).toFixed(4);

/**
 * SOURCE OF TRUTH KEYWORDS: TOUR_MARKS, phase boundary, progress, timeline
 *
 * WHAT:  Every phase boundary as a progress value, derived from the budget.
 * WHY:   DERIVED, NEVER TYPED TWICE. The timeline, the caption windows and the
 *        demo sub-timings all read these, so lengthening the entry moves every
 *        later stop with it instead of silently overlapping the one after.
 */
export const TOUR_MARKS = {
  /** The strip holds still until here, then the rise starts. */
  peekEnd: at(P.peek),
  entryEnd: at(P.peek + P.entry),
  holdEnd: at(P.peek + P.entry + P.hold),
  writeEnd: at(P.peek + P.entry + P.hold + P.stop),
  voiceEnd: at(P.peek + P.entry + P.hold + P.stop * 2),
  scheduleEnd: at(P.peek + P.entry + P.hold + P.stop * 3),
  profileEnd: at(P.peek + P.entry + P.hold + P.stop * 4),
} as const;

/**
 * SOURCE OF TRUTH KEYWORDS: TOUR_ENTRY, peek pose, settled pose, measured pairs,
 *   hero dim curve, hero drift, reference recording
 *
 * WHAT:  The entry's two poses and the hero's dimming curve — every number here
 *        was MEASURED off the reference recording rather than estimated.
 *
 * WHY:   The mock's width turned out to be EXACTLY LINEAR in its top edge
 *        across the whole rise (slope 0.455, fitted against nineteen sampled
 *        frames to within 0.2 of a percent). That is the finding that makes the
 *        entry one plain interpolation between two poses rather than a curve
 *        anyone has to maintain: top 97.7% → 15.9% and width 97.9% → 60.7%, in
 *        step, with the same translate-and-scale transform every other camera
 *        move uses.
 *
 *        THE DIM CURVE IS FRONT-LOADED AND THE SHAPE IS THE POINT. The hero
 *        loses a fifth of its brightness before the mock has visibly moved, is
 *        down to about two thirds a tenth of the way in, and then fades slowly
 *        for the rest. A linear fade reads as the hero being switched off; this
 *        reads as the page going dark to make room. Stored as a table rather
 *        than fitted to a formula because no simple curve matches it and a
 *        table is what stays tunable.
 */
export const TOUR_ENTRY = {
  /** At rest: the window's title bar peeking above the bottom edge. */
  peek: { topVh: 0.977, widthVw: 0.979 },
  /** Settled: the whole window, centred, on black. */
  settled: { topVh: 0.159, widthVw: 0.607 },
  /**
   * How far the hero's content drifts UP across the entry, as a fraction of the
   * viewport height. Measured at 7.5% — more than it looks, and front-loaded in
   * the same way the dimming is.
   */
  heroDriftVh: 0.075,
  /**
   * Hero opacity against entry progress. The black overlay above the hero is
   * drawn at one minus this, which gives the same result on a dark hero as the
   * recording and also works if the hero is ever made light.
   */
  heroDim: [
    [0, 1],
    [0.02, 0.8],
    [0.1, 0.64],
    [0.18, 0.58],
    [0.28, 0.51],
    [0.4, 0.45],
    [0.53, 0.4],
    [0.64, 0.35],
    [0.76, 0.27],
    [0.85, 0.2],
    [0.92, 0.12],
    [0.97, 0.05],
    [1, 0],
  ] as readonly (readonly [number, number])[],
  /** Past this the hero is too dark to read, so it stops being reachable. */
  heroInertAt: 0.5,
} as const;

/**
 * SOURCE OF TRUTH KEYWORDS: TOUR_RECTS, focus rectangle, camera target, column
 *
 * WHAT:  What the camera frames at each tight stop, in design coordinates.
 * WHY:   THE TWO TIGHT STOPS ARE THE SAME COLUMN, which is why they share an x
 *        and a width and differ only in y. That is not a coincidence to be
 *        preserved by hand — it is the whole reason the move between them is a
 *        pan rather than a second zoom, and the camera reads the shared width to
 *        decide the zoom ONCE for both. See buildTourPoses.
 *
 *        `voice` stops short of its pane's full height on purpose: the pane runs
 *        to the foot of the window and ends in a list of previously published
 *        posts, which is context rather than the thing being demonstrated.
 *        Framing the card alone keeps the two tight stops the same size on
 *        screen, which is what makes the pan read as a pan.
 */
export const TOUR_RECTS = {
  /* The topic box and the Generate button. */
  write: [200, 40, 380, 266] as TourRect,
  /* The voice profile card, directly beneath it in the same column. */
  voice: [200, 326, 380, 266] as TourRect,
} as const;

/**
 * SOURCE OF TRUTH KEYWORDS: TOUR_FRAMING, target area, tight zoom, wide zoom,
 *   app offset, caption half, viewport fraction
 *
 * WHAT:  How each kind of pose is sized and placed against the viewport, as
 *        fractions of its width.
 * WHY:   FRACTIONS, NOT PIXELS, so the choreography holds at every width without
 *        a breakpoint. Each number is a thing the effect was specified in terms
 *        of, and is written here rather than inline in the camera so the whole
 *        composition can be read at once:
 *
 *        `tightPanel` — a focused panel is about a third of the screen wide.
 *        `tightLeft`  — and sits this far in from the left edge, which is what
 *                       keeps the app's top-left corner and window frame on
 *                       screen beside it. Below that the corner is cropped;
 *                       above it there is no room left for the caption.
 *        `overWidth`  — the arrival: the whole app at about 60% of the screen.
 *        `wideWidth`  — the wide stops, barely smaller, so the move from the
 *                       second tight stop reads as pulling back rather than as
 *                       a new shot, and the slide between the two wide stops
 *                       changes position without changing size.
 *        `wideLeft`   — the app pushed right, its right edge at the screen's,
 *                       freeing the left half for the caption.
 *        `wideSlid`   — and then slid left until its left part is off-screen,
 *                       freeing the right half for the next one. Negative by
 *                       design: that overhang is the move.
 *        `exitDrift`  — how far the mock keeps travelling as it fades out.
 */
export const TOUR_FRAMING = {
  tightPanel: 1 / 3,
  tightLeft: 0.18,
  overWidth: 0.6,
  wideWidth: 0.58,
  wideLeft: 0.42,
  wideSlid: -0.2,
  exitDrift: -0.12,
  /** Narrow screens: the mock owns the top half, the caption the bottom. */
  narrow: {
    /** Fraction of the stage height the mock's band takes. */
    band: 0.46,
    /** A focused panel, as a fraction of the screen's width, on a phone. */
    tightPanel: 0.78,
    overWidth: 0.92,
    wideWidth: 0.92,
  },
} as const;

/**
 * SOURCE OF TRUTH KEYWORDS: TOUR_TRACK, scroll timeline, keyframe, hold, pose
 *
 * WHAT:  The camera's flight plan: at this progress, hold this pose; between two
 *        stops, interpolate.
 * WHY:   TWO CONSECUTIVE STOPS NAMING THE SAME POSE IS A HOLD, and the holds are
 *        half the point — a camera that never stops gives no demo room to play.
 *        Each stop gets about 0.185 of the section, split evenly between the
 *        move and the hold, which is the pacing the effect was specified at.
 *
 *        Read as six beats: the app arrives centred (enter → over), the camera
 *        drops hard onto the composer (over → write), pans straight down to the
 *        voice profile at the same zoom (write → voice), pulls back out to the
 *        whole app on the right of the screen (voice → calendar), slides it left
 *        to free the other half (calendar → profile), and lets it drift away as
 *        the section unpins (profile → exit).
 */
export const TOUR_TRACK: readonly TourTrackStop[] = [
  /* The entry. ONE interpolation from the peek to the settled pose — the same
     translate-and-scale the rest of the timeline uses, not a special case. */
  [0, "peek"],
  [TOUR_MARKS.peekEnd, "peek"],
  [TOUR_MARKS.entryEnd, "settled"],
  /* The hold: whole, still, on black. */
  [TOUR_MARKS.holdEnd, "settled"],
  /* 1 · Write — the tight drop onto the composer. Half the stop is the move. */
  [TOUR_MARKS.holdEnd + (TOUR_MARKS.writeEnd - TOUR_MARKS.holdEnd) * 0.52, "write"],
  [TOUR_MARKS.writeEnd, "write"],
  /* 2 · Voice — a straight pan down the same column, at the same zoom. */
  [TOUR_MARKS.writeEnd + (TOUR_MARKS.voiceEnd - TOUR_MARKS.writeEnd) * 0.52, "voice"],
  [TOUR_MARKS.voiceEnd, "voice"],
  /* 3 · Schedule — pull back; the app takes the right, the caption the left. */
  [TOUR_MARKS.voiceEnd + (TOUR_MARKS.scheduleEnd - TOUR_MARKS.voiceEnd) * 0.52, "calendar"],
  [TOUR_MARKS.scheduleEnd, "calendar"],
  /* 4 · Profile — the app slides left; the caption crosses to the right. */
  [TOUR_MARKS.scheduleEnd + (TOUR_MARKS.profileEnd - TOUR_MARKS.scheduleEnd) * 0.52, "profile"],
  [TOUR_MARKS.profileEnd, "profile"],
  /* Leave: it keeps moving and fades as the section lets go. */
  [1, "exit"],
];

/**
 * SOURCE OF TRUTH KEYWORDS: stepFor, voiceFeature, MarketingStepArtifact,
 *   borrowed copy, lookup by artifact
 *
 * WHAT:  Finds the step or the feature row whose copy a stop borrows.
 * WHY:   BY `artifact`, NEVER BY INDEX. MARKETING_STEPS and MARKETING_FEATURES
 *        are ordered for the band they render in, and a reorder there must not
 *        silently repoint a tour caption at a different feature — which an index
 *        would do without a compile error or a visible break, leaving the
 *        Schedule stop captioned "Fix the profile it lands on".
 *
 *        It THROWS rather than falling back. This module is evaluated at build
 *        time on a fully static page, so a missing step fails the build with the
 *        artifact's name in the message, which is the behaviour wanted: the
 *        alternative is a landing page that ships with placeholder copy where a
 *        caption should be.
 */
function stepFor(artifact: MarketingStepArtifact): MarketingStep {
  const step = MARKETING_STEPS.find((entry) => entry.artifact === artifact);
  if (!step) {
    throw new Error(`MARKETING_STEPS has no step for artifact "${artifact}"`);
  }
  return step;
}

const VOICE_FEATURE = MARKETING_FEATURES.find(
  (feature) => feature.artifact === "voice",
);

if (!VOICE_FEATURE) {
  throw new Error('MARKETING_FEATURES has no feature for artifact "voice"');
}

/**
 * SOURCE OF TRUTH KEYWORDS: toBlackGround, PaperWordVariant, paper variant,
 *   boxed word, dark band
 *
 * WHAT:  Re-boxes a display line so it reads on the tour's black ground.
 * WHY:   MARKETING_STEPS is authored for the ink band, where `plain` prints
 *        white — which is already right here. The one variant that is not is
 *        `paper`, a WHITE box: on black it is the loudest object on the screen
 *        and would out-shout the mock it is captioning. It becomes `blue`, the
 *        accent this section already spends inside the app.
 *
 *        Touching one variant rather than remapping the set is deliberate:
 *        `plain` and `blue` mean the same thing on black as on ink, and a
 *        wholesale remap would be a second palette to keep in step.
 */
function toBlackGround(line: PaperDisplayLine): PaperDisplayLine {
  return line.map((word) =>
    word.variant === "paper" ? { ...word, variant: "blue" as const } : word,
  );
}

/**
 * SOURCE OF TRUTH KEYWORDS: TOUR_STOPS, caption window, stop, framing, label
 *
 * WHAT:  The four stops — caption copy, the scroll window each owns, where its
 *        caption is drawn and when it is readable.
 * WHY:   THE CAPTION FADES INSIDE ITS OWN WINDOW, NOT ACROSS THE WHOLE OF IT.
 *        Each one arrives once the camera has nearly settled and dims out before
 *        it leaves, which is what makes the copy feel like a consequence of the
 *        move rather than a label racing it. The insets are what guarantee only
 *        one caption is readable at a time at any scroll speed, including a
 *        reader who throws the scrollbar.
 *
 *        `framing` is the half of the composition the caption lives in, and it
 *        tracks the camera: the two tight stops leave the right of the app
 *        window empty, so the caption goes there, INSIDE the window; the two
 *        wide stops free the left and then the right of the screen, so it goes
 *        outside, on black, and crosses over between them. That crossing is the
 *        second movement's whole gesture.
 */
/*
 * A caption is readable only during the HOLD — it arrives once the camera has
 * nearly settled and dims out before it leaves. Derived from the stop's own
 * window so retiming a stop carries its caption, and so the gap that keeps two
 * captions from ever being legible at once cannot be lost to a typo.
 */
function captionWindow(from: number, to: number) {
  const span = to - from;
  return {
    /* The camera move takes the first 52% of the stop; the caption waits for it. */
    captionFrom: +(from + span * 0.62).toFixed(4),
    captionTo: +(to - span * 0.06).toFixed(4),
  };
}

export const TOUR_STOPS: readonly TourStop[] = [
  {
    key: "write",
    label: "Write",
    heading: toBlackGround(stepFor("draft").headline),
    body: stepFor("draft").body,
    pose: "write",
    framing: "inside-right",
    from: TOUR_MARKS.holdEnd,
    to: TOUR_MARKS.writeEnd,
    ...captionWindow(TOUR_MARKS.holdEnd, TOUR_MARKS.writeEnd),
  },
  {
    key: "voice",
    label: VOICE_FEATURE.label,
    heading: toBlackGround(VOICE_FEATURE.title),
    body: VOICE_FEATURE.body,
    pose: "voice",
    framing: "inside-right",
    from: TOUR_MARKS.writeEnd,
    to: TOUR_MARKS.voiceEnd,
    ...captionWindow(TOUR_MARKS.writeEnd, TOUR_MARKS.voiceEnd),
  },
  {
    key: "schedule",
    label: "Schedule",
    heading: toBlackGround(stepFor("calendar").headline),
    body: stepFor("calendar").body,
    pose: "calendar",
    framing: "outside-left",
    from: TOUR_MARKS.voiceEnd,
    to: TOUR_MARKS.scheduleEnd,
    ...captionWindow(TOUR_MARKS.voiceEnd, TOUR_MARKS.scheduleEnd),
  },
  {
    key: "profile",
    label: "Profile",
    heading: toBlackGround(stepFor("score").headline),
    body: stepFor("score").body,
    pose: "profile",
    framing: "outside-right",
    from: TOUR_MARKS.scheduleEnd,
    to: TOUR_MARKS.profileEnd,
    ...captionWindow(TOUR_MARKS.scheduleEnd, TOUR_MARKS.profileEnd),
  },
];

/**
 * SOURCE OF TRUTH KEYWORDS: TOUR_DEMO, sub-timeline, local progress, demo timing
 *
 * WHAT:  Each demo's own window and the beats inside it, as LOCAL progress
 *        (0 → 1 across that demo).
 * WHY:   NORMALISED, so retiming a stop moves its demo with it. Every beat runs
 *        inside the HOLD rather than across the camera move: a list that fills
 *        while the camera is still flying is a list nobody can read, and the
 *        hold is exactly the half of each stop that exists for the demo to
 *        happen in.
 *
 *        There is no pointer in any of them. The prototype drove its demos with
 *        a drawn cursor that clicked things; this one lets the product do the
 *        small thing by itself, which is both less to disbelieve and one less
 *        element to keep aligned with a layout that scales.
 */
export const TOUR_DEMO = {
  /* 1 · The topic types itself and a draft comes back. */
  write: {
    from: settleOf(TOUR_MARKS.holdEnd, TOUR_MARKS.writeEnd),
    to: TOUR_MARKS.writeEnd,
    /** The topic finishes typing early — the draft is the payoff, not the typing. */
    typedBy: 0.34,
    /** The button reads "Writing" between these two. */
    writing: [0.36, 0.52],
    emptyOut: [0.42, 0.5],
    headIn: [0.5, 0.58],
    /** First line's window; each later line is offset by `lineStep`. */
    lineIn: [0.56, 0.66],
    lineStep: 0.07,
    footIn: [0.86, 0.94],
  },
  /* 2 · Three habits are learned, and each one edits a line of the draft. */
  voice: {
    from: settleOf(TOUR_MARKS.writeEnd, TOUR_MARKS.voiceEnd),
    to: TOUR_MARKS.voiceEnd,
    trainedIn: [0.1, 0.34],
    /** First trait ticks here; each later one is offset by `traitStep`. */
    traitFrom: 0.28,
    traitStep: 0.11,
    badgeIn: [0.62, 0.7],
    /*
     * ONE BEAT PER TRAIT, in the order the traits tick on: the window the edit
     * crossfades across, which line of the draft it changes, and where the
     * highlight behind that line pulses. Written as one row per trait rather
     * than three parallel arrays, because three arrays is how the beat, the
     * line and the highlight end up a frame apart from each other — the only
     * version of this that reads as a bug rather than as cause and effect.
     *
     * `line` indexes TOUR_DRAFT.lines and is NOT the trait's own position:
     * "Short sentences" edits the long second line, "No emoji" the first.
     *
     * The draft is off-screen at this stop — the camera is on the voice card —
     * so these play for the reader who scrolls back up, and so the draft is
     * already in its finished state when the wide stops bring it back.
     */
    edits: [
      { from: 0.66, to: 0.74, line: 1, highlightAt: 0.7 },
      { from: 0.76, to: 0.84, line: 0, highlightAt: 0.8 },
      { from: 0.86, to: 0.94, line: 3, highlightAt: 0.9 },
    ],
    highlightWidth: 0.05,
  },
  /* 3 · The month fills in and the post takes its slot. */
  schedule: {
    from: settleOf(TOUR_MARKS.voiceEnd, TOUR_MARKS.scheduleEnd),
    to: TOUR_MARKS.scheduleEnd,
    /** The button settles and the day is taken at the same instant. */
    bookedAt: 0.62,
    ringIn: [0.3, 0.42],
    nextIn: [0.5, 0.62],
    /** First mark's window; each later one is offset by `dotStep`. */
    dotIn: [0.44, 0.52],
    dotStep: 0.05,
  },
  /* 4 · The score is measured, the sections critiqued, the headline rewritten. */
  profile: {
    from: settleOf(TOUR_MARKS.scheduleEnd, TOUR_MARKS.profileEnd),
    to: TOUR_MARKS.profileEnd,
    scoreIn: [0.08, 0.46],
    verdictIn: [0.36, 0.46],
    verdictStep: 0.08,
    rewriteIn: [0.6, 0.68],
    strikeAt: 0.76,
    rewriteNewIn: [0.78, 0.88],
  },
} as const;

/**
 * SOURCE OF TRUTH KEYWORDS: TOUR_STAGE, pane fade, window ground, edge fade,
 *   tight stop focus
 *
 * WHAT:  How the unfocused parts of the app behave, and the two short windows
 *        where the section's black ground meets the cream bands around it.
 * WHY:   FOCUS IS SUBTRACTION, NOT COVERING. At a tight stop everything except
 *        the focused panel fades to the window's own ground, which is what
 *        empties the space the caption then occupies — a scrim laid over the top
 *        would hide the same pixels and leave the window looking occupied.
 *        `paneFloor` is not zero: a trace of the neighbouring panels at the
 *        edges is what keeps the frame reading as a window onto a larger app
 *        rather than as a cropped screenshot.
 *
 *        AT THE WIDE STOPS NOTHING FADES. The whole app is meant to be back, and
 *        the thing worth looking at is the one that is moving — the month
 *        filling, the score counting.
 */
export const TOUR_STAGE = {
  /** How present a non-focused pane is at a tight stop. */
  paneFloor: 0.08,
  /** And the window's chrome, which dims but never disappears. */
  chromeFloor: 0.22,
  /*
   * THE FADE BELONGS TO THE TWO TIGHT STOPS AND NOTHING ELSE, which is why it
   * is derived from the marks rather than written as numbers. It ramps in as
   * the camera starts its drop onto the composer and ramps out as the camera
   * leaves the voice profile — an absolute pair would reach back into the
   * entry and dim the window while it was still rising, which is exactly the
   * bug this derivation prevents.
   */
  focusIn: [TOUR_MARKS.holdEnd, TOUR_MARKS.holdEnd + 0.05] as readonly [number, number],
  focusOut: [TOUR_MARKS.voiceEnd - 0.03, TOUR_MARKS.voiceEnd + 0.02] as readonly [number, number],
  /** How long a caption takes to arrive, and to leave. See TOUR_STOPS. */
  captionFade: 0.035,
} as const;

/**
 * SOURCE OF TRUTH KEYWORDS: TOUR_DRAFT, swap line, voice rewrite, emoji,
 *   MARKETING_POST_LINES, character count
 *
 * WHAT:  The draft the tour writes, and what the voice profile changes about it
 *        — one visible change per learned trait.
 * WHY:   THE DRAFT IS MARKETING_POST_LINES, the post the composer section
 *        already shows. The tour claims the product writes THIS post from THAT
 *        topic, and the composer section further down shows the same pair, so
 *        the two corroborate each other instead of advertising two drafts.
 *
 *        THE THREE CHANGES ARE THE THREE TRAITS, sourced from
 *        MARKETING_FEATURE_PREVIEWS.voice.traits — so a trait edited there
 *        without a matching edit here is immediately visible as a trait that
 *        changes nothing. Both character counts are MEASURED off the lines
 *        rather than written down, so the readout cannot disagree with the post
 *        on screen.
 */
const DRAFT_REWRITES = [
  {
    line: 1,
    text: "Not too high. Too specific. A number per feature taught them to buy features.",
  },
  { line: 3, text: "What are you still pricing per feature?" },
] as const;

const DRAFT_AFTER: readonly string[] = MARKETING_POST_LINES.map(
  (line, index) =>
    DRAFT_REWRITES.find((rewrite) => rewrite.line === index)?.text ?? line,
);

export const TOUR_DRAFT = {
  /** The topic that types itself. The composer section shows the same one. */
  topic: MARKETING_COMPOSER.topic,
  /** The emoji the `No emoji` trait removes, and the line it sits on. */
  emoji: " 👀",
  emojiLine: 0,
  /** The draft as generated. DRAFT_REWRITES replaces two of these lines. */
  lines: MARKETING_POST_LINES,
  traits: MARKETING_FEATURE_PREVIEWS.voice.traits,
  rewrites: DRAFT_REWRITES,
  /** Measured, never written down — see DRAFT_AFTER. */
  charactersBefore: MARKETING_POST_LINES.join("\n\n").length,
  charactersAfter: DRAFT_AFTER.join("\n\n").length,
} as const;

/**
 * SOURCE OF TRUTH KEYWORDS: TOUR_CALENDAR, picked day, Tuesday, scheduled count,
 *   MARKETING_CALENDAR, TOUR_SCHEDULED_TOTAL
 *
 * WHAT:  The month the tour books a post into — which day is taken, and which
 *        days fill in behind it.
 * WHY:   THE TAKEN DAY IS A TUESDAY, because the stop's heading is "Queue it for
 *        Tuesday" and a camera that zooms into a calendar to prove that claim
 *        must land on one. The month is MARKETING_CALENDAR's, which starts on a
 *        Monday and runs 28 days, so 9 is a Tuesday — and it is the same month
 *        the how-it-works band already draws.
 */
const PICKED_DAY = 9;

/**
 * WHAT:  The number the calendar's readout counts up to.
 * WHY:   IT HAS TO AGREE WITH MARKETING_CALENDAR.scheduledLabel, which the
 *        how-it-works band prints as a static string further down the same page.
 *        A tour that animates a counter to 10 beside a band that says 9 is the
 *        page contradicting itself about its own screenshot. Parsed from that
 *        label rather than typed again, so editing the band's claim retimes the
 *        tour's counter in the same commit.
 */
const TOUR_SCHEDULED_TOTAL =
  Number.parseInt(MARKETING_CALENDAR.scheduledLabel, 10) || 0;

/*
 * THE DAYS THAT FILL IN BEHIND THE ONE THE POST TAKES.
 *
 * Two corrections to MARKETING_CALENDAR's own lists, both of which the band it
 * was written for never notices because it draws no counter:
 *
 *   1. `day <= days` — that config schedules a post on the 30th of a 28-day
 *      month. The band renders 28 cells and silently drops it; a counter does
 *      not, so without this the tour counts a mark that is not on screen.
 *   2. sliced to one short of the total — the taken day is the last of them, so
 *      the marks plus that day is exactly what the readout ends on.
 */
const MONTH_MARKS: readonly number[] = [
  ...MARKETING_CALENDAR.published,
  ...MARKETING_CALENDAR.scheduled,
]
  .filter((day) => day !== PICKED_DAY && day <= MARKETING_CALENDAR.days)
  .sort((a, b) => a - b)
  .slice(0, Math.max(TOUR_SCHEDULED_TOTAL - 1, 0));

export const TOUR_CALENDAR = {
  month: MARKETING_CALENDAR.month,
  days: MARKETING_CALENDAR.days,
  weekdayInitials: ["M", "T", "W", "T", "F", "S", "S"] as const,
  pickedDay: PICKED_DAY,
  /** What the "next out" card reads once the day is taken. */
  nextSlot: `Tue ${String(PICKED_DAY)} ${MARKETING_CALENDAR.month}, 09:00`,
  nextState: "Queued",
  fills: MONTH_MARKS,
  countLabel: "scheduled",
} as const;

/**
 * SOURCE OF TRUTH KEYWORDS: MARKETING_TOUR, tour chrome, sidebar, rewrite copy,
 *   score ring
 *
 * WHAT:  The mock's chrome and the few strings that belong to the tour alone.
 * WHY:   The sidebar is the app's REAL navigation in the app's real order, so a
 *        reader who signs up recognises the screen. The rewrite pair is the only
 *        copy invented here: the profile analyser's output is per-member by
 *        definition, so there is no existing constant to borrow, and a headline
 *        before and after is the smallest honest thing that surface produces.
 */
export const MARKETING_TOUR = {
  sidebar: [
    "Create post",
    "Calendar",
    "Profile",
    "Voice",
    "Carousels",
    "Ideas",
    "Studio",
  ] as const,
  voiceTitle: "Voice profile",
  voiceTrainedLabel: "Learned from your own posts",
  voiceTrainedCount: MARKETING_FEATURE_PREVIEWS.voice.sourceCount,
  voiceTrainedUnit: MARKETING_FEATURE_PREVIEWS.voice.sourceUnit,
  voiceAppliedLabel: MARKETING_FEATURE_PREVIEWS.voice.appliedLabel,
  voiceBadge: "In your voice",
  topicPlaceholder: "A topic, a lesson, a hot take",
  calendarTitle: MARKETING_CALENDAR.month,
  profileTitle: "Profile analysis",
  scheduleLabel: "Schedule",
  scheduledLabel: "Scheduled",
  writingLabel: "Writing",
  draftEmpty: "Your draft shows up here, ready to edit.",
  rewriteOld: "Ops lead | Problem solver | Coffee",
  rewriteNew: "I help small teams cut the busywork",
} as const;

/* Which pane keeps the floor at each pose. Declared beside the poses rather than
 * in the renderer, because "the write stop lights the composer" is a fact about
 * the choreography and not about the DOM. */
export const TOUR_POSE_FOCUS: Partial<Record<TourPoseKey, TourNodeKey>> = {
  write: "paneCompose",
  voice: "paneVoice",
};

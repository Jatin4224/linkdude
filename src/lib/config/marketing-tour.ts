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
  TourStopKey,
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
  type MarketingFeature,
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
  /**
   * One per stop, and there are SEVEN of them. Tightened from a full viewport
   * to seventy: at a hundred apiece the tour ran to nine and a half screens on
   * top of a 440svh hero, which is most of a page spent before the first band
   * of copy. Seventy still splits into a camera move and a hold long enough to
   * read three lines, which is the floor this is allowed to go to.
   */
  stop: 70,
  /*
   * THE ENDING, IN THREE PARTS. The first two are ordinary keyframes on this
   * timeline; the third is not a phase at all — it is the pinned stage running
   * out and scrolling away with the page, which costs no progress because it
   * happens after this budget is spent. See TOUR_EXIT.
   */
  /** 1 · the last caption fades out; the mock does not move. */
  captionOut: 10,
  /** 2 · the mock slides back to the centre of the screen. */
  recentre: 33,
  /** A beat of stillness at the centred pose before the page takes over. */
  settle: 7,
} as const;

/** Total scroll the pinned stage owns, in svh. */
export const MARKETING_TOUR_STOP_COUNT = 7;

export const MARKETING_TOUR_RANGE_SVH =
  MARKETING_TOUR_PHASES.peek +
  MARKETING_TOUR_PHASES.entry +
  MARKETING_TOUR_PHASES.hold +
  MARKETING_TOUR_PHASES.stop * MARKETING_TOUR_STOP_COUNT +
  MARKETING_TOUR_PHASES.captionOut +
  MARKETING_TOUR_PHASES.recentre +
  MARKETING_TOUR_PHASES.settle;

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
const START = P.peek + P.entry + P.hold;

/** The nth stop's end, in svh from the start of the stage's track. */
const stopEnd = (n: number): number => at(START + P.stop * n);

export const TOUR_MARKS = {
  /** The strip holds still until here, then the rise starts. */
  peekEnd: at(P.peek),
  entryEnd: at(P.peek + P.entry),
  holdEnd: at(START),
  /** One boundary per stop, in the order TOUR_STOPS declares them. */
  stopEnds: [1, 2, 3, 4, 5, 6, 7].map(stopEnd) as readonly number[],
  /** The last caption has gone; the mock has not moved. */
  captionOutEnd: at(START + P.stop * 7 + P.captionOut),
  /** The mock has arrived at the centred pose. */
  recentreEnd: at(START + P.stop * 7 + P.captionOut + P.recentre),
} as const;

/** The nth stop's window. Index 0 is the first stop after the hold. */
function stopWindowAt(index: number): { from: number; to: number } {
  return {
    from: index === 0 ? TOUR_MARKS.holdEnd : (TOUR_MARKS.stopEnds[index - 1] ?? 0),
    to: TOUR_MARKS.stopEnds[index] ?? 1,
  };
}

/**
 * SOURCE OF TRUTH KEYWORDS: TOUR_EXIT, release, centred pose, scroll speed,
 *   release opacity, top fade, empty band, hand-off, ProductTour ending
 *
 * WHAT:  The ending's geometry — where the mock sits once recentred, how it
 *        fades as the page carries it off the top, and how much empty ground
 *        follows it before the next section arrives.
 *
 * WHY:   THE RELEASE IS NOT ANIMATED. It is the pinned stage running out and
 *        scrolling away like any other block, which is why the mock travels at
 *        exactly one pixel per pixel of scroll with no easing and no scale
 *        change — nothing is driving it but the page. The only thing this
 *        config decides is how it DIMS on the way out, and that curve is
 *        written against how far it has travelled rather than against scroll
 *        progress, because progress is already spent by the time it starts.
 *
 *        THE OPACITY CURVE IS KEYED ON TRAVEL, NOT ON SCREEN POSITION, and
 *        that is the one translation from the brief worth explaining. The
 *        brief gives it as "60% when its bottom edge is at 80% of the
 *        viewport, 45% at 60%, 30% at 40%", which produces those numbers only
 *        on a viewport whose aspect leaves the centred mock's bottom near the
 *        floor. On a 16:10 screen the same mock at the same scale finishes its
 *        recentre with its bottom nearer 70%, so a table keyed on absolute
 *        position would start it already half faded. Converting each of the
 *        brief's points to a fraction of the whole journey keeps the SHAPE of
 *        the fade exactly while making it independent of aspect: full strength
 *        the instant the release begins, gone before the header, at every size.
 */
export const TOUR_EXIT = {
  /** The centred pose's top edge, as a fraction of the viewport height. */
  centredTopVh: 0.12,
  /**
   * How the mock dims as the page carries it off, as [journey, opacity] pairs
   * where journey is 0 when the release begins and 1 when the mock's bottom
   * edge reaches the height it must already be invisible at.
   */
  releaseOpacity: [
    [0, 1],
    [0.195, 0.6],
    [0.439, 0.45],
    [0.683, 0.3],
    [0.902, 0.1],
    [1, 0],
  ] as readonly (readonly [number, number])[],
  /**
   * Where the journey ends, as a fraction of the viewport height: the mock is
   * fully invisible once its bottom edge is this far down. Kept clear of the
   * header so it can never be caught passing behind it.
   */
  goneAtVh: 0.16,
  /** The fade under the header that the mock's top edge dissolves into. */
  topFadeVh: 0.1,
  /**
   * The empty ground between the mock's bottom edge and the next section.
   * MEASURED FROM THE MOCK, not from the stage: the centred mock's bottom sits
   * at a different height on a tall screen than on a short one, and the brief's
   * figure is a distance from the mock. The spacer that creates it is sized in
   * `measure` to whatever makes this true.
   */
  bandVh: 0.4,
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
  /*
   * HOW FAR THE APP SLIDES LEFT, and the number is tied to the window's chrome
   * rather than chosen. At -0.2 it was tuned when the profile pane sat against
   * the canvas's right edge, so pushing the app that far brought the pane INTO
   * view. Now that each screen fills the whole content area, the same slide
   * pushes the content OUT of view and leaves a sliver of empty window on
   * screen. The left part that may disappear is the rail and the nav — about
   * 200 of 1200 design pixels, which at the wide scale is a tenth of the
   * viewport — and no more.
   */
  wideSlid: -0.1,
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
/*
 * A caption is readable only during the HOLD — it arrives once the camera has
 * nearly settled and dims out before it leaves. Derived from the stop's own
 * window so retiming carries it, and so the gap that keeps two captions from
 * ever being legible at once cannot be lost to a typo.
 */
function captionWindow(from: number, to: number) {
  const span = to - from;
  return {
    /* Opens as soon as the camera move is done — the move takes 52% of the
       stop — and runs almost to the end, so the fade below has room. */
    captionFrom: +(from + span * MOVE).toFixed(4),
    captionTo: +(to - span * 0.02).toFixed(4),
  };
}

/**
 * SOURCE OF TRUTH KEYWORDS: TOUR_STOPS, seven stops, screen, framing, caption
 *   window, tight stop, wide stop, app navigates
 *
 * WHAT:  The seven stops — caption copy, which screen of the app is showing,
 *        where the caption is drawn and when it is readable.
 *
 * WHY:   THE SHAPE IS TWO MOVEMENTS. The first is the one the choreography was
 *        built around: two TIGHT stops on one screen, joined by a pan straight
 *        down a single column at a shared zoom. The second is five WIDE stops
 *        where the window stays put and the APP NAVIGATES underneath it, the
 *        caption crossing from one side of the screen to the other each time.
 *        A reader learns the rule in the first movement and can follow the rest
 *        without hunting for the camera.
 *
 *        FIVE WIDE STOPS SHARE TWO POSES. The variety comes from the content,
 *        not from flying somewhere new — which is both what the reference does
 *        after its entry and the only way seven features fit in a tour that is
 *        not ten screens long.
 *
 *        EVERY CAPTION IS BORROWED. Three come from MARKETING_STEPS and four
 *        from MARKETING_FEATURES, so the tour cannot describe a feature
 *        differently from the bands further down the page. Nothing here is a
 *        new marketing claim.
 */
export const TOUR_STOPS: readonly TourStop[] = [
  {
    key: "write",
    nav: "Create post",
    label: "Write",
    heading: toBlackGround(stepFor("draft").headline),
    body: stepFor("draft").body,
    pose: "write",
    screen: "create",
    framing: "inside-right",
    ...stopWindowAt(0),
    ...captionWindow(stopWindowAt(0).from, stopWindowAt(0).to),
  },
  {
    key: "voice",
    nav: "Voice",
    label: featureFor("voice").label,
    heading: toBlackGround(featureFor("voice").title),
    body: featureFor("voice").body,
    pose: "voice",
    screen: "create",
    framing: "inside-right",
    ...stopWindowAt(1),
    ...captionWindow(stopWindowAt(1).from, stopWindowAt(1).to),
  },
  {
    key: "carousels",
    nav: "Carousels",
    label: featureFor("carousel").label,
    heading: toBlackGround(featureFor("carousel").title),
    body: featureFor("carousel").body,
    pose: "wideLeft",
    screen: "carousel",
    framing: "outside-left",
    ...stopWindowAt(2),
    ...captionWindow(stopWindowAt(2).from, stopWindowAt(2).to),
  },
  {
    key: "studio",
    nav: "Studio",
    label: featureFor("studio").label,
    heading: toBlackGround(featureFor("studio").title),
    body: featureFor("studio").body,
    pose: "wideRight",
    screen: "studio",
    framing: "outside-right",
    ...stopWindowAt(3),
    ...captionWindow(stopWindowAt(3).from, stopWindowAt(3).to),
  },
  {
    key: "schedule",
    nav: "Calendar",
    label: "Schedule",
    heading: toBlackGround(stepFor("calendar").headline),
    body: stepFor("calendar").body,
    pose: "wideLeft",
    screen: "calendar",
    framing: "outside-left",
    ...stopWindowAt(4),
    ...captionWindow(stopWindowAt(4).from, stopWindowAt(4).to),
  },
  {
    key: "ideas",
    nav: "Ideas",
    label: featureFor("ideas").label,
    heading: toBlackGround(featureFor("ideas").title),
    body: featureFor("ideas").body,
    pose: "wideRight",
    screen: "ideas",
    framing: "outside-right",
    ...stopWindowAt(5),
    ...captionWindow(stopWindowAt(5).from, stopWindowAt(5).to),
  },
  {
    key: "profile",
    nav: "Profile",
    label: "Profile",
    heading: toBlackGround(stepFor("score").headline),
    body: stepFor("score").body,
    pose: "wideLeft",
    screen: "profile",
    framing: "outside-left",
    ...stopWindowAt(6),
    ...captionWindow(stopWindowAt(6).from, stopWindowAt(6).to),
  },
];

export const TOUR_TRACK: readonly TourTrackStop[] = [
  /* The entry. ONE interpolation from the peek to the settled pose — the same
     translate-and-scale the rest of the timeline uses, not a special case. */
  [0, "peek"],
  [TOUR_MARKS.peekEnd, "peek"],
  [TOUR_MARKS.entryEnd, "settled"],
  /* The hold: whole, still, on black. */
  [TOUR_MARKS.holdEnd, "settled"],
  /* One move-then-hold pair per stop, DERIVED from TOUR_STOPS so a stop added
     or reordered there carries the camera with it. The move takes the first
     52% of the stop and the hold the rest, which is the pacing the whole
     section is tuned to. */
  ...TOUR_STOPS.flatMap(
    (stop): readonly TourTrackStop[] => [
      [settleOf(stop.from, stop.to), stop.pose],
      [stop.to, stop.pose],
    ],
  ),
  /* 1 · caption out. The camera HOLDS the last stop's pose — two stops naming
     the same pose is this timeline's idiom for standing still, and standing
     still is the whole point of the beat: only the caption moves. */
  [TOUR_MARKS.captionOutEnd, "wideLeft"],
  /* 2 · recentre. An ordinary camera move on the same easing as every other,
     to the whole window, centred, at the scale it was already at. */
  [TOUR_MARKS.recentreEnd, "centred"],
  /* 3 · release is NOT here. It is the stage running out and scrolling away
     with the page, which happens after progress reaches 1 — see TOUR_EXIT. */
  [1, "centred"],
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

/** The feature-row twin of `stepFor`, for the four stops whose copy lives in
 *  MARKETING_FEATURES rather than MARKETING_STEPS. Same reasoning: by
 *  `artifact`, never by index, and it throws at build time rather than
 *  shipping a caption that silently describes the wrong surface. */
function featureFor(artifact: MarketingFeature["artifact"]): MarketingFeature {
  const feature = MARKETING_FEATURES.find((entry) => entry.artifact === artifact);
  if (!feature) {
    throw new Error(`MARKETING_FEATURES has no feature for artifact "${artifact}"`);
  }
  return feature;
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

/**
 * SOURCE OF TRUTH KEYWORDS: TOUR_DEMO, sub-timeline, local progress, demo timing
 *
 * WHAT:  Each stop's own window and the beats inside it, as LOCAL progress
 *        (0 → 1 across that demo).
 * WHY:   NORMALISED, so retiming a stop moves its demo with it — and with seven
 *        stops sharing one budget, that is the difference between one edit and
 *        seven. The windows are DERIVED from TOUR_STOPS by key, so a stop
 *        reordered there cannot leave its demo playing over someone else's
 *        screen.
 *
 *        EVERY BEAT RUNS INSIDE THE HOLD, never across the camera move: a list
 *        that fills while the camera is still flying is a list nobody can read,
 *        and the hold is exactly the half of each stop that exists for the demo
 *        to happen in.
 *
 *        There is no pointer in any of them. The prototype drove its demos with
 *        a drawn cursor that clicked things; here the product does the small
 *        thing by itself, which is both less to disbelieve and one less element
 *        to keep aligned with a layout that scales.
 */
const demoWindow = (key: TourStopKey) => {
  const stop = TOUR_STOPS.find((entry) => entry.key === key);
  if (!stop) throw new Error(`TOUR_STOPS has no stop "${key}"`);
  return { from: settleOf(stop.from, stop.to), to: stop.to };
};

export const TOUR_DEMO = {
  /* 1 · The topic types itself and a draft comes back. */
  write: {
    ...demoWindow("write"),
    /** The topic finishes typing early — the draft is the payoff. */
    typedBy: 0.34,
    /** The button reads "Writing" between these two. */
    writing: [0.36, 0.52] as readonly [number, number],
    emptyOut: [0.42, 0.5] as readonly [number, number],
    headIn: [0.5, 0.58] as readonly [number, number],
    /** First line's window; each later line is offset by `lineStep`. */
    lineIn: [0.56, 0.66] as readonly [number, number],
    lineStep: 0.07,
    footIn: [0.86, 0.94] as readonly [number, number],
  },
  /* 2 · Three habits are learned, and each one edits a line of the draft. */
  voice: {
    ...demoWindow("voice"),
    trainedIn: [0.1, 0.34] as readonly [number, number],
    /** First trait ticks here; each later one is offset by `traitStep`. */
    traitFrom: 0.28,
    traitStep: 0.11,
    badgeIn: [0.62, 0.7] as readonly [number, number],
    /*
     * ONE BEAT PER TRAIT, in the order the traits tick on: the window the edit
     * crossfades across, which line of the draft it changes, and where the
     * highlight behind that line pulses. One row per trait rather than three
     * parallel arrays, because three arrays is how the beat, the line and the
     * highlight end up a frame apart from each other.
     *
     * `line` indexes TOUR_DRAFT.lines and is NOT the trait's own position:
     * "Short sentences" edits the long second line, "No emoji" the first.
     */
    edits: [
      { from: 0.66, to: 0.74, line: 1, highlightAt: 0.7 },
      { from: 0.76, to: 0.84, line: 0, highlightAt: 0.8 },
      { from: 0.86, to: 0.94, line: 3, highlightAt: 0.9 },
    ],
    highlightWidth: 0.05,
  },
  /* 3 · The deck turns its pages. */
  carousels: {
    ...demoWindow("carousels"),
    /** First slide lands here; each later one is offset by `slideStep`. */
    slideFrom: 0.2,
    slideStep: 0.22,
    /** The page counter counts up to the deck's real length. */
    countIn: [0.2, 0.9] as readonly [number, number],
  },
  /* 4 · The avatar drops into the banner's safe area. */
  studio: {
    ...demoWindow("studio"),
    /** The preset chips settle, then the canvas draws, then the avatar drops. */
    presetFrom: 0.14,
    presetStep: 0.1,
    bannerIn: [0.3, 0.46] as readonly [number, number],
    avatarIn: [0.5, 0.68] as readonly [number, number],
    nameIn: [0.66, 0.8] as readonly [number, number],
  },
  /* 5 · The month fills in and the post takes a Tuesday. */
  schedule: {
    ...demoWindow("schedule"),
    /** The button settles and the day is taken at the same instant. */
    bookedAt: 0.62,
    ringIn: [0.3, 0.42] as readonly [number, number],
    nextIn: [0.5, 0.62] as readonly [number, number],
    /** First mark's window; each later one is offset by `dotStep`. */
    dotIn: [0.44, 0.52] as readonly [number, number],
    dotStep: 0.05,
  },
  /* 6 · Captured ideas are each given a slot in the month. */
  ideas: {
    ...demoWindow("ideas"),
    /** First idea arrives here; each later one is offset by `ideaStep`. */
    ideaFrom: 0.16,
    ideaStep: 0.14,
    /** Its slot appears a beat after the idea itself. */
    slotLag: 0.1,
    /** The month's filled-slot count climbs as the slots are handed out. */
    planIn: [0.3, 0.86] as readonly [number, number],
  },
  /* 7 · The score is measured, the sections critiqued, the headline rewritten. */
  profile: {
    ...demoWindow("profile"),
    scoreIn: [0.08, 0.46] as readonly [number, number],
    verdictIn: [0.36, 0.46] as readonly [number, number],
    verdictStep: 0.08,
    rewriteIn: [0.6, 0.68] as readonly [number, number],
    strikeAt: 0.76,
    rewriteNewIn: [0.78, 0.88] as readonly [number, number],
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
  focusIn: [TOUR_MARKS.holdEnd, TOUR_MARKS.holdEnd + 0.04] as readonly [number, number],
  focusOut: [
    TOUR_DEMO.voice.to - 0.025,
    TOUR_DEMO.voice.to + 0.015,
  ] as readonly [number, number],
  /**
   * How long a caption takes to arrive and to leave, AS A FRACTION OF ITS OWN
   * WINDOW rather than as a progress value.
   *
   * This was an absolute 0.035 and it broke the moment the stops were tightened
   * from a viewport each to seventy: the caption window became 0.031 of
   * progress, SHORTER than the fade, so every caption began leaving before it
   * had finished arriving and none of them ever reached full strength. A
   * fraction cannot fail that way — the plateau scales with the stop, so
   * retuning the budget can never again silently dim the copy.
   */
  captionFade: 0.28,
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

  /* The three screens the tour gained when it went from four stops to seven.
   * Every value is read from MARKETING_FEATURE_PREVIEWS, which is what the
   * feature band already draws — so the tour and that band cannot show the
   * same surface differently. Only the screen TITLES are new, and they are the
   * app's own navigation labels. */
  carousel: {
    title: "Carousels",
    ...MARKETING_FEATURE_PREVIEWS.carousel,
  },
  studio: {
    title: "Studio",
    ...MARKETING_FEATURE_PREVIEWS.studio,
    /** What the canvas is for, in the app's own words. */
    safeAreaLabel: "Avatar safe area",
  },
  ideas: {
    title: "Ideas",
    ...MARKETING_FEATURE_PREVIEWS.ideas,
    slotsLabel: "slots filled",
  },
} as const;

/* Which pane keeps the floor at each pose. Declared beside the poses rather than
 * in the renderer, because "the write stop lights the composer" is a fact about
 * the choreography and not about the DOM. */
export const TOUR_POSE_FOCUS: Partial<Record<TourPoseKey, TourNodeKey>> = {
  write: "paneCompose",
  voice: "paneVoice",
};

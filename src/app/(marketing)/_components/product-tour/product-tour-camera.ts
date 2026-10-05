/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: buildTourPoses, frameAt, panelBoxAt, clamp,
 *   smoothstep, stepRange, easeInOut, lerp, stopWindow, pulse, TourPose,
 *   TourCameraFrame, TourViewport, geometric scale, camera math, tight stop,
 *   wide stop, reduced motion cut
 *
 * WHAT:  The tour's camera, as pure functions — the easing vocabulary the whole
 *        section is written in, the pose table built from a viewport, the single
 *        frame lookup the renderer calls once per animation frame, and the one
 *        helper that tells a caption where its panel ended up on screen.
 *
 * WHY:   NO DOM, NO REACT, NO STATE. Everything the tour draws is a function of
 *        one number, so the part that decides WHERE the camera is has no reason
 *        to touch an element — which is what makes it readable, and what let the
 *        choreography in config be retuned against it without a browser.
 *
 *        THE TWO TIGHT STOPS SHARE ONE SCALE, and that is the most load-bearing
 *        line in this file. Fitting each rectangle independently is the obvious
 *        thing and it is wrong: the two panels are different heights, so an
 *        independent fit would zoom slightly on the way between them and the
 *        move would read as a second shot instead of a pan down one column.
 *        The scale is taken from the shared WIDTH once, and the second stop
 *        changes only which y is under the anchor.
 *
 *        THE SCALE IS INTERPOLATED GEOMETRICALLY, which is the other piece of
 *        maths here that is not obvious and the reason zooms feel even. Scaling
 *        linearly from 0.3 to 1.2 spends most of the travel near the big end and
 *        arrives in a rush; `a * (b / a) ** t` covers equal RATIOS in equal
 *        time, which is how an eye reads a zoom. The anchor and the framed
 *        centre interpolate linearly, because those are positions and a position
 *        has no ratio.
 *
 *        REDUCED MOTION CUTS. It does not shorten the flight, it removes it: the
 *        pose snaps at the midpoint of what would have been the transition, and
 *        the stage cross-fades through the cut so the change is still legible as
 *        one thing becoming another. See `frameAt`.
 * WHERE: src/app/(marketing)/_components/product-tour/product-tour.tsx.
 */

import {
  TOUR_DESIGN,
  TOUR_ENTRY,
  TOUR_FRAMING,
  TOUR_RECTS,
  TOUR_TRACK,
} from "@/lib/config";
import type {
  TourCameraFrame,
  TourPose,
  TourPoseKey,
} from "@/lib/types/marketing-tour";

/* ---------- the easing vocabulary ---------- */

/** Holds a value inside a range. Every window in the tour starts here. */
export function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

/** Hermite smoothstep — eased at both ends, which is every fade in this file. */
export function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

/**
 * Progress through a window, eased: 0 before `from`, 1 after `to`.
 * The tour's single most-used function — every fade, rise and count is one of
 * these, which is what makes the whole section one readable expression of scroll.
 */
export function stepRange(from: number, to: number, at: number): number {
  return smoothstep(clamp((at - from) / (to - from)));
}

/** Cubic in-out. The camera's curve, and only the camera's. */
export function easeInOut(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * SOURCE OF TRUTH KEYWORDS: stopWindow, soft edge, stop floor
 *
 * WHAT:  1 inside a stop's window, 0 outside it, with a short ramp on both edges.
 * WHY:   A hard window makes whatever it drives pop at the boundary. The ramp is
 *        centred ON the boundary rather than inside it, so two adjacent stops
 *        hand over at exactly the same instant and never both read as live.
 */
export function stopWindow(from: number, to: number, at: number): number {
  return (
    stepRange(from - 0.015, from + 0.015, at) *
    (1 - stepRange(to - 0.015, to + 0.015, at))
  );
}

/**
 * SOURCE OF TRUTH KEYWORDS: pulse, highlight bump, transient
 *
 * WHAT:  A value that rises to 1 at `center` and falls away after it.
 * WHY:   The decay is 2.5× the rise, which is what makes a highlight read as
 *        something having just happened rather than as something blinking. Used
 *        only by the voice stop, where each edited line is lit as it changes.
 */
export function pulse(center: number, width: number, at: number): number {
  return (
    stepRange(center - width, center, at) *
    (1 - stepRange(center + width, center + 2.5 * width, at))
  );
}

/* ---------- the pose table ---------- */

/**
 * SOURCE OF TRUTH KEYWORDS: TourViewport, header offset, stage size, narrow
 *
 * WHAT:  What the pose table is built from — the stage's size and how much of
 *        the top the site's fixed header owns.
 * WHY:   `headerHeight` is MEASURED and passed in rather than assumed. The site
 *        header is fixed and drawn over this section, so every pose has to start
 *        below it or the mock is framed behind the navigation. Passing it means
 *        the camera has no opinion about the header's design and nothing to keep
 *        in sync if its padding changes.
 */
export interface TourViewport {
  width: number;
  height: number;
  headerHeight: number;
}

/** Below this the stage stacks: mock in the top half, caption in the bottom. */
export const TOUR_NARROW_MAX = 820;

export function isNarrow(width: number): boolean {
  return width < TOUR_NARROW_MAX;
}

/**
 * SOURCE OF TRUTH KEYWORDS: buildTourPoses, tight zoom, wide slide, over pose,
 *   exit drift, shared scale
 *
 * WHAT:  Resolves all seven poses for one viewport.
 * WHY:   CALLED ON MOUNT AND ON RESIZE, NEVER PER FRAME. These are a handful of
 *        divisions, but they depend on the stage's measured size — doing them
 *        inside the frame loop would mean reading layout sixty times a second
 *        for an answer that only changes when the window does.
 *
 *        Every placement below is a fraction from TOUR_FRAMING rather than a
 *        number invented here, so the composition can be read in one place and
 *        retuned without touching this file.
 */
export function buildTourPoses(
  view: TourViewport,
): Readonly<Record<TourPoseKey, TourPose>> {
  const { width: vw, height: vh, headerHeight } = view;
  const narrow = isNarrow(vw);

  /* The band the mock is composed in. On a wide screen that is everything the
     header leaves; on a narrow one it is the top half, because the caption owns
     the bottom half at every stop there. */
  const top = headerHeight;
  const bandH = narrow
    ? (vh - top) * TOUR_FRAMING.narrow.band
    : Math.max(vh - top, 1);
  const midY = top + bandH / 2;

  const frame = narrow ? TOUR_FRAMING.narrow : TOUR_FRAMING;

  /* --- the two tight stops, at ONE scale taken from the shared width --- */
  /* Both rectangles are the same column, so the zoom is decided once. Fitting
     each one separately would change size between them and turn the pan into a
     zoom — see the note at the top of this file. */
  const tightScale = (frame.tightPanel * vw) / TOUR_RECTS.write[2];
  /* Capped so a short, wide window cannot zoom a panel taller than the band it
     has to sit in — at which point the caption beside it has nothing to be
     centred on. */
  const tightFitted = Math.min(
    tightScale,
    (bandH * 0.92) / TOUR_RECTS.write[3],
  );

  /* Where the focused panel's left edge sits. On a wide screen this is what
     keeps the app's top-left corner and window frame on screen beside it; on a
     narrow one the panel is simply centred, since there is no room to the side
     for anything and the caption is below. */
  const panelW = TOUR_RECTS.write[2] * tightFitted;
  const panelLeft = narrow
    ? (vw - panelW) / 2
    : TOUR_FRAMING.tightLeft * vw;

  const tightPose = (rect: readonly [number, number, number, number]): TourPose => ({
    scale: tightFitted,
    centerX: rect[0] + rect[2] / 2,
    centerY: rect[1] + rect[3] / 2,
    anchorX: panelLeft + panelW / 2,
    anchorY: midY,
    opacity: 1,
  });

  /* --- the whole app: the arrival, the two wide stops, and the exit --- */
  const whole = (
    widthFraction: number,
    leftFraction: number | null,
    opacity = 1,
  ): TourPose => {
    const scale = (widthFraction * vw) / TOUR_DESIGN.width;
    /* Capped on height too, so a short window never crops the app it is meant
       to be showing entire. */
    const fitted = Math.min(scale, (bandH * 0.94) / TOUR_DESIGN.height);
    const appW = TOUR_DESIGN.width * fitted;
    return {
      scale: fitted,
      centerX: TOUR_DESIGN.width / 2,
      centerY: TOUR_DESIGN.height / 2,
      /* `null` centres it; a fraction pins its LEFT EDGE there, which is what
         lets the wide stops run the app off one side of the screen. */
      anchorX: leftFraction === null ? vw / 2 : leftFraction * vw + appW / 2,
      anchorY: midY,
      opacity,
    };
  };

  /**
   * THE ENTRY'S TWO POSES, and the only ones anchored by their TOP EDGE rather
   * than their centre. That is not a stylistic choice: the reference was
   * measured as a top edge travelling from 97.7% of the viewport height to
   * 15.9% while the width travelled from 97.9% to 60.7% of the viewport, and
   * those two numbers move in exact lockstep. Anchoring by the top edge is what
   * lets both poses be written as the measurement reads, so a re-measure is a
   * two-number edit rather than a re-derivation.
   *
   * Measured on a wide, short window, so the WIDTH is the honest term and the
   * height is whatever the mock's fixed aspect makes it. On a tall viewport
   * that would run the window off the bottom, so it is capped — see below.
   */
  const entryPose = (
    spec: { topVh: number; widthVw: number },
    /* Whether the whole window has to fit on screen at this pose. */
    fitHeight: boolean,
  ): TourPose => {
    const byWidth = (spec.widthVw * vw) / TOUR_DESIGN.width;
    /* THE CAP IS ONLY FOR THE SETTLED POSE. The reference window filled almost
       the full height when settled because it was recorded on a 2.1:1 screen;
       on a 16:10 one the same width fraction is a much taller box, so without
       this the window would run off the bottom. The PEEK must not be capped —
       at rest only its title bar is above the fold and the rest is meant to
       hang below, so bounding it by the viewport shrinks the one pose whose
       width the visitor can actually judge against the screen's edges. */
    const room = vh - top - vh * 0.06;
    const scale = fitHeight
      ? Math.min(byWidth, room / TOUR_DESIGN.height)
      : byWidth;
    const appH = TOUR_DESIGN.height * scale;
    /* Never above the header, whatever the measurement says. */
    const topPx = fitHeight
      ? Math.max(spec.topVh * vh, top + vh * 0.02)
      : spec.topVh * vh;
    return {
      scale,
      centerX: TOUR_DESIGN.width / 2,
      centerY: TOUR_DESIGN.height / 2,
      anchorX: vw / 2,
      anchorY: topPx + appH / 2,
      opacity: 1,
    };
  };

  /* On a narrow screen the app cannot slide off one side and leave anything
     readable, so both wide stops simply centre it and the caption below does the
     work the sideways move does on a wide screen. */
  const wideLeftFraction = narrow ? null : TOUR_FRAMING.wideLeft;
  const wideSlidFraction = narrow ? null : TOUR_FRAMING.wideSlid;

  return {
    /* At rest: the window's title bar above the fold, nothing else. */
    peek: entryPose(TOUR_ENTRY.peek, false),
    /* Settled: the whole window, centred, on black. */
    settled: entryPose(TOUR_ENTRY.settled, true),
    write: tightPose(TOUR_RECTS.write),
    voice: tightPose(TOUR_RECTS.voice),
    calendar: whole(frame.wideWidth, wideLeftFraction),
    profile: whole(frame.wideWidth, wideSlidFraction),
    /* The exit: it keeps travelling in the direction it was already going and
       fades, so the section lets go of it rather than switching it off. */
    exit: {
      ...whole(frame.wideWidth, wideSlidFraction, 0),
      anchorY: midY - bandH * 0.1,
      anchorX:
        whole(frame.wideWidth, wideSlidFraction).anchorX +
        TOUR_FRAMING.exitDrift * vw,
    },
  };
}

/* ---------- the frame ---------- */

/**
 * SOURCE OF TRUTH KEYWORDS: frameAt, camera frame, geometric scale, cut
 *
 * WHAT:  The camera at one scroll progress — a translate, a scale, and the
 *        mock's opacity.
 * WHY:   The track is short and scanned forward from the start rather than
 *        binary-searched, which for a dozen stops is the cheaper of the two and
 *        keeps the function a dozen lines. `reduced` turns the whole thing into
 *        a cut: the pose snaps at the halfway point and the mock cross-fades
 *        through it, which is what a reader who asked for less motion gets
 *        instead of a flight.
 */
export function frameAt(
  progress: number,
  poses: Readonly<Record<TourPoseKey, TourPose>>,
  reduced: boolean,
): TourCameraFrame {
  let index = 0;
  while (index < TOUR_TRACK.length - 2) {
    const next = TOUR_TRACK[index + 1];
    if (!next || progress <= next[0]) break;
    index += 1;
  }

  const start = TOUR_TRACK[index];
  const end = TOUR_TRACK[index + 1];
  /* Unreachable: the scan stops two short of the end and TOUR_TRACK is a
     literal. It is here because the project runs with
     `noUncheckedIndexedAccess`, and a non-null assertion would be the one place
     in this file where the compiler was told to look away. */
  if (!start || !end) return { x: 0, y: 0, scale: 1, opacity: 1 };

  const [fromAt, fromKey] = start;
  const [toAt, toKey] = end;
  const from = poses[fromKey];
  const to = poses[toKey];

  let t =
    fromKey === toKey
      ? 0
      : easeInOut(clamp((progress - fromAt) / (toAt - fromAt)));
  let crossFade = 1;

  if (reduced && fromKey !== toKey) {
    /* Dip through the cut, then snap. */
    crossFade = Math.min(1, Math.abs(t - 0.5) * 6);
    t = t < 0.5 ? 0 : 1;
  }

  /* Geometric in scale, linear in position — see the file note. */
  const scale = from.scale * Math.pow(to.scale / from.scale, t);

  return {
    scale,
    x:
      lerp(from.anchorX, to.anchorX, t) -
      scale * lerp(from.centerX, to.centerX, t),
    y:
      lerp(from.anchorY, to.anchorY, t) -
      scale * lerp(from.centerY, to.centerY, t),
    opacity: lerp(from.opacity, to.opacity, t) * crossFade,
  };
}

/**
 * SOURCE OF TRUTH KEYWORDS: panelBoxAt, caption placement, focused panel box
 *
 * WHAT:  Where a tight stop's focused panel lands on screen, in stage pixels.
 * WHY:   A caption framed INSIDE the app window has to be positioned against the
 *        panel it sits beside, and only the camera knows where that panel ended
 *        up. Returning the box rather than the caption's own rectangle keeps the
 *        decision about gaps and widths in the component, where the caption's
 *        type is — this function's job is the geometry, not the layout.
 *
 *        Read at MEASURE time against the stop's settled pose, never per frame:
 *        the caption only appears once the camera has nearly stopped, so the
 *        box it is placed against is the one the camera is holding.
 */
export function panelBoxAt(
  pose: TourPose,
  rect: readonly [number, number, number, number],
): { left: number; top: number; width: number; height: number } {
  const width = rect[2] * pose.scale;
  const height = rect[3] * pose.scale;
  return {
    left: pose.anchorX - width / 2,
    top: pose.anchorY - height / 2,
    width,
    height,
  };
}

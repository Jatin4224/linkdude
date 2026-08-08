/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: StepConnector, draw-line, animate-spark, spark-run,
 *   stroke-dashoffset, SVG line draw, feGaussianBlur, glow filter, how it works,
 *   electric pulse, linearGradient
 *
 * WHAT:  The hairline threading the three how-it-works steps together: a static
 *        track that draws itself on when the section arrives, plus a glowing
 *        charge that runs along it from step one through to step three, forever.
 * WHY:   An SVG path rather than a bordered div, because a path can be drawn and
 *        can carry a travelling dash. The charge moves in the same direction the
 *        reader is already moving through the steps, so it reads as the flow of
 *        the process rather than as decoration bolted on top. Two paths, not
 *        one: the track has to stay visible between pulses, and only the pulse
 *        pays for the blur filter. Purely decorative and aria-hidden — the
 *        numbered steps carry the meaning without it.
 * WHERE: src/app/(marketing)/_components/how-it-works.tsx, inside a Reveal whose
 *        `data-reveal="shown"` triggers the draw-on.
 */

import * as React from "react";

/* Matches the viewBox width, so one dash cycle equals one full traversal and the
 * loop has no visible seam. */
const PATH_LENGTH = 900;

/* Variables rather than inline literals — a literal object trips the
 * excess-property check on CSSProperties, and a cast isn't allowed. */
const DRAW_STYLE: React.CSSProperties & { "--draw-length": number } = {
  "--draw-length": PATH_LENGTH,
};

const LINE = "M0 12 H900";

export function StepConnector() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 900 24"
      preserveAspectRatio="none"
      className="h-6 w-full overflow-visible"
    >
      <defs>
        {/* Both ends fade to nothing, so the track needs no mask to stop
            cleanly short of the first and last step. */}
        <linearGradient id="step-track" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor="var(--brand)" stopOpacity="0" />
          <stop offset="15%" stopColor="var(--brand)" stopOpacity="0.35" />
          <stop offset="85%" stopColor="var(--brand)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
        </linearGradient>

        {/* The glow. A generous filter region because the blur spreads well
            outside the 2px stroke, and a clipped filter shows as a hard edge
            travelling with the pulse. */}
        <filter
          id="step-spark-glow"
          x="-10%"
          y="-400%"
          width="120%"
          height="900%"
        >
          <feGaussianBlur stdDeviation="3" result="blurred" />
          <feMerge>
            <feMergeNode in="blurred" />
            <feMergeNode in="blurred" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <path
        d={LINE}
        fill="none"
        stroke="url(#step-track)"
        strokeWidth="1.5"
        strokeLinecap="round"
        className="draw-line"
        style={DRAW_STYLE}
      />

      <path
        d={LINE}
        fill="none"
        stroke="var(--brand)"
        strokeWidth="2"
        strokeLinecap="round"
        filter="url(#step-spark-glow)"
        className="animate-spark"
      />
    </svg>
  );
}

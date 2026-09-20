"use client";

/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: PaperSection, SketchCard, SketchHeading,
 *   SketchDivider, SketchAnnotation, SketchCheck, SketchDefs, SketchFrame,
 *   sketch design system, paper workspace, hand-drawn UI
 *
 * WHAT:  The paper-and-ink design kit — the pieces every sketchbook surface in
 *        this app is assembled from.
 * WHY:   GLOBAL, not route-local, per the project rule: these are visual
 *        primitives with no knowledge of the studio, and the second surface that
 *        wants a paper treatment should compose them rather than copy them.
 *
 *        The governing ratio is roughly SEVENTY PERCENT clean SaaS, THIRTY
 *        PERCENT sketchbook. Everything here is built to keep that split:
 *        handwriting is confined to headings and annotations, the imperfection
 *        in a border is one or two pixels rather than a wobble you could measure,
 *        and nothing decorative is ever placed where it could be mistaken for a
 *        control.
 *
 *        Rules that are pinned rather than trusted, because each was easy to get
 *        wrong: no handwriting on buttons, navigation, inputs or data; no
 *        decoration inside an interactive element; every mark `aria-hidden`; at
 *        most a couple of marks per section.
 * WHERE: `src/app/(dashboard)/dashboard/studio/` today. Any future paper surface
 *        should import from here.
 */

import * as React from "react";

import { cn } from "@/lib/utils";

/* One filter, referenced by id from every mark on the page. */
const ROUGHEN_ID = "sketch-roughen";

/**
 * SOURCE OF TRUTH KEYWORDS: SketchDefs
 *
 * WHAT:  The displacement filter the drawn marks borrow. Mount once per page.
 * WHY:   A hand-drawn edge cannot be a CSS border. `border-radius` bends corners
 *        but leaves every edge perfectly straight, which is the exact tell that
 *        reads as "rounded card" rather than "drawn box". `feTurbulence` into
 *        `feDisplacementMap` pushes the stroke off its path at a varying rate,
 *        which is what a hand does.
 *
 *        `scale` is deliberately small. A large displacement looks like a filter;
 *        one or two pixels looks like a person who was not being careful.
 */
export function SketchDefs() {
  return (
    <svg aria-hidden focusable="false" className="pointer-events-none absolute size-0">
      <defs>
        <filter id={ROUGHEN_ID}>
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.014"
            numOctaves="3"
            seed="9"
            result="noise"
          />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="2.4" />
        </filter>
      </defs>
    </svg>
  );
}

/**
 * SOURCE OF TRUTH KEYWORDS: SketchFrame
 *
 * WHAT:  A drawn outline, stretched to whatever it sits inside.
 * WHY:   `preserveAspectRatio="none"` so one path serves any box shape, and
 *        `vectorEffect="non-scaling-stroke"` so the ink stays the same weight at
 *        any width — without it a wide card gets a hairline and a narrow one
 *        gets a slab.
 */
export function SketchFrame({ className }: { className?: string | undefined }) {
  return (
    <svg
      aria-hidden
      focusable="false"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      fill="none"
      className={cn(
        "pointer-events-none absolute inset-0 h-full w-full text-[color:var(--sketch-ink)]",
        className,
      )}
    >
      <rect
        x="1"
        y="1"
        width="98"
        height="98"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeOpacity="0.85"
        vectorEffect="non-scaling-stroke"
        filter={`url(#${ROUGHEN_ID})`}
      />
    </svg>
  );
}

/**
 * SOURCE OF TRUTH KEYWORDS: PaperSection
 *
 * WHAT:  A block of the workspace — a handwritten heading, optional supporting
 *        line, and its content.
 * WHY:   Sections rather than boxes. The brief's "designer workspace, not a
 *        dashboard of boxes" is enforced structurally here: this renders no
 *        border and no background, so content sits ON the paper instead of in a
 *        container on top of it.
 */
export function PaperSection({
  title,
  description,
  underline,
  actions,
  children,
  className,
}: {
  title: string;
  description?: string | undefined;
  /** The one word in the title to underline, if any. */
  underline?: string | undefined;
  actions?: React.ReactNode | undefined;
  children: React.ReactNode;
  className?: string | undefined;
}) {
  return (
    <section className={cn("flex flex-col gap-4", className)}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <SketchHeading underline={underline}>{title}</SketchHeading>
          {description ? (
            /* Clean sans, never handwriting. Supporting copy is read, not
               admired, and a script face at 13px is a usability problem. */
            <p className="max-w-prose text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

/**
 * SOURCE OF TRUTH KEYWORDS: SketchHeading
 *
 * WHAT:  A handwritten section title, optionally with one word underlined.
 * WHY:   The underline is GOLD and the letters stay ink. Colouring the word as
 *        well makes the swipe redundant, and a gold word beside a blue button
 *        puts two accents in competition.
 *
 *        Only one word is underlinable by design — a marker swipe under a whole
 *        heading is a highlighter, which is a different and much louder gesture.
 */
export function SketchHeading({
  children,
  underline,
  as: Tag = "h2",
  className,
}: {
  children: string;
  underline?: string | undefined;
  as?: "h1" | "h2" | "h3" | undefined;
  className?: string | undefined;
}) {
  const parts =
    underline && children.includes(underline)
      ? children.split(underline)
      : null;

  return (
    <Tag
      className={cn(
        "font-sketch text-[1.75rem] leading-[1.1] tracking-tight text-[color:var(--sketch-ink)] sm:text-3xl",
        className,
      )}
    >
      {parts ? (
        <>
          {parts[0]}
          <span className="sketch-underline">{underline}</span>
          {parts.slice(1).join(underline)}
        </>
      ) : (
        children
      )}
    </Tag>
  );
}

/**
 * SOURCE OF TRUTH KEYWORDS: SketchCard
 *
 * WHAT:  A sheet of paper with a drawn outline.
 * WHY:   No CSS border: the SVG frame strokes the edge, and a border underneath
 *        would show as a second, perfectly straight line beside the wobbly one —
 *        which looks like a rendering bug rather than a drawing.
 *
 *        `selected` gets a blue frame and a tick rather than a ring, because a
 *        focus ring on a paper surface reads as browser chrome.
 */
export function SketchCard({
  selected = false,
  interactive = false,
  children,
  className,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & {
  selected?: boolean | undefined;
  interactive?: boolean | undefined;
}) {
  return (
    <div
      {...rest}
      data-selected={selected ? "" : undefined}
      className={cn(
        "sketch-sheet relative flex flex-col",
        interactive && "sketch-sheet-interactive cursor-pointer",
        className,
      )}
    >
      <SketchFrame
        className={selected ? "text-[color:var(--sketch-blue)]" : undefined}
      />
      {selected ? (
        <span
          aria-hidden
          className="absolute -right-2 -top-2 flex size-6 items-center justify-center rounded-full bg-[color:var(--sketch-blue)] text-xs font-bold text-white"
        >
          ✓
        </span>
      ) : null}
      {children}
    </div>
  );
}

/**
 * SOURCE OF TRUTH KEYWORDS: SketchDivider
 *
 * WHAT:  A drawn rule.
 * WHY:   Thicker in the middle than at the ends, like a stroke where the pen
 *        pressed harder halfway. A uniform 1px line is the one thing on a paper
 *        surface that unmistakably came from CSS.
 */
export function SketchDivider({ className }: { className?: string | undefined }) {
  return (
    <hr
      className={cn(
        "h-[2px] w-full border-0 bg-[color:var(--sketch-hair)]",
        "[border-radius:60%_40%_55%_45%/100%_100%_40%_40%]",
        className,
      )}
    />
  );
}

/**
 * SOURCE OF TRUTH KEYWORDS: SketchAnnotation, SketchArrow
 *
 * WHAT:  A handwritten aside with an arrow pointing at its subject.
 * WHY:   The note and the arrow ship together, because a note without one is
 *        stray text — the arrow is what makes it read as written ON the page
 *        rather than as content IN it.
 *
 *        Four hand-drawn paths rather than one rotated: an arrow flipped 180°
 *        has its curve bending the wrong way, and the hook has a handedness a
 *        transform cannot fix.
 */
const ARROW_PATHS = {
  downLeft: "M46 4C34 3 10 8 5 26M5 26l9-5M5 26l1-10",
  downRight: "M4 4c12-1 36 4 41 22M45 26l-9-5M45 26l-1-10",
  upRight: "M4 30C10 10 32 5 46 6M46 6l-9 5M46 6l-1 9",
} as const;

export type SketchArrowDirection = keyof typeof ARROW_PATHS;

export function SketchArrow({
  direction = "downLeft",
  className,
}: {
  direction?: SketchArrowDirection | undefined;
  className?: string | undefined;
}) {
  return (
    <svg
      aria-hidden
      focusable="false"
      width="46"
      height="30"
      viewBox="0 0 50 34"
      fill="none"
      className={cn("shrink-0", className)}
    >
      <path
        d={ARROW_PATHS[direction]}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        filter={`url(#${ROUGHEN_ID})`}
      />
    </svg>
  );
}

export function SketchAnnotation({
  children,
  direction = "downLeft",
  className,
}: {
  children: React.ReactNode;
  direction?: SketchArrowDirection | undefined;
  className?: string | undefined;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none flex items-center gap-1.5 font-sketch text-base leading-tight text-[color:var(--sketch-ink-soft)]",
        className,
      )}
    >
      {direction === "downRight" ? <SketchArrow direction={direction} /> : null}
      <span className="whitespace-nowrap">{children}</span>
      {direction !== "downRight" ? <SketchArrow direction={direction} /> : null}
    </span>
  );
}

/**
 * SOURCE OF TRUTH KEYWORDS: SketchCheck
 *
 * WHAT:  The drawn tick used in benefit lists.
 * WHY:   A path rather than a font glyph, so it carries the same displacement
 *        filter as every other mark and matches their weight. A lucide check
 *        beside a hand-drawn frame is the detail that gives the whole surface
 *        away.
 */
export function SketchCheck({ className }: { className?: string | undefined }) {
  return (
    <svg
      aria-hidden
      focusable="false"
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      className={cn("mt-0.5 shrink-0 text-[color:var(--sketch-blue)]", className)}
    >
      <path
        d="M2 9l4 4 8-11"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        filter={`url(#${ROUGHEN_ID})`}
      />
    </svg>
  );
}

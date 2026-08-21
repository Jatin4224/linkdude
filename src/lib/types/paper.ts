/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: PaperWordVariant, PaperDisplayWord, PaperDisplayLine,
 *   PaperOrbitMark, PaperOrbit, sphere,
 *   PaperScatterMark, PaperIconName, display type,
 *   boxed word, Archivo Black, paper design system, landing page, sign-in
 *
 * WHAT:  The contracts the paper design system's two shared primitives read —
 *        a display line expressed as a list of individually boxed words, and the
 *        scattered decorative marks that drift behind and in front of the hero.
 * WHY:   Rule 5 of the design system is that display type is Archivo Black with
 *        INDIVIDUAL WORDS boxed in blue or ink. Modelling a headline as
 *        `readonly PaperDisplayWord[]` rather than as a string with markup in it
 *        is what makes that rule mechanical: the padding, the line-height and
 *        the letter-spacing live in one component, every headline on both pages
 *        breaks the same way, and a copy edit can never get the markup wrong.
 *        `PaperWordVariant` is a closed union so the renderer's lookup is
 *        exhaustive — a variant added here is a compile error until it has a
 *        style, instead of silently rendering unstyled.
 *
 *        Lives in lib/types (per CLAUDE.md) rather than beside the components
 *        because both the landing sections and the config module that holds the
 *        copy need to name these shapes, and a type imported from a component
 *        file makes the copy depend on the renderer.
 * WHERE: src/components/global/paper/* renders them;
 *        src/lib/config/marketing.ts declares the data that satisfies them.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: PaperWordVariant
 *
 * WHAT:  How one word in a display line is boxed.
 * WHY:   `plain` is the unboxed default and must stay the majority — rule 4 is
 *        one blue per screen, so at most one word per screen may be `blue`.
 *        `paper` and `ink` are the inversions used on the blue and dark bands
 *        respectively, where a blue box would be invisible against its ground.
 */
export type PaperWordVariant = "plain" | "ink" | "blue" | "paper";

/**
 * SOURCE OF TRUTH KEYWORDS: PaperDisplayWord
 *
 * WHAT:  One word (or short phrase) of a display line, with its box treatment.
 */
export interface PaperDisplayWord {
  text: string;
  variant: PaperWordVariant;
}

/** A full display line — the words in reading order. */
export type PaperDisplayLine = readonly PaperDisplayWord[];

/**
 * SOURCE OF TRUTH KEYWORDS: PaperIconName, PaperScatterMark
 *
 * WHAT:  One drifting decorative mark — which glyph, where, how big, how tilted,
 *        and its own float timing.
 * WHY:   Timing is per-mark so a row of them never bobs in unison, which would
 *        read as a carousel rather than as ambient texture.
 *
 *        There is no depth here, and there used to be: a `layer` field split the
 *        marks into a set painted behind the mascot and a set in front of it,
 *        which was the flat hero's only depth cue. The hero now places its marks
 *        on a real sphere (PaperOrbitMark below), where depth is a computed
 *        number rather than one of two buckets — so the field went with it. What
 *        is left is the ambient treatment the auth panel wants, which has no
 *        mascot to be in front of or behind.
 * WHERE: PaperScatter in src/components/global/paper/paper-scatter.tsx.
 */
export type PaperIconName =
  | "square-dashed"
  | "asterisk"
  | "arrow-right"
  | "grid"
  | "triangle"
  | "waves";

export interface PaperScatterMark {
  icon: PaperIconName;
  /** CSS length or percentage, measured from the top of the stage. */
  top: string;
  /** Exactly one of left/right — the mark is anchored to the nearer edge. */
  left?: string;
  right?: string;
  /** Rendered size in px. */
  size: number;
  /** Rotation in degrees. */
  tilt: number;
  /** Float loop duration in seconds. */
  duration: number;
  /** Float loop delay in seconds. */
  delay: number;
}

/**
 * SOURCE OF TRUTH KEYWORDS: PaperOrbitMark, spherical coordinates, latitude,
 *   longitude, sphere, 3D orbit, hero orbit, depth cue
 *
 * WHAT:  One decorative mark's position on the invisible sphere that surrounds
 *        the hero mascot, in spherical coordinates.
 * WHY:   Latitude/longitude rather than x/y/z because the sphere SPINS: only the
 *        longitude changes as the reader scrolls, so storing a cartesian point
 *        would mean converting back to an angle on every frame to advance it.
 *        Latitude is fixed per mark, which is what puts each one on its own ring
 *        and stops the set collapsing into a single flat carousel.
 *
 *        `radius` is a FRACTION of the sphere's radius, not a pixel value. The
 *        sphere is sized from the viewport, so a mark pinned to a pixel distance
 *        would sit on the mascot's face at one width and off-screen at another.
 * WHERE: PaperOrbit in src/components/global/paper/paper-orbit.tsx; the data
 *        lives in MARKETING_HERO_ORBIT.
 */
export interface PaperOrbitMark {
  icon: PaperIconName;
  /** Degrees above (+) or below (−) the sphere's equator. Keep within ±60. */
  latitude: number;
  /** Starting degrees around the vertical axis. Spread these out. */
  longitude: number;
  /** Rendered size in px at the sphere's nearest point. */
  size: number;
  /** Distance from the centre as a fraction of the sphere radius. */
  radius: number;
}

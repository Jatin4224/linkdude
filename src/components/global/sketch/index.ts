/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: PaperSection, SketchCard, SketchButton,
 *   SketchHeading, SketchDivider, SketchAnnotation, SketchCheck, SketchArrow,
 *   SketchFrame, SketchDefs, sketch design system
 *
 * WHAT:  Barrel for the paper-and-ink design kit.
 * WHY:   One import path for a set of primitives that are always used together —
 *        a surface wanting the paper treatment takes the whole kit, not pieces.
 */
export {
  SketchDefs,
  SketchFrame,
  PaperSection,
  SketchHeading,
  SketchCard,
  SketchDivider,
  SketchAnnotation,
  SketchArrow,
  SketchCheck,
} from "./sketch";
export type { SketchArrowDirection } from "./sketch";
export { SketchButton } from "./sketch-button";
export type { SketchButtonProps } from "./sketch-button";

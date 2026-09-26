/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: PaperButton, PaperButtonProps, paperButtonVariants,
 *   PaperDisplay, PaperDisplayProps, PaperLabel, PaperLabelProps,
 *   paperLabelVariants, PaperScatter, PaperScatterProps, PaperMascot,
 *   PaperMascotProps, PaperMascotEyes, PaperMascotEyesProps,
 *   PAPER_MASCOT_EYES, PAPER_MASCOT_PUPILS, PaperLockup, PaperLockupProps,
 *   PAPER_MASCOT_SRC,
 *   PaperReveal, PaperRevealProps, PaperRevealEffect, PaperOrbit,
 *   PaperOrbitProps, PAPER_ICONS,
 *   paper design system, public surfaces
 *
 * WHAT:  Barrel for the paper design system — the six primitives the public
 *        landing and auth surfaces are built from.
 * WHY:   One import surface, so a section reads as a composition of the system
 *        rather than five import paths. Data CONTRACTS are deliberately not
 *        re-exported here: PaperDisplayWord and friends come from @/lib/types,
 *        which stays the single source of truth for types per CLAUDE.md.
 * WHERE: src/app/(marketing)/*, src/components/global/marketing/* and
 *        src/components/global/auth/*.
 */

export { PaperButton, paperButtonVariants } from "./paper-button";
export type { PaperButtonProps } from "./paper-button";
export { PaperDisplay } from "./paper-display";
export type { PaperDisplayProps } from "./paper-display";
export { PaperLabel, paperLabelVariants } from "./paper-label";
export type { PaperLabelProps } from "./paper-label";
export { PaperScatter } from "./paper-scatter";
export type { PaperScatterProps } from "./paper-scatter";
export {
  PaperMascot,
  PaperMascotEyes,
  PaperLockup,
  PAPER_MASCOT_SRC,
  PAPER_MASCOT_EYES,
  PAPER_MASCOT_PUPILS,
} from "./paper-mascot";
export type {
  PaperMascotProps,
  PaperMascotEyesProps,
  PaperLockupProps,
} from "./paper-mascot";
export { PaperReveal } from "./paper-reveal";
export type { PaperRevealProps, PaperRevealEffect } from "./paper-reveal";
export { PaperOrbit } from "./paper-orbit";
export type { PaperOrbitProps } from "./paper-orbit";
export { PAPER_ICONS } from "./paper-icons";

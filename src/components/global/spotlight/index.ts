/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: Spotlight, SpotlightProps, pointer glow, cursor glow
 *
 * WHAT:  Barrel for the pointer-tracked spotlight surface.
 * WHY:   One import surface so the effect can change implementation without
 *        touching call sites.
 * WHERE: Imported by the marketing feature and pricing cards.
 */

export { Spotlight } from "./spotlight";
export type { SpotlightProps } from "./spotlight";

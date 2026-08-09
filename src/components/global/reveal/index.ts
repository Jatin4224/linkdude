/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: Reveal, RevealProps, scroll reveal, stagger
 *
 * WHAT:  Barrel for the scroll-reveal animation primitive.
 * WHY:   One import surface (`@/components/global/reveal`) so the observer
 *        implementation can change without touching call sites.
 * WHERE: Imported by the marketing sections.
 */

export { Reveal } from "./reveal";
export type { RevealProps } from "./reveal";

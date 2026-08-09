/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: CountUp, CountUpProps, number ticker, stat animation
 *
 * WHAT:  Barrel for the scroll-triggered number counter.
 * WHY:   One import surface; the counting strategy can change without ripple.
 * WHERE: Imported by the marketing free-tier stat band.
 */

export { CountUp } from "./count-up";
export type { CountUpProps } from "./count-up";

/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: UsageMeter, UsageMeterProps
 *
 * WHAT:  Barrel for the plan-usage meter.
 * WHY:   One import surface, matching the billing barrel convention.
 * WHERE: Imported by any page rendering a limited action.
 */

export { UsageMeter } from "./usage-meter";
export type { UsageMeterProps } from "./usage-meter";

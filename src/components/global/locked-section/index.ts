/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: LockedSection, LockedSectionProps
 *
 * WHAT:  Barrel for the plan-gated content panel.
 * WHY:   One import surface, matching the usage-meter barrel convention.
 * WHERE: Imported by any page rendering a paid-tier section.
 */

export { LockedSection } from "./locked-section";
export type { LockedSectionProps } from "./locked-section";

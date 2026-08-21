/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: StickyHero, BlueStatement, CapabilityTicker,
 *   FreePlanCaps, ComposerShowcase, HowItWorks, FinalCta, landing sections,
 *   section order
 *
 * WHAT:  Barrel for the landing page's sections, in the order they render.
 * WHY:   Route-local because these compose one page; page.tsx reads as the
 *        running order of the pitch rather than a wall of import paths. Only the
 *        SECTIONS are exported — the artifact renderer inside HowItWorks and the
 *        ticker track inside CapabilityTicker are private to their one parent,
 *        so the barrel stays a table of contents for the page instead of a list
 *        of everything in the folder.
 * WHERE: src/app/(marketing)/page.tsx.
 */

export { StickyHero } from "./sticky-hero";
export { BlueStatement } from "./blue-statement";
export { CapabilityTicker } from "./capability-ticker";
export { FreePlanCaps } from "./free-plan-caps";
export { ComposerShowcase } from "./composer-showcase";
export { HowItWorks } from "./how-it-works";
export { FinalCta } from "./final-cta";

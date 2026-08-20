/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: LandingHero, CapabilityTicker, FreeTierCounters,
 *   LoopSection, InsideBento, PricingSection, FaqSection, FinalCta,
 *   DisplayHeading, SectionKicker, LandingCtaPair, AppDemo, PlanComparison,
 *   ProfileScoreMeter
 *
 * WHAT:  Barrel for the landing page's sections.
 * WHY:   Route-local because these compose one page; page.tsx reads as the
 *        running order of the pitch rather than a wall of import paths. Only the
 *        SECTIONS are exported — the pieces they are built from (the demo, the
 *        heading, the CTA pair, the comparison table) are imported directly by
 *        their one parent, so the barrel stays a table of contents for the page
 *        instead of a list of everything in the folder.
 * WHERE: src/app/(marketing)/page.tsx.
 */

export { LandingHero } from "./hero";
export { CapabilityTicker } from "./capability-ticker";
export { FreeTierCounters } from "./free-tier-counters";
export { LoopSection } from "./loop-section";
export { InsideBento } from "./inside-bento";
export { PricingSection } from "./pricing-section";
export { FaqSection } from "./faq-section";
export { FinalCta } from "./final-cta";

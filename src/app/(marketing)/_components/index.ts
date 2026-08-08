/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: LandingHero, CapabilityMarquee, ProblemCards,
 *   FeatureShowcase, HowItWorks, FreeTierStats, PricingSection,
 *   PlanComparisonTable, FaqSection, FinalCta
 *
 * WHAT:  Barrel for the landing page's sections.
 * WHY:   Route-local because these compose one page; page.tsx reads as the
 *        running order of the pitch rather than a wall of import paths.
 * WHERE: src/app/(marketing)/page.tsx.
 */

export { LandingHero } from "./hero";
export { CapabilityMarquee } from "./capability-marquee";
export { ProblemCards } from "./problem-cards";
export { FeatureShowcase } from "./feature-showcase";
export { HowItWorks } from "./how-it-works";
export { FreeTierStats } from "./free-tier-stats";
export { PricingSection } from "./pricing-section";
export { PlanComparisonTable } from "./plan-comparison-table";
export { FaqSection } from "./faq-section";
export { FinalCta } from "./final-cta";

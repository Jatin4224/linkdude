/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: MarketingNavbar, MarketingFooter, MarketingSection,
 *   MarketingSectionProps, public chrome, landing page
 *
 * WHAT:  Barrel for the public-site chrome — the layout's navbar and footer, and
 *        the section shell each landing section composes from.
 * WHY:   One import surface for anything rendering a public page. Copy and
 *        section ids are deliberately NOT re-exported here: those live in
 *        @/lib/config/marketing, the editorial source of truth. One surface for
 *        chrome, one separate surface for content.
 * WHERE: src/app/(marketing)/layout.tsx and its _components.
 */

export { MarketingNavbar } from "./marketing-navbar";
export { MarketingFooter } from "./marketing-footer";
export { MarketingSection } from "./marketing-section";
export type { MarketingSectionProps } from "./marketing-section";

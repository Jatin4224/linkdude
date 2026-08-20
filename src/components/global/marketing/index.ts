/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: MarketingNavbar, MarketingFooter, MarketingSection,
 *   MarketingSectionProps, PageAtmosphere
 *
 * WHAT:  Barrel for the public-page chrome and the section shell.
 * WHY:   One import surface for the (marketing) layout and every section under
 *        it, so the layout reads as a shell rather than four import paths.
 * WHERE: src/app/(marketing)/layout.tsx and src/app/(marketing)/_components/*.
 */

export { MarketingNavbar } from "./marketing-navbar";
export { MarketingFooter } from "./marketing-footer";
export { PageAtmosphere } from "./page-atmosphere";
export { MarketingSection } from "./marketing-section";
export type { MarketingSectionProps } from "./marketing-section";

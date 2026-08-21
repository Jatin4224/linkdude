/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: MarketingNavbar, MarketingFooter, public chrome
 *
 * WHAT:  Barrel for the public-page chrome.
 * WHY:   One import surface for the (marketing) layout, so the layout reads as a
 *        shell rather than two import paths. The section SHELL that used to live
 *        here is gone: the paper design gives each band its own ground — paper,
 *        blue, ink — and its own bleed, so a shared wrapper had nothing left to
 *        own except a border it would have had to opt out of three times.
 * WHERE: src/app/(marketing)/layout.tsx.
 */

export { MarketingNavbar } from "./marketing-navbar";
export { MarketingFooter } from "./marketing-footer";

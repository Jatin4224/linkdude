/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: PortalOverview, RangeSelector, GrowthChart,
 *   EngagementChart, RevenuePanel, portal analytics components
 *
 * WHAT:  Barrel for the /portal analytics dashboard pieces.
 * WHY:   The page imports one symbol; how the dashboard is split internally can
 *        change without touching the route.
 * WHERE: src/app/(portal)/portal/page.tsx.
 */

export { PortalOverview } from "./portal-overview";
export { RangeSelector } from "./range-selector";
export type { RangeSelectorProps } from "./range-selector";
export { GrowthChart } from "./growth-chart";
export type { GrowthChartProps } from "./growth-chart";
export { EngagementChart } from "./engagement-chart";
export type { EngagementChartProps } from "./engagement-chart";
export { RevenuePanel } from "./revenue-panel";
export type { RevenuePanelProps } from "./revenue-panel";

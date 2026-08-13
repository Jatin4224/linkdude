/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: MetricTile, MetricTileProps, KPI card, stat tile
 *
 * WHAT:  Barrel for the KPI tile with a previous-period comparison.
 * WHY:   One import surface; how a delta is worded or coloured can change
 *        without touching any dashboard that renders one.
 * WHERE: Imported by the /portal analytics dashboard.
 */

export { MetricTile } from "./metric-tile";
export type { MetricTileProps } from "./metric-tile";

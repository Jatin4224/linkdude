/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: formatChartDay, formatChartDayLabel, tickFormatter,
 *   labelFormatter, chart axis date, MMM d
 *
 * WHAT:  The two date formatters every portal chart needs — one for the axis
 *        ticks, one for the tooltip heading.
 * WHY:   Two functions rather than one because recharts types them differently:
 *        `tickFormatter` hands over the raw `string` dataKey value, while
 *        `labelFormatter` is typed against `ReactNode` (it can receive a
 *        rendered node, not just the key). Narrowing inside the label variant
 *        keeps both call sites free of casts and `any`.
 *
 *        Shared here rather than copied into each chart so the axis of one
 *        chart can never drift into a different date format from another.
 * WHERE: growth-chart.tsx and engagement-chart.tsx.
 */

import type { ReactNode } from "react";
import { format, parseISO } from "date-fns";

/* "Aug 9" — the year is redundant on a 90-day-max window and costs axis room. */
export function formatChartDay(day: string): string {
  return format(parseISO(day), "MMM d");
}

/* Tooltip headings get the fuller "Sat, Aug 9" — there is room for it there,
 * and the weekday is what makes a weekly usage rhythm visible. */
export function formatChartDayLabel(label: ReactNode): ReactNode {
  return typeof label === "string" ? format(parseISO(label), "EEE, MMM d") : label;
}

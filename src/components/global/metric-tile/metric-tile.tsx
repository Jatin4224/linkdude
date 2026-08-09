/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use client";

/**
 * SOURCE OF TRUTH KEYWORDS: MetricTile, MetricTileProps, KPI card, stat tile,
 *   delta, percentChange, trend, previous period, TrendingUp, TrendingDown
 *
 * WHAT:  One KPI: a label, a big number, and how it compares to the period
 *        before it.
 * WHY:   A bare count answers "how many" but never "is this going well" — the
 *        comparison is the entire reason an operator opens a dashboard. Sharing
 *        one tile across every metric means the delta is computed, coloured and
 *        worded identically everywhere, so two panels can't imply different
 *        things with the same arrow.
 *
 *        A null percentChange means the previous period was zero. That renders
 *        as "new", not +100% — growth from nothing has no percentage, and
 *        inventing one makes an early dashboard look like a rocket ship.
 * WHERE: The /portal analytics dashboard. Deliberately global (not route-local)
 *        because it takes its numbers entirely through props — the tenant
 *        dashboard's usage summary can adopt it unchanged.
 */

import * as React from "react";
import { TrendingDownIcon, TrendingUpIcon, MinusIcon } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CountUp } from "@/components/global/count-up";
import { cn } from "@/lib/utils";

export interface MetricTileProps {
  label: string;
  value: number | undefined;
  /** Percent change vs the previous period. `null` = no baseline to compare. */
  percentChange?: number | null | undefined;
  /** Raw previous-period value, shown as context under the delta. */
  previous?: number | undefined;
  /** Word for what is being counted, e.g. "posts". Used in the comparison line. */
  unit?: string | undefined;
  /** True while the query is in flight. */
  loading?: boolean | undefined;
  /** Set when a bigger number is WORSE (e.g. churn), so colours invert. */
  invertTrend?: boolean | undefined;
  className?: string | undefined;
}

/* Below this the change is noise — a 0.4% move dressed up with a green arrow
 * reads as signal the data can't support. */
const FLAT_THRESHOLD_PERCENT = 1;

export function MetricTile({
  label,
  value,
  percentChange,
  previous,
  unit,
  loading,
  invertTrend,
  className,
}: MetricTileProps) {
  const isFlat =
    percentChange !== null &&
    percentChange !== undefined &&
    Math.abs(percentChange) < FLAT_THRESHOLD_PERCENT;

  const isUp = (percentChange ?? 0) > 0;
  /* A rise in a bad metric is a bad thing — colour follows meaning, not sign. */
  const isGood = invertTrend ? !isUp : isUp;

  const TrendIcon = isFlat ? MinusIcon : isUp ? TrendingUpIcon : TrendingDownIcon;

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-muted-foreground text-sm font-medium">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading || value === undefined ? (
          <Skeleton className="h-9 w-20" />
        ) : (
          <p className="text-3xl font-semibold tabular-nums">
            <CountUp value={value} />
          </p>
        )}

        {loading || percentChange === undefined ? null : percentChange ===
          null ? (
          /* No prior period to divide by. Say so plainly. */
          <p className="text-muted-foreground text-xs">
            {previous === 0 ? "First activity in this window" : "No comparison"}
          </p>
        ) : (
          <div className="flex items-center gap-1.5 text-xs">
            <TrendIcon
              aria-hidden="true"
              className={cn(
                "size-3.5 shrink-0",
                isFlat
                  ? "text-muted-foreground"
                  : isGood
                    ? "text-brand"
                    : "text-destructive",
              )}
            />
            <span
              className={cn(
                "font-medium tabular-nums",
                isFlat
                  ? "text-muted-foreground"
                  : isGood
                    ? "text-brand"
                    : "text-destructive",
              )}
            >
              {isUp ? "+" : ""}
              {percentChange.toFixed(percentChange % 1 === 0 ? 0 : 1)}%
            </span>
            <span className="text-muted-foreground">
              vs {previous?.toLocaleString() ?? 0}
              {unit ? ` ${unit}` : ""} before
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

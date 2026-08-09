/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use client";

/**
 * SOURCE OF TRUTH KEYWORDS: RangeSelector, RangeSelectorProps,
 *   ANALYTICS_RANGE_DAYS, AnalyticsRangeDays, 7d 30d 90d, window picker
 *
 * WHAT:  The 7 / 30 / 90-day window picker for the portal dashboard.
 * WHY:   Options are mapped from ANALYTICS_RANGE_DAYS rather than typed out, so
 *        the control can never offer a window the zod input would reject.
 *        Lifted state (value + onChange) rather than owning it, because every
 *        panel on the page has to move together.
 * WHERE: The /portal analytics dashboard header.
 */

import { ANALYTICS_RANGE_DAYS, type AnalyticsRangeDays } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface RangeSelectorProps {
  value: AnalyticsRangeDays;
  onChange: (days: AnalyticsRangeDays) => void;
}

export function RangeSelector({ value, onChange }: RangeSelectorProps) {
  return (
    <div
      role="group"
      aria-label="Time range"
      className="bg-muted inline-flex items-center gap-1 rounded-lg p-1"
    >
      {ANALYTICS_RANGE_DAYS.map((days) => {
        const active = days === value;
        return (
          <Button
            key={days}
            type="button"
            size="sm"
            variant="ghost"
            aria-pressed={active}
            onClick={() => onChange(days)}
            className={cn(
              "h-7 px-3 text-xs font-medium",
              active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {days}d
          </Button>
        );
      })}
    </div>
  );
}

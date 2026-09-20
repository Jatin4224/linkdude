/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use client";

/**
 * SOURCE OF TRUTH KEYWORDS: MonthCalendar, MonthCalendarProps, getMonthGridRange,
 *   WEEKDAY_LABELS
 *
 * WHAT:  A month grid that renders arbitrary items into their day cells.
 * WHY:   Hand-built on date-fns rather than shadcn's calendar, which is
 *        react-day-picker — a date PICKER for selecting a day, not a surface for
 *        rendering content inside cells. Using it here would mean fighting a
 *        component built for a different job, plus a dependency.
 *
 *        Fully GENERIC over its item type and slot-driven (`renderItem`,
 *        `renderDayAction`), so it knows nothing about posts and the next
 *        feature that needs a calendar reuses it rather than forking it.
 * WHERE: Used by the content calendar. Pair with getMonthGridRange so the query
 *        window matches exactly what the grid draws.
 */

import * as React from "react";
import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from "date-fns";

import { cn } from "@/lib/utils";

/* Sunday-first, matching the default locale week used throughout the app. */
export const WEEKDAY_LABELS = [
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
] as const;

/**
 * SOURCE OF TRUTH KEYWORDS: getMonthGridRange
 *
 * WHAT:  The full first-to-last day the grid will DRAW for a given month.
 * WHY:   A month grid shows leading and trailing days from adjacent months, so
 *        querying `startOfMonth`→`endOfMonth` leaves those cells wrongly empty.
 *        Exported so the data query and the render use one definition and
 *        cannot disagree.
 * WHERE: Called by the calendar page to build its listCalendar input.
 */
export function getMonthGridRange(month: Date): { from: Date; to: Date } {
  return {
    from: startOfWeek(startOfMonth(month)),
    to: endOfWeek(endOfMonth(month)),
  };
}

export interface MonthCalendarProps<TItem> {
  /** Any date inside the month to display. */
  month: Date;
  items: readonly TItem[];
  /** Which day a given item belongs in. */
  getItemDate: (item: TItem) => Date;
  getItemKey: (item: TItem) => string;
  /** Slot: how one item renders inside its day cell. */
  renderItem: (item: TItem) => React.ReactNode;
  /* Optionals spell out `| undefined` because the project runs
   * exactOptionalPropertyTypes — without it a caller cannot pass a
   * conditionally-undefined value, which is exactly how these slots are used. */
  /** Slot: extra control per day (e.g. an add button), shown on hover/focus. */
  renderDayAction?: ((day: Date) => React.ReactNode) | undefined;
  onDayClick?: ((day: Date) => void) | undefined;
  /** Highlighted day, e.g. the one whose detail panel is open. */
  selectedDay?: Date | null | undefined;
  className?: string | undefined;
}

export function MonthCalendar<TItem>({
  month,
  items,
  getItemDate,
  getItemKey,
  renderItem,
  renderDayAction,
  onDayClick,
  selectedDay,
  className,
}: MonthCalendarProps<TItem>) {
  const days = React.useMemo(() => {
    const { from, to } = getMonthGridRange(month);
    return eachDayOfInterval({ start: from, end: to });
  }, [month]);

  /* Bucketed once per render rather than filtering the list inside all 35-42
   * cells, which would be quadratic in the number of items. */
  const itemsByDay = React.useMemo(() => {
    const buckets = new Map<string, TItem[]>();
    for (const item of items) {
      const key = format(getItemDate(item), "yyyy-MM-dd");
      const existing = buckets.get(key);
      if (existing) existing.push(item);
      else buckets.set(key, [item]);
    }
    return buckets;
  }, [items, getItemDate]);

  return (
    /* `data-slot` is a styling hook, not a fork. A calendar is the one place in
       this app where ruled lines are the CONTENT — the cells are genuinely
       separated — so a technical-editorial surface retunes their weight rather
       than removing them, and it needs a handle to do that. */
    <div
      data-slot="month-calendar"
      className={cn("overflow-hidden rounded-lg border bg-card", className)}
    >
      <div className="grid grid-cols-7 border-b bg-muted/40">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            /* `tech-label` resolves only inside `.tech-scope`, so the weekday
               row reads as mono column headings there and is untouched
               elsewhere. */
            className="tech-label px-2 py-2 text-center text-xs font-medium text-muted-foreground"
          >
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {days.map((day) => {
          const dayItems = itemsByDay.get(format(day, "yyyy-MM-dd")) ?? [];
          const outside = !isSameMonth(day, month);
          const selected = selectedDay ? isSameDay(day, selectedDay) : false;

          return (
            <div
              key={day.toISOString()}
              /* A div with a role rather than <button>: day cells contain their
               * own interactive children, and nesting buttons is invalid HTML
               * that breaks keyboard navigation. */
              role={onDayClick ? "button" : undefined}
              tabIndex={onDayClick ? 0 : undefined}
              onClick={onDayClick ? () => onDayClick(day) : undefined}
              onKeyDown={
                onDayClick
                  ? (event) => {
                      if (event.key !== "Enter" && event.key !== " ") return;
                      event.preventDefault();
                      onDayClick(day);
                    }
                  : undefined
              }
              className={cn(
                "group relative flex min-h-24 flex-col gap-1 border-r border-b p-1.5 last:border-r-0",
                "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
                outside && "bg-muted/30",
                onDayClick && "cursor-pointer hover:bg-accent/50",
                selected && "bg-accent",
              )}
            >
              <div className="flex items-center justify-between">
                <span
                  data-slot="month-calendar-day-number"
                  className={cn(
                    "flex size-6 items-center justify-center rounded-full text-xs tabular-nums",
                    outside
                      ? "text-muted-foreground/60"
                      : "text-muted-foreground",
                    isToday(day) &&
                      "bg-primary font-medium text-primary-foreground",
                  )}
                >
                  {format(day, "d")}
                </span>
                {renderDayAction ? (
                  /* Hidden until the cell is hovered or something inside it has
                   * focus, so 42 buttons don't compete with the content. */
                  <span className="opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                    {renderDayAction(day)}
                  </span>
                ) : null}
              </div>

              <div className="flex flex-col gap-1">
                {dayItems.map((item) => (
                  <React.Fragment key={getItemKey(item)}>
                    {renderItem(item)}
                  </React.Fragment>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

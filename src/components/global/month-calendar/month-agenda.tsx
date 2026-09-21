/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use client";

/**
 * SOURCE OF TRUTH KEYWORDS: MonthAgenda, MonthAgendaProps, agenda view,
 *   mobile calendar, calendar list, MonthCalendar, day rows
 *
 * WHAT:  The same month as MonthCalendar, drawn as a list of the days that have
 *        something on them.
 * WHY:   A seven-column grid on a 390px phone leaves each day about fifty
 *        pixels wide — the post chips inside cannot be read, and the cells are
 *        too small to tap reliably. A list turns the one question a member asks
 *        of a calendar on a phone ("what is going out, and when?") into a scan
 *        down the page.
 *
 *        It takes MonthCalendar's props UNCHANGED, so a caller renders both from
 *        one set of values and switches by breakpoint; nothing about posts lives
 *        here either. Empty days are left out on purpose: a list of thirty
 *        blank rows is the grid's problem again, just vertical. `empty` covers
 *        the month with nothing on it.
 * WHERE: The content calendar, below the md breakpoint. Pair with MonthCalendar.
 */

import * as React from "react";
import {
  eachDayOfInterval,
  endOfMonth,
  format,
  isSameDay,
  isToday,
  startOfMonth,
} from "date-fns";

import { cn } from "@/lib/utils";

import type { MonthCalendarProps } from "./month-calendar";

export type MonthAgendaProps<TItem> = MonthCalendarProps<TItem> & {
  /** Shown when no day in the month has an item. */
  empty?: React.ReactNode | undefined;
};

export function MonthAgenda<TItem>({
  month,
  items,
  getItemDate,
  getItemKey,
  renderItem,
  renderDayAction,
  onDayClick,
  selectedDay,
  empty,
  className,
}: MonthAgendaProps<TItem>) {
  /* Only this month's days — the grid's leading and trailing days exist to
   * square off a grid, and a list has no grid to square off. */
  const days = React.useMemo(() => {
    const buckets = new Map<string, TItem[]>();
    for (const item of items) {
      const key = format(getItemDate(item), "yyyy-MM-dd");
      const existing = buckets.get(key);
      if (existing) existing.push(item);
      else buckets.set(key, [item]);
    }
    return eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) })
      .map((day) => ({ day, dayItems: buckets.get(format(day, "yyyy-MM-dd")) ?? [] }))
      .filter(({ dayItems }) => dayItems.length > 0);
  }, [month, items, getItemDate]);

  if (days.length === 0) return <div className={className}>{empty}</div>;

  return (
    <ol data-slot="month-agenda" className={cn("flex flex-col", className)}>
      {days.map(({ day, dayItems }) => {
        const selected = selectedDay ? isSameDay(day, selectedDay) : false;
        return (
          <li
            key={day.toISOString()}
            /* A div-with-role for the MonthCalendar reason: the row holds its
             * own interactive children, and nested buttons are invalid HTML. */
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
              "flex gap-4 border-b py-3 last:border-b-0",
              "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
              onDayClick && "cursor-pointer",
              selected && "bg-accent",
            )}
          >
            {/* The date is a number with a label on it, so it is set in mono and
                given a fixed column — the rows then align into a readable
                timeline instead of a ragged list. */}
            <div className="flex w-14 shrink-0 flex-col items-start gap-0.5 font-mono">
              <span className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                {isToday(day) ? "Today" : format(day, "EEE")}
              </span>
              <span className="text-xl leading-none tabular-nums">{format(day, "d")}</span>
            </div>

            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              {dayItems.map((item) => (
                <div key={getItemKey(item)}>{renderItem(item)}</div>
              ))}
            </div>

            {renderDayAction ? (
              /* Always visible here: there is no hover on a phone, so an action
                 revealed on hover would simply not exist. */
              <div className="shrink-0">{renderDayAction(day)}</div>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

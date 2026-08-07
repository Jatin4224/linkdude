/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: CalendarPost, getCalendarPostDate
 *
 * WHAT:  The client type for one post on the calendar, derived from the tRPC
 *        router output so it cannot drift from the server contract.
 * WHY:   Same router-derived pattern as member-types.ts and
 *        use-active-organization — no hand-rolled mirror of the payload, and no
 *        duplicate of a DB-shaped type (CLAUDE.md: Prisma is the source of
 *        truth for anything the database owns).
 * WHERE: Consumed by the calendar _components.
 */

import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@/trpc/routers/_app";

export type CalendarPost =
  inferRouterOutputs<AppRouter>["linkedinPosts"]["listCalendar"][number];

/**
 * SOURCE OF TRUTH KEYWORDS: getCalendarPostDate
 *
 * WHAT:  Which day a post belongs on.
 * WHY:   A scheduled post is placed by `scheduledFor` and a published one by
 *        `publishedAt` — the same reason listCalendar queries both columns.
 *        `createdAt` is the last resort so a row can never fall off the grid.
 * WHERE: Passed to MonthCalendar as getItemDate.
 */
export function getCalendarPostDate(post: CalendarPost): Date {
  return post.scheduledFor ?? post.publishedAt ?? post.createdAt;
}

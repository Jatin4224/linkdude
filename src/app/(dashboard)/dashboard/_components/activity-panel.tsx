/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use client";

/**
 * SOURCE OF TRUTH KEYWORDS: ActivityPanel, UpcomingPosts, RecentPosts,
 *   linkedinPosts.listCalendar, linkedinPosts.list, PostStatusBadge,
 *   useActiveOrganizationId, CalendarPost, SCHEDULE_LOOKAHEAD_DAYS
 *
 * WHAT:  Two columns — what is queued to go out next, and what went out
 *        recently — each linking through to the surface that owns it.
 * WHY:   The one question this page has to answer on sight is "am I on track",
 *        and that is entirely a question about the queue: an empty upcoming
 *        column IS the finding, which is why its empty state is a call to write
 *        rather than a shrug.
 *
 *        Reads the two existing post queries and does the narrowing on the
 *        client — the calendar query is already bounded and cached by the
 *        calendar route, so asking for a window here reuses that work instead of
 *        needing a new "upcoming posts" procedure on the server.
 * WHERE: src/app/(dashboard)/dashboard/page.tsx.
 */

import * as React from "react";
import Link from "next/link";
import { addDays, format, isToday, isTomorrow } from "date-fns";

import { trpc } from "@/trpc/react-provider";
import { useActiveOrganizationId } from "@/hooks/use-active-organization";
import { getResourceDefinition } from "@/lib/resources";
import { PostStatusBadge } from "@/components/global/post-status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/* How far ahead the queue is worth reading. Long enough to cover a month of
 * planned posts, short enough that the window stays a cheap query. */
const SCHEDULE_LOOKAHEAD_DAYS = 45;

/* Enough to show a rhythm without turning the home page into the calendar. */
const LIST_SIZE = 4;

const POST_COMPOSER_HREF =
  getResourceDefinition("linkedinPosts").nav?.href ?? "/dashboard";
const CALENDAR_HREF =
  getResourceDefinition("contentCalendar").nav?.href ?? "/dashboard";

/* "Today · 9:00 AM" beats "Tue 14 Jan" for anything imminent — the reader is
 * checking whether something is about to happen, not reading a date. */
function formatWhen(date: Date): string {
  const time = format(date, "h:mm a");
  if (isToday(date)) return `Today · ${time}`;
  if (isTomorrow(date)) return `Tomorrow · ${time}`;
  return `${format(date, "EEE d MMM")} · ${time}`;
}

function PostRow({
  commentary,
  status,
  when,
}: {
  commentary: string;
  status: string;
  when: string;
}) {
  return (
    <li className="flex flex-col gap-1.5 border-b py-3 last:border-0 last:pb-0 first:pt-0">
      <div className="flex items-center gap-2">
        <PostStatusBadge status={status} />
        <span className="text-xs tabular-nums text-muted-foreground">
          {when}
        </span>
      </div>
      {/* Two lines: enough to recognise which post this is, not enough to
          re-read it here instead of in the composer. */}
      <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
        {commentary}
      </p>
    </li>
  );
}

function PanelSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: 3 }, (_, index) => (
        <Skeleton key={index} className="h-12 w-full" />
      ))}
    </div>
  );
}

export function ActivityPanel() {
  const organizationId = useActiveOrganizationId();
  const enabled = organizationId !== undefined;
  const orgId = organizationId ?? "";

  /* Pinned on first render: a range rebuilt every render would be a new query
   * key each time and refetch forever. */
  const range = React.useMemo(() => {
    const from = new Date();
    return { from, to: addDays(from, SCHEDULE_LOOKAHEAD_DAYS) };
  }, []);

  const upcoming = trpc.linkedinPosts.listCalendar.useQuery(
    { organizationId: orgId, from: range.from, to: range.to },
    { enabled },
  );

  const recent = trpc.linkedinPosts.list.useQuery(
    { organizationId: orgId, limit: LIST_SIZE },
    { enabled },
  );

  /* The calendar window returns published posts too — the queue is only what
   * has not gone out yet, soonest first. */
  const queued = (upcoming.data ?? [])
    .filter((post) => post.scheduledFor !== null && post.status === "scheduled")
    .sort(
      (a, b) =>
        (a.scheduledFor?.getTime() ?? 0) - (b.scheduledFor?.getTime() ?? 0),
    )
    .slice(0, LIST_SIZE);

  const published = (recent.data ?? []).slice(0, LIST_SIZE);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="surface-raised">
        <CardHeader className="flex-row items-center justify-between gap-2">
          <CardTitle className="text-base">Going out next</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            nativeButton={false}
            render={<Link href={CALENDAR_HREF} />}
          >
            Calendar
          </Button>
        </CardHeader>
        <CardContent>
          {upcoming.isPending && enabled ? (
            <PanelSkeleton />
          ) : queued.length === 0 ? (
            /* An empty queue is the whole point of looking, so this state asks
               for the next action instead of just reporting nothing. */
            <div className="flex flex-col items-start gap-3 py-2">
              <p className="text-sm text-muted-foreground">
                Nothing scheduled. The gap in your cadence starts here.
              </p>
              <Button
                variant="brand"
                size="sm"
                nativeButton={false}
                render={<Link href={POST_COMPOSER_HREF} />}
              >
                Write a post
              </Button>
            </div>
          ) : (
            <ul className="flex flex-col">
              {queued.map((post) => (
                <PostRow
                  key={post.id}
                  commentary={post.commentary}
                  status={post.status}
                  when={
                    post.scheduledFor ? formatWhen(post.scheduledFor) : "—"
                  }
                />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="surface-raised">
        <CardHeader>
          <CardTitle className="text-base">Recently published</CardTitle>
        </CardHeader>
        <CardContent>
          {recent.isPending && enabled ? (
            <PanelSkeleton />
          ) : published.length === 0 ? (
            <p className="py-2 text-sm text-muted-foreground">
              Nothing published yet. Your first one is the hard one.
            </p>
          ) : (
            <ul className="flex flex-col">
              {published.map((post) => (
                <PostRow
                  key={post.id}
                  commentary={post.commentary}
                  status={post.status}
                  when={
                    post.publishedAt
                      ? format(post.publishedAt, "EEE d MMM")
                      : "—"
                  }
                />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

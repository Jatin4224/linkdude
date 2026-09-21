/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use client";

/**
 * SOURCE OF TRUTH KEYWORDS: ContentCalendar, ContentCalendarProps, DayDetail
 *
 * WHAT:  The content calendar — a month grid of scheduled and published posts,
 *        with a day-detail panel for cancelling or inspecting one.
 * WHY:   Composes the global MonthCalendar rather than owning a grid, so the
 *        layout/keyboard behaviour lives in one reusable place and this file is
 *        only the post-specific slots.
 *
 *        The query window comes from getMonthGridRange, NOT from the month
 *        boundaries: the grid draws leading and trailing days from adjacent
 *        months, and querying the month alone would leave those cells wrongly
 *        empty.
 * WHERE: Rendered by /dashboard/calendar.
 */

import * as React from "react";
import Link from "next/link";
import { addMonths, format, isSameDay, startOfMonth } from "date-fns";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ImageIcon,
  Loader2Icon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import { toast } from "sonner";

import { getErrorMessage } from "@/lib/errors";

import { trpc } from "@/trpc/react-provider";
import { useActiveOrganizationId } from "@/hooks/use-active-organization";
import { CANCELABLE_POST_STATUSES, type LinkedInPostStatus } from "@/lib/types";
import { ContentLayout } from "@/components/global/page-header";
import {
  MonthAgenda,
  MonthCalendar,
  getMonthGridRange,
} from "@/components/global/month-calendar";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TechEmpty, TechSurface } from "@/components/global/tech";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { PostStatusBadge } from "@/components/global/post-status-badge";
import { getCalendarPostDate, type CalendarPost } from "./calendar-types";

export interface ContentCalendarProps {
  /** A scheduler is wired up; without it nothing new can be scheduled. */
  schedulingEnabled: boolean;
}

/* Deep-links the composer to a specific day. `?date=` is read by the
 * post-generation page and seeded into the schedule control. */
function composeHref(day: Date): string {
  return `/dashboard/post-generation?date=${encodeURIComponent(day.toISOString())}`;
}

export function ContentCalendar({ schedulingEnabled }: ContentCalendarProps) {
  const organizationId = useActiveOrganizationId();
  const utils = trpc.useUtils();

  const [month, setMonth] = React.useState(() => startOfMonth(new Date()));
  const [selectedDay, setSelectedDay] = React.useState<Date | null>(null);

  const enabled = organizationId !== undefined;
  const orgId = organizationId ?? "";
  const range = React.useMemo(() => getMonthGridRange(month), [month]);

  const posts = trpc.linkedinPosts.listCalendar.useQuery(
    { organizationId: orgId, from: range.from, to: range.to },
    { enabled },
  );

  const cancel = trpc.linkedinPosts.delete.useMutation({
    onSuccess: async () => {
      toast.success("Post removed.");
      await Promise.all([
        utils.linkedinPosts.listCalendar.invalidate(),
        utils.linkedinPosts.list.invalidate(),
        /* The slot is refunded by the delete verb, so the usage meter is stale
         * until this refetches. */
        utils.usage.invalidate(),
      ]);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const items = React.useMemo(() => posts.data ?? [], [posts.data]);

  const selectedPosts = React.useMemo(
    () =>
      selectedDay
        ? items.filter((post) =>
            isSameDay(getCalendarPostDate(post), selectedDay),
          )
        : [],
    [items, selectedDay],
  );

  function handleCancel(post: CalendarPost) {
    if (!enabled) return;
    cancel.mutate({ organizationId: orgId, postId: post.id });
  }

  return (
    <ContentLayout
      title="Content Calendar"
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            aria-label="Previous month"
            onClick={() => setMonth((current) => addMonths(current, -1))}
          >
            <ChevronLeftIcon className="size-4" />
          </Button>
          {/* The month is the page's one readout, so it is set in mono like
              every other number on a technical surface. */}
          {/* Abbreviated below sm: the header also carries the title, two
              arrows and Today, and a fixed 144px label pushed the row past a
              390px screen. The full name returns as soon as there is room. */}
          <span className="min-w-20 text-center font-mono text-sm tracking-[0.04em] uppercase sm:min-w-36">
            <span className="sm:hidden">{format(month, "MMM yyyy")}</span>
            <span className="hidden sm:inline">{format(month, "MMMM yyyy")}</span>
          </span>
          <Button
            variant="outline"
            size="icon"
            aria-label="Next month"
            onClick={() => setMonth((current) => addMonths(current, 1))}
          >
            <ChevronRightIcon className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setMonth(startOfMonth(new Date()))}
          >
            Today
          </Button>
        </div>
      }
    >
      <TechSurface className="flex flex-col gap-4">
        {posts.isLoading ? (
          <Skeleton className="h-128 w-full" />
        ) : (
          <>
          {/* Grid from md up, list below it — the same props feed both, so the
              two views cannot disagree about what is on which day. A 7-column
              grid at phone width leaves each day ~50px, too narrow to read a
              post or tap a cell; see MonthAgenda. */}
          <MonthCalendar
            className="hidden md:block"
            month={month}
            items={items}
            getItemDate={getCalendarPostDate}
            getItemKey={(post) => post.id}
            selectedDay={selectedDay}
            onDayClick={setSelectedDay}
            renderDayAction={
              schedulingEnabled
                ? (day) => (
                    /* buttonVariants rather than <Button asChild> — this
                       Button is a base-ui primitive with no asChild slot, so a
                       link that looks like a button borrows the classes. */
                    <Link
                      href={composeHref(day)}
                      aria-label={`Schedule a post on ${format(day, "PPP")}`}
                      className={cn(
                        buttonVariants({ variant: "ghost", size: "icon-xs" }),
                      )}
                      /* Stop the day cell's own click from also firing and
                         opening the detail panel behind the navigation. */
                      onClick={(event) => event.stopPropagation()}
                    >
                      <PlusIcon className="size-3.5" />
                    </Link>
                  )
                : undefined
            }
            renderItem={(post) => (
              /* A fill one step off the cell, not an outlined chip — the cell
                 is already ruled, and a box inside a box is two frames. */
              <div className="flex flex-col gap-0.5 bg-(--ed-surface-deep) p-1 text-left">
                <div className="flex items-center gap-1">
                  <PostStatusBadge status={post.status} />
                  {post.imageUrl ? (
                    <ImageIcon className="size-3 shrink-0 text-muted-foreground" />
                  ) : null}
                </div>
                <p className="line-clamp-2 text-[11px] leading-tight text-muted-foreground">
                  {post.commentary}
                </p>
              </div>
            )}
          />
          <MonthAgenda
            className="md:hidden"
            month={month}
            items={items}
            getItemDate={getCalendarPostDate}
            getItemKey={(post) => post.id}
            selectedDay={selectedDay}
            onDayClick={setSelectedDay}
            renderDayAction={
              schedulingEnabled
                ? (day) => (
                    <Link
                      href={composeHref(day)}
                      aria-label={`Schedule a post on ${format(day, "PPP")}`}
                      className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }))}
                      onClick={(event) => event.stopPropagation()}
                    >
                      <PlusIcon className="size-4" />
                    </Link>
                  )
                : undefined
            }
            /* Reading size, not cell size: a list row has the width a grid
               cell never did, so the post can be read rather than recognised. */
            renderItem={(post) => (
              <div className="flex flex-col gap-1 bg-(--ed-surface-deep) p-2 text-left">
                <div className="flex items-center gap-1.5">
                  <PostStatusBadge status={post.status} />
                  {post.imageUrl ? (
                    <ImageIcon className="size-3.5 shrink-0 text-muted-foreground" />
                  ) : null}
                </div>
                <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
                  {post.commentary}
                </p>
              </div>
            )}
            empty={
              <TechEmpty
                title="Nothing this month"
                hint="Use the arrows above to look at another month, or write a post and schedule it."
              />
            }
          />
          </>
        )}

        {selectedDay ? (
          <DayDetail
            day={selectedDay}
            posts={selectedPosts}
            schedulingEnabled={schedulingEnabled}
            onCancel={handleCancel}
            isCancelling={cancel.isPending}
            cancellingId={cancel.variables?.postId}
          />
        ) : null}
      </TechSurface>
    </ContentLayout>
  );
}

/* The day panel doubles as the empty state: clicking a day with nothing on it
 * is how a user discovers they can schedule there. */
function DayDetail({
  day,
  posts,
  schedulingEnabled,
  onCancel,
  isCancelling,
  cancellingId,
}: {
  day: Date;
  posts: readonly CalendarPost[];
  schedulingEnabled: boolean;
  onCancel: (post: CalendarPost) => void;
  isCancelling: boolean;
  cancellingId: string | undefined;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base">{format(day, "EEEE, PPP")}</CardTitle>
        {schedulingEnabled ? (
          <Link
            href={composeHref(day)}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            <PlusIcon className="size-4" />
            Schedule a post
          </Link>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {posts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing planned for this day.
          </p>
        ) : (
          posts.map((post, index) => (
            <React.Fragment key={post.id}>
              {index > 0 ? <Separator /> : null}
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <PostStatusBadge status={post.status} />
                    <span className="text-xs text-muted-foreground">
                      {(
                        post.scheduledFor ??
                        post.publishedAt ??
                        post.createdAt
                      ).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">
                    {post.commentary}
                  </p>
                </div>
                {/* `publishing` is excluded: the worker has already claimed it
                    and the server refuses the delete, so offering the button
                    would only produce an error toast. */}
                {(CANCELABLE_POST_STATUSES as readonly string[]).includes(
                  post.status,
                ) ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onCancel(post)}
                    disabled={isCancelling}
                  >
                    {isCancelling && cancellingId === post.id ? (
                      <Loader2Icon className="size-4 animate-spin" />
                    ) : (
                      <Trash2Icon className="size-4" />
                    )}
                    Cancel
                  </Button>
                ) : null}
              </div>
              {post.status === ("failed" satisfies LinkedInPostStatus) ? (
                <p className="text-xs text-destructive">
                  This post could not be published. Cancel it and try again.
                </p>
              ) : null}
            </React.Fragment>
          ))
        )}
      </CardContent>
    </Card>
  );
}

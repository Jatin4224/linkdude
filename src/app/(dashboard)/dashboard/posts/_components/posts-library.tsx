/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use client";

/**
 * SOURCE OF TRUTH KEYWORDS: PostsLibrary, postRowDate, postRowDateLabel,
 *   buildDraftComposerHref
 *
 * WHAT:  The /dashboard/posts surface — every post this workspace has written, in
 *        any state, with edit, open-on-LinkedIn, discard and delete.
 * WHY:   This app's post table is the only readable history of what an org has
 *        published: LinkedIn gates reading a member's posts behind
 *        `r_member_social`, so nothing can be re-fetched from the feed. Before
 *        this page the rows existed with no surface — a draft had nowhere to live
 *        and a failed post could only be found by walking the calendar.
 *
 *        Uses the global DataTable, like the carousel and documents lists, so the
 *        three cannot drift into different pagination or empty-state behaviour.
 *        Search and the status filter are SERVER-side: the table renders one page,
 *        and filtering it in the browser would report "nothing matches" while the
 *        match sat on page two.
 * WHERE: Rendered by the posts page. RESOURCES.postLibrary.nav.href.
 */

import * as React from "react";
import Link from "next/link";
import {
  ExternalLinkIcon,
  FileStackIcon,
  ImageIcon,
  Layers2Icon,
  Loader2Icon,
  PencilIcon,
} from "lucide-react";
import { toast } from "sonner";

import { getErrorMessage } from "@/lib/errors";

import { trpc } from "@/trpc/react-provider";
import { useActiveOrganizationId } from "@/hooks/use-active-organization";
import { ContentLayout } from "@/components/global/page-header";
import { DataTable, type DataTableColumn } from "@/components/global/data-table";
import {
  PostStatusBadge,
  postStatusLabel,
} from "@/components/global/post-status-badge";
import { buildLinkedInPostUrl } from "@/lib/config";
import { type LinkedInPostStatus } from "@/lib/types";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { buildDraftComposerHref, cn } from "@/lib/utils";
import {
  POST_STATUS_FILTERS,
  POST_STATUS_FILTER_ALL,
  type PostLibraryRow,
  type PostStatusFilter,
} from "./post-types";

const PAGE_SIZE = 20;

const DRAFT = "draft" satisfies LinkedInPostStatus;

/* Every status has a different meaningful date, and showing the wrong one makes
 * the list read as broken — a draft with a publish date, or a queued post
 * claiming it went out. `updatedAt` is the floor because it is the only one of
 * the four that is never null. */
function postRowDate(row: PostLibraryRow): Date {
  if (row.status === DRAFT) return new Date(row.updatedAt);
  return new Date(row.publishedAt ?? row.scheduledFor ?? row.updatedAt);
}

function postRowDateLabel(row: PostLibraryRow): string {
  if (row.status === DRAFT) return "Edited";
  if (row.publishedAt) return "Published";
  if (row.scheduledFor) return "Scheduled";
  return "Updated";
}

/* Reopening a draft is a LINK, not a client-side handoff: the composer already
 * reads its seed values from the URL (`?date=` for the calendar), so a draft is
 * one more param on the same door. It also makes a reopened draft shareable and
 * survivable across a refresh. The href itself is built in @/lib/utils, because
 * the content plan's "Draft this" action hands users to the same place. */

export function PostsLibrary() {
  const organizationId = useActiveOrganizationId();
  const utils = trpc.useUtils();

  const [page, setPage] = React.useState(1);
  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState<PostStatusFilter>(
    POST_STATUS_FILTER_ALL,
  );
  /* Which row's action is in flight, so only that row's button shows a spinner
   * rather than every row disabling at once. */
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  const enabled = organizationId !== undefined;
  const orgInput = { organizationId: organizationId ?? "" };

  const listQuery = trpc.linkedinPosts.listLibrary.useQuery(
    {
      ...orgInput,
      page,
      pageSize: PAGE_SIZE,
      ...(status === POST_STATUS_FILTER_ALL ? {} : { status }),
      ...(search.trim() ? { search: search.trim() } : {}),
    },
    { enabled, retry: false },
  );

  /* Both removals refresh the same three surfaces. The calendar and the
   * composer's recent strip read the same rows, so leaving them stale would show
   * a post that no longer exists; usage is invalidated because `delete` REFUNDS a
   * post slot and the meter would otherwise lag behind by one. */
  async function invalidateAfterRemoval(): Promise<void> {
    await Promise.all([
      utils.linkedinPosts.listLibrary.invalidate(),
      utils.linkedinPosts.list.invalidate(),
      utils.linkedinPosts.listCalendar.invalidate(),
      utils.usage.invalidate(),
    ]);
  }

  const discard = trpc.linkedinPosts.discard.useMutation({
    onSuccess: async () => {
      await invalidateAfterRemoval();
      toast.success("Draft discarded.");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
    onSettled: () => setPendingId(null),
  });

  const remove = trpc.linkedinPosts.delete.useMutation({
    onSuccess: async () => {
      await invalidateAfterRemoval();
      toast.success("Post record removed.");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
    onSettled: () => setPendingId(null),
  });

  if (!organizationId) return null;

  const rows = listQuery.data?.items ?? [];

  const columns: ReadonlyArray<DataTableColumn<PostLibraryRow>> = [
    {
      id: "commentary",
      header: "Post",
      render: (row) => (
        <div className="flex min-w-0 items-start gap-2">
          {/* The attachment marker earns its place: a text post and a deck read
              identically from their first line, and which one it is changes what
              the row means. */}
          {row.documentId ? (
            <Layers2Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          ) : row.imageUrl ? (
            <ImageIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          ) : null}
          <span className="line-clamp-2 max-w-prose whitespace-pre-wrap">
            {row.commentary}
          </span>
        </div>
      ),
    },
    {
      id: "status",
      header: "Status",
      className: "w-px",
      render: (row) => <PostStatusBadge status={row.status} />,
    },
    {
      id: "date",
      header: "When",
      align: "end",
      className: "w-px whitespace-nowrap text-muted-foreground",
      render: (row) => (
        <span className="flex flex-col items-end">
          <span className="tabular-nums">
            {postRowDate(row).toLocaleDateString()}
          </span>
          <span className="text-[10px] uppercase">
            {postRowDateLabel(row)}
          </span>
        </span>
      ),
    },
  ];

  return (
    <ContentLayout
      title="Posts"
      description="Every draft, scheduled and published post in this workspace"
      icon={<FileStackIcon className="size-4" />}
    >
      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(row) => row.id}
        isLoading={listQuery.isLoading}
        error={listQuery.error ? "Posts couldn’t be loaded." : undefined}
        /* Says which emptiness this is. "No posts yet" under an active status
           filter would read as an empty workspace when the workspace is fine. */
        empty={
          status === POST_STATUS_FILTER_ALL
            ? "No posts yet. Write one from Create Post."
            : `No ${postStatusLabel(status).toLowerCase()} posts.`
        }
        search={{
          value: search,
          onChange: (value) => {
            setSearch(value);
            /* Back to page one on every narrowing — staying on page three of a
               result set that now has one page renders an empty table. */
            setPage(1);
          },
          placeholder: "Search post text…",
        }}
        filters={
          <Select
            value={status}
            onValueChange={(value) => {
              setStatus(value as PostStatusFilter);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-40">
              {/* Base UI's Select.Value renders the raw VALUE unless given
                  children — see the note in image-editor.tsx. */}
              <SelectValue>
                {status === POST_STATUS_FILTER_ALL
                  ? "All statuses"
                  : postStatusLabel(status)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {POST_STATUS_FILTERS.map((option) => (
                <SelectItem key={option} value={option}>
                  {option === POST_STATUS_FILTER_ALL
                    ? "All statuses"
                    : postStatusLabel(option)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
        pagination={{
          page,
          pageSize: PAGE_SIZE,
          total: listQuery.data?.total ?? 0,
          onPageChange: setPage,
        }}
        rowActions={(row) => {
          const isPending = pendingId === row.id;
          const isDraft = row.status === DRAFT;
          return (
            <div className="flex justify-end gap-1">
              {isDraft ? (
                /* buttonVariants rather than <Button asChild> — Button is a
                   base-ui primitive with no asChild slot, so a link that looks
                   like a button borrows the classes. */
                <Link
                  href={buildDraftComposerHref(row.id)}
                  className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
                >
                  <PencilIcon className="size-4" />
                  Edit
                </Link>
              ) : null}
              {row.postUrn ? (
                <a
                  href={buildLinkedInPostUrl(row.postUrn)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
                >
                  <ExternalLinkIcon className="size-4" />
                  <span className="sr-only">Open on LinkedIn</span>
                </a>
              ) : null}
              {/* `publishing` offers neither: the worker has claimed the row and
                  the server refuses both verbs, so a button here would only ever
                  produce an error toast. */}
              {row.status === ("publishing" satisfies LinkedInPostStatus) ? null : (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={isPending}
                  onClick={() => {
                    setPendingId(row.id);
                    /* Two verbs, one button, chosen by the row — a draft never
                       spent a post slot, so discarding must not refund one. See
                       the note on linkedinPosts.discard. */
                    if (isDraft) {
                      discard.mutate({ ...orgInput, postId: row.id });
                    } else {
                      remove.mutate({ ...orgInput, postId: row.id });
                    }
                  }}
                >
                  {isPending ? (
                    <Loader2Icon className="size-4 animate-spin" />
                  ) : null}
                  {isDraft ? "Discard" : "Delete"}
                </Button>
              )}
            </div>
          );
        }}
      />
    </ContentLayout>
  );
}

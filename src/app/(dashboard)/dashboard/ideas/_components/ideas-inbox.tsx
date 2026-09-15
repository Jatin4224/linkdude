/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use client";

/**
 * SOURCE OF TRUTH KEYWORDS: IdeasInbox, idea inbox, Ideas page, turn into post,
 *   mark used, postIdeas.list, postIdeas.update, postIdeas.delete
 *
 * WHAT:  The /dashboard/ideas surface: a quick-add box, then every idea the
 *        member has saved, with Turn into post, Edit, Mark used and Delete.
 * WHY:   Uses the global DataTable, like the post library, so paging, search and
 *        empty states behave the same everywhere. Search and the status filter
 *        run on the SERVER, so a match on page two is never reported missing.
 *
 *        "Turn into post" is a link, not a client-side handoff: the composer
 *        resolves `?ideaId=` server-side and marks the idea used once a post is
 *        generated from it, so an idea only turns "Used" when it really was.
 * WHERE: Rendered by the ideas page. RESOURCES.postIdeas.nav.href.
 */

import * as React from "react";
import Link from "next/link";
import {
  CheckIcon,
  LightbulbIcon,
  Loader2Icon,
  PencilIcon,
  RotateCcwIcon,
  SparklesIcon,
  Trash2Icon,
} from "lucide-react";
import { toast } from "sonner";

import { permissions } from "@/lib/better-auth/permissions";
import { POST_IDEA_STATUS_LABELS } from "@/lib/config";
import { getErrorMessage } from "@/lib/errors";
import type { PostIdeaStatus } from "@/lib/types";
import { buildIdeaComposerHref, cn } from "@/lib/utils";
import { trpc } from "@/trpc/react-provider";
import {
  useActiveOrganization,
  useActiveOrganizationId,
} from "@/hooks/use-active-organization";
import { ContentLayout } from "@/components/global/page-header";
import { DataTable, type DataTableColumn } from "@/components/global/data-table";
import { IdeaQuickAdd } from "@/components/global/idea-quick-add";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EditIdeaDialog } from "./edit-idea-dialog";
import {
  POST_IDEA_STATUS_FILTERS,
  POST_IDEA_STATUS_FILTER_ALL,
  type PostIdeaRow,
  type PostIdeaStatusFilter,
} from "./idea-types";

const PAGE_SIZE = 20;

const USED = "used" satisfies PostIdeaStatus;

function filterLabel(filter: PostIdeaStatusFilter): string {
  return filter === POST_IDEA_STATUS_FILTER_ALL
    ? "All ideas"
    : POST_IDEA_STATUS_LABELS[filter];
}

export function IdeasInbox() {
  const organizationId = useActiveOrganizationId();
  const { hasPermission } = useActiveOrganization();
  const utils = trpc.useUtils();

  const [page, setPage] = React.useState(1);
  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState<PostIdeaStatusFilter>(
    POST_IDEA_STATUS_FILTER_ALL,
  );
  /* Which row's action is in flight, so only that row shows a spinner. */
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState<PostIdeaRow | null>(null);

  const enabled = organizationId !== undefined;
  const orgInput = { organizationId: organizationId ?? "" };

  const listQuery = trpc.postIdeas.list.useQuery(
    {
      ...orgInput,
      page,
      pageSize: PAGE_SIZE,
      ...(status === POST_IDEA_STATUS_FILTER_ALL ? {} : { status }),
      ...(search.trim() ? { search: search.trim() } : {}),
    },
    { enabled, retry: false },
  );

  const setIdeaStatus = trpc.postIdeas.update.useMutation({
    onSuccess: async () => {
      await utils.postIdeas.list.invalidate();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
    onSettled: () => setPendingId(null),
  });

  const remove = trpc.postIdeas.delete.useMutation({
    onSuccess: async () => {
      /* Usage too: deleting frees the idea's slot on the plan. */
      await Promise.all([
        utils.postIdeas.list.invalidate(),
        utils.usage.invalidate(),
      ]);
      toast.success("Idea deleted.");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
    onSettled: () => setPendingId(null),
  });

  if (!organizationId) return null;

  const canUpdate = hasPermission(permissions.POST_IDEAS_UPDATE);
  const canDelete = hasPermission(permissions.POST_IDEAS_DELETE);
  const rows = listQuery.data?.items ?? [];

  const columns: ReadonlyArray<DataTableColumn<PostIdeaRow>> = [
    {
      id: "text",
      header: "Idea",
      render: (row) => (
        <span className="line-clamp-3 max-w-prose whitespace-pre-wrap">
          {row.text}
        </span>
      ),
    },
    {
      id: "status",
      header: "Status",
      className: "w-px",
      render: (row) =>
        row.status === USED ? (
          <Badge variant="secondary">{POST_IDEA_STATUS_LABELS.used}</Badge>
        ) : (
          <Badge variant="outline">{POST_IDEA_STATUS_LABELS.new}</Badge>
        ),
    },
    {
      id: "date",
      header: "Saved",
      align: "end",
      className: "w-px whitespace-nowrap text-muted-foreground tabular-nums",
      render: (row) => new Date(row.createdAt).toLocaleDateString(),
    },
  ];

  return (
    <ContentLayout
      title="Ideas"
      description="Save ideas in seconds, turn them into posts when you're ready"
      icon={<LightbulbIcon className="size-4" />}
    >
      <div className="flex flex-col gap-4">
        <Card className="surface-raised">
          <CardContent className="p-4">
            <IdeaQuickAdd placeholder="Jot down an idea for a post..." />
          </CardContent>
        </Card>

        <DataTable
          rows={rows}
          columns={columns}
          rowKey={(row) => row.id}
          isLoading={listQuery.isLoading}
          error={listQuery.error ? "Ideas couldn't be loaded." : undefined}
          empty={
            status === POST_IDEA_STATUS_FILTER_ALL && !search.trim()
              ? "No ideas yet. Save one above whenever something comes to mind."
              : "No ideas match."
          }
          search={{
            value: search,
            onChange: (value) => {
              setSearch(value);
              /* Back to page one on every narrowing. */
              setPage(1);
            },
            placeholder: "Search ideas...",
          }}
          filters={
            <Select
              value={status}
              onValueChange={(value) => {
                setStatus(value as PostIdeaStatusFilter);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-36">
                {/* Base UI's Select.Value renders the raw VALUE unless given
                    children. */}
                <SelectValue>{filterLabel(status)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {POST_IDEA_STATUS_FILTERS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {filterLabel(option)}
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
            const isUsed = row.status === USED;
            return (
              <div className="flex justify-end gap-1">
                <Link
                  href={buildIdeaComposerHref(row.id)}
                  className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
                >
                  <SparklesIcon className="size-4" />
                  Turn into post
                </Link>
                {canUpdate ? (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={isPending}
                      onClick={() => setEditing(row)}
                    >
                      <PencilIcon className="size-4" />
                      <span className="sr-only">Edit</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={isPending}
                      onClick={() => {
                        setPendingId(row.id);
                        setIdeaStatus.mutate({
                          ...orgInput,
                          field: "status",
                          id: row.id,
                          status: isUsed ? "new" : "used",
                        });
                      }}
                    >
                      {isPending && setIdeaStatus.isPending ? (
                        <Loader2Icon className="size-4 animate-spin" />
                      ) : isUsed ? (
                        <RotateCcwIcon className="size-4" />
                      ) : (
                        <CheckIcon className="size-4" />
                      )}
                      <span className="sr-only">
                        {isUsed ? "Mark as new" : "Mark as used"}
                      </span>
                    </Button>
                  </>
                ) : null}
                {canDelete ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={isPending}
                    onClick={() => {
                      setPendingId(row.id);
                      remove.mutate({ ...orgInput, id: row.id });
                    }}
                  >
                    {isPending && remove.isPending ? (
                      <Loader2Icon className="size-4 animate-spin" />
                    ) : (
                      <Trash2Icon className="size-4" />
                    )}
                    <span className="sr-only">Delete</span>
                  </Button>
                ) : null}
              </div>
            );
          }}
        />
      </div>

      {editing ? (
        <EditIdeaDialog
          key={editing.id}
          idea={editing}
          open
          onOpenChange={(open) => {
            if (!open) setEditing(null);
          }}
        />
      ) : null}
    </ContentLayout>
  );
}

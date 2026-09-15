/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use client";

/**
 * SOURCE OF TRUTH KEYWORDS: IdeasInbox, idea inbox, Ideas page, expand idea,
 *   draft it, handleDraftIdea, handleExpand, turn into post, mark used,
 *   postIdeas.list, ideaAngles.create
 *
 * WHAT:  The /dashboard/ideas surface: a quick-add box, then every idea the
 *        member has saved. Each idea can be Expanded into angles or Drafted in
 *        one click; Open in Create Post, Edit, Mark used and Delete sit in a menu.
 * WHY:   The inbox is a pipeline, not a list: capture, sharpen (Expand), write
 *        (Draft it). The two AI actions are buttons because they are the point of
 *        the page; the rest live in a menu so a row stays readable.
 *
 *        Draft it chains two calls, the content plan's "Draft this" precedent:
 *        `aiGeneration.create` owns the metered generation and
 *        `linkedinPosts.draft` owns the free save, so each cost stays on the
 *        resource that declares it.
 *
 *        Uses the global DataTable with SERVER-side search and filter, like the
 *        post library, so a match on page two is never reported missing.
 * WHERE: Rendered by the ideas page. RESOURCES.postIdeas.nav.href.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  CheckIcon,
  LightbulbIcon,
  Loader2Icon,
  MoreHorizontalIcon,
  PencilIcon,
  PenLineIcon,
  RotateCcwIcon,
  SparklesIcon,
  Trash2Icon,
} from "lucide-react";
import { toast } from "sonner";

import { permissions } from "@/lib/better-auth/permissions";
import { POST_IDEA_STATUS_LABELS } from "@/lib/config";
import { getErrorMessage } from "@/lib/errors";
import {
  AI_POST_TOPIC_MIN,
  DEFAULT_POST_GOAL,
  DEFAULT_POST_LENGTH,
  DEFAULT_POST_TONE,
  type PostIdeaStatus,
} from "@/lib/types";
import { buildDraftComposerHref, buildIdeaComposerHref } from "@/lib/utils";
import { trpc } from "@/trpc/react-provider";
import {
  useActiveOrganization,
  useActiveOrganizationId,
} from "@/hooks/use-active-organization";
import { FeatureGate } from "@/components/feature-gate";
import { ContentLayout } from "@/components/global/page-header";
import { DataTable, type DataTableColumn } from "@/components/global/data-table";
import { IdeaQuickAdd } from "@/components/global/idea-quick-add";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EditIdeaDialog } from "./edit-idea-dialog";
import { IdeaAnglesDialog } from "./idea-angles-dialog";
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
  const router = useRouter();

  const [page, setPage] = React.useState(1);
  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState<PostIdeaStatusFilter>(
    POST_IDEA_STATUS_FILTER_ALL,
  );
  /* Which row's quick action is in flight, so only that row shows a spinner. */
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  /* One draft at a time: a second click while one is writing is a no-op, never
   * a second paid generation. */
  const [draftingId, setDraftingId] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState<PostIdeaRow | null>(null);
  const [expanding, setExpanding] = React.useState<PostIdeaRow | null>(null);

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

  /* Errors are shown inside the angles dialog, next to Try again. */
  const expand = trpc.ideaAngles.create.useMutation({
    onSuccess: async () => {
      await utils.usage.invalidate();
    },
  });

  const generatePost = trpc.aiGeneration.create.useMutation();
  const saveDraft = trpc.linkedinPosts.draft.useMutation();
  /* Silent: marking the idea used is bookkeeping after a draft that succeeded. */
  const markUsed = trpc.postIdeas.update.useMutation();

  if (!organizationId) return null;

  const canUpdate = hasPermission(permissions.POST_IDEAS_UPDATE);
  const canDelete = hasPermission(permissions.POST_IDEAS_DELETE);
  const canExpand = hasPermission(permissions.IDEA_ANGLES_CREATE);
  const canDraft =
    hasPermission(permissions.AI_GENERATION_CREATE) &&
    hasPermission(permissions.LINKEDIN_POSTS_DRAFT);
  const rows = listQuery.data?.items ?? [];

  function handleExpand(row: PostIdeaRow) {
    setExpanding(row);
    expand.mutate({ ...orgInput, id: row.id });
  }

  function closeExpand() {
    setExpanding(null);
    expand.reset();
  }

  /**
   * SOURCE OF TRUTH KEYWORDS: handleDraftIdea
   *
   * WHAT:  Writes a post from the idea, saves it as a draft, and marks the idea
   *        used.
   * WHY:   Uses the composer's default tone, length and goal, the content plan
   *        precedent: the draft opens in the composer where every control
   *        exists, so guessing here is cheap to correct.
   */
  async function handleDraftIdea(row: PostIdeaRow) {
    if (draftingId !== null) return;
    if (row.text.trim().length < AI_POST_TOPIC_MIN) {
      toast.error(
        `Add a little more to this idea first (at least ${AI_POST_TOPIC_MIN} characters).`,
      );
      return;
    }

    setDraftingId(row.id);
    try {
      const generated = await generatePost.mutateAsync({
        ...orgInput,
        source: "topic",
        topic: row.text,
        tone: DEFAULT_POST_TONE,
        length: DEFAULT_POST_LENGTH,
        goal: DEFAULT_POST_GOAL,
      });
      const draft = await saveDraft.mutateAsync({
        ...orgInput,
        commentary: generated.commentary,
      });
      if (canUpdate && row.status !== USED) {
        await markUsed
          .mutateAsync({ ...orgInput, field: "status", id: row.id, status: "used" })
          .catch(() => undefined);
      }

      await Promise.all([
        utils.usage.invalidate(),
        utils.linkedinPosts.listLibrary.invalidate(),
        utils.postIdeas.list.invalidate(),
      ]);
      toast.success("Draft saved to your posts.", {
        action: {
          label: "Open draft",
          onClick: () => router.push(buildDraftComposerHref(draft.id)),
        },
      });
    } catch (error) {
      toast.error(
        getErrorMessage(error, "Could not draft that idea. Please try again."),
      );
    } finally {
      setDraftingId(null);
    }
  }

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
      description="Capture ideas, sharpen them into angles, and draft them in one click"
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
            const isUsed = row.status === USED;
            const isDrafting = draftingId === row.id;
            const isRowBusy = pendingId === row.id || isDrafting;
            return (
              <div className="flex items-center justify-end gap-1">
                {canExpand ? (
                  <FeatureGate resource="ideaAngles">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={isRowBusy || expand.isPending}
                      onClick={() => handleExpand(row)}
                    >
                      <LightbulbIcon className="size-4" />
                      Expand
                    </Button>
                  </FeatureGate>
                ) : null}
                {canDraft ? (
                  <FeatureGate resource="aiGeneration">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isRowBusy || draftingId !== null}
                      onClick={() => void handleDraftIdea(row)}
                    >
                      {isDrafting ? (
                        <Loader2Icon className="size-4 animate-spin" />
                      ) : (
                        <PenLineIcon className="size-4" />
                      )}
                      Draft it
                    </Button>
                  </FeatureGate>
                ) : null}

                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        disabled={isRowBusy}
                      />
                    }
                  >
                    {pendingId === row.id ? (
                      <Loader2Icon className="size-4 animate-spin" />
                    ) : (
                      <MoreHorizontalIcon className="size-4" />
                    )}
                    <span className="sr-only">More actions</span>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => router.push(buildIdeaComposerHref(row.id))}
                    >
                      <SparklesIcon className="mr-2 size-4" />
                      Open in Create Post
                    </DropdownMenuItem>
                    {canUpdate ? (
                      <>
                        <DropdownMenuItem onClick={() => setEditing(row)}>
                          <PencilIcon className="mr-2 size-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
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
                          {isUsed ? (
                            <RotateCcwIcon className="mr-2 size-4" />
                          ) : (
                            <CheckIcon className="mr-2 size-4" />
                          )}
                          {isUsed ? "Mark as new" : "Mark as used"}
                        </DropdownMenuItem>
                      </>
                    ) : null}
                    {canDelete ? (
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => {
                          setPendingId(row.id);
                          remove.mutate({ ...orgInput, id: row.id });
                        }}
                      >
                        <Trash2Icon className="mr-2 size-4" />
                        Delete
                      </DropdownMenuItem>
                    ) : null}
                  </DropdownMenuContent>
                </DropdownMenu>
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

      {expanding ? (
        <IdeaAnglesDialog
          key={expanding.id}
          idea={expanding}
          angles={
            expand.variables?.id === expanding.id
              ? expand.data?.angles
              : undefined
          }
          isLoading={expand.isPending}
          errorMessage={
            expand.error ? getErrorMessage(expand.error) : undefined
          }
          onRetry={() => expand.mutate({ ...orgInput, id: expanding.id })}
          onOpenChange={(open) => {
            if (!open) closeExpand();
          }}
        />
      ) : null}
    </ContentLayout>
  );
}

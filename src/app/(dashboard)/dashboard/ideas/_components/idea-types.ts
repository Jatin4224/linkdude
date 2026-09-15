/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: PostIdeaRow, POST_IDEA_STATUS_FILTERS,
 *   PostIdeaStatusFilter, POST_IDEA_STATUS_FILTER_ALL
 *
 * WHAT:  The exact row shape postIdeas.list returns, plus the status filter's
 *        option list.
 * WHY:   Derived with `inferRouterOutputs` rather than restated, so
 *        POST_IDEA_SELECT in post-ideas.service stays the single source of truth.
 *        Same pattern as post-types.ts, which is why it lives beside its
 *        components: it declares no new shape.
 * WHERE: ideas-inbox.tsx and edit-idea-dialog.tsx.
 */

import type { inferRouterOutputs } from "@trpc/server";

import type { AppRouter } from "@/trpc/routers/_app";
import { POST_IDEA_STATUSES, type PostIdeaStatus } from "@/lib/types";

export type PostIdeaRow =
  inferRouterOutputs<AppRouter>["postIdeas"]["list"]["items"][number];

/* The Select needs a concrete value for "no filter"; an empty string reads as
 * unset to Base UI's Select and would leave the trigger blank. */
export const POST_IDEA_STATUS_FILTER_ALL = "all";

export type PostIdeaStatusFilter =
  | typeof POST_IDEA_STATUS_FILTER_ALL
  | PostIdeaStatus;

export const POST_IDEA_STATUS_FILTERS: readonly PostIdeaStatusFilter[] = [
  POST_IDEA_STATUS_FILTER_ALL,
  ...POST_IDEA_STATUSES,
];

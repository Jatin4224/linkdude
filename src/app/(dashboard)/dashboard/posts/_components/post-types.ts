/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: PostLibraryRow, POST_STATUS_FILTERS,
 *   PostStatusFilter, POST_STATUS_FILTER_ALL
 *
 * WHAT:  The exact row shape linkedinPosts.listLibrary returns, plus the status
 *        filter's option list.
 * WHY:   The row type is derived with `inferRouterOutputs` rather than restated,
 *        so POST_SAFE_SELECT in linkedin.service stays the single source of truth
 *        for what a client can see. Same pattern as document-types.ts and
 *        calendar-types.ts.
 *
 *        The filter options are built FROM LINKEDIN_POST_STATUSES rather than
 *        hand-listed, so a new status appears in the dropdown automatically and
 *        cannot be silently unfilterable. Labels come from the same place the
 *        chips get theirs — see postStatusLabel.
 * WHERE: Imported by posts-library.tsx.
 */

import type { inferRouterOutputs } from "@trpc/server";

import type { AppRouter } from "@/trpc/routers/_app";
import { LINKEDIN_POST_STATUSES, type LinkedInPostStatus } from "@/lib/types";

export type PostLibraryRow =
  inferRouterOutputs<AppRouter>["linkedinPosts"]["listLibrary"]["items"][number];

/* The Select needs a concrete value for "no filter" — an empty string reads as
 * unset to Base UI's Select and would leave the trigger blank. */
export const POST_STATUS_FILTER_ALL = "all";

export type PostStatusFilter =
  | typeof POST_STATUS_FILTER_ALL
  | LinkedInPostStatus;

export const POST_STATUS_FILTERS: readonly PostStatusFilter[] = [
  POST_STATUS_FILTER_ALL,
  ...LINKEDIN_POST_STATUSES,
];

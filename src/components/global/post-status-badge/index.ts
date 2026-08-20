/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: PostStatusBadge, PostStatusBadgeProps,
 *   postStatusLabel, LinkedInPostStatus, post status chip
 *
 * WHAT:  Barrel for the LinkedIn post status chip and its label lookup.
 * WHY:   One import surface now that more than one route renders a post's state.
 * WHERE: The calendar grid and day-detail panel, the dashboard home's activity
 *        panel, and the post library's table and status filter.
 */

export { PostStatusBadge, postStatusLabel } from "./post-status-badge";
export type { PostStatusBadgeProps } from "./post-status-badge";

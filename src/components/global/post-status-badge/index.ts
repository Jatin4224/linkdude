/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: PostStatusBadge, PostStatusBadgeProps,
 *   LinkedInPostStatus, post status chip
 *
 * WHAT:  Barrel for the LinkedIn post status chip.
 * WHY:   One import surface now that more than one route renders a post's state.
 * WHERE: The calendar grid and day-detail panel, and the dashboard home's
 *        activity panel.
 */

export { PostStatusBadge } from "./post-status-badge";
export type { PostStatusBadgeProps } from "./post-status-badge";

/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: UsageSummary, QuickActions, ActivityPanel,
 *   IdeaInboxCard, dashboard home, dashboard widgets
 *
 * WHAT:  Barrel for the dashboard home page's panels.
 * WHY:   Route-local because these compose one page; page.tsx then reads as the
 *        order of the screen rather than a stack of import paths.
 * WHERE: src/app/(dashboard)/dashboard/page.tsx.
 */

export { UsageSummary } from "./usage-summary";
export { QuickActions } from "./quick-actions";
export { ActivityPanel } from "./activity-panel";
export { IdeaInboxCard } from "./idea-inbox-card";

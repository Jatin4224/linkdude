/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: DashboardHomePage, ContentLayout, UsageSummary,
 *   QuickActions, ActivityPanel, dashboard home
 *
 * WHAT:  The post-onboarding home — what's left of the plan, what to start, and
 *        what the queue looks like.
 * WHY:   Ordered by the questions a returning user actually arrives with: how
 *        much have I got left, what do I do now, and is anything going out. The
 *        quotas come first because they constrain the answer to the other two.
 *
 *        No entrance animation anywhere on this page, by design. This is the
 *        most-visited route in the app, and motion on a screen someone opens
 *        several times a day reads as latency rather than polish — the marketing
 *        surfaces keep the reveals, the dashboard keeps the speed. The shared
 *        card surface is the only thing carried across.
 * WHERE: Route /dashboard under the (dashboard) layout.
 */

import type { Metadata } from "next";
import { LayoutDashboardIcon } from "lucide-react";

import { ContentLayout } from "@/components/global/page-header";
import {
  ActivityPanel,
  QuickActions,
  UsageSummary,
} from "./_components";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default function DashboardHomePage() {
  return (
    <ContentLayout
      title="Dashboard"
      description="Your plan, your queue, and what to do next"
      icon={<LayoutDashboardIcon className="size-4" />}
    >
      <UsageSummary />
      <QuickActions />
      <ActivityPanel />
    </ContentLayout>
  );
}

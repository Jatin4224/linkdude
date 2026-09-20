/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: DashboardHomePage, ContentLayout, TechSurface,
 *   TechSection, UsageSummary, QuickActions, IdeaInboxCard, ActivityPanel,
 *   dashboard home, technical editorial
 *
 * WHAT:  The post-onboarding home — what's left of the plan, what to start, and
 *        what the queue looks like.
 * WHY:   Ordered by the questions a returning user actually arrives with: how
 *        much have I got left, what do I do now, and is anything going out. The
 *        quotas come first because they constrain the answer to the other two.
 *
 *        The three TechSections NAME that order rather than adding to it. Those
 *        three questions were always the structure of this page — the header's
 *        own subtitle says so in a sentence — but they were carried by four
 *        undifferentiated cards, so the page read as a pile rather than as an
 *        argument. Nothing was added to the screen except the words for what
 *        was already there.
 *
 *        No entrance animation anywhere on this page, by design. This is the
 *        most-visited route in the app, and motion on a screen someone opens
 *        several times a day reads as latency rather than polish — the marketing
 *        surfaces keep the reveals, the dashboard keeps the speed.
 * WHERE: Route /dashboard under the (dashboard) layout.
 */

import type { Metadata } from "next";
import { LayoutDashboardIcon } from "lucide-react";

import { ContentLayout } from "@/components/global/page-header";
import { TechSection, TechSurface } from "@/components/global/tech";
import {
  ActivityPanel,
  IdeaInboxCard,
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
      <TechSurface className="flex flex-col gap-12">
        <TechSection index="01" label="Plan" title="What's left">
          <UsageSummary />
        </TechSection>

        {/* Ideas sit INSIDE the start band rather than beside it: an idea is
            the smallest thing you can start, so it belongs with the other four
            entry points instead of forming a fourth section of its own. */}
        <TechSection index="02" label="Start" title="What to do next">
          <QuickActions />
          <IdeaInboxCard />
        </TechSection>

        <TechSection index="03" label="Queue" title="What's going out">
          <ActivityPanel />
        </TechSection>
      </TechSurface>
    </ContentLayout>
  );
}

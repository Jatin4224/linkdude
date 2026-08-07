/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: ContentCalendarPage
 *
 * WHAT:  /dashboard/calendar route — thin shell; ContentCalendar does the work.
 * WHY:   Reads the scheduler config HERE because isSchedulerConfigured() checks
 *        a server-only env var and would evaluate to false inside the client
 *        component, hiding scheduling on a correctly configured install.
 * WHERE: RESOURCES.contentCalendar.nav.href.
 */

import type { Metadata } from "next";

import { isSchedulerConfigured } from "@/lib/config";
import { ContentCalendar } from "./_components/content-calendar";

export const metadata: Metadata = {
  title: "Content Calendar",
};

export default function ContentCalendarPage() {
  return <ContentCalendar schedulingEnabled={isSchedulerConfigured()} />;
}

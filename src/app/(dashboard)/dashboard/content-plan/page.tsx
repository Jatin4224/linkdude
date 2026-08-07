/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: ContentPlanPage
 *
 * WHAT:  /dashboard/content-plan route — thin shell; ContentPlanChat does the
 *        work.
 * WHERE: RESOURCES.contentPlan.nav.href.
 */

import type { Metadata } from "next";

import { ContentPlanChat } from "./_components/content-plan-chat";

export const metadata: Metadata = {
  title: "Content Plan",
};

export default function ContentPlanPage() {
  return <ContentPlanChat />;
}

/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: IdeasPage, idea inbox route
 *
 * WHAT:  /dashboard/ideas route: a thin shell; IdeasInbox does the work.
 * WHERE: RESOURCES.postIdeas.nav.href.
 */

import type { Metadata } from "next";

import { IdeasInbox } from "./_components/ideas-inbox";

export const metadata: Metadata = {
  title: "Ideas",
};

export default function IdeasPage() {
  return <IdeasInbox />;
}

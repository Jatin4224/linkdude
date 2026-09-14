/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: JobsPage, Job Assist page
 *
 * WHAT:  /dashboard/jobs route — thin shell; JobAssistWorkspace does the work.
 * WHERE: RESOURCES.jobEmails.nav.href.
 */

import type { Metadata } from "next";

import { JobAssistWorkspace } from "./_components/job-assist-workspace";

export const metadata: Metadata = {
  title: "Job Assist",
};

export default function JobsPage() {
  return <JobAssistWorkspace />;
}

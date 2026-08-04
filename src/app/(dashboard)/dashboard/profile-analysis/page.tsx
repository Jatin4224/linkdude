/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: ProfileAnalysisPage
 *
 * WHAT:  /dashboard/profile-analysis route — thin shell; ProfileAnalyzer does
 *        the work.
 * WHERE: RESOURCES.profileAnalysis.nav.href.
 */

import type { Metadata } from "next";

import { ProfileAnalyzer } from "./_components/profile-analyzer";

export const metadata: Metadata = {
  title: "Profile Analysis",
};

export default function ProfileAnalysisPage() {
  return <ProfileAnalyzer />;
}

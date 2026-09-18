/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: StudioPage
 *
 * WHAT:  /dashboard/studio route — thin shell; StudioWorkspace does the work.
 * WHERE: RESOURCES.studio.nav.href.
 */

import type { Metadata } from "next";

import { StudioWorkspace } from "./_components";

export const metadata: Metadata = {
  title: "Studio",
};

export default function StudioPage() {
  return <StudioWorkspace />;
}

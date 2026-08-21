/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: MarketingLayout, MarketingNavbar, MarketingFooter,
 *   paper-scope, --gutter, public layout, paper design system, full bleed
 *
 * WHAT:  The shell every public page renders inside — the paper theme scope, the
 *        fixed header, the content, and the footer.
 * WHY:   A server component that reads no session and issues no tRPC call, which
 *        is what keeps "/" statically rendered and free of the auth-redirect
 *        behaviour that governs the app routes. Note that the ROOT layout still
 *        swaps the whole tree for the env SetupChecklist while a required
 *        variable is missing, so this page is invisible on a half-configured
 *        deployment — deliberate, since a landing page whose CTA leads to a dead
 *        auth flow is a worse failure than an honest checklist.
 *
 *        `paper-scope` is the single most structural thing here. The app is
 *        forced dark everywhere else; this class is what flips the whole subtree
 *        to the paper palette, pins radius to 0 and shadows to none, sets Archivo
 *        as the inherited family, and publishes --gutter for every section below
 *        to measure from. It lives at the LAYOUT level so no section can opt out
 *        of the design system by accident.
 *
 *        There is no ruled max-width column any more, and no decorative
 *        atmosphere layer. The bands are FULL BLEED by design — the blue
 *        statement and the dark how-it-works run edge to edge, and the sections
 *        that do want a measured column carry their own max-width. A wrapper
 *        with rails would have to be fought by three of the seven sections.
 * WHERE: Wraps src/app/(marketing)/page.tsx.
 */

import * as React from "react";

import {
  MarketingFooter,
  MarketingNavbar,
} from "@/components/global/marketing";

export default function MarketingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="paper-scope relative isolate flex min-h-svh flex-col">
      <MarketingNavbar />

      <main className="flex-1">{children}</main>

      <MarketingFooter />
    </div>
  );
}

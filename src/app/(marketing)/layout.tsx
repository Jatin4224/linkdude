/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: MarketingLayout, MarketingNavbar, MarketingFooter,
 *   public layout, landing shell, noscript reveal, data-reveal
 *
 * WHAT:  The shell every public page renders inside — navbar, content, footer.
 * WHY:   A server component that reads no session and issues no tRPC call, which
 *        is what keeps "/" statically rendered and free of the auth-redirect
 *        behaviour that governs the app routes. Note that the ROOT layout still
 *        swaps the whole tree for the env SetupChecklist while a required
 *        variable is missing, so this page is invisible on a half-configured
 *        deployment — deliberate, since a landing page whose CTA leads to a dead
 *        auth flow is a worse failure than an honest checklist.
 * WHERE: Wraps src/app/(marketing)/page.tsx.
 */

import * as React from "react";

import { MarketingFooter, MarketingNavbar } from "@/components/global/marketing";

export default function MarketingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="relative isolate flex min-h-svh flex-col">
      {/* The copy is in the server HTML either way — Reveal only animates
          opacity and offset — so this is all it takes to make a JS-disabled
          visit render the finished page. */}
      <noscript>
        <style>{`[data-reveal]{opacity:1 !important;transform:none !important}`}</style>
      </noscript>

      <MarketingNavbar />
      <main className="flex-1">{children}</main>
      <MarketingFooter />
    </div>
  );
}

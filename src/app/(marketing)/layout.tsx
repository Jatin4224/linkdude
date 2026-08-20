/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: MarketingLayout, MarketingNavbar, MarketingFooter,
 *   PageAtmosphere, landing-shell, border-rail, ruled column, public layout,
 *   landing shell, noscript reveal, data-reveal
 *
 * WHAT:  The shell every public page renders inside — the decorative layers, the
 *        sticky header, the ruled 1240px column holding the content and footer.
 * WHY:   A server component that reads no session and issues no tRPC call, which
 *        is what keeps "/" statically rendered and free of the auth-redirect
 *        behaviour that governs the app routes. Note that the ROOT layout still
 *        swaps the whole tree for the env SetupChecklist while a required
 *        variable is missing, so this page is invisible on a half-configured
 *        deployment — deliberate, since a landing page whose CTA leads to a dead
 *        auth flow is a worse failure than an honest checklist.
 *
 *        The ruled column is the single most structural thing here. The 1240px
 *        max-width with a hairline down each edge is what makes the page read as
 *        one designed document rather than a stack of loose bands, and it lives
 *        at the LAYOUT level so no section can opt out of it by accident. The
 *        header sits outside it because its blurred material is full-bleed; its
 *        inner row shares the same max-width, so the rails still line up.
 * WHERE: Wraps src/app/(marketing)/page.tsx.
 */

import * as React from "react";

import {
  MarketingFooter,
  MarketingNavbar,
  PageAtmosphere,
} from "@/components/global/marketing";

export default function MarketingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    /* landing-shell publishes --gutter and --section-y to everything below, so
       the header row, every section and the bleeding demo frame all measure from
       one declaration. */
    <div className="landing-shell relative isolate flex min-h-svh flex-col">
      {/* Belt and braces with the CSS failsafe in globals.css: that one covers
          JS enabled but never arriving, this one covers JS switched off. The
          copy is in the server HTML either way — Reveal only animates opacity
          and offset — so this is all it takes to make a JS-disabled visit render
          the finished page. */}
      <noscript>
        <style>{`[data-reveal]{opacity:1 !important;transform:none !important}`}</style>
      </noscript>

      <PageAtmosphere />

      <MarketingNavbar />

      <div className="mx-auto flex w-full max-w-[1240px] flex-1 flex-col border-x border-rail">
        <main className="flex-1">{children}</main>
        <MarketingFooter />
      </div>
    </div>
  );
}

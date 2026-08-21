/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: LandingPage, metadata, APP_NAME, StickyHero,
 *   BlueStatement, CapabilityTicker, FreePlanCaps, ComposerShowcase,
 *   HowItWorks, FinalCta, section order, paper design
 *
 * WHAT:  The public landing page at "/" — the running order of the pitch.
 * WHY:   A static server component. It reads no session, calls no tRPC procedure
 *        and touches neither headers() nor cookies(), so Next prerenders it and
 *        an anonymous visitor never triggers the AuthRedirectObserver. That is
 *        the whole reason "/" no longer forwards anyone: the route that used to
 *        live here was an auth probe, and signed-in users now reach the
 *        dashboard directly from the auth form's callback instead.
 *
 *        Seven bands, in the order a sceptical reader asks their questions: what
 *        is this about (the sticky hero's two beats), what are you building
 *        (the blue statement), what can it do (the ticker), what does it cost to
 *        try (the free caps), what does it actually look like (the composer),
 *        how does it work (the dark band), and where do I start (the closing
 *        CTA). Only StickyHero is a client component; everything after it is
 *        static HTML.
 * WHERE: Rendered inside src/app/(marketing)/layout.tsx.
 */

import type { Metadata } from "next";

import { APP_NAME } from "@/lib/config";
import {
  BlueStatement,
  CapabilityTicker,
  ComposerShowcase,
  FinalCta,
  FreePlanCaps,
  HowItWorks,
  StickyHero,
} from "./_components";

const TITLE = `${APP_NAME} — AI LinkedIn posts, scheduled and on-brand`;

const DESCRIPTION =
  "Turn a topic into a LinkedIn post worth reading, schedule it straight to LinkedIn, and fix the profile it lands on. Free tier, no card required.";

/**
 * SOURCE OF TRUTH KEYWORDS: metadata, opengraph-image, og:image, twitter:image,
 *   link preview, openGraph merge
 *
 * WHAT:  The page's title, description and canonical URL.
 * WHY:   It deliberately declares NO `openGraph` / `twitter` object, and that
 *        absence is load-bearing. A route that declares an `openGraph` block
 *        REPLACES the inherited one wholesale — including the images Next
 *        derives from src/app/opengraph-image.tsx — so the previous version of
 *        this file, which set og:title and og:description by hand, silently
 *        stripped the social card off the one page most likely to be shared.
 *        Verified by comparison: /sign-in declares no openGraph block and emits
 *        the full og:image set; "/" declared one and emitted none.
 *
 *        Left to itself Next builds og:title and og:description from the title
 *        and description below, so nothing is lost by not repeating them, and
 *        the app-wide og:type / og:site_name live in the root layout where they
 *        apply to every route rather than just this one.
 *
 *        `absolute` bypasses the root layout's "%s — <app>" template: a homepage
 *        titled "Tagline — linkdude" reads as a subpage of itself.
 */
export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: "/" },
};

export default function LandingPage() {
  return (
    <>
      <StickyHero />
      <BlueStatement />
      <CapabilityTicker />
      <FreePlanCaps />
      <ComposerShowcase />
      <HowItWorks />
      <FinalCta />
    </>
  );
}

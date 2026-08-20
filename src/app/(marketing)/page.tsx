/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: LandingPage, metadata, APP_NAME, LandingHero,
 *   CapabilityTicker, FreeTierCounters, LoopSection, InsideBento,
 *   PricingSection, FaqSection, FinalCta
 *
 * WHAT:  The public landing page at "/" — the running order of the pitch.
 * WHY:   A static server component. It reads no session, calls no tRPC procedure
 *        and touches neither headers() nor cookies(), so Next prerenders it and
 *        an anonymous visitor never triggers the AuthRedirectObserver. That is
 *        the whole reason "/" no longer forwards anyone: the route that used to
 *        live here was an auth probe, and signed-in users now reach the
 *        dashboard directly from the auth form's callback instead.
 *
 *        Six sections, in the order a sceptical reader asks their questions:
 *        what is it (hero, with the product on screen rather than described),
 *        what can it do (ticker), what does it cost to try (counters), how does
 *        it work (the loop), what is actually in it (the bento), what does it
 *        cost (pricing), and what am I still worried about (FAQ).
 * WHERE: Rendered inside src/app/(marketing)/layout.tsx.
 */

import type { Metadata } from "next";

import { APP_NAME } from "@/lib/config";
import {
  CapabilityTicker,
  FaqSection,
  FinalCta,
  FreeTierCounters,
  InsideBento,
  LandingHero,
  LoopSection,
  PricingSection,
} from "./_components";

const TITLE = `${APP_NAME} — AI LinkedIn posts, scheduled and on-brand`;

const DESCRIPTION =
  "Turn a topic into a LinkedIn post worth reading, schedule it straight to LinkedIn, and fix the profile it lands on. Free tier, no card required.";

export const metadata: Metadata = {
  /* `absolute` bypasses the root layout's "%s — <app>" template: a homepage
     titled "Tagline — linkdude" reads as a subpage of itself. */
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: APP_NAME,
    title: TITLE,
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function LandingPage() {
  return (
    <>
      <LandingHero />
      <CapabilityTicker />
      <FreeTierCounters />
      <LoopSection />
      <InsideBento />
      <PricingSection />
      <FaqSection />
      <FinalCta />
    </>
  );
}

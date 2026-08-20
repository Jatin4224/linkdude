/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: FinalCta, MARKETING_CLOSING, LandingCtaPair,
 *   AUTH_ROUTES, BRAND_MASCOT, formatResourceAllowance, mask-vignette-lg,
 *   DisplayHeading, closing band
 *
 * WHAT:  The closing band — the mascot, one restated promise, and the last CTA.
 * WHY:   A reader who scrolled this far has already been past pricing; the job
 *        here is to remove the last excuse, which is why the free-tier line
 *        repeats under the buttons rather than making them scroll back up for
 *        it. Those numbers are read from RESOURCES, not typed — this is the
 *        page's final promise and the one a reader is most likely to hold us to.
 * WHERE: src/app/(marketing)/page.tsx, last section before the footer.
 */

import Image from "next/image";

import BRAND_MASCOT from "@/app/assets/images/linkdin-dude.png";
import { AUTH_ROUTES, MARKETING_CLOSING } from "@/lib/config";
import { formatResourceAllowance } from "@/lib/resources";
import { MarketingSection } from "@/components/global/marketing";
import { Reveal } from "@/components/global/reveal";
import { DisplayHeading } from "./display-heading";
import { LandingCtaPair } from "./landing-cta";

export function FinalCta() {
  return (
    <MarketingSection
      flush
      spacingClassName="py-[clamp(72px,9vw,124px)]"
      className="overflow-hidden"
    >
      {/* Rises from below the fold rather than sitting behind the heading, so
          the page closes on a glow instead of a hard edge against the footer. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-80 left-1/2 -z-10 h-[620px] w-[1000px] -translate-x-1/2 bg-[radial-gradient(44%_44%_at_50%_50%,color-mix(in_oklch,var(--acid)_14%,transparent)_0%,transparent_70%)]"
      />

      <div className="flex flex-col items-center gap-7 text-center">
        <Reveal>
          <Image
            src={BRAND_MASCOT}
            alt=""
            width={232}
            height={232}
            aria-hidden="true"
            className="mask-vignette-lg h-auto w-[clamp(88px,9vw,116px)]"
          />
        </Reveal>

        <Reveal delay={70}>
          <DisplayHeading size="closing" heading={MARKETING_CLOSING.heading} />
        </Reveal>

        <Reveal delay={140}>
          <p className="max-w-[34em] text-pretty text-base leading-[1.65] text-muted-foreground">
            {MARKETING_CLOSING.body}
          </p>
        </Reveal>

        <Reveal delay={210} className="mt-2">
          <LandingCtaPair
            secondaryLabel="Sign in"
            secondaryHref={AUTH_ROUTES.signIn}
            className="justify-center"
          />
        </Reveal>

        <Reveal delay={280}>
          <p className="font-mono text-[11.5px] text-dim">
            {formatResourceAllowance("linkedinPosts", "free")} and{" "}
            {formatResourceAllowance("aiGeneration", "free")} a month, free. No
            card, no trial timer.
          </p>
        </Reveal>
      </div>
    </MarketingSection>
  );
}

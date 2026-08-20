/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: LandingHero, MARKETING_HERO, DisplayHeading,
 *   LandingCtaPair, AppDemo, bg-dot-grid, animate-sheen, animate-pulse-dot,
 *   Reveal, hero, eyebrow pill
 *
 * WHAT:  The first screen — eyebrow, the display headline, the subhead, the CTA
 *        pair, and the live app demo bleeding off the bottom of the section.
 * WHY:   A server component; the only client code it pulls in is the demo and
 *        the Reveal wrappers, so the copy above the fold is in the server HTML
 *        and is not waiting on hydration to exist. The demo sits directly under
 *        the headline rather than beside it because the claim and the proof of
 *        the claim should be read in that order, and because a full-width frame
 *        is the only way to show three panels of the app at once.
 * WHERE: src/app/(marketing)/page.tsx.
 */

import { MARKETING_HERO, MARKETING_SECTION_IDS } from "@/lib/config";
import { MarketingSection } from "@/components/global/marketing";
import { Reveal } from "@/components/global/reveal";
import { AppDemo } from "./app-demo";
import { DisplayHeading } from "./display-heading";
import { LandingCtaPair } from "./landing-cta";

export function LandingHero() {
  return (
    <MarketingSection
      id={MARKETING_SECTION_IDS.top}
      spacingClassName="pb-0 pt-[clamp(48px,7vw,92px)]"
      className="overflow-hidden"
    >
      {/* Fades out well before the headline sits on it — a dot grid behind
          display type at this size reads as moiré, not as texture. */}
      <div
        aria-hidden="true"
        className="bg-dot-grid pointer-events-none absolute inset-0 -z-10 opacity-50"
      />

      <div className="flex flex-col items-center text-center">
        <Reveal>
          <p className="relative inline-flex items-center gap-2 overflow-hidden rounded-full border border-acid-soft bg-[color-mix(in_oklch,var(--acid-soft)_34%,transparent)] px-[15px] py-1.5 font-mono text-[11px] uppercase tracking-[0.1em] text-acid">
            <span
              aria-hidden="true"
              className="animate-pulse-dot size-[5px] rounded-full bg-acid"
            />
            {MARKETING_HERO.eyebrow}
            {/* One sheen pass every few seconds, then a long pause. Constant
                motion at the edge of vision is noise; an occasional pass reads
                as light moving across a surface. */}
            <span
              aria-hidden="true"
              className="animate-sheen pointer-events-none absolute inset-y-0 -left-full w-1/2 bg-[linear-gradient(to_right,transparent,color-mix(in_oklch,var(--acid)_26%,transparent),transparent)]"
            />
          </p>
        </Reveal>

        <Reveal delay={70} className="mt-7 flex flex-col items-center">
          <DisplayHeading
            as="h1"
            size="hero"
            heading={MARKETING_HERO.heading}
          />
        </Reveal>

        <Reveal delay={140} className="mt-7">
          <p className="max-w-[32em] text-pretty text-[clamp(16px,1.4vw,19px)] leading-[1.62] text-muted-foreground">
            {MARKETING_HERO.subhead}
          </p>
        </Reveal>

        <Reveal delay={210} className="mt-9">
          <LandingCtaPair
            secondaryLabel={MARKETING_HERO.secondaryCta}
            secondaryHref={`#${MARKETING_SECTION_IDS.loop}`}
            className="justify-center"
          />
        </Reveal>

        <Reveal delay={280} className="mt-6">
          <p className="font-mono text-[12px] tracking-[0.06em] text-dim">
            {MARKETING_HERO.reassurance}
          </p>
        </Reveal>
      </div>

      {/* Not wrapped in Reveal: the demo runs its own entrance and its own
          visibility observer, and stacking a translate on top of a parallax
          transform on the same subtree fights for the same property. */}
      <AppDemo />
    </MarketingSection>
  );
}

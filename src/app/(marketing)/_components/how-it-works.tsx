/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: HowItWorks, MARKETING_STEPS, MarketingSection,
 *   Reveal, onboarding steps, connector hairline
 *
 * WHAT:  The three-step path from signing up to a post going out.
 * WHY:   The objection this answers is "how much work is this going to be" —
 *        three steps, stated plainly, is the answer. The connector is a masked
 *        hairline behind the numbers rather than a border on each cell, so it
 *        vanishes cleanly at the ends instead of running into the gutters.
 * WHERE: src/app/(marketing)/page.tsx.
 */

import { MARKETING_SECTION_IDS, MARKETING_STEPS } from "@/lib/config";
import { MarketingSection } from "@/components/global/marketing";
import { Reveal } from "@/components/global/reveal";

export function HowItWorks() {
  return (
    <MarketingSection
      id={MARKETING_SECTION_IDS.how}
      eyebrow="How it works"
      title="Connected in a minute. Posting the same day."
    >
      <div className="relative">
        <div
          aria-hidden="true"
          className="absolute inset-x-[16%] top-6 -z-10 hidden h-px bg-[linear-gradient(to_right,transparent,var(--border),transparent)] md:block"
        />
        <div className="grid gap-10 md:grid-cols-3">
          {MARKETING_STEPS.map((step, index) => (
            <Reveal
              key={step.title}
              delay={index * 110}
              className="flex flex-col items-center gap-3 text-center"
            >
              <span className="flex size-12 items-center justify-center rounded-full border border-brand-border bg-brand-soft font-semibold tabular-nums text-brand-soft-foreground">
                {index + 1}
              </span>
              <h3 className="font-semibold">{step.title}</h3>
              <p className="max-w-xs text-sm text-muted-foreground">
                {step.body}
              </p>
            </Reveal>
          ))}
        </div>
      </div>
    </MarketingSection>
  );
}

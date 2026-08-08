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
import { StepConnector } from "./step-connector";

export function HowItWorks() {
  return (
    <MarketingSection
      id={MARKETING_SECTION_IDS.how}
      eyebrow="How it works"
      title="Connected in a minute. Posting the same day."
    >
      {/* `isolate` creates the stacking context the layers below sit in. Without
          it the connector's z-0 competes with the page background and simply
          disappears behind it. */}
      <div className="relative isolate">
        {/* Wrapped in its own Reveal purely so the path's draw-on is keyed to
            `data-reveal="shown"` — the line draws when the steps arrive, not
            while the section is still below the fold. Reveal carries the
            positioning so the SVG itself stays a plain, sizeable box the
            observer can actually measure. */}
        {/* top-3, not top-6: the step circles are size-12 so their centre line
            is 24px down, and this box is 24px tall with the path across its
            middle — so it has to start 12px up to land the line on the centre
            rather than on the circles' lower edge. */}
        <Reveal className="pointer-events-none absolute inset-x-[16%] top-3 z-0 hidden md:block">
          <StepConnector />
        </Reveal>
        <div className="relative z-10 grid gap-10 md:grid-cols-3">
          {MARKETING_STEPS.map((step, index) => (
            <Reveal
              key={step.title}
              delay={index * 70}
              className="flex flex-col items-center gap-3 text-center"
            >
              {/* Opaque background, not the translucent brand-soft: the charge
                  passes behind these and should disappear under them, the way a
                  wire disappears behind a terminal. */}
              <span className="relative flex size-12 items-center justify-center rounded-full border border-brand-border bg-background font-semibold tabular-nums text-brand-soft-foreground shadow-[0_0_0_6px_var(--background)]">
                <span
                  aria-hidden="true"
                  className="absolute inset-0 rounded-full bg-brand-soft"
                />
                <span className="relative">{index + 1}</span>
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

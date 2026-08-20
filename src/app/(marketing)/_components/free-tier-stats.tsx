/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: FreeTierStats, MARKETING_FREE_TIER_RESOURCES,
 *   getRawResourceLimit, formatResourceLimit, getResourceDefinition, CountUp,
 *   free plan, quota band
 *
 * WHAT:  A slim band showing what the free plan actually includes, in numbers
 *        that count up the first time the band scrolls into view.
 * WHY:   Placed immediately before pricing so the reader reaches the plan cards
 *        already knowing they can start at zero. Both the number and its label
 *        are read from RESOURCES, so this band cannot advertise an allowance the
 *        gate would refuse. A cap of 'unlimited' has no number to count, so it
 *        falls back to the formatted text.
 * WHERE: src/app/(marketing)/page.tsx.
 */

import { MARKETING_FREE_TIER_RESOURCES } from "@/lib/config";
import {
  formatResourceLimit,
  getRawResourceLimit,
  getResourceDefinition,
} from "@/lib/resources";
import { MarketingSection } from "@/components/global/marketing";
import { CountUp } from "@/components/global/count-up";

export function FreeTierStats() {
  return (
    <MarketingSection bare spacingClassName="py-0">
      <div className="relative overflow-hidden border-y bg-card/30">
        {/* A hairline of brand light along the top edge — the cheapest way to
            stop a full-width band reading as a plain grey rule. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(to_right,transparent,var(--brand),transparent)] opacity-70"
        />

        {/* 2 / 3 / 6 — every breakpoint divides the six tiles evenly, so no row
            ever strands a lone number. `md:divide-x` only reads correctly while
            the tiles are on one line, hence it arrives with the 6-up column. */}
        <div className="mx-auto grid w-full max-w-6xl grid-cols-2 gap-y-8 px-6 py-12 md:grid-cols-3 md:gap-y-10 lg:grid-cols-6 lg:gap-y-0 lg:divide-x">
          {MARKETING_FREE_TIER_RESOURCES.map((resource) => {
            const raw = getRawResourceLimit(resource, "free");
            return (
              <div
                key={resource}
                className="flex flex-col items-center gap-1 text-center"
              >
                <p className="text-3xl font-semibold tabular-nums">
                  <CountUp
                    value={raw === "unlimited" ? 0 : raw}
                    {...(raw === "unlimited"
                      ? { fallback: formatResourceLimit(resource, "free") }
                      : {})}
                  />
                </p>
                <p className="text-sm text-muted-foreground">
                  {getResourceDefinition(resource).name}
                </p>
              </div>
            );
          })}
        </div>
        <p className="pb-10 text-center text-xs text-muted-foreground">
          What you get before you ever enter a card.
        </p>
      </div>
    </MarketingSection>
  );
}

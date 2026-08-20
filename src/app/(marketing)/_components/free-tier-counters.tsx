/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: FreeTierCounters, MARKETING_FREE_TIER_RESOURCES,
 *   getRawResourceLimit, formatResourceLimit, getResourceDefinition, CountUp,
 *   free plan, counter row, quota band
 *
 * WHAT:  A row of the free plan's real allowances, in figures that count up the
 *        first time the row scrolls into view.
 * WHY:   Placed high on the page, before any price is mentioned, so the reader
 *        reaches pricing already knowing they can start at zero. Both the number
 *        and its label are read from RESOURCES, so this row cannot advertise an
 *        allowance the gate would refuse — and a cap edited in the registry
 *        updates the marketing claim in the same commit. A cap of 'unlimited'
 *        has no number to count, so it falls back to the formatted text.
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
import { cn } from "@/lib/utils";

export function FreeTierCounters() {
  return (
    <MarketingSection bleed spacingClassName="py-0">
      <div className="grid grid-cols-2 sm:grid-cols-[repeat(auto-fit,minmax(150px,1fr))]">
        {MARKETING_FREE_TIER_RESOURCES.map((resource, index) => {
          const raw = getRawResourceLimit(resource, "free");
          return (
            <div
              key={resource}
              className={cn(
                "flex flex-col items-center gap-3 px-3 py-[clamp(26px,3.4vw,40px)] text-center",
                /* A left rule on every cell but the first turns four figures
                   into one ruled row rather than four floating numbers. */
                index > 0 && "border-l border-rail",
              )}
            >
              <p
                className={cn(
                  "text-[clamp(40px,5.4vw,74px)] font-semibold leading-[0.86] tracking-[-0.06em] tabular-nums",
                  /* Only the first figure is accented — it is the one that
                     answers "can I start for free", and four accents would
                     answer nothing. */
                  index === 0 ? "text-acid" : "text-foreground",
                )}
              >
                <CountUp
                  value={raw === "unlimited" ? 0 : raw}
                  {...(raw === "unlimited"
                    ? { fallback: formatResourceLimit(resource, "free") }
                    : {})}
                />
              </p>
              <p className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-dim">
                {getResourceDefinition(resource).name}
              </p>
            </div>
          );
        })}
      </div>

      <p className="border-t border-rail px-(--gutter) py-[13px] text-center font-mono text-[11px] uppercase tracking-[0.06em] text-dim">
        Every month, on the free plan, before you ever enter a card.
      </p>
    </MarketingSection>
  );
}

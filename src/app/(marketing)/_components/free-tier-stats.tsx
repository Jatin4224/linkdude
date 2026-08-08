/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: FreeTierStats, MARKETING_FREE_TIER_RESOURCES,
 *   formatResourceLimit, getResourceDefinition, free plan, quota band
 *
 * WHAT:  A slim band showing what the free plan actually includes, in numbers.
 * WHY:   Placed immediately before pricing so the reader reaches the plan cards
 *        already knowing they can start at zero. Both the number and its label
 *        are read from RESOURCES, so this band cannot advertise an allowance the
 *        gate would refuse.
 * WHERE: src/app/(marketing)/page.tsx.
 */

import { MARKETING_FREE_TIER_RESOURCES } from "@/lib/config";
import { formatResourceLimit, getResourceDefinition } from "@/lib/resources";
import { MarketingSection } from "@/components/global/marketing";

export function FreeTierStats() {
  return (
    <MarketingSection bare spacingClassName="py-0">
      <div className="border-y bg-card/30">
        <div className="mx-auto grid w-full max-w-6xl grid-cols-2 gap-y-8 px-6 py-12 md:grid-cols-4 md:divide-x md:gap-y-0">
          {MARKETING_FREE_TIER_RESOURCES.map((resource) => (
            <div
              key={resource}
              className="flex flex-col items-center gap-1 text-center"
            >
              <p className="text-3xl font-semibold tabular-nums">
                {formatResourceLimit(resource, "free")}
              </p>
              <p className="text-sm text-muted-foreground">
                {getResourceDefinition(resource).name}
              </p>
            </div>
          ))}
        </div>
        <p className="pb-10 text-center text-xs text-muted-foreground">
          What you get before you ever enter a card.
        </p>
      </div>
    </MarketingSection>
  );
}

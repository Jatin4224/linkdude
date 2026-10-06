/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: FreePlanCaps, MARKETING_FREE_CAPS,
 *   getRawResourceLimit, formatResourceLimit, getResourceDefinition, CountUp,
 *   PaperLabel, free plan, quota band, ruled row, caps row
 *
 * WHAT:  A ruled row of the free plan's real allowances, in Archivo Black
 *        figures that count up the first time the row scrolls into view.
 * WHY:   Placed straight after the product's loudest claim, so a reader reaches
 *        the product shot already knowing they can start at zero. Both the
 *        number and its label are read from RESOURCES, so this row cannot
 *        advertise an allowance the gate would refuse — and a cap edited in the
 *        registry updates the marketing claim in the same commit. A cap of
 *        'unlimited' has no number to count, so it falls back to the formatted
 *        text.
 *
 *        One 1px ink box divided by 1px ink rules, with the last cell's rule
 *        dropped: that is the whole treatment, and it is what makes four figures
 *        read as one measured statement rather than four floating numbers. The
 *        grid is `auto-fit` so the cells reflow to two-up on a phone without the
 *        rules ever ending up on the wrong edges.
 * WHERE: src/app/(marketing)/page.tsx, between the ticker and the dark band.
 */

import { MARKETING_FREE_CAPS, MARKETING_SECTION_IDS } from "@/lib/config";
import {
  formatResourceLimit,
  getRawResourceLimit,
  getResourceDefinition,
} from "@/lib/resources";
import { CountUp } from "@/components/global/count-up";
import { PaperLabel, PaperReveal } from "@/components/global/paper";
import { cn } from "@/lib/utils";

export function FreePlanCaps() {
  const caps = MARKETING_FREE_CAPS.resources;

  return (
    <section
      id={MARKETING_SECTION_IDS.free}
      className="relative z-6 bg-paper px-[clamp(16px,3vw,34px)] pt-[clamp(44px,6vw,72px)] text-ink"
    >
      <PaperReveal
        distance={18}
        className="mx-auto flex w-full max-w-[1240px] flex-col gap-3.5"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <PaperLabel size="band">{MARKETING_FREE_CAPS.label}</PaperLabel>
          <PaperLabel size="band" tone="grey">
            {MARKETING_FREE_CAPS.note}
          </PaperLabel>
        </div>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] border border-ink">
          {caps.map((resource, index) => {
            const raw = getRawResourceLimit(resource, "free");
            return (
              <div
                key={resource}
                className={cn(
                  "flex flex-col gap-2 px-[clamp(14px,1.8vw,22px)] py-[clamp(16px,2vw,24px)]",
                  index < caps.length - 1 && "border-r border-ink",
                )}
              >
                <span className="font-paper-display text-[clamp(34px,4vw,52px)] leading-[0.86] tracking-[-0.05em] tabular-nums">
                  <CountUp
                    value={raw === "unlimited" ? 0 : raw}
                    {...(raw === "unlimited"
                      ? { fallback: formatResourceLimit(resource, "free") }
                      : {})}
                  />
                </span>
                <PaperLabel tone="grey">
                  {getResourceDefinition(resource).name}
                </PaperLabel>
              </div>
            );
          })}
        </div>
      </PaperReveal>
    </section>
  );
}

/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: CapabilityTicker, RESOURCE_ENTRIES, animate-ticker,
 *   marquee-scroll, capability band, ticker, prefers-reduced-motion
 *
 * WHAT:  A thin scrolling band of the workspace capabilities a plan can grant,
 *        read straight off the resource registry.
 * WHY:   This is the slot a landing page usually fills with customer logos. We
 *        have no customers to name, and inventing them would be a lie printed on
 *        the homepage — so the band shows what the product actually does
 *        instead. Deriving it from RESOURCE_ENTRIES means a new gated feature
 *        joins the band the day it ships, and one that is removed leaves it the
 *        same day.
 * WHERE: src/app/(marketing)/page.tsx, directly under the hero.
 */

import { RESOURCE_ENTRIES } from "@/lib/resources";
import { MarketingSection } from "@/components/global/marketing";
import { cn } from "@/lib/utils";

/* Only plan-gated surfaces: a resource with neither a quota nor a flag is
 * internal plumbing, not something to advertise. */
const CAPABILITIES = RESOURCE_ENTRIES.filter(
  ([, def]) => def.limit ?? def.flag,
).map(([, def]) => def.name);

function TickerTrack({ hidden }: { hidden: boolean }) {
  return (
    <ul
      aria-hidden={hidden || undefined}
      className="flex shrink-0 items-center gap-[30px] pr-[30px]"
    >
      {CAPABILITIES.map((name, index) => (
        <li
          key={name}
          className={cn(
            "whitespace-nowrap font-mono text-[11.5px] uppercase tracking-[0.13em]",
            /* Every third item takes the accent. A single-colour ticker reads as
               one long string of text; the rhythm is what makes it scan as a
               list of separate things. */
            index % 3 === 2 ? "text-acid-dim" : "text-dim",
          )}
        >
          {name}
        </li>
      ))}
    </ul>
  );
}

export function CapabilityTicker() {
  return (
    <MarketingSection
      bleed
      spacingClassName="py-3.5"
      className="overflow-hidden bg-[color-mix(in_oklch,var(--card)_24%,transparent)]"
    >
      {/* Two identical tracks translating -50% is what makes the loop seamless;
          the second is hidden from assistive tech so the list isn't announced
          twice. */}
      <div className="animate-ticker flex w-max">
        <TickerTrack hidden={false} />
        <TickerTrack hidden />
      </div>
    </MarketingSection>
  );
}

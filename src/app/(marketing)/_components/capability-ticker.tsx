/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: CapabilityTicker, RESOURCE_ENTRIES,
 *   animate-paper-ticker, marquee-scroll, PaperLabel, ticker band, marquee,
 *   prefers-reduced-motion
 *
 * WHAT:  A thin scrolling band of the workspace capabilities a plan can grant,
 *        read straight off the resource registry, running along the bottom edge
 *        of the blue band.
 * WHY:   This is the slot a landing page usually fills with customer logos. We
 *        have no customers to name, and inventing them would be a lie printed on
 *        the homepage — so the band shows what the product actually does
 *        instead. Deriving it from RESOURCE_ENTRIES means a new gated feature
 *        joins the band the day it ships, and one that is removed leaves it the
 *        same day; nothing here is a claim anybody has to remember to update.
 *
 *        Two identical tracks translating -50% is what makes the loop seamless.
 *        The second is aria-hidden so the list is not announced twice, and the
 *        rules above and below it are white at 25% rather than a second colour,
 *        because the band is part of the blue section, not a divider between two.
 * WHERE: src/app/(marketing)/page.tsx, directly under BlueStatement.
 */

import { RESOURCE_ENTRIES } from "@/lib/resources";
import { PaperLabel } from "@/components/global/paper";

/* Only plan-gated surfaces: a resource with neither a quota nor a flag is
 * internal plumbing, not something to advertise.
 *
 * Deduped by NAME, not by key: `carousels` and `carousel` are two resources —
 * the monthly allowance and the document it renders — but they are one
 * capability to a reader, and the registry gives both the same display name, so
 * without this the band printed "CAROUSELS CAROUSELS" back to back. */
const CAPABILITIES = [
  ...new Set(
    RESOURCE_ENTRIES.filter(([, def]) => def.limit ?? def.flag).map(
      ([, def]) => def.name,
    ),
  ),
];

function TickerTrack({ hidden }: { hidden: boolean }) {
  return (
    <ul
      aria-hidden={hidden || undefined}
      className="flex flex-none items-center gap-6.5 pr-6.5"
    >
      {CAPABILITIES.map((name) => (
        <li key={name} className="list-none">
          <PaperLabel
            as="span"
            size="band"
            tone="inherit"
            className="whitespace-nowrap text-blue-foreground/90"
          >
            {name}
          </PaperLabel>
        </li>
      ))}
    </ul>
  );
}

export function CapabilityTicker() {
  return (
    <section className="relative z-6 overflow-hidden border-y border-blue-foreground/25 bg-blue py-3.5">
      <div className="animate-paper-ticker flex w-max">
        <TickerTrack hidden={false} />
        <TickerTrack hidden />
      </div>
    </section>
  );
}

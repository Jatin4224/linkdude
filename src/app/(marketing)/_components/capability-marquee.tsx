/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: CapabilityMarquee, RESOURCE_ENTRIES, animate-marquee,
 *   mask-fade-x, capability pills, marquee track, prefers-reduced-motion
 *
 * WHAT:  An infinitely scrolling band of the workspace capabilities a plan can
 *        grant, read straight off the resource registry.
 * WHY:   This is the slot a landing page usually fills with customer logos. We
 *        have no customers to name, and inventing them would be a lie printed on
 *        the homepage — so the band shows what the product actually does instead.
 *        Deriving it from RESOURCE_ENTRIES means a new gated feature joins the
 *        band the day it ships.
 * WHERE: src/app/(marketing)/page.tsx, directly under the hero.
 */

import { RESOURCE_ENTRIES } from "@/lib/resources";

/* Only plan-gated surfaces: a resource with neither a quota nor a flag is
 * internal plumbing, not something to advertise. */
const CAPABILITIES = RESOURCE_ENTRIES.filter(
  ([, def]) => def.limit ?? def.flag,
).map(([, def]) => def.name);

function MarqueeTrack({ hidden }: { hidden: boolean }) {
  return (
    <ul
      aria-hidden={hidden || undefined}
      className="flex shrink-0 items-center gap-8 pr-8"
    >
      {CAPABILITIES.map((name) => (
        <li
          key={name}
          className="flex items-center gap-2 whitespace-nowrap text-sm text-muted-foreground"
        >
          <span aria-hidden="true" className="size-1 rounded-full bg-brand" />
          {name}
        </li>
      ))}
    </ul>
  );
}

export function CapabilityMarquee() {
  return (
    <div className="border-y bg-card/30 py-5">
      <div className="mask-fade-x overflow-hidden">
        {/* Two identical tracks translating -50% is what makes the loop
            seamless; the second is hidden from assistive tech so the list isn't
            announced twice. */}
        <div className="animate-marquee flex w-max">
          <MarqueeTrack hidden={false} />
          <MarqueeTrack hidden />
        </div>
      </div>
    </div>
  );
}

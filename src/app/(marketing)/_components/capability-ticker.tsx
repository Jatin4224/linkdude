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
 *
 *        IT PAUSES ON HOVER AND ON FOCUS. See the `.paper-ticker` rules in
 *        globals.css and the note on the section below: the band is its own
 *        pause control, which is what makes the moving content stoppable
 *        without putting a button in a band that holds nothing but words.
 * WHERE: src/app/(marketing)/page.tsx, directly under BlueStatement.
 */

import { MARKETING_CAPABILITIES } from "@/lib/config";
import { getResourceDefinition } from "@/lib/resources";
import { PaperLabel } from "@/components/global/paper";

/* The band's words, resolved from the curated key list — see
 * MARKETING_CAPABILITIES for why this is chosen rather than derived. Each key
 * still reads its display name out of the registry, so the band cannot call a
 * feature something the app does not.
 *
 * Deduped by NAME because `carousels` and `carousel` are two resources with one
 * display name; if both ever appear in the list the band would otherwise print
 * "CAROUSELS CAROUSELS" back to back. */
const CAPABILITIES = [
  ...new Set(
    MARKETING_CAPABILITIES.map((key) => getResourceDefinition(key).name),
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
    <section
      /* THE BAND ITSELF IS THE PAUSE CONTROL. `.paper-ticker` is what the
         hover and focus-within rules in globals.css hang off; the tabIndex is
         what makes it work without a mouse, since nothing inside this band is
         focusable on its own and a pause a keyboard cannot reach is not a
         mechanism. One tab stop, no added chrome — the alternative was a
         visible pause button in a 42px band built to hold nothing but words.
         The focus ring is drawn here rather than inherited: the scope's ring
         is blue, and this band is blue. */
      tabIndex={0}
      aria-label={`${CAPABILITIES.length} workspace capabilities, scrolling. Pauses while focused.`}
      className="paper-ticker relative z-6 overflow-hidden border-y border-blue-foreground/25 bg-blue py-3.5 focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-blue-foreground"
    >
      <div className="animate-paper-ticker flex w-max">
        <TickerTrack hidden={false} />
        <TickerTrack hidden />
      </div>
    </section>
  );
}

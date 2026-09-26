/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: MarketingFooter, MARKETING_FOOTER_GROUPS,
 *   MARKETING_DISCLAIMER, PaperLockup, PaperLabel, APP_DESCRIPTION, site footer,
 *   border-ink, bottom bar
 *
 * WHAT:  The public site footer — brand lockup and blurb, three link columns,
 *        and the bottom bar.
 * WHY:   A server component with no interactivity, so it costs the page nothing
 *        in client JS. Like the header it belongs to the (marketing) LAYOUT
 *        rather than a single route, so every future public page gets it.
 *
 *        One ink rule along the top and one hairline above the bottom bar: the
 *        difference between them is the whole hierarchy. Ink closes the page;
 *        the hairline only separates the copyright from the columns, and using
 *        ink for both would make the bottom bar look like a second footer.
 * WHERE: src/app/(marketing)/layout.tsx.
 */

import Link from "next/link";

import {
  APP_DESCRIPTION,
  APP_NAME,
  MARKETING_DISCLAIMER,
  MARKETING_FOOTER_GROUPS,
  MARKETING_SECTION_IDS,
} from "@/lib/config";
import { PaperLabel, PaperLockup } from "@/components/global/paper";

export function MarketingFooter() {
  return (
    <footer className="relative z-6 border-t border-ink bg-paper px-(--gutter) pt-[clamp(30px,4vw,48px)] pb-[22px] text-ink">
      <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-[clamp(26px,4vw,44px)]">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] items-start gap-[clamp(24px,3vw,44px)]">
          <div className="flex max-w-[22em] flex-col gap-3">
            <PaperLockup href={`#${MARKETING_SECTION_IDS.top}`} />
            <p className="m-0 text-sm leading-normal text-pretty text-grey">
              {APP_DESCRIPTION}
            </p>
          </div>

          {MARKETING_FOOTER_GROUPS.map((group) => (
            <div key={group.label} className="flex flex-col gap-2.5">
              <PaperLabel size="band">{group.label}</PaperLabel>
              <ul className="flex list-none flex-col gap-2.5 p-0">
                {group.items.map((item) => (
                  <li key={`${group.label}-${item.label}`}>
                    {/* The underline is the affordance; the colour change alone
                        left the reader guessing which words were links.
                        `.paper-underline` owns both transitions, so no
                        `transition-colors` here — a utility declaring the
                        property again would drop the wipe. */}
                    <Link
                      href={item.href}
                      className="paper-underline inline-block text-sm text-grey hover:text-ink"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hair pt-[18px]">
          {/* The page is prerendered, so this year is stamped at build time and
              refreshes on the next deploy — not a live clock. */}
          <PaperLabel size="band" tone="grey" className="tracking-[0.09em]">
            © {new Date().getFullYear()} {APP_NAME}
          </PaperLabel>
          <PaperLabel size="band" tone="grey" className="tracking-[0.09em]">
            {MARKETING_DISCLAIMER}
          </PaperLabel>
        </div>
      </div>
    </footer>
  );
}

/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: MarketingFooter, MARKETING_FOOTER_GROUPS, BrandMark,
 *   APP_NAME, APP_DESCRIPTION, public footer, site footer, border-rail
 *
 * WHAT:  The public site footer — brand lockup and blurb, link columns, and the
 *        bottom bar.
 * WHY:   A server component with no interactivity, so it costs the page nothing
 *        in client JS. Like the navbar it belongs to the (marketing) layout
 *        rather than a single route, so every future public page gets it. It
 *        sits INSIDE the page's ruled column, which is what closes the grid off
 *        at the bottom rather than letting the rails run into nothing.
 * WHERE: src/app/(marketing)/layout.tsx.
 */

import Link from "next/link";

import {
  APP_DESCRIPTION,
  APP_NAME,
  MARKETING_FOOTER_GROUPS,
  MARKETING_SECTION_IDS,
} from "@/lib/config";
import { BrandMark } from "@/components/global/platform-logo";

export function MarketingFooter() {
  return (
    <footer className="border-t border-rail">
      <div className="grid grid-cols-2 gap-10 px-(--gutter) py-[clamp(40px,5vw,56px)] md:grid-cols-[2fr_repeat(3,1fr)]">
        <div className="col-span-2 flex flex-col gap-4 md:col-span-1">
          <Link
            href={`#${MARKETING_SECTION_IDS.top}`}
            className="flex w-fit items-center gap-2.5"
          >
            <BrandMark className="size-[26px] rounded-[7px]" />
            <span className="font-mono text-[13px] font-medium uppercase tracking-[0.02em]">
              {APP_NAME}
            </span>
          </Link>
          <p className="max-w-xs text-pretty text-[13.5px] leading-relaxed text-muted-foreground">
            {APP_DESCRIPTION}
          </p>
        </div>

        {MARKETING_FOOTER_GROUPS.map((group) => (
          <div key={group.label} className="flex flex-col gap-3.5">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-dim">
              {group.label}
            </p>
            <ul className="flex flex-col gap-2.5">
              {group.items.map((item) => (
                <li key={`${group.label}-${item.label}`}>
                  <Link
                    href={item.href}
                    className="text-[13.5px] text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2 border-t border-rail px-(--gutter) py-5 font-mono text-[10.5px] uppercase tracking-[0.06em] text-dim sm:flex-row sm:items-center sm:justify-between">
        {/* The page is prerendered, so this year is stamped at build time and
            refreshes on the next deploy — not a live clock. */}
        <p>
          © {new Date().getFullYear()} {APP_NAME}
        </p>
        <p>Not affiliated with LinkedIn Corporation.</p>
      </div>
    </footer>
  );
}

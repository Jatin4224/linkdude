/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: MarketingNavbar, MARKETING_NAV, GET_STARTED_HREF,
 *   GET_STARTED_LABEL, BrandMark, APP_NAME, AUTH_ROUTES, public navbar,
 *   sticky header, nav pill, animate-pulse-dot, acid button
 *
 * WHAT:  The public site header — brand lockup, the nav pill, sign-in, and the
 *        primary CTA.
 * WHY:   Lives in components/global rather than a route `_components` folder
 *        because it is rendered by the (marketing) LAYOUT, not by one page:
 *        every future public route inherits it unchanged.
 *
 *        A SERVER component, unlike the version this replaced. That one was
 *        "use client" for one reason — a scroll listener that faded the
 *        background in past 8px — and this design has the bar translucent from
 *        the first pixel, so the listener, the state and the hydration all went
 *        with it. The header now costs the page nothing in client JS.
 *
 *        There is no mobile sheet either: the nav is four short in-page anchors,
 *        and at narrow widths the pill simply wraps onto its own row (order-3 +
 *        basis-full below). A drawer to hold four anchors is a dialog, a focus
 *        trap and a client boundary in exchange for nothing.
 * WHERE: src/app/(marketing)/layout.tsx.
 */

import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";

import {
  APP_NAME,
  AUTH_ROUTES,
  GET_STARTED_HREF,
  GET_STARTED_LABEL,
  MARKETING_NAV,
  MARKETING_SECTION_IDS,
} from "@/lib/config";
import { BrandMark } from "@/components/global/platform-logo";
import { Button } from "@/components/ui/button";

export function MarketingNavbar() {
  return (
    <header
      /* A translucent material rather than an opaque strip: content scrolls
         under it and stays faintly visible, which is what keeps the page reading
         as one surface. `saturate` compensates for the colour a heavy blur
         drains out of whatever is behind it. */
      className="sticky top-0 z-50 border-b border-[color-mix(in_oklch,var(--rail)_65%,transparent)] bg-[color-mix(in_oklch,var(--background)_74%,transparent)] supports-backdrop-filter:backdrop-blur-[22px] supports-backdrop-filter:backdrop-saturate-150"
    >
      <nav className="mx-auto flex min-h-[62px] w-full max-w-[1240px] flex-wrap items-center justify-between gap-x-4 gap-y-2.5 px-(--gutter) py-2.5">
        <Link
          href={`#${MARKETING_SECTION_IDS.top}`}
          className="flex items-center gap-2.5"
        >
          <BrandMark className="size-[26px] rounded-[7px]" />
          <span className="font-mono text-[13px] font-medium uppercase tracking-[0.02em]">
            {APP_NAME}
          </span>
          <span
            aria-hidden="true"
            className="animate-pulse-dot size-[5px] rounded-full bg-acid"
          />
        </Link>

        {/* order-3 + basis-full: below roughly 1000px the pill drops onto its own
            centred row rather than colliding with the CTA, which is why the CTA
            carries flex-none and the row allows wrapping. */}
        <div className="order-3 flex basis-full justify-center lg:order-none lg:basis-auto">
          <div className="flex flex-wrap justify-center rounded-full border border-rail p-1">
            {MARKETING_NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-full px-3.5 py-1.5 font-mono text-[11.5px] uppercase tracking-[0.06em] text-muted-foreground transition-colors hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="flex flex-none items-center gap-4">
          <Link
            href={AUTH_ROUTES.signIn}
            className="font-mono text-[11.5px] uppercase tracking-[0.06em] text-muted-foreground transition-colors hover:text-foreground"
          >
            Sign in
          </Link>
          <Button
            variant="acid"
            className="h-[34px] whitespace-nowrap rounded-[9px] px-3.5 font-mono text-[11.5px] font-medium uppercase tracking-[0.05em] shadow-[0_0_24px_-6px_color-mix(in_oklch,var(--acid)_55%,transparent)]"
            nativeButton={false}
            render={<Link href={GET_STARTED_HREF} />}
          >
            {GET_STARTED_LABEL}
            <ArrowRightIcon className="size-[13px]" />
          </Button>
        </div>
      </nav>
    </header>
  );
}

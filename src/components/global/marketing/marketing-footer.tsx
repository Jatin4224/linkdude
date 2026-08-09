/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: MarketingFooter, MARKETING_FOOTER_GROUPS,
 *   PlatformLogo, APP_NAME, APP_DESCRIPTION, public footer, site footer,
 *   formatResourceAllowance, free tier
 *
 * WHAT:  The public site footer — brand blurb, link columns, and the copyright
 *        line.
 * WHY:   A server component with no interactivity, so it costs the page nothing
 *        in client JS. Like the navbar it belongs to the (marketing) layout
 *        rather than a single route, so every future public page gets it. The
 *        free-tier line is derived from RESOURCES rather than typed, so it can't
 *        promise an allowance the app doesn't grant.
 * WHERE: src/app/(marketing)/layout.tsx.
 */

import Link from "next/link";

import { APP_DESCRIPTION, APP_NAME, MARKETING_FOOTER_GROUPS } from "@/lib/config";
import { formatResourceAllowance } from "@/lib/resources";
import { PlatformLogo } from "@/components/global/platform-logo";

export function MarketingFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto w-full max-w-6xl px-6 py-16">
        <div className="grid gap-10 md:grid-cols-[1.6fr_repeat(3,1fr)]">
          <div className="flex flex-col gap-4">
            <PlatformLogo href="/" />
            <p className="max-w-xs text-sm text-muted-foreground">
              {APP_DESCRIPTION}
            </p>
            <p className="text-xs text-muted-foreground">
              Free forever plan — {formatResourceAllowance("linkedinPosts", "free")}{" "}
              and {formatResourceAllowance("aiGeneration", "free")} a month, no
              card required.
            </p>
          </div>

          {MARKETING_FOOTER_GROUPS.map((group) => (
            <div key={group.label} className="flex flex-col gap-3">
              <p className="text-sm font-medium">{group.label}</p>
              <ul className="flex flex-col gap-2.5">
                {group.items.map((item) => (
                  <li key={`${group.label}-${item.label}`}>
                    <Link
                      href={item.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-2 border-t pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          {/* The page is prerendered, so this year is stamped at build time and
              refreshes on the next deploy — not a live clock. */}
          <p>
            © {new Date().getFullYear()} {APP_NAME}. All rights reserved.
          </p>
          <p>Not affiliated with LinkedIn Corporation.</p>
        </div>
      </div>
    </footer>
  );
}

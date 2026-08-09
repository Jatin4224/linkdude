/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: FinalCta, GET_STARTED_HREF, GET_STARTED_LABEL,
 *   AUTH_ROUTES, BRAND_MASCOT, bg-brand-glow, bg-grid-lines, closing band
 *
 * WHAT:  The closing full-bleed band — one restated promise and the last CTA.
 * WHY:   A reader who scrolled this far has read the pricing table; the job here
 *        is to remove the last excuse, which is why the free-tier line repeats
 *        under the button rather than making them scroll back up for it. Reuses
 *        the hero's glow and grid so the page closes on the surface it opened on.
 * WHERE: src/app/(marketing)/page.tsx, last section before the footer.
 */

import Image from "next/image";
import Link from "next/link";

import BRAND_MASCOT from "@/app/assets/images/linkdin-dude.png";
import {
  AUTH_ROUTES,
  GET_STARTED_HREF,
  GET_STARTED_LABEL,
} from "@/lib/config";
import { formatResourceAllowance } from "@/lib/resources";
import { Reveal } from "@/components/global/reveal";
import { Button } from "@/components/ui/button";

export function FinalCta() {
  return (
    <section className="relative isolate overflow-hidden border-t">
      <div
        aria-hidden="true"
        className="bg-grid-lines pointer-events-none absolute inset-0 -z-20 opacity-50"
      />
      <div
        aria-hidden="true"
        className="bg-brand-glow pointer-events-none absolute inset-x-0 -top-32 -z-10 h-120"
      />

      <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-6 px-6 py-28 text-center">
        <Reveal>
          <Image
            src={BRAND_MASCOT}
            alt=""
            width={192}
            height={192}
            aria-hidden="true"
            className="mx-auto h-auto w-28 mask-[radial-gradient(closest-side,oklch(0_0_0)_72%,transparent_100%)]"
          />
        </Reveal>

        <Reveal delay={60} className="flex flex-col items-center gap-6">
          <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
            Your next thirty posts are one conversation away.
          </h2>
          <p className="max-w-xl text-pretty text-muted-foreground">
            Connect LinkedIn, answer a few questions, and leave with a month of
            posts already on the calendar.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button
              variant="brand"
              size="lg"
              className="h-11 px-6 text-base"
              nativeButton={false}
              render={<Link href={GET_STARTED_HREF} />}
            >
              {GET_STARTED_LABEL}
            </Button>
            <Button
              variant="ghost"
              size="lg"
              className="h-11 px-6 text-base"
              nativeButton={false}
              render={<Link href={AUTH_ROUTES.signIn} />}
            >
              Sign in
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            {formatResourceAllowance("linkedinPosts", "free")} and{" "}
            {formatResourceAllowance("aiGeneration", "free")} a month on the free
            plan. No card, no trial timer.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

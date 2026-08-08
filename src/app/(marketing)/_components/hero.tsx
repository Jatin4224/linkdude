/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: LandingHero, MARKETING_HERO_POST, LinkedInPostPreview,
 *   BRAND_MASCOT, GET_STARTED_HREF, formatResourceAllowance, bg-brand-glow,
 *   bg-grid-lines, text-gradient-brand, Reveal
 *
 * WHAT:  The first screen — positioning line, CTAs, the derived free-tier trust
 *        line, and a live LinkedInPostPreview standing in as the product shot.
 * WHY:   The mockup is the real composer component rather than a screenshot, so
 *        it can never show a UI the app no longer has, and it stays crisp at any
 *        density. The trust line is computed from RESOURCES for the same reason:
 *        the headline promise and the enforced quota are one value.
 * WHERE: src/app/(marketing)/page.tsx.
 */

import Image from "next/image";
import Link from "next/link";
import { CalendarCheckIcon, GaugeIcon } from "lucide-react";

import BRAND_MASCOT from "@/app/assets/images/linkdin-dude.png";
import {
  GET_STARTED_HREF,
  GET_STARTED_LABEL,
  MARKETING_SECTION_IDS,
} from "@/lib/config";
import { formatResourceAllowance } from "@/lib/resources";
import { Reveal } from "@/components/global/reveal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HeroPostMockup } from "./hero-post-mockup";

export function LandingHero() {
  return (
    <section
      id={MARKETING_SECTION_IDS.top}
      className="relative isolate overflow-hidden"
    >
      {/* Backdrop, back to front: two drifting aurora blobs, a fading grid for
          structure, then a brand glow. All decorative, all behind everything,
          none focusable. Only `transform` animates, so the drift runs on the
          compositor and doesn't compete with the page still loading. */}
      <div
        aria-hidden="true"
        className="animate-aurora-a aurora-blob aurora-brand pointer-events-none absolute -top-40 left-[8%] -z-30 size-120 opacity-50"
      />
      <div
        aria-hidden="true"
        className="animate-aurora-b aurora-blob aurora-accent pointer-events-none absolute -top-24 right-[4%] -z-30 size-96 opacity-35"
      />
      <div
        aria-hidden="true"
        className="bg-grid-lines pointer-events-none absolute inset-0 -z-20 opacity-60"
      />
      <div
        aria-hidden="true"
        className="bg-brand-glow pointer-events-none absolute inset-x-0 -top-40 -z-10 h-152"
      />

      <div className="mx-auto grid w-full max-w-6xl items-center gap-14 px-6 pb-24 pt-20 lg:grid-cols-[1.05fr_0.95fr] lg:pb-32 lg:pt-28">
        <Reveal className="flex flex-col items-start gap-6">
          <Badge
            variant="outline"
            className="relative gap-2 overflow-hidden border-brand-border"
          >
            <span
              aria-hidden="true"
              className="size-1.5 rounded-full bg-brand"
            />
            AI that writes like you, not like AI
            {/* One sheen pass every few seconds, then a long pause. Constant
                motion at the edge of vision is noise; an occasional one reads
                as light moving across a surface. */}
            <span
              aria-hidden="true"
              className="animate-sheen pointer-events-none absolute inset-y-0 -left-full w-1/2 bg-[linear-gradient(to_right,transparent,color-mix(in_oklch,var(--brand)_28%,transparent),transparent)]"
            />
          </Badge>

          <h1 className="text-gradient-brand text-balance text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
            Show up on LinkedIn every day. Without the blank box.
          </h1>

          <p className="max-w-xl text-pretty text-lg text-muted-foreground">
            Turn a topic into a post worth reading, schedule it straight to
            LinkedIn, and fix the profile people land on when it works.
          </p>

          <div className="flex flex-wrap items-center gap-3">
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
              variant="outline"
              size="lg"
              className="h-11 px-6 text-base"
              nativeButton={false}
              render={<Link href={`#${MARKETING_SECTION_IDS.features}`} />}
            >
              See how it works
            </Button>
          </div>

          {/* Every number here is read from the registry, so the promise and the
              enforced quota are the same value. */}
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Free forever:</span>{" "}
            {formatResourceAllowance("linkedinPosts", "free")} ·{" "}
            {formatResourceAllowance("aiGeneration", "free")} ·{" "}
            {formatResourceAllowance("profileAnalysis", "free")} ·{" "}
            {formatResourceAllowance("contentPlan", "free")}. No card required.
          </p>
        </Reveal>

        {/* Capped and pushed right: the mockup is supporting evidence, not the
            subject of the screen, so it stays narrower than its grid column
            instead of stretching to fill it. */}
        <div className="relative isolate mx-auto w-full max-w-sm lg:mr-0">
          <Reveal delay={60} className="relative z-10">
            <HeroPostMockup />
          </Reveal>

          {/* The mascot peeks out from BEHIND the card's lower-left corner —
              negative z-index, so it can overlap the card edge for depth without
              ever covering a word of the post. Hidden below lg, where the column
              is too narrow for it to clear the text. */}
          <Reveal
            delay={120}
            className="pointer-events-none absolute -bottom-10 -left-20 -z-10 hidden w-36 lg:block xl:-left-24 xl:w-40"
          >
            <Image
              src={BRAND_MASCOT}
              alt=""
              width={256}
              height={256}
              priority
              aria-hidden="true"

              className="h-auto w-full bottom-20 right-20 absolute  drop-shadow-2xl mask-[radial-gradient(closest-side,oklch(0_0_0)_70%,transparent_100%)]"
            />
          </Reveal>

          <Reveal
            delay={180}
            className="absolute -right-3 -top-5 hidden sm:block"
          >
            <div className="border-hairline-gradient flex items-center gap-2 rounded-lg border bg-card px-3 py-2 shadow-lg">
              <CalendarCheckIcon className="size-4 text-brand" />
              <span className="text-xs font-medium">
                Scheduled · Tue 9:00 AM
              </span>
            </div>
          </Reveal>

          <Reveal
            delay={240}
            className="absolute -bottom-6 right-4 hidden sm:block"
          >
            <div className="border-hairline-gradient flex items-center gap-2 rounded-lg border bg-card px-3 py-2 shadow-lg">
              <GaugeIcon className="size-4 text-brand" />
              <span className="text-xs font-medium tabular-nums">
                Profile score 82 / 100
              </span>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

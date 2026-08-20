/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: FeatureShowcase, MARKETING_FEATURES, RESOURCES,
 *   getNavIcon, sticky scroll, Reveal, MarketingSection, product surfaces,
 *   SURFACE_COUNT, SURFACE_WORDS
 *
 * WHAT:  The product section — a pinned copy column beside one card per shipped
 *        surface, with the heading counting them.
 * WHY:   The card TITLE and ICON come from RESOURCES[resource], not from the
 *        copy file, so the name a visitor reads here is the exact label they
 *        will later click in the sidebar. The sticky column is pure CSS
 *        (`lg:sticky`) — a scroll-driven pin would need a listener and a
 *        measurement pass to do something the browser already does for free.
 * WHERE: src/app/(marketing)/page.tsx.
 */

import Link from "next/link";
import { CheckIcon } from "lucide-react";

import {
  GET_STARTED_HREF,
  GET_STARTED_LABEL,
  MARKETING_FEATURES,
  MARKETING_SECTION_IDS,
} from "@/lib/config";
import { getResourceDefinition } from "@/lib/resources";
import { MarketingSection } from "@/components/global/marketing";
import { getNavIcon } from "@/components/global/sidebar/nav-icons";
import { Reveal } from "@/components/global/reveal";
import { Spotlight } from "@/components/global/spotlight";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/* The heading counts the cards below it, so the number is DERIVED rather than
 * typed into the copy: "Four surfaces" survived two new surfaces shipping,
 * because a sentence in JSX is the one place nobody looks when adding a feature.
 * Spelled out to match the prose around it; the numeral is the fallback so an
 * unlisted length degrades to "7 surfaces" instead of rendering nothing. */
const SURFACE_WORDS: Readonly<Record<number, string>> = {
  3: "Three",
  4: "Four",
  5: "Five",
  6: "Six",
  7: "Seven",
  8: "Eight",
};

const SURFACE_COUNT: string =
  SURFACE_WORDS[MARKETING_FEATURES.length] ?? String(MARKETING_FEATURES.length);

export function FeatureShowcase() {
  return (
    <MarketingSection id={MARKETING_SECTION_IDS.features}>
      <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
        <div className="flex flex-col gap-6 lg:sticky lg:top-24 lg:self-start">
          <p className="text-xs font-medium uppercase tracking-widest text-brand-soft-foreground">
            The product
          </p>
          <h2 className="text-pretty text-3xl font-semibold tracking-tight sm:text-4xl">
            {SURFACE_COUNT} surfaces. One workflow.
          </h2>
          <p className="text-pretty text-muted-foreground">
            Plan the month, write the post or the deck, ship it on schedule, and
            fix the profile it lands on. Each one is useful alone. Together they
            close the loop.
          </p>
          <Button
            variant="brand"
            size="lg"
            className="h-10 w-fit px-5"
            nativeButton={false}
            render={<Link href={GET_STARTED_HREF} />}
          >
            {GET_STARTED_LABEL}
          </Button>
        </div>

        <div className="flex flex-col gap-4">
          {MARKETING_FEATURES.map((feature, index) => {
            const resource = getResourceDefinition(feature.resource);
            /* Falls through getNavIcon's neutral default if a surface ever loses
               its nav entry — a missing icon must not blank the card. */
            const Icon = getNavIcon(resource.nav?.icon ?? "");
            return (
              <Reveal key={feature.resource} delay={index * 60}>
                {/* Spotlight is a transparent positioning shell — the Card keeps
                    its own border, surface and radius. */}
                <Spotlight className="h-full">
                  <Card className="surface-raised h-full border-border/80 transition-[border-color,box-shadow] duration-200 ease-out hover:border-brand-border hover:shadow-lg">
                    <CardContent className="flex flex-col gap-3 p-6">
                      <div className="flex items-center gap-3">
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-linear-to-br from-brand/30 to-brand/5 ring-1 ring-inset ring-brand-border">
                          <Icon className="size-5 text-brand-soft-foreground" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            {resource.name}
                          </p>
                          <h3 className="truncate font-semibold">
                            {feature.headline}
                          </h3>
                        </div>
                      </div>
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        {feature.body}
                      </p>
                      <p className="flex items-start gap-2 text-xs text-muted-foreground">
                        <CheckIcon className="mt-0.5 size-3.5 shrink-0 text-brand" />
                        {feature.proof}
                      </p>
                    </CardContent>
                  </Card>
                </Spotlight>
              </Reveal>
            );
          })}
        </div>
      </div>
    </MarketingSection>
  );
}

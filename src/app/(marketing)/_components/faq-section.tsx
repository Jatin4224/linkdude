/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use client";

/**
 * SOURCE OF TRUTH KEYWORDS: FaqSection, MARKETING_FAQ, Collapsible,
 *   CollapsibleTrigger, CollapsibleContent, data-panel-open, FAQ accordion,
 *   defaultOpen, DisplayHeading
 *
 * WHAT:  The objection-handling list, one collapsible row per question, laid out
 *        beside the section heading.
 * WHY:   Built on the installed Collapsible rather than adding shadcn's accordion:
 *        the registry ships the Radix build, and pulling it in would leave two
 *        incompatible primitive systems in components/ui next to @base-ui. Each
 *        row is independent, which also means a reader can open several at once
 *        instead of losing the answer they were half-way through. The first is
 *        open on load so the pattern is legible without a click.
 * WHERE: src/app/(marketing)/page.tsx.
 */

import { ChevronDownIcon } from "lucide-react";

import {
  MARKETING_FAQ,
  MARKETING_SECTION_HEADINGS,
  MARKETING_SECTION_IDS,
} from "@/lib/config";
import { MarketingSection } from "@/components/global/marketing";
import { Reveal } from "@/components/global/reveal";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { DisplayHeading, SectionKicker } from "./display-heading";

const COPY = MARKETING_SECTION_HEADINGS.faq;

export function FaqSection() {
  return (
    <MarketingSection id={MARKETING_SECTION_IDS.faq}>
      <div className="grid grid-cols-1 gap-[clamp(32px,5vw,72px)] lg:grid-cols-3">
        <Reveal>
          <div className="flex max-w-[20em] flex-col gap-5">
            <SectionKicker>{COPY.kicker}</SectionKicker>
            <DisplayHeading size="compact" heading={COPY.heading} />
          </div>
        </Reveal>

        <div className="lg:col-span-2">
          {MARKETING_FAQ.map((item, index) => (
            <Reveal key={item.question} delay={Math.min(index, 8) * 70}>
              <Collapsible
                /* Only the first, and only on load — every other row stays shut
                   so the list reads as a list rather than as six open answers. */
                defaultOpen={index === 0}
                className="group border-b border-rail"
              >
                <CollapsibleTrigger className="flex w-full items-center gap-3.5 py-[22px] text-left transition-colors hover:text-acid">
                  <span className="font-mono text-[10.5px] tabular-nums text-acid-dim">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="flex-1 text-[clamp(15px,1.3vw,16.5px)] font-medium tracking-[-0.012em]">
                    {item.question}
                  </span>
                  {/* base-ui exposes open state as data-panel-open — not Radix's
                      data-state="open". */}
                  <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground transition-transform duration-[240ms] ease-out group-data-panel-open:rotate-180" />
                </CollapsibleTrigger>
                {/* The left indent lines the answer up past the number, so the
                    column of two-digit indices stays unbroken down the list. */}
                <CollapsibleContent className="pb-6 pl-[34px] pr-[clamp(0px,5vw,64px)] text-sm leading-[1.78] text-muted-foreground">
                  {item.answer}
                </CollapsibleContent>
              </Collapsible>
            </Reveal>
          ))}
        </div>
      </div>
    </MarketingSection>
  );
}

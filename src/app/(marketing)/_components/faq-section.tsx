/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use client";

/**
 * SOURCE OF TRUTH KEYWORDS: FaqSection, MARKETING_FAQ, Collapsible,
 *   CollapsibleTrigger, CollapsibleContent, data-panel-open, FAQ accordion
 *
 * WHAT:  The objection-handling list, one collapsible row per question.
 * WHY:   Built on the installed Collapsible rather than adding shadcn's accordion:
 *        the registry ships the Radix build, and pulling it in would leave two
 *        incompatible primitive systems in components/ui next to @base-ui. Each
 *        row is independent, which also means a reader can open several at once
 *        instead of losing the answer they were half-way through.
 * WHERE: src/app/(marketing)/page.tsx.
 */

import { ChevronDownIcon } from "lucide-react";

import { MARKETING_FAQ, MARKETING_SECTION_IDS } from "@/lib/config";
import { MarketingSection } from "@/components/global/marketing";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

export function FaqSection() {
  return (
    <MarketingSection
      id={MARKETING_SECTION_IDS.faq}
      eyebrow="Questions"
      title="The things people ask before signing up"
    >
      <div className="mx-auto max-w-3xl divide-y rounded-xl border px-6">
        {MARKETING_FAQ.map((item) => (
          <Collapsible key={item.question} className="group">
            <CollapsibleTrigger className="flex w-full items-center justify-between gap-4 py-5 text-left text-sm font-medium transition-colors hover:text-brand-soft-foreground">
              {item.question}
              {/* base-ui exposes open state as data-panel-open — not Radix's
                  data-state="open". */}
              <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 ease-out group-data-panel-open:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent className="pb-5 pr-8 text-sm leading-relaxed text-muted-foreground">
              {item.answer}
            </CollapsibleContent>
          </Collapsible>
        ))}
      </div>
    </MarketingSection>
  );
}

/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: LoopSection, MARKETING_LOOP_STEPS,
 *   MARKETING_SECTION_HEADINGS, DisplayHeading, SectionKicker, BRAND_MASCOT,
 *   text-stroke-acid, mask-vignette, bubble-tail, Reveal, Write Ship Land
 *
 * WHAT:  The three jobs the product does — Write, Ship, Land — one ruled row
 *        each, with the mascot delivering the proof point for every row.
 * WHY:   This one section replaced the old "problem cards" and "how it works"
 *        bands. Both were saying the same thing twice at different altitudes,
 *        and neither said what the product does in the order you would do it.
 *        The mascot bubble is doing real work rather than being decoration: the
 *        row body makes the claim, and the bubble is the specific capability
 *        that backs it, which keeps the claim honest and gives the reader
 *        somewhere to check it.
 * WHERE: src/app/(marketing)/page.tsx.
 */

import Image from "next/image";

import BRAND_MASCOT from "@/app/assets/images/linkdin-dude.png";
import {
  MARKETING_LOOP_STEPS,
  MARKETING_SECTION_HEADINGS,
  MARKETING_SECTION_IDS,
  type MarketingLoopStep,
} from "@/lib/config";
import { MarketingSection } from "@/components/global/marketing";
import { Reveal } from "@/components/global/reveal";
import { DisplayHeading, SectionKicker } from "./display-heading";

const COPY = MARKETING_SECTION_HEADINGS.loop;

export function LoopSection() {
  return (
    <MarketingSection id={MARKETING_SECTION_IDS.loop}>
      <Reveal>
        <div className="flex flex-wrap items-end justify-between gap-11">
          <div className="flex flex-col gap-5">
            <SectionKicker>{COPY.kicker}</SectionKicker>
            <DisplayHeading size="loop" heading={COPY.heading} />
          </div>
          <p className="max-w-[25em] text-pretty text-base leading-[1.65] text-muted-foreground">
            {COPY.body}
          </p>
        </div>
      </Reveal>

      <div className="mt-[clamp(28px,3.4vw,46px)]">
        {MARKETING_LOOP_STEPS.map((step, index) => (
          <Reveal key={step.kicker} delay={index * 70}>
            <LoopRow step={step} index={index} />
          </Reveal>
        ))}
      </div>
    </MarketingSection>
  );
}

function LoopRow({ step, index }: { step: MarketingLoopStep; index: number }) {
  /* Two digits, from position rather than typed into the copy — the numbering IS
     the running order, so it should not be possible for them to disagree. */
  const numeral = String(index + 1).padStart(2, "0");

  return (
    <div className="grid grid-cols-1 items-start gap-[clamp(20px,4vw,56px)] border-t border-rail py-[clamp(28px,3.4vw,46px)] md:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)_minmax(0,1.4fr)]">
      <div className="flex items-baseline gap-4">
        <span
          aria-hidden="true"
          className="text-stroke-acid text-[clamp(56px,7vw,104px)] font-semibold leading-[0.74] tracking-[-0.07em]"
        >
          {numeral}
        </span>
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-acid">
          {step.kicker}
        </span>
      </div>

      <h3 className="text-[clamp(22px,2.3vw,32px)] font-semibold leading-[1.06] tracking-[-0.035em]">
        {step.title}
      </h3>

      <div className="flex flex-col gap-6">
        <p className="text-pretty text-[15px] leading-[1.68] text-muted-foreground">
          {step.body}
        </p>

        {/* The mascot appears to be saying the proof line. Reading order puts the
            bubble before the image so a screen reader gets the sentence without
            the decorative figure interrupting it. */}
        <div className="flex items-end gap-2.5">
          <div className="relative flex-1 rounded-[14px_14px_4px_14px] bg-[color-mix(in_oklch,var(--acid-soft)_62%,transparent)] px-[15px] py-[13px] font-mono text-[11.5px] leading-[1.65] text-acid shadow-[inset_0_0_0_1px_color-mix(in_oklch,var(--acid)_26%,transparent)]">
            {step.bubble}
            <span
              aria-hidden="true"
              className="bubble-tail absolute -right-[5px] bottom-[9px] size-[11px] rotate-45"
            />
          </div>
          <Image
            src={BRAND_MASCOT}
            alt=""
            width={116}
            height={116}
            aria-hidden="true"
            className="mask-vignette h-auto w-[58px] shrink-0"
          />
        </div>
      </div>
    </div>
  );
}

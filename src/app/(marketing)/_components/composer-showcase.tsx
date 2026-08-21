/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: ComposerShowcase, MARKETING_COMPOSER,
 *   MARKETING_COMPOSER_TONES, MARKETING_POST_LINES, MARKETING_COMPOSER_QUEUE,
 *   getRawResourceLimit, PaperDisplay, PaperLabel, composer screenshot,
 *   product shot, generations left, queue rail
 *
 * WHAT:  The product shot — a static, hand-drawn composer with the topic, the
 *        tone chips, the generated draft, its actions, and the queue beside it.
 * WHY:   The reference calls this "no mockups, this is the part that does the
 *        work", and honouring that means the panel has to be drawn to the same
 *        rules as the real app rather than sketched: 1px ink outer border, 1px
 *        ink dividers between regions, hairline rules INSIDE the regions, and
 *        white rather than paper so it reads as a screen sitting on the page.
 *
 *        The generations counter is derived from the free plan's real
 *        aiGeneration cap instead of typed, so a screenshot on the marketing
 *        page can never quote a quota the product does not grant — the one claim
 *        in this panel that could otherwise go stale silently. Everything else
 *        here is illustrative copy and lives in config.
 *
 *        A server component: it is a picture, not a demo. The previous version of
 *        this section ran a phase machine on a timer, which cost a client
 *        boundary and a running interval for something a reader looks at for two
 *        seconds on their way down the page.
 * WHERE: src/app/(marketing)/page.tsx, after FreePlanCaps.
 */

import { CalendarCheckIcon } from "lucide-react";

import {
  MARKETING_COMPOSER,
  MARKETING_COMPOSER_QUEUE,
  MARKETING_COMPOSER_TONES,
  MARKETING_POST_LINES,
  MARKETING_SECTION_IDS,
} from "@/lib/config";
import { getRawResourceLimit } from "@/lib/resources";
import {
  PaperLabel,
  PaperDisplay,
  PaperReveal,
} from "@/components/global/paper";
import { cn } from "@/lib/utils";

/* The panel shows one generation already spent, so the counter reads as a
 * session in progress rather than as an untouched account. An 'unlimited' free
 * plan has no counter to show, so the line is dropped entirely. */
const FREE_GENERATIONS = getRawResourceLimit("aiGeneration", "free");
const GENERATIONS_LABEL =
  FREE_GENERATIONS === "unlimited"
    ? null
    : `${FREE_GENERATIONS - 1} / ${FREE_GENERATIONS} generations left`;

export function ComposerShowcase() {
  return (
    <section
      id={MARKETING_SECTION_IDS.composer}
      className="relative z-6 bg-paper px-[clamp(16px,3vw,34px)] pt-[clamp(64px,9vw,120px)] pb-[clamp(56px,8vw,104px)] text-ink"
    >
      <PaperReveal
        distance={34}
        className="mx-auto flex w-full max-w-[1240px] flex-col gap-[clamp(28px,4vw,48px)]"
      >
        <div className="flex flex-col gap-2.5">
          <p className="m-0 text-[clamp(16px,2vw,26px)] tracking-[-0.02em] text-grey">
            {MARKETING_COMPOSER.lead}
          </p>
          <PaperDisplay
            as="h2"
            words={MARKETING_COMPOSER.heading}
            className="text-[clamp(38px,8vw,116px)] leading-[0.84]"
          />
        </div>

        <div className="border border-ink bg-paper-raised">
          {/* Chrome. The only place on the page a URL appears, and it is built
              from APP_DOMAIN so a rebrand moves it. */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-ink px-3.5 py-2.5">
            <PaperLabel size="band" tone="grey" className="tracking-[0.09em]">
              {MARKETING_COMPOSER.addressBar}
            </PaperLabel>
            {GENERATIONS_LABEL ? (
              <PaperLabel size="band" tone="grey" className="tracking-[0.09em]">
                {GENERATIONS_LABEL}
              </PaperLabel>
            ) : null}
          </div>

          {/* The composer takes two thirds so the queue stays a rail beside it
              rather than an equal half; below md they stack and the divider
              between them goes with the split. */}
          <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr]">
            <div className="flex min-w-0 flex-col gap-4 border-b border-ink p-[clamp(16px,2.2vw,26px)] md:border-r md:border-b-0">
              <div className="border border-ink px-3.5 py-3 text-[13px] tracking-[-0.01em]">
                {MARKETING_COMPOSER.topic}
              </div>

              <div className="flex flex-wrap gap-2">
                {MARKETING_COMPOSER_TONES.map((tone, index) => (
                  <PaperLabel
                    key={tone}
                    as="span"
                    tone="inherit"
                    className={cn(
                      "border px-2.5 py-1.5 tracking-[0.07em] whitespace-nowrap",
                      /* Exactly one selected chip — this section's single blue. */
                      index === 0
                        ? "border-blue bg-blue text-blue-foreground"
                        : "border-ink/30 text-ink",
                    )}
                  >
                    {tone}
                  </PaperLabel>
                ))}
              </div>

              <div className="flex flex-col gap-3 border-t border-hair pt-4">
                <div className="flex items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="flex size-9 flex-none items-center justify-center border border-ink text-xs font-medium"
                  >
                    {MARKETING_COMPOSER.authorInitials}
                  </span>
                  <div>
                    <p className="m-0 text-sm leading-tight font-semibold tracking-[-0.01em]">
                      {MARKETING_COMPOSER.authorName}
                    </p>
                    <PaperLabel size="micro" tone="grey">
                      {MARKETING_COMPOSER.authorRole}
                    </PaperLabel>
                  </div>
                </div>

                {MARKETING_POST_LINES.map((line) => (
                  <p
                    key={line}
                    className="m-0 text-[clamp(13px,1.3vw,15px)] leading-relaxed"
                  >
                    {line}
                  </p>
                ))}
              </div>

              {/* Drawn, not interactive: these are spans, so nothing here is a
                  focus stop on the way to the page's real CTAs. */}
              <div className="flex flex-wrap items-center gap-2.5">
                <PaperLabel
                  as="span"
                  size="band"
                  tone="inherit"
                  className="inline-flex h-[38px] items-center bg-blue px-4 tracking-[0.09em] text-blue-foreground"
                >
                  {MARKETING_COMPOSER.publishLabel}
                </PaperLabel>
                <PaperLabel
                  as="span"
                  size="band"
                  className="inline-flex h-[38px] items-center gap-2 border border-ink px-3.5 tracking-[0.09em]"
                >
                  <CalendarCheckIcon aria-hidden="true" className="size-3.5" />
                  {MARKETING_COMPOSER.scheduleLabel}
                </PaperLabel>
                <PaperLabel size="micro" tone="grey">
                  {MARKETING_COMPOSER.savedLabel}
                </PaperLabel>
              </div>
            </div>

            <div className="flex min-w-0 flex-col gap-3 p-[clamp(16px,2.2vw,26px)]">
              <div className="flex items-center justify-between gap-2">
                <PaperLabel size="band" className="tracking-[0.1em]">
                  {MARKETING_COMPOSER.queueLabel}
                </PaperLabel>
                <PaperLabel size="micro" tone="grey">
                  {MARKETING_COMPOSER.queueRange}
                </PaperLabel>
              </div>

              {MARKETING_COMPOSER_QUEUE.map((item) => (
                <div
                  key={item.title}
                  className={cn(
                    "flex flex-col gap-1.5 border px-3 py-2.5",
                    item.live ? "border-blue" : "border-ink/20",
                  )}
                >
                  <PaperLabel
                    as="span"
                    size="micro"
                    tone={item.live ? "blue" : "grey"}
                    className="tracking-[0.09em]"
                  >
                    {item.when}
                  </PaperLabel>
                  <span className="text-[12.5px] leading-snug">
                    {item.title}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </PaperReveal>
    </section>
  );
}

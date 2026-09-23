/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: ComposerShowcase, MARKETING_COMPOSER,
 *   MARKETING_COMPOSER_CONTROLS, MARKETING_COMPOSER_RECENT,
 *   MARKETING_POST_LINES, LINKEDIN_MAX_COMMENTARY, getRawResourceLimit,
 *   usage meter, crop marks, brackets, PaperLabel, PaperDisplay, landing page
 *
 * WHAT:  A drawing of the real Create Post screen — the source tabs, the topic,
 *        the three settings, the draft rendered as LinkedIn will render it, and
 *        what has already gone out.
 *
 * WHY:   THIS SECTION'S LEAD LINE PROMISES "no mockups". That raises the bar
 *        here above anywhere else on the page, and the previous version did not
 *        clear it: it was topped by `app.<domain> / create` — a URL that reads
 *        as "app.localhost" on a developer's machine — offered four tone chips
 *        the product has never had, and filled its right rail with a "Queue ·
 *        next 7 days" panel that exists nowhere in the app. Every control now
 *        corresponds to something a member can actually press, and the rail
 *        shows what the composer really lists beside the editor: posts that have
 *        already been published. Scheduling did not vanish — it lives in the
 *        calendar, which the step above this section already draws, so showing
 *        it here was the same idea told twice.
 *
 *        THE LINKEDIN CHROME IS THE ARGUMENT. The draft is drawn inside the post
 *        the network will publish — avatar, name, "Now", and the reaction row —
 *        because the persuasive thing about the real screen is not that it
 *        writes text, it is that you are looking at the thing you are about to
 *        ship. A bare block of copy makes the same claim and proves none of it.
 *
 *        The treatment follows the DASHBOARD as it is today: mono uppercase
 *        field labels, square controls, and crop marks on the one primary
 *        action. The marks need `--bracket-color` set locally — the variable
 *        lives in `.tech-scope`, which is the signed-in app, and this page is
 *        the paper system.
 *
 *        Nothing here is interactive. Every control is a span, so the panel adds
 *        no focus stops between a reader and the page's real calls to action.
 * WHERE: src/app/(marketing)/page.tsx, before the how-it-works band.
 */

import type * as React from "react";
import {
  GlobeIcon,
  MessageCircleIcon,
  Repeat2Icon,
  SendIcon,
  SparklesIcon,
  ThumbsUpIcon,
} from "lucide-react";

import {
  LINKEDIN_MAX_COMMENTARY,
  MARKETING_COMPOSER,
  MARKETING_COMPOSER_CONTROLS,
  MARKETING_COMPOSER_RECENT,
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
 * plan has no counter to show, so the readout is dropped entirely. */
const FREE_GENERATIONS = getRawResourceLimit("aiGeneration", "free");
const GENERATIONS =
  FREE_GENERATIONS === "unlimited"
    ? null
    : { used: FREE_GENERATIONS - 1, total: FREE_GENERATIONS };

/* The real length of the draft on screen, against the real LinkedIn ceiling —
 * both measured rather than written down, so neither can drift from what the
 * panel is actually showing. */
const DRAFT_LENGTH = MARKETING_POST_LINES.join("\n\n").length;

/* The crop marks need a colour, and `--bracket-color` is declared by
 * `.tech-scope` — the signed-in app. This page is the paper system, so the
 * variable is handed to the one element that uses it. Typed on the constant
 * rather than asserted inline: a custom property is not part of
 * React.CSSProperties, and the project's lint rule refuses the cast. */
const BRACKET_STYLE: React.CSSProperties & Record<"--bracket-color", string> = {
  "--bracket-color": "var(--blue)",
};

const POST_ACTION_ICONS = [
  ThumbsUpIcon,
  MessageCircleIcon,
  Repeat2Icon,
  SendIcon,
] as const;

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
          {/* The screen's own header — the page name and what it does, which is
              what the app puts here. */}
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-ink px-[clamp(14px,2vw,22px)] py-[clamp(10px,1.4vw,16px)]">
            <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
              <PaperLabel size="band" className="tracking-[0.1em]">
                {MARKETING_COMPOSER.title}
              </PaperLabel>
              <span className="text-[12.5px] leading-tight text-grey">
                {MARKETING_COMPOSER.subtitle}
              </span>
            </div>

            {/* Drawn the way the dashboard draws a quota: a mono readout over a
                thin bar, rather than a sentence. */}
            {GENERATIONS ? (
              <div className="flex min-w-[148px] flex-col gap-1.5">
                <PaperLabel size="micro" tone="grey" className="tracking-[0.09em]">
                  {`${String(GENERATIONS.used)} / ${String(GENERATIONS.total)} generations left`}
                </PaperLabel>
                <span aria-hidden="true" className="block h-[3px] w-full bg-ink/12">
                  <span
                    className="block h-full bg-blue"
                    style={{
                      width: `${String((GENERATIONS.used / GENERATIONS.total) * 100)}%`,
                    }}
                  />
                </span>
              </div>
            ) : null}
          </div>

          {/* Controls left, the post right — the proportion the real screen
              uses. Below md they stack and the divider goes with the split. */}
          <div className="grid grid-cols-1 md:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
            <div className="flex min-w-0 flex-col gap-[clamp(14px,1.8vw,20px)] border-b border-ink p-[clamp(16px,2.2vw,26px)] md:border-r md:border-b-0">
              {/* Topic or an existing post — the composer's two real sources. */}
              <div className="flex">
                {MARKETING_COMPOSER.sourceTabs.map((tab, index) => (
                  <PaperLabel
                    key={tab}
                    as="span"
                    size="micro"
                    tone="inherit"
                    className={cn(
                      "border-b-2 px-3 pb-2 tracking-[0.1em]",
                      index === 0
                        ? "border-blue text-ink"
                        : "border-transparent text-grey",
                    )}
                  >
                    {tab}
                  </PaperLabel>
                ))}
              </div>

              <div className="flex flex-col gap-2">
                <PaperLabel size="micro" tone="grey" className="tracking-[0.09em]">
                  {MARKETING_COMPOSER.topicLabel}
                </PaperLabel>
                <div className="border border-ink px-3.5 py-3 font-mono text-[12.5px] leading-snug tracking-[-0.01em]">
                  {MARKETING_COMPOSER.topic}
                </div>
              </div>

              {/* The panel's one saturated control, wearing the app's crop
                  marks — see BRACKET_STYLE for why the colour is handed in. */}
              <span
                className="brackets inline-flex h-[42px] w-full items-center justify-center gap-2 bg-blue text-blue-foreground"
                style={BRACKET_STYLE}
              >
                <SparklesIcon aria-hidden="true" className="size-3.5" />
                <PaperLabel as="span" size="band" tone="inherit" className="tracking-[0.1em]">
                  {MARKETING_COMPOSER.generateLabel}
                </PaperLabel>
              </span>

              <dl className="m-0 flex flex-col gap-2.5 border-t border-hair pt-[clamp(12px,1.6vw,18px)]">
                {MARKETING_COMPOSER_CONTROLS.map((control) => (
                  <div
                    key={control.label}
                    className="flex items-center justify-between gap-3 border border-ink/25 px-3 py-2"
                  >
                    <dt>
                      <PaperLabel as="span" size="micro" tone="grey" className="tracking-[0.09em]">
                        {control.label}
                      </PaperLabel>
                    </dt>
                    <dd className="m-0 text-[12.5px] tracking-[-0.01em]">
                      {control.value}
                    </dd>
                  </div>
                ))}
              </dl>

              <p className="m-0 flex flex-wrap items-baseline gap-1.5 text-[12px] text-grey">
                {MARKETING_COMPOSER.voiceNote}
                <span className="text-ink underline underline-offset-2">
                  {MARKETING_COMPOSER.voiceAction}
                </span>
              </p>
            </div>

            <div className="flex min-w-0 flex-col gap-[clamp(14px,1.8vw,20px)] p-[clamp(16px,2.2vw,26px)]">
              {/* The draft, inside the post LinkedIn will publish. */}
              <div className="flex flex-col gap-3 border border-ink/20 p-[clamp(12px,1.6vw,18px)]">
                <div className="flex items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="flex size-9 flex-none items-center justify-center rounded-full border border-ink text-xs font-medium"
                  >
                    {MARKETING_COMPOSER.authorInitials}
                  </span>
                  <div className="min-w-0">
                    <p className="m-0 text-sm leading-tight font-semibold tracking-[-0.01em]">
                      {MARKETING_COMPOSER.authorName}
                    </p>
                    <span className="flex items-center gap-1.5 text-[11.5px] text-grey">
                      {MARKETING_COMPOSER.postedMeta}
                      <span aria-hidden="true">·</span>
                      <GlobeIcon aria-hidden="true" className="size-3" />
                    </span>
                  </div>
                </div>

                {MARKETING_POST_LINES.map((line) => (
                  <p
                    key={line}
                    className="m-0 text-[clamp(13px,1.25vw,14.5px)] leading-relaxed"
                  >
                    {line}
                  </p>
                ))}

                {/* The reaction row, at the weight LinkedIn gives it: present,
                    never competing with the copy above it. */}
                <div className="flex items-center justify-between gap-2 border-t border-hair pt-2.5">
                  {MARKETING_COMPOSER.postActions.map((action, index) => {
                    const Icon = POST_ACTION_ICONS[index] ?? ThumbsUpIcon;
                    return (
                      <span
                        key={action}
                        className="flex items-center gap-1.5 text-[11.5px] text-grey"
                      >
                        <Icon aria-hidden="true" className="size-3.5" />
                        {action}
                      </span>
                    );
                  })}
                </div>
              </div>

              {/* The commit row: what it costs against the platform's ceiling,
                  then the two ways out of the screen. */}
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
                <PaperLabel size="micro" tone="grey" className="tabular-nums tracking-[0.06em]">
                  {`${String(DRAFT_LENGTH)} / ${String(LINKEDIN_MAX_COMMENTARY)} ${MARKETING_COMPOSER.charactersLabel}`}
                </PaperLabel>

                <span className="flex flex-wrap items-center gap-2.5">
                  <PaperLabel
                    as="span"
                    size="band"
                    className="inline-flex h-[38px] items-center border border-ink px-3.5 tracking-[0.09em]"
                  >
                    {MARKETING_COMPOSER.saveLabel}
                  </PaperLabel>
                  <PaperLabel
                    as="span"
                    size="band"
                    tone="inverted"
                    className="inline-flex h-[38px] items-center gap-2 bg-ink px-4 tracking-[0.09em]"
                  >
                    <SendIcon aria-hidden="true" className="size-3.5" />
                    {MARKETING_COMPOSER.publishLabel}
                  </PaperLabel>
                </span>
              </div>

              <div className="flex flex-col gap-2.5 border-t border-hair pt-[clamp(12px,1.6vw,18px)]">
                <PaperLabel size="micro" className="tracking-[0.1em]">
                  {MARKETING_COMPOSER.recentLabel}
                </PaperLabel>

                {MARKETING_COMPOSER_RECENT.map((item) => (
                  <div key={item.title} className="flex flex-col gap-0.5">
                    <PaperLabel size="micro" tone="grey" className="tracking-[0.08em]">
                      {item.when}
                    </PaperLabel>
                    <p className="m-0 text-[12.5px] leading-snug tracking-[-0.01em]">
                      {item.title}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </PaperReveal>
    </section>
  );
}

/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use client";

/**
 * SOURCE OF TRUTH KEYWORDS: DemoPanel, MarketingPanelArtifact, useDemoStep,
 *   StepArtifact, FeaturePreview, draft calendar score, studio voice carousel
 *   ideas, panel shell, micro interaction, demo motion, CountUp
 *
 * WHAT:  The white panel beside a row in the dark band — all seven of them, in
 *        one component with an exhaustive switch. Each one plays a single state
 *        change the first time it is seen, and steps forward again under a
 *        mouse where it has somewhere to step.
 * WHY:   ONE SHELL, ONE TRIGGER, ONE CURVE. The panels used to be two
 *        components in two files — StepArtifact in how-it-works and
 *        FeaturePreview in feature-rows — each with its own copy of the same
 *        shell string. Seven panels down one column read as one object seen
 *        seven times, and two definitions of that object is how they start
 *        drifting apart. Once they also needed state, the split would have
 *        meant two reduced-motion gates and two in-view thresholds as well.
 *
 *        EVERY DEMO IS A MOVE BETWEEN TWO TRUE STATES, never a reveal of hidden
 *        content: a queued post goes out, an idea gets a slot, a deck turns a
 *        page, a meter fills to a score that is already printed beside it. So
 *        the server HTML is a panel a reader can use, and a visitor whose JS
 *        never arrives sees page one of the deck rather than an empty card.
 *        Nothing here may animate from `opacity: 0`.
 *
 *        THE MOTION IS TWO CONSTANTS. Everything transitions on the app's own
 *        --ease-out at one duration, and both constants carry
 *        `motion-reduce:transition-none`, so a reduced-motion reader gets the
 *        same state changes with none of the travel — the panel still
 *        demonstrates, it just arrives already done.
 *
 *        It is a CLIENT component so that how-it-works and feature-rows can
 *        stay server components: the band's headlines, copy and hairlines are
 *        static, and only these panels need a hook.
 * WHERE: Rendered by how-it-works.tsx (steps) and feature-rows.tsx (features).
 *        Private to those two — deliberately not in the barrel.
 */

import * as React from "react";

import {
  MARKETING_CALENDAR,
  MARKETING_COMPOSER,
  MARKETING_FEATURE_PREVIEWS,
  MARKETING_POST_LINES,
  MARKETING_PROFILE_ROWS,
  MARKETING_PROFILE_SCORE,
  type MarketingPanelArtifact,
} from "@/lib/config";
import { CountUp } from "@/components/global/count-up";
import { PaperLabel } from "@/components/global/paper";
import { useDemoStep } from "@/hooks/use-demo-step";
import { cn } from "@/lib/utils";

/** The panel. White ground, ink text, 18px padding — the band's one card. */
const SHELL = "flex flex-col gap-3 bg-paper-raised p-[18px] text-ink";

/** Colour, fill and position changes. */
const MOTION =
  "transition duration-500 ease-[var(--ease-out)] motion-reduce:transition-none";

/** The meter, which grows rather than moves, and takes longer to be readable. */
const MOTION_WIDTH =
  "transition-[width] duration-[900ms] ease-[var(--ease-out)] motion-reduce:transition-none";

/** What every panel body is handed. See useDemoStep for what the two mean. */
interface DemoBodyProps {
  active: boolean;
  cycle: number;
}

export function DemoPanel({ artifact }: { artifact: MarketingPanelArtifact }) {
  const { ref, active, cycle, hoverProps } = useDemoStep();
  const Body = PANEL_BODIES[artifact];

  return (
    <div ref={ref} {...hoverProps} className={SHELL}>
      <Body active={active} cycle={cycle} />
    </div>
  );
}

/* A complete record rather than a switch: a step or a feature added to the
   config without a panel here is a compile error at THIS line, which is the
   only place that can see both lists. */
const PANEL_BODIES: Record<
  MarketingPanelArtifact,
  React.ComponentType<DemoBodyProps>
> = {
  draft: DraftBody,
  calendar: CalendarBody,
  score: ScoreBody,
  studio: StudioBody,
  voice: VoiceBody,
  carousel: CarouselBody,
  ideas: IdeasBody,
};

/* ---------- [1] The draft writes in, then goes out ---------- */

function DraftBody({ active }: DemoBodyProps) {
  return (
    <>
      <PaperLabel size="micro" tone="grey" className="tracking-[0.12em]">
        {MARKETING_COMPOSER.draftLabel}
      </PaperLabel>

      {/* The lines come up to full strength one after another — a draft
          arriving, not a paragraph fading in. They start at 45%, which is a
          legible grey rather than a hidden line. */}
      {MARKETING_POST_LINES.map((line, index) => (
        <p
          key={line}
          className={cn(
            "m-0 text-[13px] leading-normal",
            MOTION,
            active ? "opacity-100" : "opacity-45",
          )}
          style={{ transitionDelay: `${String(index * 90)}ms` }}
        >
          {line}
        </p>
      ))}

      {/* The button fills last, once there is something to post. */}
      <PaperLabel
        as="span"
        size="micro"
        tone="inherit"
        className={cn(
          "self-start border border-blue px-3 py-[7px] tracking-[0.09em]",
          MOTION,
          active ? "bg-blue text-blue-foreground" : "bg-transparent text-blue",
        )}
        style={{
          transitionDelay: `${String(MARKETING_POST_LINES.length * 90)}ms`,
        }}
      >
        {MARKETING_COMPOSER.publishLabel}
      </PaperLabel>
    </>
  );
}

/* ---------- [2] The queue drains ---------- */

function CalendarBody({ active, cycle }: DemoBodyProps) {
  /* One scheduled post goes out when the panel is first seen, and one more
     each time a mouse enters it — the calendar's whole promise is that the
     queue empties itself while you are not looking. */
  const sentCount = active
    ? Math.min(cycle + 1, MARKETING_CALENDAR.scheduled.length)
    : 0;
  const sent = MARKETING_CALENDAR.scheduled.slice(0, sentCount);

  return (
    <>
      <div className="flex items-center justify-between gap-2.5">
        <PaperLabel size="micro" className="tracking-[0.12em]">
          {MARKETING_CALENDAR.month}
        </PaperLabel>
        <PaperLabel size="micro" tone="grey">
          {MARKETING_CALENDAR.scheduledLabel}
        </PaperLabel>
      </div>

      <div className="grid grid-cols-7 gap-[5px]">
        {Array.from({ length: MARKETING_CALENDAR.days }, (_, i) => i + 1).map(
          (day) => (
            <span
              key={day}
              className={cn(
                "flex h-[26px] items-center justify-center text-[10px] tabular-nums",
                MOTION,
                /* Three states, in the order the real calendar draws them:
                   already out, going out, and nothing planned. A day the demo
                   has sent joins the first group. */
                MARKETING_CALENDAR.published.includes(day) || sent.includes(day)
                  ? "bg-ink text-ink-foreground"
                  : MARKETING_CALENDAR.scheduled.includes(day)
                    ? "bg-blue text-blue-foreground"
                    : "bg-ink/5 text-grey",
              )}
            >
              {day}
            </span>
          ),
        )}
      </div>
    </>
  );
}

/* ---------- [3] The score is measured ---------- */

function ScoreBody({ active }: DemoBodyProps) {
  return (
    <>
      <PaperLabel size="micro" tone="grey" className="tracking-[0.12em]">
        {MARKETING_PROFILE_SCORE.label}
      </PaperLabel>

      <p className="m-0 flex items-baseline gap-[7px]">
        <span className="font-paper-display text-[56px] leading-[0.84] tracking-[-0.05em]">
          <CountUp value={MARKETING_PROFILE_SCORE.value} />
        </span>
        <span className="text-[11px] text-grey">
          / {MARKETING_PROFILE_SCORE.outOf}
        </span>
      </p>

      {/* A bar, not a ring: a square meter is the only shape this system has.
          Its width is computed from the same value the numeral prints, so the
          two cannot drift apart — and they now fill together. */}
      <div className="h-1.5 bg-ink/10">
        <div
          className={cn("h-full bg-blue", MOTION_WIDTH)}
          style={{
            width: active
              ? `${String((MARKETING_PROFILE_SCORE.value / MARKETING_PROFILE_SCORE.outOf) * 100)}%`
              : "0%",
          }}
        />
      </div>

      {MARKETING_PROFILE_ROWS.map((row) => (
        <div
          key={row.section}
          className="flex items-center justify-between gap-2.5 border-t border-ink/10 pt-2"
        >
          <span className="text-[12.5px]">{row.section}</span>
          <PaperLabel as="span" size="micro" tone={row.good ? "grey" : "blue"}>
            {row.verdict}
          </PaperLabel>
        </div>
      ))}
    </>
  );
}

/* ---------- [4] The avatar drops into the banner ---------- */

function StudioBody({ active }: DemoBodyProps) {
  const preview = MARKETING_FEATURE_PREVIEWS.studio;

  return (
    <>
      <PaperLabel size="micro" tone="grey" className="tracking-[0.12em]">
        {preview.label}
      </PaperLabel>

      {/* The canvas presets as the studio lists them: the one being drawn is
          filled, the rest wait. */}
      <div className="flex flex-wrap gap-1.5">
        {preview.presets.map((preset) => (
          <PaperLabel
            key={preset}
            as="span"
            size="micro"
            tone="inherit"
            className={cn(
              "px-2.5 py-[5px] tracking-[0.09em]",
              preset === preview.activePreset
                ? "bg-ink text-ink-foreground"
                : "bg-ink/5 text-grey",
            )}
          >
            {preset}
          </PaperLabel>
        ))}
      </div>

      <div className="flex aspect-[4/1] items-center bg-ink px-[14px] text-ink-foreground">
        <span className="font-paper-display text-[clamp(14px,2.2vw,22px)] leading-[0.9] tracking-[-0.045em]">
          {preview.bannerLine}
        </span>
      </div>

      {/* Pulled up over the banner's lower edge, where LinkedIn drops the
          avatar. That overlap is the reason a banner's safe area matters, and
          therefore the reason this surface exists — so the avatar DROPS the
          last few pixels into its hole rather than starting in it.

          The name sits UNDER the avatar rather than beside it — beside it, the
          line rode up into the banner with the avatar and was printed
          white-on-ink halfway through a word. */}
      <div className="-mt-[34px] flex flex-col gap-2 pl-3">
        <span
          aria-hidden="true"
          className={cn(
            "size-[46px] rounded-full border-[3px] border-paper-raised bg-blue",
            MOTION,
            active ? "translate-y-0" : "-translate-y-3.5",
          )}
        />
        <div
          className={cn(
            "flex min-w-0 flex-col",
            MOTION,
            active ? "opacity-100" : "opacity-55",
          )}
          style={{ transitionDelay: "160ms" }}
        >
          <span className="truncate text-[12.5px] leading-tight font-medium">
            {preview.name}
          </span>
          <span className="truncate text-[11.5px] leading-tight text-grey">
            {preview.role}
          </span>
        </div>
      </div>
    </>
  );
}

/* ---------- [5] The profile learns ---------- */

function VoiceBody({ active }: DemoBodyProps) {
  const preview = MARKETING_FEATURE_PREVIEWS.voice;

  return (
    <>
      <PaperLabel size="micro" tone="grey" className="tracking-[0.12em]">
        {preview.label}
      </PaperLabel>

      <div className="flex items-baseline justify-between gap-2.5 border-b border-ink/10 pb-2.5">
        <span className="text-[12.5px]">{preview.sourceLabel}</span>
        <span className="font-mono text-[12px] tabular-nums">
          <CountUp value={preview.sourceCount} /> {preview.sourceUnit}
        </span>
      </div>

      {/* The traits are a voice profile's readable output — the part of it the
          app can actually show you it learned. Their marks strike one at a
          time, which is the closest thing to watching it read. */}
      <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
        {preview.traits.map((trait, index) => (
          <li key={trait} className="flex items-center gap-2.5 text-[13px]">
            <span
              aria-hidden="true"
              className={cn(
                "size-[7px] flex-none bg-blue",
                MOTION,
                active ? "scale-100" : "scale-0",
              )}
              style={{ transitionDelay: `${String(index * 110)}ms` }}
            />
            {trait}
          </li>
        ))}
      </ul>

      <PaperLabel
        as="span"
        size="micro"
        tone="inherit"
        className={cn(
          "self-start bg-ink px-3 py-[7px] tracking-[0.09em] text-ink-foreground",
          MOTION,
          active ? "translate-y-0 opacity-100" : "translate-y-1 opacity-60",
        )}
        style={{
          transitionDelay: `${String(preview.traits.length * 110)}ms`,
        }}
      >
        {preview.appliedLabel}
      </PaperLabel>
    </>
  );
}

/* ---------- [6] The deck is swiped ---------- */

function CarouselBody({ active, cycle }: DemoBodyProps) {
  const preview = MARKETING_FEATURE_PREVIEWS.carousel;
  /* Turns to page two when seen, and one further on every mouse entry —
     wrapping, because a deck is a loop and the alternative is a panel that
     stops responding after two hovers. */
  const page = active ? (cycle + 1) % preview.slides.length : 0;

  return (
    <>
      <div className="flex items-center justify-between gap-2.5">
        <PaperLabel size="micro" tone="grey" className="tracking-[0.12em]">
          {preview.label}
        </PaperLabel>
        <span className="font-mono text-[11px] text-grey tabular-nums">
          {`${String(page + 1).padStart(2, "0")} / ${String(preview.pages).padStart(2, "0")}`}
        </span>
      </div>

      {/* Three pages at the ratio the renderer rasterises, side by side rather
          than stacked: a deck is read one page at a time, and the one being
          read is the one that is inked. */}
      <div className="flex gap-2">
        {preview.slides.map((slide, index) => (
          <div
            key={slide}
            className={cn(
              "flex aspect-[4/5] flex-1 flex-col justify-between p-2.5",
              MOTION,
              index === page
                ? "bg-ink text-ink-foreground"
                : "bg-ink/5 text-ink/40",
            )}
          >
            <span className="font-paper-display text-[13px] leading-[0.95] tracking-[-0.035em]">
              {slide}
            </span>
            <span className="font-mono text-[10px] tabular-nums">
              {String(index + 1).padStart(2, "0")}
            </span>
          </div>
        ))}
      </div>

      {/* The swipe indicator, at the deck's real length. */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-1">
          {Array.from({ length: preview.pages }, (_, index) => (
            <span
              key={index}
              className={cn(
                "h-1 w-[18px]",
                MOTION,
                index === page ? "bg-blue" : "bg-ink/15",
              )}
            />
          ))}
        </div>
        <PaperLabel as="span" size="micro" tone="grey">
          {preview.outputLabel}
        </PaperLabel>
      </div>
    </>
  );
}

/* ---------- [7] An idea gets a slot ---------- */

function IdeasBody({ active, cycle }: DemoBodyProps) {
  const preview = MARKETING_FEATURE_PREVIEWS.ideas;
  /* The top idea is placed when the panel is seen, the next on each mouse
     entry. This is the row the copy beside it describes: a captured line
     becoming a date. */
  const plannedCount = active
    ? Math.min(cycle + 1, preview.items.length)
    : 0;

  return (
    <>
      <PaperLabel size="micro" tone="grey" className="tracking-[0.12em]">
        {preview.label}
      </PaperLabel>

      <ul className="m-0 flex list-none flex-col p-0">
        {preview.items.map((item, index) => {
          const planned = index < plannedCount;

          return (
            <li
              key={item.text}
              className="flex items-center gap-2.5 border-b border-ink/10 py-2.5 last:border-b-0"
            >
              <span
                aria-hidden="true"
                className={cn(
                  "size-[11px] flex-none border",
                  MOTION,
                  planned ? "border-blue bg-blue" : "border-ink/25",
                )}
                style={{ transitionDelay: `${String(index * 120)}ms` }}
              />
              <span className="min-w-0 flex-1 text-[12.5px] leading-snug">
                {item.text}
              </span>
              <span
                className={cn(
                  "flex-none font-mono text-[11px] tabular-nums",
                  MOTION,
                  planned ? "text-ink" : "text-grey",
                )}
                style={{ transitionDelay: `${String(index * 120)}ms` }}
              >
                {planned ? item.slot : preview.capturedLabel}
              </span>
            </li>
          );
        })}
      </ul>

      <div className="flex items-baseline justify-between gap-2.5 border-t border-ink/10 pt-2.5">
        <PaperLabel as="span" size="micro" tone="grey">
          {preview.planLabel}
        </PaperLabel>
        {/* Counts with the rows rather than beside them: the month fills
            BECAUSE the ideas were placed. */}
        <span className="font-mono text-[12px] tabular-nums">
          {`${String(preview.filledSlots + plannedCount)} of ${String(preview.totalSlots)} slots`}
        </span>
      </div>
    </>
  );
}

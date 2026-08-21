/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: HowItWorks, MARKETING_STEPS, MarketingStepArtifact,
 *   MARKETING_POST_LINES, MARKETING_CALENDAR, MARKETING_PROFILE_ROWS,
 *   StepArtifact, PaperDisplay, PaperLabel, dark band, ink section,
 *   alternating bleed, draft calendar score
 *
 * WHAT:  The dark band — three steps, each pairing a display headline with the
 *        artifact that step produces: a draft, a month of calendar, a profile
 *        score.
 * WHY:   The band inverts to ink so the middle of the page has one hard change
 *        of ground in it; on that ground the artifacts are white panels, which
 *        is the only contrast rule 2 leaves available once shadows are out.
 *
 *        The artifacts alternate which edge they bleed off, and they are CROPPED
 *        by the section rather than fitted inside it — `margin-right:
 *        calc(-1 * var(--gutter))` on the even rows and the mirror on the odd
 *        ones. A panel that stops neatly inside the gutter reads as a
 *        screenshot pasted into a slide; one that runs off the edge reads as a
 *        window onto something larger. The bleed is computed FROM --gutter, so
 *        it stays flush at every width without a second copy of the clamp.
 *
 *        `artifact` is switched on exhaustively, so a fourth step cannot ship
 *        without someone deciding what it shows.
 * WHERE: src/app/(marketing)/page.tsx, after ComposerShowcase.
 */

import {
  MARKETING_CALENDAR,
  MARKETING_COMPOSER,
  MARKETING_POST_LINES,
  MARKETING_PROFILE_ROWS,
  MARKETING_PROFILE_SCORE,
  MARKETING_SECTION_IDS,
  MARKETING_STEPS,
  type MarketingStepArtifact,
} from "@/lib/config";
import {
  PaperLabel,
  PaperDisplay,
  PaperReveal,
} from "@/components/global/paper";
import { cn } from "@/lib/utils";

export function HowItWorks() {
  return (
    <section
      id={MARKETING_SECTION_IDS.how}
      className="relative z-6 overflow-hidden bg-ink px-(--gutter) py-[clamp(64px,10vw,130px)] text-ink-foreground"
    >
      {/* One stagger across the three STEP ROWS rather than one per row: the
          band is read as a sequence, and three independent reveals would race
          each other on a tall viewport that shows two rows at once. */}
      <PaperReveal
        distance={40}
        className="mx-auto flex w-full max-w-[1320px] flex-col gap-[clamp(56px,8vw,110px)]"
      >
        {MARKETING_STEPS.map((step, index) => (
          <div
            key={step.marker}
            className="grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] items-center gap-[clamp(24px,4vw,56px)]"
          >
            <div className="flex min-w-0 flex-col gap-4">
              <div className="flex flex-wrap items-baseline gap-3">
                <PaperLabel
                  as="span"
                  size="band"
                  tone="inherit"
                  className="bg-blue px-2 py-1 text-[12px] tracking-[0.1em] text-blue-foreground"
                >
                  {step.marker}
                </PaperLabel>
                <span className="text-[clamp(15px,1.7vw,22px)] tracking-[-0.02em] text-ink-foreground/50">
                  {step.lead}
                </span>
              </div>

              <PaperDisplay
                as="h3"
                words={step.headline}
                className="text-[clamp(34px,6.4vw,96px)] leading-[0.86] tracking-[-0.045em]"
              />

              <p className="m-0 max-w-[30em] text-[clamp(14px,1.4vw,17px)] leading-relaxed text-pretty text-ink-foreground/60">
                {step.body}
              </p>
            </div>

            <div
              className={cn(
                "w-[min(100%,420px)] min-w-0",
                /* Flush to the section edge and cropped by it, alternating. */
                index % 2 === 0
                  ? "justify-self-end -mr-(--gutter)"
                  : "justify-self-start -ml-(--gutter)",
              )}
            >
              <StepArtifact artifact={step.artifact} />
            </div>
          </div>
        ))}
      </PaperReveal>
    </section>
  );
}

/**
 * SOURCE OF TRUTH KEYWORDS: StepArtifact, MarketingStepArtifact, draft artifact,
 *   calendar artifact, score artifact
 *
 * WHAT:  The white panel beside a step. One component with an exhaustive switch
 *        rather than three exported siblings.
 * WHY:   The three share their entire outer treatment — white ground, ink text,
 *        18px padding, 12px stack — and differ only in contents. Keeping the
 *        shell in one place is what stops the second and third from drifting a
 *        pixel off the first, which on a page built from hard edges is visible.
 */
function StepArtifact({ artifact }: { artifact: MarketingStepArtifact }) {
  const shell = "flex flex-col gap-3 bg-paper-raised p-[18px] text-ink";

  if (artifact === "draft") {
    return (
      <div className={shell}>
        <PaperLabel size="micro" tone="grey" className="tracking-[0.12em]">
          {MARKETING_COMPOSER.authorRole}
        </PaperLabel>
        {MARKETING_POST_LINES.map((line) => (
          <p key={line} className="m-0 text-[13px] leading-normal">
            {line}
          </p>
        ))}
        <PaperLabel
          as="span"
          size="micro"
          tone="inherit"
          className="self-start bg-blue px-3 py-[7px] tracking-[0.09em] text-blue-foreground"
        >
          {MARKETING_COMPOSER.publishLabel}
        </PaperLabel>
      </div>
    );
  }

  if (artifact === "calendar") {
    return (
      <div className={shell}>
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
                  /* Three states, in the order the real calendar draws them:
                     already out, going out, and nothing planned. */
                  MARKETING_CALENDAR.published.includes(day)
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
      </div>
    );
  }

  return (
    <div className={shell}>
      <PaperLabel size="micro" tone="grey" className="tracking-[0.12em]">
        {MARKETING_PROFILE_SCORE.label}
      </PaperLabel>
      <p className="m-0 flex items-baseline gap-[7px]">
        <span className="font-paper-display text-[56px] leading-[0.84] tracking-[-0.05em]">
          {MARKETING_PROFILE_SCORE.value}
        </span>
        <span className="text-[11px] text-grey">
          / {MARKETING_PROFILE_SCORE.outOf}
        </span>
      </p>
      {/* A bar, not a ring: a square meter is the only shape this system has.
          Its width is computed from the same value the numeral prints, so the
          two cannot drift apart. */}
      <div className="h-1.5 bg-ink/10">
        <div
          className="h-full bg-blue"
          style={{
            width: `${(MARKETING_PROFILE_SCORE.value / MARKETING_PROFILE_SCORE.outOf) * 100}%`,
          }}
        />
      </div>
      {MARKETING_PROFILE_ROWS.map((row) => (
        <div
          key={row.section}
          className="flex items-center justify-between gap-2.5 border-t border-ink/10 pt-2"
        >
          <span className="text-[12.5px]">{row.section}</span>
          <PaperLabel
            as="span"
            size="micro"
            tone={row.good ? "grey" : "blue"}
          >
            {row.verdict}
          </PaperLabel>
        </div>
      ))}
    </div>
  );
}

/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: FeatureRows, FeaturePreview, MARKETING_FEATURES,
 *   MARKETING_FEATURE_PREVIEWS, feature rows, preview panel, hairline,
 *   mono metadata, dark band, PaperDisplay, PaperLabel, how it works
 *
 * WHAT:  The four surfaces the composer and the three steps do not cover —
 *        studio, voice, carousel, ideas — one ruled row each: the copy on the
 *        left, a panel showing the surface itself on the right.
 *
 * WHY:   PART OF THE DARK BAND, not a section of its own. These rows and the
 *        steps above them answer one question between them — what is this thing
 *        made of — and as two separate sections, one cream and one ink, the page
 *        asked the reader to cross a hard colour boundary in the middle of a
 *        single answer.
 *
 *        THE STEP ROW'S LAYOUT, EXACTLY: the same two-column grid, breakpoint,
 *        hairline, marker chip and 400px panel pinned to the right edge. An
 *        earlier pass matched only the numbering and kept a three-column row
 *        with a small line drawing in the left gutter — and numbering alone
 *        merged nothing, because the band still changed shape halfway down,
 *        which a reader sees before any ordinal. These rows are the steps'
 *        format carrying a set's contents.
 *
 *        WHICH MEANS REAL PANELS, NOT DIAGRAMS. The drawings were flat stroked
 *        line art, deliberately quiet so they would not compete with the steps'
 *        white cards; standing in the steps' own slot, that quietness reads as
 *        a missing card. Each row now shows a glimpse of its surface in the
 *        idiom the step artifacts already use — white ground, ink text, 18px
 *        padding — because on this band a white panel is the only contrast the
 *        system allows.
 *
 *        THE DASHBOARD'S STRUCTURE, ON THE LANDING PAGE'S BAND: a section
 *        marker, a short lead over a condensed heading, a hairline where
 *        something is genuinely separated, and metadata as label/value pairs.
 *
 *        THE ROWS ARE NUMBERED, continuing the steps above them rather than
 *        restarting. An earlier pass took the ordinals off on the grounds that
 *        a number claims an order and these four are a set — nobody does studio
 *        before voice. That argument lost to a stronger one: with names on one
 *        half of the band and numbers on the other, the two halves read as two
 *        different sections, and the join is the thing this band exists to
 *        make. The numbers are a reading order now, not a workflow.
 *
 *        They are DERIVED from the step count, never written down. [4] is
 *        "after the three steps", so adding a fourth step renumbers these
 *        automatically instead of quietly producing two number fours.
 * WHERE: Rendered inside HowItWorks, after its three steps. Not exported from
 *        the barrel — private to that one parent, like StepArtifact.
 */

import type { MarketingFeature } from "@/lib/config";
import {
  MARKETING_FEATURES,
  MARKETING_FEATURE_PREVIEWS,
  MARKETING_STEPS,
} from "@/lib/config";
import { PaperDisplay, PaperLabel } from "@/components/global/paper";
import { cn } from "@/lib/utils";

export function FeatureRows() {
  return (
    <>
      {MARKETING_FEATURES.map((feature, index) => (
        <article
          key={feature.label}
          /* The step row's className, minus its `first:` rules — a feature row
             is never first, there are always three steps above it, so every one
             of them carries the hairline that separates it from what came
             before. */
          className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] items-start gap-[clamp(24px,4vw,56px)] border-t border-ink-foreground/12 py-[clamp(40px,6vw,76px)] last:pb-0"
        >
          <div className="flex min-w-0 flex-col gap-4">
            {/* The number and the surface's name, in the slot where a step puts
                its marker and its lead. The name IS the lead here, so it takes
                the lead's treatment rather than a mono label, which would
                announce a different kind of row. */}
            <div className="flex flex-wrap items-baseline gap-3">
              <PaperLabel
                as="span"
                size="band"
                tone="inherit"
                className="bg-blue px-2 py-1 text-[12px] tracking-[0.1em] text-blue-foreground"
              >
                {`[${String(MARKETING_STEPS.length + index + 1)}]`}
              </PaperLabel>
              <span className="text-[clamp(14px,1.3vw,18px)] tracking-[-0.02em] text-ink-foreground/50">
                {feature.label}
              </span>
            </div>

            <PaperDisplay
              as="h3"
              words={feature.title}
              /* A step under the steps' 64px. These four titles are sentences
                 where a step's is a command ("Queue it for Tuesday"), and at
                 the larger size the longest of them took a third line beside a
                 panel that is only so tall. */
              className="text-[clamp(28px,4vw,54px)] leading-[0.88] tracking-[-0.045em]"
            />

            <p className="m-0 max-w-[28em] text-[clamp(14px,1.4vw,17px)] leading-relaxed text-pretty text-ink-foreground/70">
              {feature.body}
            </p>

            {/* Label over value, in mono — the dashboard's metadata pair. These
                are here to be CHECKED rather than admired, which is why every
                value is a real figure from the app rather than a rounded claim.
                They sit under the copy they qualify instead of being pinned to
                the foot of the row: the row's height is set by a panel now, and
                pinning would hang them in whatever space the panel left over. */}
            <dl className="m-0 mt-1 flex flex-wrap gap-x-[clamp(20px,3vw,40px)] gap-y-3 border-t border-ink-foreground/12 pt-4">
              {feature.meta.map((item) => (
                <div key={item.label} className="flex flex-col gap-1">
                  <dt>
                    <PaperLabel
                      as="span"
                      size="micro"
                      tone="inverted"
                      className="text-ink-foreground/55"
                    >
                      {item.label}
                    </PaperLabel>
                  </dt>
                  <dd className="m-0 font-mono text-[13px] tracking-[0.01em] text-ink-foreground tabular-nums">
                    {item.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="w-[min(100%,400px)] min-w-0 justify-self-end">
            <FeaturePreview artifact={feature.artifact} />
          </div>
        </article>
      ))}
    </>
  );
}

/**
 * SOURCE OF TRUTH KEYWORDS: FeaturePreview, MARKETING_FEATURE_PREVIEWS,
 *   studio preview, voice preview, carousel preview, ideas preview
 *
 * WHAT:  The white panel beside a feature row. One component with an exhaustive
 *        switch, the same shape and the same shell string as StepArtifact.
 * WHY:   Seven panels down one column have to read as one object seen seven
 *        times; two components either side of a shared shell is how they start
 *        drifting a pixel apart, which on a page built from hard edges shows.
 *
 *        Each panel draws the ONE thing its surface makes, at the proportion
 *        that thing really has — a 4:1 banner with the avatar hole punched in
 *        it, 4:5 deck pages — so the figures in the row's metadata are visible
 *        in the drawing rather than only asserted beside it.
 */
function FeaturePreview({
  artifact,
}: {
  artifact: MarketingFeature["artifact"];
}) {
  const shell = "flex flex-col gap-3 bg-paper-raised p-[18px] text-ink";

  if (artifact === "studio") {
    const preview = MARKETING_FEATURE_PREVIEWS.studio;

    return (
      <div className={shell}>
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
            therefore the reason this surface exists.

            The name sits UNDER the avatar rather than beside it — beside it,
            the line rode up into the banner with the avatar and was printed
            white-on-ink halfway through a word. */}
        <div className="-mt-[34px] flex flex-col gap-2 pl-3">
          <span
            aria-hidden="true"
            className="size-[46px] rounded-full border-[3px] border-paper-raised bg-blue"
          />
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-[12.5px] leading-tight font-medium">
              {preview.name}
            </span>
            <span className="truncate text-[11.5px] leading-tight text-grey">
              {preview.role}
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (artifact === "voice") {
    const preview = MARKETING_FEATURE_PREVIEWS.voice;

    return (
      <div className={shell}>
        <PaperLabel size="micro" tone="grey" className="tracking-[0.12em]">
          {preview.label}
        </PaperLabel>

        <div className="flex items-baseline justify-between gap-2.5 border-b border-ink/10 pb-2.5">
          <span className="text-[12.5px]">{preview.sourceLabel}</span>
          <span className="font-mono text-[12px] tabular-nums">
            {preview.sourceValue}
          </span>
        </div>

        {/* The traits are a voice profile's readable output — the part of it the
            app can actually show you it learned. */}
        <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
          {preview.traits.map((trait) => (
            <li key={trait} className="flex items-center gap-2.5 text-[13px]">
              <span
                aria-hidden="true"
                className="size-[7px] flex-none bg-blue"
              />
              {trait}
            </li>
          ))}
        </ul>

        <PaperLabel
          as="span"
          size="micro"
          tone="inherit"
          className="self-start bg-ink px-3 py-[7px] tracking-[0.09em] text-ink-foreground"
        >
          {preview.appliedLabel}
        </PaperLabel>
      </div>
    );
  }

  if (artifact === "carousel") {
    const preview = MARKETING_FEATURE_PREVIEWS.carousel;

    return (
      <div className={shell}>
        <div className="flex items-center justify-between gap-2.5">
          <PaperLabel size="micro" tone="grey" className="tracking-[0.12em]">
            {preview.label}
          </PaperLabel>
          <span className="font-mono text-[11px] text-grey tabular-nums">
            {`01 / ${String(preview.pages).padStart(2, "0")}`}
          </span>
        </div>

        {/* Three pages at the ratio the renderer rasterises, side by side rather
            than stacked: a deck is read one page at a time. */}
        <div className="flex gap-2">
          <div className="flex aspect-[4/5] flex-1 flex-col justify-between bg-ink p-2.5 text-ink-foreground">
            <span className="font-paper-display text-[13px] leading-[0.95] tracking-[-0.035em]">
              {preview.coverLine}
            </span>
            <span className="font-mono text-[10px] tabular-nums">01</span>
          </div>
          {[2, 3].map((page) => (
            <div
              key={page}
              className="flex aspect-[4/5] flex-1 flex-col gap-1.5 bg-ink/5 p-2.5"
            >
              <span className="h-1.5 w-[85%] bg-ink/20" />
              <span className="h-1.5 w-[60%] bg-ink/15" />
              <span className="mt-auto h-1.5 w-[40%] bg-ink/10" />
            </div>
          ))}
        </div>

        {/* The swipe indicator, at the deck's real length. */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex gap-1">
            {Array.from({ length: preview.pages }, (_, page) => (
              <span
                key={page}
                className={cn(
                  "h-1 w-[18px]",
                  page === 0 ? "bg-blue" : "bg-ink/15",
                )}
              />
            ))}
          </div>
          <PaperLabel as="span" size="micro" tone="grey">
            {preview.outputLabel}
          </PaperLabel>
        </div>
      </div>
    );
  }

  const preview = MARKETING_FEATURE_PREVIEWS.ideas;

  return (
    <div className={shell}>
      <PaperLabel size="micro" tone="grey" className="tracking-[0.12em]">
        {preview.label}
      </PaperLabel>

      {/* Captured lines, one of which has a slot. That difference — a date
          against a line you typed in three seconds — is the whole distance
          between an inbox and a plan. */}
      <ul className="m-0 flex list-none flex-col p-0">
        {preview.items.map((item) => (
          <li
            key={item.text}
            className="flex items-center gap-2.5 border-b border-ink/10 py-2.5 last:border-b-0"
          >
            <span
              aria-hidden="true"
              className={cn(
                "size-[11px] flex-none border",
                item.planned ? "border-blue bg-blue" : "border-ink/25",
              )}
            />
            <span className="min-w-0 flex-1 text-[12.5px] leading-snug">
              {item.text}
            </span>
            <span
              className={cn(
                "flex-none font-mono text-[11px] tabular-nums",
                item.planned ? "text-ink" : "text-grey",
              )}
            >
              {item.status}
            </span>
          </li>
        ))}
      </ul>

      <div className="flex items-baseline justify-between gap-2.5 border-t border-ink/10 pt-2.5">
        <PaperLabel as="span" size="micro" tone="grey">
          {preview.planLabel}
        </PaperLabel>
        <span className="font-mono text-[12px] tabular-nums">
          {preview.planValue}
        </span>
      </div>
    </div>
  );
}

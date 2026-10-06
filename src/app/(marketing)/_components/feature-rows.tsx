/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: FeatureRows, DemoPanel, MARKETING_FEATURES,
 *   MARKETING_STEPS, feature rows, preview panel, hairline, mono metadata,
 *   dark band, PaperDisplay, PaperLabel, how it works
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
 *        a missing card. A row's panel is now a DemoPanel — the same component
 *        the steps use, white ground and all — so the seven of them are one
 *        object seen seven times rather than two families sharing a column.
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
 *        the barrel — private to that one parent, like DemoPanel.
 */

import { MARKETING_FEATURES, MARKETING_STEPS } from "@/lib/config";
import { PaperDisplay, PaperLabel } from "@/components/global/paper";
import { cn } from "@/lib/utils";
import { BAND_ROW } from "./band-row";
import { DemoPanel } from "./demo-panel";

export function FeatureRows() {
  return (
    <>
      {MARKETING_FEATURES.map((feature, index) => (
        <article
          key={feature.label}
          /* The band's shared row, minus the steps' `first:` rules — a feature
             row is never first, there are always three steps above it, so every
             one of them carries the hairline that separates it from what came
             before. */
          className={cn(BAND_ROW.row, "last:pb-0")}
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
                className={BAND_ROW.marker}
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

            {/* NO METADATA ROW. A `<dl>` of label-over-value pairs used to sit
                here — "Banner / 1584 × 396", "Export / PNG" and the three other
                features' equivalents. It was removed on request: the pairs read
                as spec-sheet chrome under copy that is already making the
                point, and the four rows are quieter without them.

                MARKETING_FEATURES still carries `meta`, and it is NOT dead —
                product-tour-mock.tsx draws the carousel screen's "Page 1080 ×
                1350 · Output PDF" readout from the same entries, where the
                numbers are the simulated app's own UI rather than a claim made
                to the reader. Deleting the field would blank that readout. */}
          </div>

          <div className="w-[min(100%,400px)] min-w-0 justify-self-end">
            <DemoPanel artifact={feature.artifact} />
          </div>
        </article>
      ))}
    </>
  );
}

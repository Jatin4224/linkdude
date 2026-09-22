/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: FeatureRows, FeatureArtifact, MARKETING_FEATURES,
 *   feature rows, section marker, hairline, mono metadata, dark band,
 *   PaperDisplay, PaperLabel, how it works
 *
 * WHAT:  The four surfaces the composer and the three steps do not cover —
 *        studio, voice, carousel, ideas — one ruled row each: a drawing of the
 *        thing, its name, the claim, and the numbers that prove it.
 *
 * WHY:   PART OF THE DARK BAND, not a section of its own. These rows and the
 *        steps above them answer one question between them — what is this thing
 *        made of — and as two separate sections, one cream and one ink, the page
 *        asked the reader to cross a hard colour boundary in the middle of a
 *        single answer.
 *
 *        EVERY ROW DRAWS ITSELF. Without the diagrams these were four blocks of
 *        text following three steps that each had an artifact, so the band
 *        changed rhythm halfway down and the rows read as a spec sheet appended
 *        to a story. The drawings are deliberately the SMALLEST thing that says
 *        what the surface makes — a banner's proportions, a slide stack, four
 *        lines of a rewritten post — flat, unfilled, and one accent each. A
 *        second set of cards here would compete with the steps' artifacts.
 *
 *        They also solve a layout problem. The name used to sit alone in a
 *        9.5rem column with the headline starting well to its right, which left
 *        a dead gutter down the middle of all four rows. The drawing lives in
 *        that gutter.
 *
 *        THE DASHBOARD'S STRUCTURE, ON THE LANDING PAGE'S BAND: a section
 *        marker, a mono label over a condensed heading, a hairline where
 *        something is genuinely separated, and metadata as label/value pairs.
 *        One habit is left out — the dashboard numbers its bands, and numbering
 *        these made them read as a second run of the steps. Those three are a
 *        real order; four parallel tools are not. They carry their names.
 *
 *        The metadata is pinned to the BOTTOM of each row rather than flowing
 *        under the copy, so the four pairs line up across the section and read
 *        as one instrument panel instead of four captions of different lengths.
 * WHERE: Rendered inside HowItWorks, after its three steps. Not exported from
 *        the barrel — private to that one parent, like StepArtifact.
 */

import type { MarketingFeature } from "@/lib/config";
import { MARKETING_FEATURES } from "@/lib/config";
import { PaperDisplay, PaperLabel } from "@/components/global/paper";

/* The drawings. Stroked rather than filled, at 12–30% of the band's foreground,
 * with a single blue accent marking the part that matters: the avatar's
 * footprint on a banner, the line that was rewritten, the slide on top of the
 * deck, the idea that became a post. Inline SVG because each is a handful of
 * rectangles and a circle — an asset request for that would cost more than the
 * drawing. */
function FeatureArtifact({ artifact }: { artifact: MarketingFeature["artifact"] }) {
  const stroke = "currentColor";

  if (artifact === "studio") {
    /* A banner at its real 4:1 proportion, with the circle LinkedIn drops the
       avatar into — which is the whole reason the sizes matter. */
    return (
      <svg viewBox="0 0 160 64" fill="none" aria-hidden="true" className="w-full">
        <rect x="0.5" y="0.5" width="159" height="47" stroke={stroke} opacity="0.3" />
        <circle cx="34" cy="47" r="14.5" stroke="var(--blue)" strokeDasharray="3 3" />
        <rect x="70" y="14" width="74" height="5" fill={stroke} opacity="0.25" />
        <rect x="70" y="25" width="52" height="5" fill={stroke} opacity="0.18" />
        <rect x="0.5" y="56.5" width="40" height="7" stroke={stroke} opacity="0.2" />
      </svg>
    );
  }

  if (artifact === "voice") {
    /* Four lines of a post, the third one replaced — the only visible thing a
       voice profile does. */
    return (
      <svg viewBox="0 0 160 64" fill="none" aria-hidden="true" className="w-full">
        <rect y="6" width="150" height="6" fill={stroke} opacity="0.22" />
        <rect y="20" width="120" height="6" fill={stroke} opacity="0.22" />
        <rect y="34" width="138" height="6" fill="var(--blue)" />
        <rect y="48" width="96" height="6" fill={stroke} opacity="0.22" />
      </svg>
    );
  }

  if (artifact === "carousel") {
    /* Three pages of a deck at 4:5, the front one carrying the accent. */
    return (
      <svg viewBox="0 0 160 64" fill="none" aria-hidden="true" className="w-full">
        <rect x="64.5" y="8.5" width="38" height="47" stroke={stroke} opacity="0.18" />
        <rect x="46.5" y="6.5" width="38" height="51" stroke={stroke} opacity="0.3" />
        <rect x="26.5" y="4.5" width="38" height="55" stroke="var(--blue)" />
        <rect x="32" y="44" width="27" height="5" fill="var(--blue)" />
      </svg>
    );
  }

  /* ideas — captured lines, one of which has become a scheduled post. */
  return (
    <svg viewBox="0 0 160 64" fill="none" aria-hidden="true" className="w-full">
      <rect x="0.5" y="4.5" width="8" height="8" stroke={stroke} opacity="0.35" />
      <rect x="18" y="6" width="96" height="5" fill={stroke} opacity="0.22" />
      <rect x="0.5" y="26.5" width="8" height="8" stroke="var(--blue)" fill="var(--blue)" />
      <rect x="18" y="28" width="120" height="5" fill="var(--blue)" />
      <rect x="0.5" y="48.5" width="8" height="8" stroke={stroke} opacity="0.35" />
      <rect x="18" y="50" width="74" height="5" fill={stroke} opacity="0.22" />
    </svg>
  );
}

export function FeatureRows() {
  return (
    <div className="flex flex-col">
      {/* A heavier rule than the ones between rows: this is where the band stops
          describing a sequence and starts listing a set. */}
      <div className="flex items-center gap-3.5 border-t border-ink-foreground/25 pt-[clamp(36px,5vw,64px)]">
        <span aria-hidden="true" className="size-[7px] bg-blue" />
        <PaperLabel size="micro" tone="inverted" className="tracking-[0.12em]">
          Also inside
        </PaperLabel>
      </div>

      {MARKETING_FEATURES.map((feature) => (
        <article
          key={feature.label}
          /* The rule belongs to the row BELOW it, so the last row does not close
             the band with a line that leads nowhere.

             The `min-h` is what lets the metadata sit on ONE line across all
             four rows, and it has to clear the tallest row rather than the
             average: below that, each row shrinks to its own content and
             `mt-auto` pins the pairs to four different heights, which is the
             ragged look it was meant to fix. The last row keeps its bottom
             padding for the same reason — dropping it shortened that row alone
             and knocked its pairs 39px out of line with the other three. */
          className="grid gap-x-[clamp(16px,3vw,48px)] gap-y-[clamp(14px,2vw,22px)] border-b border-ink-foreground/12 py-[clamp(24px,3.2vw,38px)] last:border-b-0 min-[900px]:min-h-[232px] min-[900px]:grid-cols-[minmax(0,172px)_minmax(0,1.05fr)_minmax(0,1fr)] min-[900px]:items-start"
        >
          {/* Name over drawing, in what used to be a dead gutter. */}
          <div className="flex flex-col gap-4">
            <div className="flex items-baseline gap-2.5">
              <span aria-hidden="true" className="size-[6px] shrink-0 bg-blue" />
              <PaperLabel
                as="span"
                size="micro"
                tone="inverted"
                className="tracking-[0.12em]"
              >
                {feature.label}
              </PaperLabel>
            </div>

            <div className="w-[min(100%,150px)] text-ink-foreground">
              <FeatureArtifact artifact={feature.artifact} />
            </div>
          </div>

          <PaperDisplay
            as="h3"
            words={feature.title}
            className="text-[clamp(24px,3.2vw,44px)] leading-[0.9] tracking-[-0.045em]"
          />

          <div className="flex h-full flex-col gap-[clamp(12px,1.6vw,20px)]">
            <p className="m-0 max-w-[30em] text-[clamp(14px,1.3vw,17px)] leading-relaxed text-pretty text-ink-foreground/70">
              {feature.body}
            </p>

            {/* Label over value, in mono — the dashboard's metadata pair, pushed
                to the foot of the row so the four line up. It is here to be
                CHECKED rather than admired, which is why every value is a real
                figure from the app rather than a rounded claim. */}
            <dl className="m-0 flex flex-wrap gap-x-[clamp(20px,3vw,40px)] gap-y-3 min-[900px]:mt-auto">
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
        </article>
      ))}
    </div>
  );
}

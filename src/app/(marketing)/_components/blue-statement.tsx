/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: BlueStatement, MARKETING_STATEMENT, PaperDisplay,
 *   PaperButton, PaperReveal, wipe, clip-path, blue band, statement section,
 *   full bleed, z-index, sticky hero
 *
 * WHAT:  The full-height blue band that answers the hero and names the product.
 * WHY:   This is the payoff of the sticky hero, so it is the one section that IS
 *        the accent rather than a section that uses it — which is also why it
 *        obeys rule 4 by inverting instead of adding a second colour: the
 *        product name is boxed in white and the CTA is white on blue, so the
 *        whole screen still spends exactly one blue.
 *
 *        It is also the page's ONE wipe. Every other section rises quietly; this
 *        one arrives OVER the hero, which is the moment the whole 280svh sticky
 *        sequence has been building toward. The <section> itself stays paper on
 *        purpose — the wipe needs a ground to be revealed against, and without
 *        it the clip-path would expose the hero underneath and read as a hole
 *        punched in the page rather than as blue rising.
 *
 *        The z-index is load-bearing. Everything after the hero sits above it in
 *        the stacking order, because the hero's stage is `position: sticky` and
 *        would otherwise remain painted under — and occasionally over — the
 *        bands that follow it as they scroll up.
 * WHERE: src/app/(marketing)/page.tsx, immediately after StickyHero.
 */


import {
  GET_STARTED_HREF,
  GET_STARTED_LABEL,
  MARKETING_SECTION_IDS,
  MARKETING_STATEMENT,
} from "@/lib/config";
import {
  PaperButton,
  PaperDisplay,
  PaperReveal,
} from "@/components/global/paper";

export function BlueStatement() {
  return (
    /* THE GROUND THE WIPE REVEALS AGAINST. PaperReveal's wipe clips this band
       from the top and grows it up from its bottom edge, so until it finishes
       the reader sees whatever is behind it — this background. `bg-paper` was
       right while a cream section came before it; the product tour above is
       black, and cream here reads as a pale gap between two dark bands.
       --tour-ground is the token the tour's own stage and spacer use, so the
       hand-off cannot develop a seam. */
    <section
      id={MARKETING_SECTION_IDS.why}
      className="relative z-5 bg-[var(--tour-ground)]"
    >
      <PaperReveal
        effect="wipe"
        className="flex min-h-svh flex-col items-center justify-center gap-[26px] bg-blue px-[clamp(16px,3vw,34px)] py-[clamp(72px,12vh,140px)] text-blue-foreground"
      >
        <p className="m-0 text-center text-[clamp(18px,2.4vw,34px)] tracking-[-0.02em] text-blue-foreground/90">
          {MARKETING_STATEMENT.intro}
        </p>

        <PaperDisplay
          as="h2"
          words={MARKETING_STATEMENT.heading}
          className="justify-center text-center text-[clamp(54px,12.5vw,186px)] leading-[0.82] tracking-[-0.045em]"
        />

        <p className="m-0 max-w-[22em] text-center text-[clamp(16px,1.6vw,21px)] leading-normal text-pretty text-blue-foreground/85">
          {MARKETING_STATEMENT.body}
        </p>

        <PaperButton href={GET_STARTED_HREF} variant="paper" size="lg" arrow>
          {GET_STARTED_LABEL}
        </PaperButton>
      </PaperReveal>
    </section>
  );
}

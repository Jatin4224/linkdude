/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: BAND_ROW, band row, step row, feature row, marker
 *   chip, hairline, group hover, dark band, how it works, feature rows
 *
 * WHAT:  The two class strings every row in the dark band is built from — the
 *        row itself and its [n] marker chip.
 * WHY:   The band is SEVEN ROWS IN ONE COLUMN written in two files: the three
 *        steps in how-it-works, the four features in feature-rows. They were
 *        the same string copied twice, which held only as long as nobody
 *        touched one of them — and the whole argument for the feature rows'
 *        layout is that a reader cannot tell where one file stops and the
 *        other starts.
 *
 *        THE ROW IS THE HOVER TARGET. Its hairline brightens and its marker
 *        steps right, which is the smallest gesture that says "this row is a
 *        thing" without adding a shadow, a lift or a fill that this system does
 *        not have. The marker moves via `group-hover`, so the whole row — copy,
 *        panel and all — is the surface you have to be over, not the chip.
 *
 *        Each file appends its own edge rules: the steps open the band, so the
 *        first has no rule above it, and the last feature closes it, so it has
 *        no padding below.
 * WHERE: src/app/(marketing)/_components/how-it-works.tsx and feature-rows.tsx.
 */

export const BAND_ROW = {
  row: "group grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] items-start gap-[clamp(24px,4vw,56px)] border-t border-ink-foreground/12 py-[clamp(40px,6vw,76px)] transition-colors duration-300 ease-[var(--ease-out)] hover:border-ink-foreground/35 motion-reduce:transition-none",
  marker:
    "bg-blue px-2 py-1 text-[12px] tracking-[0.1em] text-blue-foreground transition-transform duration-300 ease-[var(--ease-out)] group-hover:translate-x-0.5 motion-reduce:transition-none",
} as const;

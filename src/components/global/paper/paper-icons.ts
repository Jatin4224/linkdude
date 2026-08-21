/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: PAPER_ICONS, PaperIconName, LucideIcon, decorative
 *   glyphs, scatter icons, orbit icons, paper design system
 *
 * WHAT:  The decorative glyph set the paper surfaces draw their floating marks
 *        from, keyed by PaperIconName.
 * WHY:   Two components render these — PaperScatter on the auth panel and
 *        PaperOrbit in the hero — and a second copy of this map is how the two
 *        end up drawing different shapes for the same name. Keyed by the union
 *        so a glyph added to PaperIconName is a compile error here until it has
 *        a component, rather than rendering nothing.
 *
 *        `lucide-react` components rather than the reference's remote
 *        lucide-static SVGs masked through CSS: these inline into a bundle we
 *        already ship, so the hero has no third-party request in it and a mark
 *        cannot arrive late or not at all.
 * WHERE: src/components/global/paper/paper-scatter.tsx and paper-orbit.tsx.
 */

import {
  ArrowRightIcon,
  AsteriskIcon,
  Grid2x2Icon,
  SquareDashedIcon,
  TriangleIcon,
  WavesIcon,
  type LucideIcon,
} from "lucide-react";

import type { PaperIconName } from "@/lib/types";

export const PAPER_ICONS: Record<PaperIconName, LucideIcon> = {
  "square-dashed": SquareDashedIcon,
  asterisk: AsteriskIcon,
  "arrow-right": ArrowRightIcon,
  grid: Grid2x2Icon,
  triangle: TriangleIcon,
  waves: WavesIcon,
};

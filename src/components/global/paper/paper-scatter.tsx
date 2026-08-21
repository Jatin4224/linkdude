/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: PaperScatter, PaperScatterProps, PaperScatterMark,
 *   PaperIconName, animate-paper-float, float-duration, float-delay,
 *   decorative marks, hero scatter, aria-hidden, paper design system
 *
 * WHAT:  The drifting blue marks scattered around the hero and the sign-in brand
 *        panel — absolutely positioned, tilted, and bobbing on their own timing.
 * WHY:   The reference paints these by masking remote lucide-static SVGs through
 *        CSS `mask-image`, one network request per icon. Rendered as
 *        `lucide-react` components instead they are inlined into the bundle we
 *        already ship, so the hero has no third-party request in it and the
 *        marks cannot arrive late or not at all. Same glyphs, same accent, no
 *        unpkg dependency.
 *
 *        The whole layer is aria-hidden and pointer-events-none: none of it is
 *        content, and a decorative mark that swallowed a click on the CTA
 *        underneath it would be invisible in every review.
 * WHERE: The landing hero (both its front and back layers) and the sign-in brand
 *        panel.
 */

import * as React from "react";
import type { PaperScatterMark } from "@/lib/types";
import { PAPER_ICONS } from "./paper-icons";
import { cn } from "@/lib/utils";

export interface PaperScatterProps {
  marks: readonly PaperScatterMark[];
  className?: string;
}

export function PaperScatter({ marks, className }: PaperScatterProps) {
  return (
    <div
      aria-hidden="true"
      className={cn("pointer-events-none absolute inset-0", className)}
    >
      {marks.map((mark, index) => {
        const Icon = PAPER_ICONS[mark.icon];
        return (
          <span
            key={`${mark.icon}-${index}`}
            className="animate-paper-float absolute"
            /* Position and timing are per-mark DATA, so they arrive as custom
               properties rather than as forty generated utility classes that
               Tailwind would have to see literally to emit. */
            style={{
              top: mark.top,
              ...(mark.left === undefined
                ? { right: mark.right }
                : { left: mark.left }),
              ["--float-duration" as string]: `${mark.duration}s`,
              ["--float-delay" as string]: `${mark.delay}s`,
            }}
          >
            <Icon
              className="block text-blue"
              style={{
                width: mark.size,
                height: mark.size,
                transform: `rotate(${mark.tilt}deg)`,
              }}
            />
          </span>
        );
      })}
    </div>
  );
}

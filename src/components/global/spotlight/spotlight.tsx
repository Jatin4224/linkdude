/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use client";

/**
 * SOURCE OF TRUTH KEYWORDS: Spotlight, SpotlightProps, spotlight-surface,
 *   --spot-x, --spot-y, pointer glow, cursor glow, hover highlight, card polish
 *
 * WHAT:  Wraps a surface so a soft brand-tinted glow follows the cursor across
 *        it, fading in on enter and out on leave.
 * WHY:   Pure decoration, and the cheapest possible version of it: two CSS
 *        variables written directly on this element drive a ::after gradient, so
 *        there is no React state, no re-render per pointer move, and no
 *        animation frame loop. The variables are set on the element itself
 *        rather than a shared parent on purpose — a variable change on a parent
 *        restyles every descendant, which is what makes naive versions of this
 *        effect stutter on a grid of cards.
 *        Mouse-only: a finger has no hover, and tracking it would leave a glow
 *        frozen wherever the user last tapped.
 * WHERE: The marketing feature cards and pricing cards.
 */

import * as React from "react";

import { cn } from "@/lib/utils";

export interface SpotlightProps {
  children: React.ReactNode;
  className?: string | undefined;
}

export function Spotlight({ children, className }: SpotlightProps) {
  const ref = React.useRef<HTMLDivElement | null>(null);

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "mouse") return;
    const node = ref.current;
    if (!node) return;
    const bounds = node.getBoundingClientRect();
    node.style.setProperty("--spot-x", `${event.clientX - bounds.left}px`);
    node.style.setProperty("--spot-y", `${event.clientY - bounds.top}px`);
    node.dataset["spotlight"] = "on";
  }

  function handlePointerLeave() {
    const node = ref.current;
    if (!node) return;
    node.dataset["spotlight"] = "off";
  }

  return (
    <div
      ref={ref}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      className={cn(
        "spotlight-surface relative isolate overflow-hidden rounded-xl",
        className,
      )}
    >
      {children}
    </div>
  );
}

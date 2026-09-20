"use client";

/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: SketchButton, SketchButtonProps, ink button
 *
 * WHAT:  A button that reads as drawn in blue marker — and nothing more.
 * WHY:   THE BUTTON ITSELF STAYS CLEAN. That is the rule this component exists
 *        to enforce: no handwriting on the label, no doodles inside the hit
 *        area, no sparkles flanking the text. A control has one job and anything
 *        decorative inside it competes with the word that tells you what it
 *        does. Marks belong NEAR a CTA, never in it.
 *
 *        What makes it feel drawn is only the frame and the shadow: a 1px ink
 *        outline pushed off true by the shared displacement filter, and a small
 *        hard offset with no blur. Blur is elevation, and elevation is printing.
 *
 *        Wraps the app's own Button rather than restyling one, so variant sizing,
 *        disabled handling, focus behaviour and the base-ui quirks all keep
 *        working — this adds a surface, it does not fork a control.
 * WHERE: Any paper surface. The studio's gallery and editor.
 */

import * as React from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { SketchFrame } from "./sketch";

export interface SketchButtonProps
  extends React.ComponentProps<typeof Button> {
  /** `ink` is the quiet one: paper ground, ink outline, for secondary actions. */
  tone?: "blue" | "ink" | undefined;
}

export function SketchButton({
  tone = "blue",
  className,
  children,
  ...rest
}: SketchButtonProps) {
  return (
    <span className="relative inline-flex">
      <Button
        {...rest}
        className={cn(
          "relative rounded-md border-0 font-medium",
          /* Small hard offset, no blur. */
          "shadow-[2px_2px_0_0_rgba(17,24,39,0.22)]",
          "transition-[transform,box-shadow] duration-150",
          "hover:-translate-x-px hover:-translate-y-px hover:shadow-[3px_3px_0_0_rgba(17,24,39,0.3)]",
          /* Pressing a drawn button should feel like pressing paper onto a desk:
             the offset collapses rather than the colour changing. */
          "active:translate-x-0 active:translate-y-0 active:shadow-[1px_1px_0_0_rgba(17,24,39,0.24)]",
          tone === "blue"
            ? "bg-[color:var(--sketch-blue)] text-white hover:bg-[color:var(--sketch-blue)]"
            : "bg-[color:var(--card)] text-[color:var(--sketch-ink)] hover:bg-[color:var(--card)]",
          className,
        )}
      >
        {children}
      </Button>

      {/* Outside the Button so it can never intercept a click, and never
          renders for a disabled control — a drawn outline around something that
          does nothing is a promise the button does not keep. */}
      {rest.disabled ? null : (
        <SketchFrame
          className={cn(
            "rounded-md",
            tone === "blue" ? "text-white/35" : "text-[color:var(--sketch-ink)]/70",
          )}
        />
      )}
    </span>
  );
}

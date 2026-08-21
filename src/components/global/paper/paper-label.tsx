/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: PaperLabel, PaperLabelProps, paperLabelVariants,
 *   uppercase label, kicker, chip, metadata line, Archivo, letter-spacing,
 *   paper design system, two-font system
 *
 * WHAT:  Every label, kicker, chip and metadata line on the paper surfaces —
 *        uppercase Archivo at 10–12px with wide letter-spacing.
 * WHY:   These surfaces run on TWO faces and no more: Archivo Black for display
 *        type, Archivo for everything else. This component is the "everything
 *        else" end of that rule at small sizes, and making it a component with a
 *        closed `size` scale means a new label picks from three correct options
 *        instead of inventing a fourth size and a fourth tracking value. The
 *        scale is named by role, not by pixels, so the type can be retuned once
 *        here rather than at forty call sites.
 *
 *        It used to be `PaperLabel`, set in Geist Mono, because the design
 *        handoff's third rule asked for uppercase MONO on every label. That put
 *        a third family on a page whose whole argument is typographic restraint,
 *        and the mono read as code rather than as metadata beside Archivo body
 *        copy. The structure of the rule survives — uppercase, small, widely
 *        tracked, used for exactly these roles — only the family changed, so the
 *        page still reads as one system with two voices instead of three.
 *
 *        Weight 500 rather than 400: Geist Mono carried these sizes on its own
 *        even stroke, and Archivo at 10px with 0.1em of tracking goes thin and
 *        loses against the 1px ink rules it sits between.
 * WHERE: Section kickers, the free-plan cap labels, the composer chrome, the
 *        ticker, the footer bottom bar, the sign-in kicker and assurance
 *        numbers.
 */

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const paperLabelVariants = cva(
  /* No family declared: `.paper-scope` sets Archivo as the inherited family for
     the whole subtree, so naming it again here would be a second place to keep
     in step with it. */
  "font-medium uppercase",
  {
    variants: {
      size: {
        /* Section headers and the ticker — the widest tracking, because these
           are read as a band rather than as a word. */
        band: "text-[11px] tracking-[0.14em]",
        /* The default: cap labels, chips, metadata under a figure. */
        meta: "text-[10.5px] tracking-[0.1em]",
        /* The smallest step — inline markers inside a panel. */
        micro: "text-[10px] tracking-[0.08em]",
      },
      tone: {
        ink: "text-ink",
        grey: "text-grey",
        blue: "text-blue",
        /* On the dark band, where ink would be invisible. */
        inverted: "text-ink-foreground",
        /* Inherits — for labels inside an already-coloured box. */
        inherit: "text-inherit",
      },
    },
    defaultVariants: { size: "meta", tone: "ink" },
  },
);

export interface PaperLabelProps
  extends React.ComponentPropsWithoutRef<"p">,
    VariantProps<typeof paperLabelVariants> {
  /** `span` where the label sits inline inside another line of text. */
  as?: "p" | "span";
}

export function PaperLabel({
  as: Tag = "p",
  size,
  tone,
  className,
  children,
  ...props
}: PaperLabelProps) {
  return (
    <Tag className={cn(paperLabelVariants({ size, tone }), className)} {...props}>
      {children}
    </Tag>
  );
}

export { paperLabelVariants };

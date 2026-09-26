/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: PaperButton, PaperButtonProps, paperButtonVariants,
 *   paper CTA, uppercase button, square button, blue-pressed, blue-hover,
 *   Continue with Google, Get started free, paper design system
 *
 * WHAT:  The one button shape the public paper surfaces use — square, uppercase
 *        label, 1px ink or solid blue, with hover / pressed / pending states.
 *        Renders an <a> when `href` is passed and a <button> otherwise.
 * WHY:   Three of the design's five hard rules meet in this component (square,
 *        no shadow, uppercase at 0.08em), so it exists so no call site has to
 *        remember them. It is a SEPARATE component from components/ui/button
 *        rather than a variant of it: that button is built for the dark product
 *        chrome — rounded, with a ring-based focus treatment and a `size` scale
 *        keyed to 8px rows — and adding a fourth colour variant to it would put
 *        the public design system's rules inside the component every dashboard
 *        surface also renders. This one has no rounding to override and no ring
 *        to cancel.
 *
 *        The pressed state is a real 1px drop rather than a colour change alone,
 *        because with shadows forbidden the drop is the only affordance left
 *        that says the surface moved. `pending` is a prop, not a variant, so a
 *        caller cannot dim the button without also making it inert.
 *
 *        `arrow` is opt-in rather than automatic on the blue variant. Every
 *        primary on the landing page should carry it, but the Google button is
 *        blue too and already has a glyph, and an arrow on a form submit points
 *        at nothing. Opting in is one word at four call sites; opting out would
 *        be a negation at the ones that matter least.
 * WHERE: The landing hero and closing CTA, the blue statement band, and the
 *        Continue-with-Google button in
 *        src/components/global/auth/auth-form.tsx.
 */

import * as React from "react";
import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const paperButtonVariants = cva(
  /* The label treatment lives here so no call site has to remember it: every
     button on these surfaces is uppercase at 12px with 0.08em tracking, in the
     inherited Archivo — no family is declared, because .paper-scope already sets
     one for the whole subtree and a second declaration is a second thing to keep
     in step. */
  "group/paper-button inline-flex shrink-0 items-center justify-center gap-2.5 whitespace-nowrap rounded-none border text-[12px] font-medium uppercase tracking-[0.08em] transition-[background-color,color,transform,border-color] duration-150 ease-out select-none disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        /* The single saturated element on a screen. Rule 4 means at most one of
           these may be visible at a time. */
        blue: "border-blue bg-blue text-blue-foreground hover:border-blue-hover hover:bg-blue-hover active:translate-y-px active:border-blue-pressed active:bg-blue-pressed",
        /* The blue band's inversion — white on blue, where a blue fill would
           disappear. */
        paper:
          "border-paper-raised bg-paper-raised text-blue hover:-translate-y-0.5 active:translate-y-0",
        /* The quiet companion. Fills with ink on hover rather than tinting, so
           the page never gains a second saturated colour. */
        outline:
          "border-ink bg-transparent text-ink hover:bg-ink hover:text-ink-foreground active:translate-y-px",
      },
      size: {
        /* 52px is the hero's CTA, 54px the form's and the closing band's — the
           design uses both, and the difference is deliberate: the taller one is
           the last ask on its screen. */
        md: "h-[52px] px-6",
        lg: "h-[54px] px-[26px]",
        /* The header CTA, which shares a row with the wordmark. */
        sm: "h-10 px-[18px] text-[11px] tracking-[0.09em]",
      },
      block: { true: "w-full", false: "w-fit" },
    },
    defaultVariants: { variant: "blue", size: "md", block: false },
  },
);

export interface PaperButtonProps
  extends React.ComponentPropsWithoutRef<"button">,
    VariantProps<typeof paperButtonVariants> {
  /** Renders a Next <Link> instead of a <button>. */
  href?: string;
  /**
   * THIS action is in flight: dims the control, blocks the click and announces
   * it as busy. Distinct from `disabled`, which is "some other action on this
   * form is in flight" — that one greys out without claiming to be working.
   */
  pending?: boolean;
  /**
   * Appends the arrow that steps right on hover. For the GO action only — the
   * page's one primary CTA — never on a secondary or a form submit, where a
   * second arrow would make two things look equally like the way forward.
   */
  arrow?: boolean;
}

export function PaperButton({
  className,
  variant,
  size,
  block,
  href,
  pending = false,
  disabled = false,
  arrow = false,
  type = "button",
  children,
  ...props
}: PaperButtonProps) {
  const inert = pending || disabled;
  const classes = cn(
    paperButtonVariants({ variant, size, block }),
    inert ? "pointer-events-none opacity-75" : "cursor-pointer",
    className,
  );

  /* The label and, on the primary action, the one moving part this system
     allows itself: a square-cut arrow that steps forward under the cursor.
     With shadows and rounding out, and colour already spent on the fill, a
     4px move is the only "yes, this one" a button has left to say. */
  const content = (
    <>
      {children}
      {arrow ? (
        <ArrowRightIcon
          aria-hidden="true"
          className="size-3.5 transition-transform duration-150 ease-out group-hover/paper-button:translate-x-1 motion-reduce:transition-none"
        />
      ) : null}
    </>
  );

  if (href) {
    /* A link has no disabled state, so the flags only reach it as the dimmed
       treatment — pointer-events-none above is what makes it inert. */
    return (
      <Link href={href} className={classes} aria-busy={pending || undefined}>
        {content}
      </Link>
    );
  }

  return (
    <button
      type={type}
      className={classes}
      disabled={inert}
      aria-busy={pending || undefined}
      {...props}
    >
      {content}
    </button>
  );
}

export { paperButtonVariants };

/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: AuthShell, AuthShellProps, paper-scope, PaperLockup,
 *   PaperDisplay, PaperMascot, PaperScatter, PaperLabel, MARKETING_AUTH_PANEL,
 *   MARKETING_AUTH_SCATTER, MARKETING_DISCLAIMER, DOM order, tab order, order-2,
 *   split panel, reserved mascot track, auth layout
 *
 * WHAT:  The chrome every (auth) route renders inside — the form column and, from
 *        900px up, the marketing panel beside it.
 * WHY:   Two structural decisions, and both are easy to undo by accident:
 *
 *        1. The FORM COLUMN IS FIRST IN THE DOM and is moved right with `order`,
 *           not written second. Tab order and screen-reader order follow the DOM,
 *           not the paint, so this is what makes a keyboard user reach the Google
 *           button before the sales copy. Writing the brand column first and
 *           relying on the visual order would put a headline, a paragraph and a
 *           mascot between the visitor and the only control on the page. The
 *           `order` swap is also scoped to the width where the brand column
 *           exists at all — below it there is nothing to reorder.
 *
 *        2. The brand column is itself a GRID with a RESERVED mascot track —
 *           `minmax(0,1fr)` for the copy and `clamp(200px,26%,300px)` for the
 *           mascot — and the mascot is IN FLOW in its own track rather than
 *           absolutely positioned. It then hangs off the panel edge with a
 *           negative right margin. Because the track is reserved, the headline's
 *           available width already excludes the mascot at every viewport size,
 *           so the two can never overlap; an absolutely positioned mascot would
 *           be over the headline at some width nobody tested.
 *
 *        Deliberately NOT animated. Sign-in is a page people hit repeatedly and
 *        often with a password manager already firing; an entrance animation on
 *        a high-frequency screen only adds delay between intent and input. The
 *        drifting scatter marks are the exception, because they never gate
 *        interaction.
 * WHERE: Used by every page under src/app/(auth)/ — sign-in, sign-up,
 *        forgot-password, reset-password, accept-invitation.
 */

import * as React from "react";

import {
  MARKETING_AUTH_PANEL,
  MARKETING_AUTH_SCATTER,
  MARKETING_DISCLAIMER,
} from "@/lib/config";
import {
  PaperLabel,
  PaperDisplay,
  PaperLockup,
  PaperMascot,
  PaperScatter,
} from "@/components/global/paper";

export interface AuthShellProps {
  children: React.ReactNode;
}

export function AuthShell({ children }: AuthShellProps) {
  return (
    <div className="paper-scope relative grid min-h-svh grid-cols-1 min-[900px]:grid-cols-[1.38fr_1fr]">
      {/* ---------- Form column: FIRST in the DOM, painted right ---------- */}
      <div className="relative flex flex-col items-start justify-center px-[clamp(16px,4vw,60px)] pt-[clamp(36px,6vw,68px)] pb-[clamp(48px,8vw,104px)] min-[900px]:order-2">
        <div className="flex w-full max-w-[380px] flex-col gap-[30px]">
          <PaperLockup href="/" />

          {children}

          <PaperLabel tone="grey" className="text-[10.5px]">
            {MARKETING_DISCLAIMER}
          </PaperLabel>
        </div>
      </div>

      {/* ---------- Brand column: painted left, read last ----------
          hidden below 900px: at phone widths it would push the form off the
          first screen, and the form is the only thing anyone came here to
          reach. */}
      <div className="relative order-1 hidden overflow-hidden border-r border-ink px-[clamp(24px,3.5vw,56px)] pt-[clamp(28px,4vw,52px)] min-[900px]:grid min-[900px]:grid-cols-[minmax(0,1fr)_clamp(200px,26%,300px)] min-[900px]:grid-rows-[auto_minmax(0,1fr)] min-[900px]:gap-x-[clamp(12px,2vw,28px)]">
        <PaperScatter marks={MARKETING_AUTH_SCATTER} className="z-0" />

        <PaperLockup href="/" className="relative z-[2] col-span-full row-start-1" />

        {/* The reserved track. `overflow-visible` on an in-flow cell is what
            lets the negative margin hang the figure off the panel edge without
            the cell itself growing.

            The figure is sized as `100% + the panel's own right padding`, i.e.
            exactly its reserved track plus the amount it hangs off the edge.
            That is the literal reading of the handoff's guarantee — in its own
            track, hanging off the panel edge, never overlapping the headline —
            and it is the only sizing that keeps the guarantee true at every
            width. A fixed `clamp(240px, 30vw, 460px)` is wider than the
            clamp(200px, 26%, 300px) track it sits in from about 800px up, so it
            would spill back across the copy column instead of off the edge. */}
        <div
          aria-hidden="true"
          /* justify-self is left at `stretch` deliberately: the cell must BE the
             reserved track, or the percentage width below would resolve against
             the figure's own content width instead. */
          className="relative z-[1] col-start-2 row-start-2 min-w-0 self-end overflow-visible"
        >
          <PaperMascot
            width={460}
            height={460}
            flipped
            priority
            className="block h-auto w-[calc(100%+clamp(24px,3.5vw,56px))] -mr-[clamp(24px,3.5vw,56px)]"
          />
        </div>

        <div className="relative z-[2] col-start-1 row-start-2 flex max-w-[620px] flex-col gap-5 self-end pb-[clamp(28px,4vw,52px)]">
          <PaperLabel
            as="span"
            className="inline-flex w-fit items-center gap-2 border border-ink px-2.5 py-1.5 text-[10.5px] tracking-[0.12em]"
          >
            <span aria-hidden="true" className="size-[7px] bg-blue" />
            {MARKETING_AUTH_PANEL.badge}
          </PaperLabel>

          <PaperDisplay
            words={MARKETING_AUTH_PANEL.heading}
            className="text-[clamp(36px,min(5.2vw,9svh),88px)]"
          />

          <p className="m-0 max-w-[460px] text-[clamp(15px,1.4vw,19px)] leading-normal text-pretty text-grey">
            {MARKETING_AUTH_PANEL.body}
          </p>

          <PaperLabel as="span" className="flex items-center gap-2.5 text-[10.5px]">
            <span aria-hidden="true" className="h-px w-[26px] bg-ink" />
            {MARKETING_AUTH_PANEL.footnote}
          </PaperLabel>
        </div>
      </div>
    </div>
  );
}

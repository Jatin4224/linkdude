/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: AuthShell, AuthShellProps, AuthShellVariant,
 *   paper-scope, PaperLockup, PaperDisplay, PaperMascot, PaperScatter,
 *   PaperLabel, MARKETING_AUTH_PANEL, MARKETING_AUTH_TRUST,
 *   MARKETING_AUTH_SCATTER, MARKETING_DISCLAIMER, DOM order, split panel
 *
 * WHAT:  The chrome every (auth) route renders inside, in two arrangements.
 *
 *        `variant="action"` — sign-in and sign-up. The pitch and the ONE control
 *        share the left panel; the right panel answers "why should I hand over
 *        a Google account" with the mascot and three checkable facts.
 *
 *        `variant="form"` (default) — forgot-password, reset-password,
 *        accept-invitation. A form column beside a brand panel, unchanged.
 * WHY:   Two structural decisions, and both are easy to undo by accident:
 *
 *        1. THE COLUMN HOLDING THE CONTROL COMES FIRST IN THE DOM. Tab order and
 *           screen-reader order follow the DOM, not the paint. In `form` that
 *           means the form column is written first and moved right with `order`;
 *           in `action` the control already lives in the left panel, so that
 *           panel is written first and NO order swap is needed — which is why
 *           the trust panel, being reading matter, is written second. Putting
 *           the pitch first in either arrangement would make a keyboard user
 *           walk a headline, a paragraph and three trust points before reaching
 *           the only button on the page.
 *
 *        2. The mascot is IN FLOW in a reserved track and hangs off the panel
 *           edge with a negative margin, never absolutely positioned. Because
 *           the track is reserved, the copy's available width already excludes
 *           the mascot at every viewport, so the two can never overlap; an
 *           absolutely positioned mascot would sit over the text at some width
 *           nobody tested.
 *
 *        FILLS ITS PARENT, rather than measuring the viewport again. The root
 *        layout already establishes a full-height chain — `html` is `h-full`
 *        and `body` is `min-h-full flex flex-col` — so `flex-1` here resolves
 *        to exactly the page box. `min-h-svh` looked equivalent and was not: it
 *        asks the browser for the viewport a SECOND time and rounds that answer
 *        on its own, so on a display at fractional scaling (Windows at 125%,
 *        where the window's CSS height lands on something like 906.4px) the
 *        panel came out a fraction of a pixel taller than the page and raised a
 *        scrollbar on a screen that fits. Growing past the viewport still
 *        scrolls normally, because `body` is min-height, not height.
 *
 *        Deliberately NOT animated. Sign-in is a page people hit repeatedly and
 *        often with a password manager already firing; an entrance animation on
 *        a high-frequency screen only adds delay between intent and input. The
 *        drifting scatter marks are the exception, because they never gate
 *        interaction.
 * WHERE: Used by every page under src/app/(auth)/. The sign-in and sign-up
 *        pages pass variant="action"; the rest take the default.
 */

import * as React from "react";

import {
  EMAIL_AUTH_ENABLED,
  MARKETING_AUTH_PANEL,
  MARKETING_AUTH_SCATTER,
  MARKETING_AUTH_TRUST,
  MARKETING_DISCLAIMER,
} from "@/lib/config";
import {
  PaperLabel,
  PaperDisplay,
  PaperLockup,
  PaperMascot,
  PaperScatter,
} from "@/components/global/paper";

export type AuthShellVariant = "form" | "action";

export interface AuthShellProps {
  children: React.ReactNode;
  /** "action" for sign-in/sign-up; "form" for the password and invite routes. */
  variant?: AuthShellVariant | undefined;
}

export function AuthShell({ children, variant = "form" }: AuthShellProps) {
  /* The action arrangement assumes ONE control. With email auth switched on,
   * the child is a full form — labelled fields, a submit, a divider, a second
   * Google button — and dropping that into a panel that already carries a
   * headline and a paragraph would stack two pitches and a form in one column,
   * with the trust panel repeating a third. Those deployments keep the form
   * arrangement, which was built for exactly that shape. */
  if (variant === "action" && !EMAIL_AUTH_ENABLED)
    return <AuthActionShell>{children}</AuthActionShell>;
  return <AuthFormShell>{children}</AuthFormShell>;
}

/* ---------- The sign-in / sign-up arrangement ---------- */

function AuthActionShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="paper-scope relative grid flex-1 grid-cols-1 min-[900px]:grid-cols-[1.25fr_1fr]">
      {/* The pitch AND the control, in that order. The button sits where the
          "Ten posts a month, free" footnote used to: at the end of the argument,
          which is the point at which someone has either been persuaded or has
          stopped reading. */}
      <div className="relative flex flex-col overflow-hidden px-[clamp(16px,4vw,60px)] pt-[clamp(36px,6vw,68px)] pb-[clamp(48px,8vw,104px)] min-[900px]:border-r min-[900px]:border-ink">
        <PaperScatter marks={MARKETING_AUTH_SCATTER} className="z-0" />

        <PaperLockup href="/" className="relative z-[2]" />

        <div className="relative z-[2] flex flex-1 flex-col justify-center gap-7 py-[clamp(32px,5vw,64px)]">
          {/* No eyebrow above this. A "Free forever · no card" badge over a
              headline is a label on a label — and the same promise is made
              properly, with its terms, in the trust panel. */}
          <PaperDisplay
            words={MARKETING_AUTH_PANEL.heading}
            className="max-w-[16ch] text-[clamp(34px,min(4.6vw,8svh),76px)]"
          />

          <p className="m-0 max-w-[46ch] text-[clamp(15px,1.4vw,19px)] leading-normal text-pretty text-grey">
            {MARKETING_AUTH_PANEL.body}
          </p>

          {/* The only control on the page. */}
          <div className="w-full max-w-[380px]">{children}</div>
        </div>

        <PaperLabel tone="grey" className="relative z-[2] text-[10.5px]">
          {MARKETING_DISCLAIMER}
        </PaperLabel>
      </div>

      {/* ---------- Trust panel: read second, hidden on phones ----------
          Below 900px it would push the button off the first screen, and the
          button is the only thing anyone came here to reach. Nothing in here is
          load-bearing for signing in — it answers a hesitation. */}
      <aside
        aria-label="What signing in with Google involves"
        className="relative hidden overflow-hidden px-[clamp(24px,3.5vw,56px)] pt-[clamp(28px,4vw,52px)] min-[900px]:grid min-[900px]:grid-rows-[minmax(0,1fr)_auto]"
      >
        <ul className="m-0 flex list-none flex-col self-center border-t border-ink p-0">
          {MARKETING_AUTH_TRUST.map((point, index, all) => (
            <li
              key={point.title}
              className={
                index === all.length - 1
                  ? "flex items-start gap-3 py-4"
                  : "flex items-start gap-3 border-b border-hair py-4"
              }
            >
              <PaperLabel
                as="span"
                size="micro"
                tone="blue"
                className="flex-none pt-1 tracking-[0.1em]"
              >
                {`0${index + 1}`}
              </PaperLabel>
              <div className="flex flex-col gap-1.5">
                <p className="m-0 text-[14.5px] leading-snug font-medium">
                  {point.title}
                </p>
                <p className="m-0 text-[13px] leading-normal text-grey">
                  {point.body}
                </p>
              </div>
            </li>
          ))}
        </ul>

        {/* Flipped, so the figure faces back across the panel toward the copy
            and the button rather than out of the page — the same reason the
            form arrangement flips it. It hangs off the right edge by exactly
            the panel's own padding, so the panel does not grow to contain it. */}
        <div
          aria-hidden="true"
          className="relative min-w-0 justify-self-end self-end overflow-visible"
        >
          <PaperMascot
            width={460}
            height={460}
            flipped
            priority
            className="-mr-[clamp(24px,3.5vw,56px)] block h-auto w-[clamp(200px,24vw,340px)]"
          />
        </div>
      </aside>
    </div>
  );
}

/* ---------- The password / invitation arrangement (unchanged) ---------- */

function AuthFormShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="paper-scope relative grid flex-1 grid-cols-1 min-[900px]:grid-cols-[1.38fr_1fr]">
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

      {/* ---------- Brand column: painted left, read last ---------- */}
      <div className="relative order-1 hidden overflow-hidden border-r border-ink px-[clamp(24px,3.5vw,56px)] pt-[clamp(28px,4vw,52px)] min-[900px]:grid min-[900px]:grid-cols-[minmax(0,1fr)_clamp(200px,26%,300px)] min-[900px]:grid-rows-[auto_minmax(0,1fr)] min-[900px]:gap-x-[clamp(12px,2vw,28px)]">
        <PaperScatter marks={MARKETING_AUTH_SCATTER} className="z-0" />

        <PaperLockup href="/" className="relative z-[2] col-span-full row-start-1" />

        {/* The reserved track — see the note at the top of this file. */}
        <div
          aria-hidden="true"
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
          <PaperDisplay
            words={MARKETING_AUTH_PANEL.heading}
            className="text-[clamp(36px,min(5.2vw,9svh),88px)]"
          />

          <p className="m-0 max-w-[460px] text-[clamp(15px,1.4vw,19px)] leading-normal text-pretty text-grey">
            {MARKETING_AUTH_PANEL.body}
          </p>
        </div>
      </div>
    </div>
  );
}

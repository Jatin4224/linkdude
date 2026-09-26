/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use client";

/**
 * SOURCE OF TRUTH KEYWORDS: useDemoStep, DemoStepState, useInView, demo panel,
 *   micro interaction, hover advance, in view once, pointerType, landing
 *   motion, prefers-reduced-motion
 *
 * WHAT:  Drives a panel that demonstrates itself: `active` flips once, the
 *        first time the panel scrolls into view, and `cycle` counts every time
 *        a mouse enters it afterwards.
 * WHY:   One hook so all seven panels on the landing page share one trigger
 *        point and one idea of what a demo is. Seven hand-rolled observers is
 *        how a page ends up with seven thresholds, and a reader feels that as
 *        panels that fire at visibly different moments down one column.
 *
 *        IN VIEW, NOT HOVER, IS THE TRIGGER. A demo that only plays on hover is
 *        a demo most visitors never see: there is no hover on a phone, and the
 *        panels are the page's explanation of what the product does.
 *
 *        HOVER ADVANCES, IT DOES NOT REPLAY. Rewinding a finished demo so it
 *        can run again reads as a glitch — the meter empties, the queue
 *        un-sends. `cycle` only ever counts up, so a panel with a genuine next
 *        state (the next page of the deck, the next post out of the queue) can
 *        step forward under the cursor, and a panel without one ignores it.
 *
 *        THE PRE-DEMO STATE IS A REAL STATE, which is a constraint on the
 *        panels rather than on this hook, and the reason there is no failsafe
 *        here: a panel renders its BEFORE state on the server and moves to its
 *        AFTER state when this fires, and both are legible. If the bundle never
 *        arrives the reader sees an inbox of captured ideas and a deck open at
 *        page one — not an empty card. Contrast Reveal, which hides content
 *        until JS runs and therefore needs four ways out of the hidden state.
 *
 *        Reduced motion is handled where the motion is — the panels' transition
 *        utilities carry `motion-reduce:transition-none`, so the state still
 *        changes and only the travel goes. Blocking `active` here instead would
 *        leave those readers looking at the before state forever.
 * WHERE: src/app/(marketing)/_components/demo-panel.tsx.
 */

import * as React from "react";
import { useInView } from "motion/react";

/** Matches CountUp's margin, so numbers and panels fire on the same line. */
const IN_VIEW_MARGIN = "-80px";

export interface DemoStepState {
  /** Attach to the panel's root element. */
  ref: React.RefObject<HTMLDivElement | null>;
  /** The panel has been seen: show the after state. */
  active: boolean;
  /** Mouse entries since mount. Panels with a "next" state step through it. */
  cycle: number;
  /** Spread onto the panel's root element. */
  hoverProps: { onPointerEnter: React.PointerEventHandler<HTMLElement> };
}

export function useDemoStep(): DemoStepState {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const active = useInView(ref, { once: true, margin: IN_VIEW_MARGIN });
  const [cycle, setCycle] = React.useState(0);

  const onPointerEnter = React.useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      /* Mouse only. A touch fires pointerenter as well, so on a phone the panel
         would jump a step under the reader's thumb the moment they scrolled
         past it with a finger down — and it would then be stuck in the hovered
         state, because no pointerleave follows a tap. */
      if (event.pointerType !== "mouse") return;
      setCycle((current) => current + 1);
    },
    [],
  );

  return { ref, active, cycle, hoverProps: { onPointerEnter } };
}

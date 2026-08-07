/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use client";

/**
 * SOURCE OF TRUTH KEYWORDS: ChatShell, ChatShellProps, useScrollToBottom
 *
 * WHAT:  The frame around a conversation — a scrolling message column that
 *        follows new turns, with a pinned composer area below it.
 * WHY:   Two things here are easy to get wrong and worth owning once. A chat
 *        must scroll INSIDE the page rather than growing it, or the composer
 *        walks off the bottom of the viewport; and it must follow new messages,
 *        or the user watches an answer arrive somewhere they cannot see.
 *
 *        The follow is deliberately unconditional rather than "only when already
 *        at the bottom". Every turn here is either the user's own action or a
 *        direct response to it, so there is no background chatter to interrupt
 *        someone scrolled up reading — and the alternative silently strands
 *        people who scrolled one line to re-read a question.
 *
 *        Header chrome is NOT here: the page header is ContentLayout's job, and
 *        duplicating it would give this surface two titles.
 * WHERE: The content-plan chat. Available to any future conversational surface.
 */

import * as React from "react";

import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export interface ChatShellProps {
  /** The message turns, oldest first. */
  children: React.ReactNode;
  /**
   * Pinned below the scroll area — the input, the option chips, the action bar.
   * Separate from `children` so it stays reachable while the transcript scrolls.
   */
  footer?: React.ReactNode | undefined;
  /**
   * Changes to this value scroll the column to the bottom. Pass something that
   * moves when a turn is added — a message count, the current step. A value
   * rather than an effect on `children` because children is a new array every
   * render, which would scroll on every keystroke in the composer.
   */
  scrollKey?: React.DependencyList[number] | undefined;
  className?: string | undefined;
}

export function ChatShell({
  children,
  footer,
  scrollKey,
  className,
}: ChatShellProps) {
  const endRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    /* `block: "end"` keeps the sentinel just inside the viewport rather than
     * centring it, which would leave a gap of blank space under the last turn. */
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [scrollKey]);

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
      {/* min-h-0 on both the wrapper and the ScrollArea: without it a flex child
          refuses to shrink below its content height and the column grows the
          page instead of scrolling itself. */}
      <ScrollArea className="min-h-0 flex-1">
        <div
          className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-6"
          role="log"
          aria-live="polite"
          aria-label="Conversation"
        >
          {children}
          {/* Scroll target. Kept as an empty sentinel rather than scrolling the
              last message, which would hide anything below it. */}
          <div ref={endRef} aria-hidden />
        </div>
      </ScrollArea>

      {footer ? (
        <div className="border-t bg-background">
          <div className="mx-auto w-full max-w-3xl px-4 py-4">{footer}</div>
        </div>
      ) : null}
    </div>
  );
}

/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use client";

/**
 * SOURCE OF TRUTH KEYWORDS: ChatShell, ChatShellProps, useScrollToBottom,
 *   CHAT_PATTERN_STYLE, CHAT_BACKGROUND, chat wallpaper
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

import CHAT_BACKGROUND from "@/app/assets/images/chat-background.jpg";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

/* Built once at module scope rather than per render, and tiled rather than
 * stretched — the artwork is a seamless doodle pattern, so scaling it to the
 * container would blur it and expose the seams. A fixed tile width keeps the
 * doodles the same physical size on every viewport, which is what makes it read
 * as wallpaper instead of as a stretched image. */
const CHAT_PATTERN_STYLE: React.CSSProperties = {
  backgroundImage: `url(${CHAT_BACKGROUND.src})`,
  backgroundRepeat: "repeat",
  /* Small tile on purpose. At ~460px the individual doodles were large enough to
   * be read as pictures, which turns wallpaper into a competing subject; dense
   * and small, they blur into texture at a glance. */
  backgroundSize: "300px auto",
};

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
    <div
      className={cn("relative isolate flex min-h-0 flex-1 flex-col", className)}
    >
      {/* The wallpaper sits on the SHELL, not inside the scroll area, so it
          stays put while the transcript slides over it — the same way a chat
          app's background does. Inside the scroller it would scroll with the
          messages and read as a very long image rather than as a surface.
          Decorative, so it is hidden from assistive tech and takes no pointer. */}
      <div
        data-slot="chat-wallpaper"
        aria-hidden="true"
        style={CHAT_PATTERN_STYLE}
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.35]"
      />

      {/* min-h-0 on both the wrapper and the ScrollArea: without it a flex child
          refuses to shrink below its content height and the column grows the
          page instead of scrolling itself. */}
      <ScrollArea className="min-h-0 flex-1">
        {/* min-h-full + justify-end anchors the transcript to the BOTTOM, so a
            conversation that has only just started sits above the composer
            instead of stranding the first turn at the top with a screen of
            empty wallpaper under it. The ScrollArea viewport is size-full, so
            min-h-full resolves to the visible height; once the turns outgrow
            that the column simply grows past it and scrolls as normal. */}
        <div
          className="mx-auto flex min-h-full w-full max-w-3xl flex-col justify-end gap-4 px-4 py-6"
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

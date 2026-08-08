/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use client";

/**
 * SOURCE OF TRUTH KEYWORDS: ChatMessage, ChatMessageProps, ChatRole,
 *   ChatTyping, ChatTypingProps, BrandMark, assistant avatar, mascot
 *
 * WHAT:  One turn in a conversational surface — an avatar and a bubble, aligned
 *        by who is speaking — plus the "thinking" placeholder.
 * WHY:   Presentational only, exactly like LinkedInPostPreview: it takes a role
 *        and children and renders them, with no idea what a content plan is. A
 *        second conversational feature gets the same bubbles by importing this
 *        rather than by copying a div with the right padding.
 *
 *        `children` rather than a `text` prop because half the assistant turns in
 *        this app are not text — they are result cards, option chips, and action
 *        bars. A text prop would have forced every one of those to sit outside
 *        the bubble and lose the alignment.
 * WHERE: The content-plan chat. Available to any future conversational surface.
 */

import * as React from "react";
import { Loader2Icon } from "lucide-react";

import { BrandMark } from "@/components/global/platform-logo";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn, initialsOf } from "@/lib/utils";

export type ChatRole = "assistant" | "user";

export interface ChatMessageProps {
  role: ChatRole;
  /** Speaker name — used for the avatar fallback and the image alt text. */
  name?: string | null | undefined;
  avatarUrl?: string | null | undefined;
  /**
   * Drops the bubble background and padding, leaving only the alignment and the
   * avatar gutter. For assistant turns whose content is already a Card — a
   * bubble around a card reads as a box inside a box.
   */
  unstyled?: boolean | undefined;
  children: React.ReactNode;
  className?: string | undefined;
}

export function ChatMessage({
  role,
  name,
  avatarUrl,
  unstyled = false,
  children,
  className,
}: ChatMessageProps) {
  const isUser = role === "user";

  const avatar = (
    <Avatar
      className={cn(
        "size-8 shrink-0",
        /* The ring gives the assistant a consistent edge whichever way its
           avatar resolves, so the character reads as one speaker down the
           whole transcript. */
        !isUser && "ring-2 ring-brand/25",
      )}
    >
      {avatarUrl ? <AvatarImage src={avatarUrl} alt={name ?? ""} /> : null}
      <AvatarFallback
        className={cn(
          "text-xs font-medium",
          isUser
            ? "bg-muted text-muted-foreground"
            : "bg-brand-soft text-brand-soft-foreground",
        )}
      >
        {isUser ? (
          initialsOf(name)
        ) : (
          /* The mascot rather than a generic bot glyph: the assistant here is
             the product's character, and a face the user recognises from the
             sign-in screen turns a form into a conversation. Rendered through
             BrandMark so the image is still imported in exactly one place and a
             rebrand stays a one-line swap. */
          <BrandMark className="size-8 rounded-full" />
        )}
      </AvatarFallback>
    </Avatar>
  );

  return (
    <div
      className={cn(
        "flex w-full items-end gap-2",
        /* Reversed rather than justify-end so the avatar stays adjacent to its
           own bubble at every width. */
        isUser ? "flex-row-reverse" : "flex-row",
        className,
      )}
    >
      {avatar}
      <div
        className={cn(
          /* Capped so a long assistant answer wraps into a column instead of
             running the full width of a desktop viewport, which is unreadable. */
          "max-w-[min(42rem,85%)] min-w-0",
          /* The shadow is what lifts a bubble off the patterned wallpaper behind
             it — without it the two dark surfaces sit in the same plane and the
             doodles read as noise inside the bubble rather than behind it. */
          !unstyled &&
            "rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-md wrap-break-word whitespace-pre-wrap",
          !unstyled &&
            (isUser
              ? "bg-brand text-brand-foreground"
              : "bg-muted text-foreground"),
        )}
      >
        {children}
      </div>
    </div>
  );
}

export interface ChatTypingProps {
  /** What is being waited on, e.g. "Reading your profile". */
  label?: string | undefined;
}

/**
 * SOURCE OF TRUTH KEYWORDS: ChatTyping
 *
 * WHAT:  An assistant bubble showing that a response is on its way.
 * WHY:   The model calls behind this feature take tens of seconds, which is long
 *        enough that a still screen reads as broken. Naming what is happening
 *        rather than showing a bare spinner is what makes the wait legible —
 *        "Building your plan" is a reason to wait; a spinner is not.
 */
export function ChatTyping({ label = "Thinking" }: ChatTypingProps) {
  return (
    <ChatMessage role="assistant">
      <span className="flex items-center gap-2 text-muted-foreground">
        <Loader2Icon className="size-4 animate-spin" aria-hidden />
        {label}
        <span className="sr-only">, please wait</span>
      </span>
    </ChatMessage>
  );
}

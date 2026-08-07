/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use client";

/**
 * SOURCE OF TRUTH KEYWORDS: LinkedInPostPreview, LinkedInPostPreviewProps
 *
 * WHAT:  A LinkedIn-styled rendering of a post — author row, body, optional
 *        media, and the reaction bar.
 * WHY:   Global rather than route-local because every LinkedIn surface shows
 *        this same card: the composer today, and drafts, the schedule queue,
 *        and post analytics next. It is presentational only (no data fetching,
 *        no mutations) and takes an `actions` slot, so a caller can hang
 *        Publish/Schedule/Delete off it without the component knowing about any
 *        of them.
 * WHERE: Rendered by the composer under
 *        src/app/(dashboard)/dashboard/post-generation/_components.
 */

import * as React from "react";
import {
  GlobeIcon,
  MessageCircleIcon,
  RepeatIcon,
  SendIcon,
  ThumbsUpIcon,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn, initialsOf } from "@/lib/utils";

export interface LinkedInPostPreviewProps {
  authorName: string;
  authorAvatarUrl?: string | null | undefined;
  /** Post body. Blank lines are preserved — LinkedIn renders them as spacing. */
  commentary: string;
  /** Object URL or data URL for attached media. */
  imageUrl?: string | null | undefined;
  /** Relative time label, e.g. "Now" or "2h". */
  timestamp?: string;
  /** Slot for editor controls or per-post actions. */
  children?: React.ReactNode;
  /** Slot rendered below the reaction bar (e.g. media attach controls). */
  actions?: React.ReactNode;
  className?: string;
}

const REACTIONS = [
  { label: "Like", icon: ThumbsUpIcon },
  { label: "Comment", icon: MessageCircleIcon },
  { label: "Repost", icon: RepeatIcon },
  { label: "Send", icon: SendIcon },
] as const;

export function LinkedInPostPreview({
  authorName,
  authorAvatarUrl,
  commentary,
  imageUrl,
  timestamp = "Now",
  children,
  actions,
  className,
}: LinkedInPostPreviewProps) {
  return (
    /* The accent hairline is what makes the card read as "this is the LinkedIn
       post", without tinting the surface the copy sits on. */
    <Card
      className={cn("overflow-hidden border-t-2 border-t-brand", className)}
    >
      <CardContent className="flex flex-col gap-4 p-4">
        <div className="flex items-center gap-3">
          <Avatar className="size-12 ring-2 ring-brand/25">
            {authorAvatarUrl ? (
              <AvatarImage src={authorAvatarUrl} alt={authorName} />
            ) : null}
            <AvatarFallback className="bg-brand-soft font-medium text-brand-soft-foreground">
              {initialsOf(authorName)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate font-semibold leading-tight">{authorName}</p>
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              {timestamp}
              <span aria-hidden>·</span>
              <GlobeIcon className="size-3" aria-label="Public" />
            </p>
          </div>
        </div>

        {/* `children` lets the composer swap the static body for a live editor
            while keeping identical surrounding chrome. */}
        {children ?? (
          <p className="whitespace-pre-wrap wrap-break-word text-sm leading-relaxed">
            {commentary || "Your AI generated post will be shown here..."}
          </p>
        )}

        {imageUrl ? (
          <div className="overflow-hidden rounded-md border">
            {/* Local object/data URL for an unsaved attachment — next/image
                can't optimize a blob, so a plain img is correct here. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt="Attached media"
              className="max-h-96 w-full object-cover"
            />
          </div>
        ) : null}

        {actions}

        <Separator />

        <div className="flex items-center justify-between text-muted-foreground">
          {REACTIONS.map(({ label, icon: Icon }) => (
            <span
              key={label}
              className="flex items-center gap-2 rounded-md px-2 py-1 text-xs font-medium transition-colors hover:bg-brand-soft hover:text-brand-soft-foreground"
            >
              <Icon className="size-4" />
              {label}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

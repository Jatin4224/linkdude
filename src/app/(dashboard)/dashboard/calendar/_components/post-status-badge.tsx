/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: PostStatusBadge, POST_STATUS_LABELS,
 *   POST_STATUS_CLASSES
 *
 * WHAT:  Renders a LinkedInPost status as a labelled chip.
 * WHY:   The maps are typed against LinkedInPostStatus, so adding a status to
 *        the union is a COMPILE ERROR here until it has both copy and a colour —
 *        a new state can never silently render as a blank chip.
 *        Colours come from theme tokens only, so the chips follow light/dark.
 * WHERE: Used by the calendar grid and its day-detail panel.
 */

import type { LinkedInPostStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const POST_STATUS_LABELS: Record<LinkedInPostStatus, string> = {
  scheduled: "Scheduled",
  publishing: "Publishing",
  published: "Published",
  failed: "Failed",
  canceled: "Canceled",
};

/* `publishing` borrows the primary tint because it is transient and should read
 * as active work; `failed` is the only destructive state a user must act on. */
const POST_STATUS_CLASSES: Record<LinkedInPostStatus, string> = {
  scheduled: "bg-brand-soft text-brand-soft-foreground border-brand-border",
  publishing: "bg-primary/10 text-primary border-primary/20",
  published: "bg-muted text-muted-foreground border-transparent",
  failed: "bg-destructive/10 text-destructive border-destructive/20",
  canceled: "bg-muted text-muted-foreground/70 border-transparent",
};

/* The column is a bare String in Postgres, so a value outside the union is
 * possible in principle — fall back rather than render nothing. */
function asStatus(value: string): LinkedInPostStatus {
  return value in POST_STATUS_LABELS
    ? (value as LinkedInPostStatus)
    : "scheduled";
}

export function PostStatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const key = asStatus(status);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] leading-none font-medium",
        POST_STATUS_CLASSES[key],
        className,
      )}
    >
      {POST_STATUS_LABELS[key]}
    </span>
  );
}

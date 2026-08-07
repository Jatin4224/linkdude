/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use client";

/**
 * SOURCE OF TRUTH KEYWORDS: CopyButton, CopyButtonProps, COPY_RESET_MS
 *
 * WHAT:  Copies a string to the clipboard and confirms it in place for a moment.
 * WHY:   This app's output is text the user came to PASTE — a profile rewrite, a
 *        content pillar, a hook — so every generated block needs the same
 *        control. It started as a local helper inside the profile-analysis
 *        result view; lifted here the moment a second feature needed it, rather
 *        than copied, so the confirmation timing, the failure toast and the
 *        accessible label stay identical everywhere.
 *
 *        The confirmed state lives in the button rather than in a toast because
 *        the user's attention is already on the thing they clicked, and a corner
 *        toast for "copied" is noise on a page with a dozen copy buttons.
 *
 *        Presentational only — it takes the text, never fetches or derives it.
 * WHERE: Profile analysis rewrites; content plan section cards.
 */

import * as React from "react";
import { CheckIcon, CopyIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** How long the confirmed state holds before reverting. */
const COPY_RESET_MS = 2000;

export interface CopyButtonProps {
  /** The exact string written to the clipboard. */
  text: string;
  /**
   * What is being copied, for the screen-reader label — "headline rewrite",
   * "Hook Bank". Required rather than optional: a page of identical "Copy"
   * buttons is unusable without it.
   */
  label: string;
  /** Hides the "Copy"/"Copied" text, leaving the icon. For dense card headers. */
  iconOnly?: boolean | undefined;
  variant?: React.ComponentProps<typeof Button>["variant"] | undefined;
  size?: React.ComponentProps<typeof Button>["size"] | undefined;
  className?: string | undefined;
}

export function CopyButton({
  text,
  label,
  iconOnly = false,
  variant = "outline",
  size,
  className,
}: CopyButtonProps) {
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), COPY_RESET_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      /* Clipboard access is denied in insecure contexts and some browsers. */
      toast.error("Could not copy. Select the text and copy manually.");
    }
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size ?? (iconOnly ? "icon-sm" : "sm")}
      onClick={handleCopy}
      aria-label={`Copy ${label}`}
      className={cn(className)}
    >
      {copied ? (
        <CheckIcon className="size-4" />
      ) : (
        <CopyIcon className="size-4" />
      )}
      {iconOnly ? null : copied ? "Copied" : "Copy"}
    </Button>
  );
}

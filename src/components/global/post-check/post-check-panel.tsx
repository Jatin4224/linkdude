/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use client";

/**
 * SOURCE OF TRUTH KEYWORDS: PostCheckPanel, PostCheckPanelProps, Check my post,
 *   post check panel, Fix it, Undo fix, pre-publish check UI
 *
 * WHAT:  A live pre-publish check for any LinkedIn post text: what to fix before
 *        posting, what to review, and an optional Fix it button that hands the
 *        found problems to the AI.
 * WHY:   Global because every surface that lets a member write LinkedIn copy
 *        should say the same thing about it: the composer today, and the carousel
 *        caption or the draft library later.
 *
 *        The check runs in the browser on a deferred copy of the text, so typing
 *        never waits on it and it costs nothing. The panel only reports; the
 *        caller owns the fix mutation and the undo, and passes the gated
 *        resource, so the component never assumes which allowance a fix spends.
 * WHERE: post-composer.tsx.
 */

import * as React from "react";
import {
  AlertTriangleIcon,
  CheckIcon,
  Loader2Icon,
  SparklesIcon,
  Undo2Icon,
  XIcon,
} from "lucide-react";

import { POST_CHECK_RULES } from "@/lib/config/post-writing";
import { checkPost } from "@/lib/post-check";
import type { ResourceKey } from "@/lib/resources";
import type { PostCheckCode, PostLength } from "@/lib/types";
import { cn } from "@/lib/utils";
import { FeatureGate } from "@/components/feature-gate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface PostCheckPanelProps {
  commentary: string;
  /** The length the member picked, when there is one. Enables the length check. */
  length?: PostLength | undefined;
  /** Receives the codes of every problem found. Omit to hide Fix it. */
  onFix?: ((issues: PostCheckCode[]) => void) | undefined;
  /** The allowance a fix spends, so Fix it opens the upgrade prompt at the limit. */
  fixResource?: ResourceKey | undefined;
  isFixing?: boolean | undefined;
  /** Present only right after a fix, to put the previous text back. */
  onUndoFix?: (() => void) | undefined;
  disabled?: boolean | undefined;
  className?: string | undefined;
}

export function PostCheckPanel({
  commentary,
  length,
  onFix,
  fixResource,
  isFixing = false,
  onUndoFix,
  disabled = false,
  className,
}: PostCheckPanelProps) {
  /* Typing stays instant: the check catches up on the next idle render. */
  const deferredCommentary = React.useDeferredValue(commentary);
  const result = React.useMemo(
    () => checkPost(deferredCommentary, { length }),
    [deferredCommentary, length],
  );

  /* Nothing to check until there is text. */
  if (result.wordCount === 0) return null;

  const isClean = result.issues.length === 0;

  const fixButton =
    onFix && !isClean ? (
      <Button
        type="button"
        variant="brand"
        size="sm"
        disabled={disabled || isFixing}
        onClick={() => onFix(result.issues.map((issue) => issue.code))}
      >
        {isFixing ? (
          <Loader2Icon className="size-3.5 animate-spin" />
        ) : (
          <SparklesIcon className="size-3.5" />
        )}
        Fix it
      </Button>
    ) : null;

  return (
    <div
      className={cn(
        "surface-raised flex flex-col gap-3 rounded-lg border p-3",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium">
            {isClean ? "Ready to post" : "Check my post"}
          </p>
          {result.blockerCount > 0 ? (
            <Badge variant="destructive">{result.blockerCount} to fix</Badge>
          ) : null}
          {result.warningCount > 0 ? (
            <Badge variant="outline">{result.warningCount} to review</Badge>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {onUndoFix ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isFixing}
              onClick={onUndoFix}
            >
              <Undo2Icon className="size-3.5" />
              Undo fix
            </Button>
          ) : null}
          {fixButton && fixResource ? (
            <FeatureGate resource={fixResource}>{fixButton}</FeatureGate>
          ) : (
            fixButton
          )}
        </div>
      </div>

      {isClean ? (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <CheckIcon className="size-3.5 shrink-0 text-brand" />
          No weak openers, AI-sounding patterns or reach problems found.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {result.issues.map((issue) => {
            const rule = POST_CHECK_RULES[issue.code];
            return (
              <li key={issue.code} className="flex gap-2">
                {issue.severity === "blocker" ? (
                  <XIcon className="mt-0.5 size-4 shrink-0 text-destructive" />
                ) : (
                  <AlertTriangleIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                )}
                <div className="flex min-w-0 flex-col gap-0.5 text-sm">
                  <p className="font-medium">{rule.title}</p>
                  <p className="text-muted-foreground">{rule.fix}</p>
                  {issue.excerpt ? (
                    <p className="mt-1 truncate rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
                      {issue.excerpt}
                    </p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {fixButton ? (
        <p className="text-xs text-muted-foreground">
          Fix it rewrites only what is listed and uses one AI generation.
        </p>
      ) : null}
    </div>
  );
}

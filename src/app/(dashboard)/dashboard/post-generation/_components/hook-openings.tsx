/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use client";

/**
 * SOURCE OF TRUTH KEYWORDS: HookOpenings, HookOpeningsProps, opening lines,
 *   alternative hooks, swap first line, hook formula label
 *
 * WHAT:  The generated post's opening line and two alternatives, each labelled
 *        with its hook formula, with a button to use it.
 * WHY:   The first line decides whether anyone clicks "see more", and it is the
 *        part members most often want to try another way. Swapping replaces only
 *        the first line and spends no generation, and the generated opening stays
 *        in the list, so any choice can be undone by choosing again.
 * WHERE: post-composer.tsx, under the preview, after a topic generation.
 */

import { CheckIcon } from "lucide-react";

import { HOOK_FORMULAS } from "@/lib/config";
import type { PostOpeningChoice } from "@/lib/types";
import { Button } from "@/components/ui/button";

export interface HookOpeningsProps {
  choices: readonly PostOpeningChoice[];
  /** The post's current first line, to mark which choice is in use. */
  currentOpening: string;
  onChoose: (line: string) => void;
  disabled?: boolean | undefined;
}

export function HookOpenings({
  choices,
  currentOpening,
  onChoose,
  disabled = false,
}: HookOpeningsProps) {
  return (
    <div className="surface-raised flex flex-col gap-3 rounded-lg border p-3">
      <div>
        <p className="text-sm font-medium">Opening lines</p>
        <p className="text-xs text-muted-foreground">
          Same post, different hooks. Swapping changes only the first line and
          uses no generation.
        </p>
      </div>

      <ul className="flex flex-col gap-2">
        {choices.map((choice, index) => {
          const inUse = choice.line.trim() === currentOpening.trim();
          const label = choice.formula
            ? HOOK_FORMULAS[choice.formula].label
            : "Your opening";
          return (
            <li
              key={`${index}-${choice.formula ?? "original"}`}
              className="flex items-start justify-between gap-3 rounded-md border p-2"
            >
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <p className="text-xs font-medium text-muted-foreground">
                  {label}
                  {index === 0 ? " (generated)" : ""}
                </p>
                <p className="text-sm">{choice.line}</p>
              </div>
              <Button
                type="button"
                size="sm"
                variant={inUse ? "ghost" : "outline"}
                disabled={disabled || inUse}
                onClick={() => onChoose(choice.line)}
              >
                {inUse ? (
                  <>
                    <CheckIcon className="size-3.5" />
                    In use
                  </>
                ) : (
                  "Use"
                )}
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

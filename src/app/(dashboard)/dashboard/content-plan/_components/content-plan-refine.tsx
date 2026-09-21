/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use client";

/**
 * SOURCE OF TRUTH KEYWORDS: ContentPlanRefineBar, ContentPlanRefineBarProps
 *
 * WHAT:  "Refine Strategy" — one button per answered question, to change an
 *        answer and regenerate.
 * WHY:   The honest response to a plan that misses is "you asked me the wrong
 *        thing", and without this the only recovery is starting over from the
 *        URL — which throws away a paid lookup and three correct answers to fix
 *        one wrong one.
 *
 *        Buttons are derived from CONTENT_PLAN_QUESTION_KEYS and each step's
 *        `editLabel`, so a new question gets a Refine button for free and the
 *        profile step is excluded by construction rather than by an index check.
 *
 *        The warning line is not decoration. Regenerating is a fresh model call
 *        and costs another quota unit, and a control that silently spends should
 *        say so before it is clicked.
 * WHERE: Rendered below the result cards once a plan exists.
 */

import { CONTENT_PLAN_QUESTION_KEYS, CONTENT_PLAN_STEPS } from "@/lib/config";
import type { ContentPlanStepKey } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface ContentPlanRefineBarProps {
  onEdit: (step: ContentPlanStepKey) => void;
  disabled?: boolean | undefined;
}

export function ContentPlanRefineBar({
  onEdit,
  disabled = false,
}: ContentPlanRefineBarProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Refine Strategy</CardTitle>
        <p className="mt-1 text-xs text-muted-foreground">
          Not quite right? Change an answer and I&apos;ll rebuild the plan — that
          counts as another generation.
        </p>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {CONTENT_PLAN_QUESTION_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              disabled={disabled}
              onClick={() => onEdit(key)}
              /* The same option chip the conversation above uses, so "change
                 this answer" looks like the answers it changes. */
              className="tech-chip px-3.5 py-1.5 text-sm disabled:cursor-not-allowed"
            >
              {CONTENT_PLAN_STEPS[key].editLabel}
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

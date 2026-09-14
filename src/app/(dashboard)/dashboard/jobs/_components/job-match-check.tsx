/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: JobMatchCheck, JobMatchCheckProps, match check,
 *   matched requirements, missing requirements, how you match
 *
 * WHAT:  The post's key requirements, marked as backed or not backed by the
 *        member's saved details and job notes.
 * WHY:   Shows at a glance whether a job is worth applying to, and what to add
 *        to About me when a real skill was simply left out. It comes from the
 *        same model call as the email, so it costs nothing extra.
 * WHERE: Rendered by job-email-result.tsx above the draft.
 */

import { CheckIcon, XIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";

export interface JobMatchCheckProps {
  matched: readonly string[];
  missing: readonly string[];
}

export function JobMatchCheck({ matched, missing }: JobMatchCheckProps) {
  const total = matched.length + missing.length;
  if (total === 0) return null;

  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-muted/40 p-3">
      <div>
        <p className="text-sm font-medium">How you match</p>
        <p className="text-xs text-muted-foreground">
          {matched.length} of {total} key requirements are backed by your details.
        </p>
      </div>

      <ul className="flex flex-wrap gap-1.5">
        {matched.map((requirement, index) => (
          <li key={`matched-${index}`} className="max-w-full">
            <Badge variant="secondary" className="max-w-full" title={requirement}>
              <CheckIcon className="text-brand" />
              <span className="truncate">{requirement}</span>
            </Badge>
          </li>
        ))}
        {missing.map((requirement, index) => (
          <li key={`missing-${index}`} className="max-w-full">
            <Badge
              variant="outline"
              className="max-w-full text-muted-foreground"
              title={requirement}
            >
              <XIcon />
              <span className="truncate">{requirement}</span>
            </Badge>
          </li>
        ))}
      </ul>

      {missing.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          Have one of the missing ones? Add it to About me and write the email again.
        </p>
      ) : null}
    </div>
  );
}

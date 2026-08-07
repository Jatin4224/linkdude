/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use client";

/**
 * SOURCE OF TRUTH KEYWORDS: ContentPlanInsightsCard, ContentPlanInsightsCardProps
 *
 * WHAT:  The "Profile Insights" read-back shown right after the profile loads.
 * WHY:   Its job is to earn the next three questions. The user has just handed
 *        over a URL and been asked to keep answering; showing that the profile
 *        was actually READ — and read specifically, naming their own material —
 *        is what makes that worth doing rather than feeling like a form.
 *
 *        Deliberately has no copy button and no actions. Nothing here is meant to
 *        be pasted anywhere; it is context, and the plan is the product.
 * WHERE: Rendered by the chat inside an assistant turn, once per session.
 */

import { SparklesIcon } from "lucide-react";

import type { ContentPlanInsights } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface ContentPlanInsightsCardProps {
  insights: ContentPlanInsights;
  /** Shown under the title when the lookup returned a name. */
  profileName?: string | null | undefined;
}

export function ContentPlanInsightsCard({
  insights,
  profileName,
}: ContentPlanInsightsCardProps) {
  if (insights.bullets.length === 0) return null;

  return (
    <Card className="border-t-2 border-t-brand">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <SparklesIcon className="size-4 text-brand" aria-hidden />
          Profile Insights
        </CardTitle>
        {profileName ? (
          <p className="mt-1 text-xs text-muted-foreground">
            Read from {profileName}&apos;s profile
          </p>
        ) : null}
      </CardHeader>
      <CardContent>
        <ul className="flex list-disc flex-col gap-2 pl-5 text-sm leading-relaxed">
          {insights.bullets.map((bullet, index) => (
            <li key={index} className="wrap-break-word">
              {bullet}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

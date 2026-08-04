/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use client";

/**
 * SOURCE OF TRUTH KEYWORDS: AnalysisResult, AnalysisResultProps, ScoreDial,
 *   RewriteBlock, SCORE_BANDS
 *
 * WHAT:  Renders a completed profile analysis — score, per-section rewrites,
 *        strengths, and prioritized fixes.
 * WHY:   Rewrites are the product, so each one gets a copy button and is shown
 *        as the finished text rather than as advice about text. The score is
 *        banded into words because a bare number invites arguing with the
 *        number; the band says what to do about it.
 * WHERE: Rendered by profile-analyzer.tsx once the mutation resolves.
 */

import * as React from "react";
import { CheckIcon, CopyIcon, LightbulbIcon, ThumbsUpIcon } from "lucide-react";
import { toast } from "sonner";

import type { ProfileAnalysis, SectionFeedback } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export interface AnalysisResultProps {
  analysis: ProfileAnalysis;
}

/* Bands rather than a raw number alone: the label tells the user what the score
 * means for their next action, which the digit on its own does not. */
const SCORE_BANDS = [
  {
    min: 75,
    label: "Strong",
    className: "border-brand-border bg-brand-soft text-brand-soft-foreground",
  },
  {
    min: 50,
    label: "Solid, needs sharpening",
    className: "border-border bg-muted text-foreground",
  },
] as const;

/* The floor case, declared separately rather than as a `min: 0` row so the
 * lookup below returns a total result — indexing the array for a fallback would
 * be `possibly undefined` under noUncheckedIndexedAccess. */
const BASE_BAND = {
  label: "Needs work",
  className: "border-destructive/40 bg-destructive/10 text-destructive",
} as const;

function bandFor(score: number): { label: string; className: string } {
  return SCORE_BANDS.find((band) => score >= band.min) ?? BASE_BAND;
}

/* Copy is the primary action on every rewrite — the user came here to paste
 * something into LinkedIn, not to retype it. */
function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
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
      variant="outline"
      size="sm"
      onClick={handleCopy}
      aria-label={`Copy ${label}`}
    >
      {copied ? (
        <CheckIcon className="size-4" />
      ) : (
        <CopyIcon className="size-4" />
      )}
      {copied ? "Copied" : "Copy"}
    </Button>
  );
}

function RewriteBlock({
  title,
  feedback,
}: {
  title: string;
  feedback: SectionFeedback;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle className="text-base">{title}</CardTitle>
        <CopyButton text={feedback.rewrite} label={`${title} rewrite`} />
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">{feedback.verdict}</p>
        <Separator />
        {/* The rewrite is presented as finished copy, visually distinct from the
            critique above it, so it reads as something to take rather than read. */}
        <p className="whitespace-pre-wrap wrap-break-word rounded-md border bg-muted/40 p-3 text-sm leading-relaxed">
          {feedback.rewrite}
        </p>
      </CardContent>
    </Card>
  );
}

export function AnalysisResult({ analysis }: AnalysisResultProps) {
  const band = bandFor(analysis.score);

  return (
    <div className="flex flex-col gap-4">
      <Card className="border-t-2 border-t-brand">
        <CardContent className="flex flex-col gap-4 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-3xl font-semibold tabular-nums">
              {analysis.score}
            </span>
            <span className="text-sm text-muted-foreground">/ 100</span>
            <Badge variant="outline" className={band.className}>
              {band.label}
            </Badge>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {analysis.summary}
          </p>
        </CardContent>
      </Card>

      <RewriteBlock title="Headline" feedback={analysis.headlineFeedback} />
      <RewriteBlock title="About" feedback={analysis.aboutFeedback} />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ThumbsUpIcon className="size-4 text-brand-soft-foreground" />
            What&apos;s working
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {analysis.strengths.map((strength, index) => (
            <React.Fragment key={strength}>
              {index > 0 ? <Separator /> : null}
              <p className="text-sm leading-relaxed">{strength}</p>
            </React.Fragment>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <LightbulbIcon className="size-4 text-brand-soft-foreground" />
            Fix these next
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {analysis.improvements.map((improvement, index) => (
            <React.Fragment key={improvement.issue}>
              {index > 0 ? <Separator /> : null}
              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium">{improvement.issue}</p>
                <div className="flex items-start justify-between gap-3">
                  <p className="whitespace-pre-wrap wrap-break-word text-sm leading-relaxed text-muted-foreground">
                    {improvement.fix}
                  </p>
                  <CopyButton text={improvement.fix} label="fix" />
                </div>
              </div>
            </React.Fragment>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

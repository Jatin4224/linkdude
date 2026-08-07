/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use client";

/**
 * SOURCE OF TRUTH KEYWORDS: ContentPlanResultView, ContentPlanResultViewProps,
 *   ContentPlanSectionCard, ContentPlanReadyBar
 *
 * WHAT:  The generated strategy — the Save / New action bar and one card per
 *        section.
 * WHY:   Iterates CONTENT_PLAN_SECTION_ENTRIES rather than hard-coding ten cards,
 *        and switches on the section's `kind` rather than on its key. That is why
 *        there are four body renderers for ten sections, and why adding an
 *        eleventh is a registry entry plus a schema field with nothing to change
 *        here.
 *
 *        A section with no content is skipped entirely rather than rendered as an
 *        empty card: every array is defaulted so a model omission cannot fail the
 *        generation, which means empty is a state that genuinely reaches this
 *        component.
 * WHERE: Rendered by the chat once a plan exists, inside an assistant turn.
 */

import * as React from "react";
import { Loader2Icon, RotateCcwIcon, SaveIcon, SparklesIcon } from "lucide-react";

import type {
  ContentPlanResult,
  ContentPlanSectionKey,
  ContentPlanStatus,
} from "@/lib/types";
import {
  CONTENT_PLAN_SECTION_ENTRIES,
  contentPlanSectionCopyText,
} from "@/lib/config";
import { CopyButton } from "@/components/global/copy-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export interface ContentPlanResultViewProps {
  result: ContentPlanResult;
  status: ContentPlanStatus;
  onSave: () => void;
  onStartNew: () => void;
  isSaving: boolean;
  canSave: boolean;
  canStartNew: boolean;
}

/* Bulleted bodies are the majority shape, so they get one renderer rather than
 * one per section. */
function BulletList({ items }: { items: readonly string[] }) {
  return (
    <ul className="flex list-disc flex-col gap-2 pl-5 text-sm leading-relaxed">
      {items.map((item, index) => (
        <li key={index} className="wrap-break-word">
          {item}
        </li>
      ))}
    </ul>
  );
}

/**
 * SOURCE OF TRUTH KEYWORDS: ContentPlanSectionBody
 *
 * WHAT:  Draws one section's payload according to its declared shape.
 * WHY:   The switch is exhaustive over `kind`, so a fifth shape added to the
 *        registry is a compile error here rather than a card that renders blank.
 *        Returns null for empty content so the parent can skip the whole card.
 */
function ContentPlanSectionBody({
  sectionKey,
  result,
}: {
  sectionKey: ContentPlanSectionKey;
  result: ContentPlanResult;
}): React.ReactNode {
  switch (sectionKey) {
    case "positioning":
    case "postingStrategy": {
      const text = result[sectionKey];
      if (!text) return null;
      return (
        <p className="whitespace-pre-wrap wrap-break-word rounded-md border bg-muted/40 p-3 text-sm leading-relaxed">
          {text}
        </p>
      );
    }

    case "targetAudience":
    case "contentFormats":
    case "postIdeas":
    case "hooks":
    case "ctas":
    case "gaps": {
      const items = result[sectionKey];
      if (items.length === 0) return null;
      return <BulletList items={items} />;
    }

    case "contentPillars": {
      if (result.contentPillars.length === 0) return null;
      return (
        <div className="flex flex-col gap-3">
          {result.contentPillars.map((pillar, index) => (
            <React.Fragment key={pillar.title}>
              {index > 0 ? <Separator /> : null}
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium">{pillar.title}</p>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {pillar.description}
                </p>
              </div>
            </React.Fragment>
          ))}
        </div>
      );
    }

    case "calendar": {
      if (result.calendar.length === 0) return null;
      return (
        <div className="flex flex-col gap-3">
          {result.calendar.map((week, index) => (
            <React.Fragment key={week.week}>
              {index > 0 ? <Separator /> : null}
              <div className="flex flex-col gap-2">
                <Badge variant="outline" className="w-fit font-normal">
                  Week {week.week}
                </Badge>
                <p className="text-sm leading-relaxed">{week.focus}</p>
                {week.formats.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {week.formats.map((format) => (
                      <span
                        key={format}
                        className="rounded-full border bg-muted/40 px-2.5 py-1 text-xs text-muted-foreground"
                      >
                        {format}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            </React.Fragment>
          ))}
        </div>
      );
    }
  }
}

function ContentPlanSectionCard({
  sectionKey,
  result,
}: {
  sectionKey: ContentPlanSectionKey;
  result: ContentPlanResult;
}) {
  const section = CONTENT_PLAN_SECTION_ENTRIES.find(
    (entry) => entry.key === sectionKey,
  );
  const body = ContentPlanSectionBody({ sectionKey, result });
  /* Nothing generated for this section — skip the card rather than showing an
     empty one, which reads as a bug rather than as an omission. */
  if (!section || body === null) return null;

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div className="min-w-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <span aria-hidden>{section.emoji}</span>
            {section.label}
          </CardTitle>
          {section.description ? (
            <p className="mt-1 text-xs text-muted-foreground">
              {section.description}
            </p>
          ) : null}
        </div>
        {section.copyable ? (
          <CopyButton
            text={contentPlanSectionCopyText(result, sectionKey)}
            label={section.label}
            iconOnly
          />
        ) : null}
      </CardHeader>
      <CardContent>{body}</CardContent>
    </Card>
  );
}

export function ContentPlanResultView({
  result,
  status,
  onSave,
  onStartNew,
  isSaving,
  canSave,
  canStartNew,
}: ContentPlanResultViewProps) {
  const isSaved = status === "saved";

  return (
    <div className="flex flex-col gap-4">
      {/* The action bar leads, not trails. The plan is long, and Save has to be
          reachable the moment it arrives rather than after ten cards of scroll. */}
      <Card className="border-t-2 border-t-brand">
        <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <SparklesIcon className="size-4 text-brand" aria-hidden />
            {isSaved ? "Your Strategy is Saved" : "Your Strategy is Ready"}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onSave}
              /* Already saved is not a failure worth an error toast — the control
                 simply has nothing left to do. */
              disabled={isSaving || isSaved || !canSave}
            >
              {isSaving ? (
                <Loader2Icon className="size-4 animate-spin" />
              ) : (
                <SaveIcon className="size-4" />
              )}
              {isSaved ? "Saved" : "Save"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onStartNew}
              disabled={!canStartNew}
            >
              <RotateCcwIcon className="size-4" />
              New
            </Button>
          </div>
        </CardHeader>
      </Card>

      {CONTENT_PLAN_SECTION_ENTRIES.map((section) => (
        <ContentPlanSectionCard
          key={section.key}
          sectionKey={section.key}
          result={result}
        />
      ))}
    </div>
  );
}

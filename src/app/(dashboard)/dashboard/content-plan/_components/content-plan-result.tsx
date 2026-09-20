/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use client";

/**
 * SOURCE OF TRUTH KEYWORDS: ContentPlanResultView, ContentPlanResultViewProps,
 *   ContentPlanSectionCard, ContentPlanReadyBar, ContentPlanDraftControls,
 *   DraftIdeaButton, BulletList renderItemAction
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
import Link from "next/link";
import {
  CheckIcon,
  Loader2Icon,
  PenLineIcon,
  RotateCcwIcon,
  SaveIcon,
  SparklesIcon,
} from "lucide-react";

import type {
  ContentPlanResult,
  ContentPlanSectionKey,
  ContentPlanStatus,
} from "@/lib/types";
import { AI_POST_TOPIC_MIN } from "@/lib/types";
import {
  CONTENT_PLAN_SECTION_ENTRIES,
  contentPlanSectionCopyText,
} from "@/lib/config";
import { buildDraftComposerHref, cn } from "@/lib/utils";
import { CopyButton } from "@/components/global/copy-button";
import { TechBadge } from "@/components/global/tech";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

/**
 * SOURCE OF TRUTH KEYWORDS: ContentPlanDraftControls
 *
 * WHAT:  The "Draft this" action, handed down from the chat.
 * WHY:   Callbacks rather than tRPC in here, matching onSave/onStartNew: this
 *        component renders a plan and owns no data access, so the chat stays the
 *        one place that knows a draft costs a generation.
 *
 *        Passed as a WHOLE or not at all — the chat omits it when the member
 *        lacks the permissions. Six disabled buttons down a list is noise, unlike
 *        the single disabled Save above, where the greyed control is the
 *        explanation.
 * WHERE: Supplied by ContentPlanChat; consumed by the Post Idea Bank card.
 */
export interface ContentPlanDraftControls {
  /** Generates a post from one idea and saves it as a draft. */
  onDraftIdea: (idea: string) => void;
  /** The idea in flight, so only its own button spins rather than all six. */
  pendingIdea: string | null;
  /**
   * idea → draft id, for ideas drafted in this session.
   *
   * Drives a persistent "Open draft" link rather than a toast: the user works
   * DOWN this list, and a notification that disappears takes the only route back
   * to the draft with it. It also marks which ideas are already done.
   */
  draftedIds: Record<string, string>;
  /** True while any other blocking work on the screen is running. */
  disabled: boolean;
}

export interface ContentPlanResultViewProps {
  result: ContentPlanResult;
  status: ContentPlanStatus;
  onSave: () => void;
  onStartNew: () => void;
  isSaving: boolean;
  canSave: boolean;
  canStartNew: boolean;
  /** Omitted when the member cannot generate or cannot save drafts. */
  draft?: ContentPlanDraftControls | undefined;
}

/**
 * SOURCE OF TRUTH KEYWORDS: DraftIdeaButton
 *
 * WHAT:  The per-idea action on the Post Idea Bank.
 * WHY:   Refuses an idea shorter than the generator's own floor rather than
 *        spending a generation to be told no — `generatePostSchema` requires
 *        AI_POST_TOPIC_MIN characters, and the plan's schema allows a shorter
 *        item. Disabled with a reason rather than hidden, so a missing button on
 *        one row of six never reads as a rendering bug.
 * WHERE: Passed to BulletList as `renderItemAction` for draftable sections.
 */
function DraftIdeaButton({
  idea,
  controls,
}: {
  idea: string;
  controls: ContentPlanDraftControls;
}) {
  const tooShort = idea.trim().length < AI_POST_TOPIC_MIN;
  const isPending = controls.pendingIdea === idea;
  const draftedId = controls.draftedIds[idea];

  /* Already drafted in this session — the button's job is done, and what the
     user wants now is the way to it. */
  if (draftedId) {
    return (
      <Link
        href={buildDraftComposerHref(draftedId)}
        className={cn(
          buttonVariants({ variant: "ghost", size: "sm" }),
          "shrink-0",
        )}
      >
        <CheckIcon className="size-4 text-brand" />
        Open draft
      </Link>
    );
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="shrink-0"
      disabled={tooShort || controls.disabled || controls.pendingIdea !== null}
      title={
        tooShort
          ? `This idea is too short to generate from — it needs at least ${AI_POST_TOPIC_MIN} characters.`
          : "Generate a post from this idea and save it as a draft"
      }
      onClick={() => controls.onDraftIdea(idea)}
    >
      {isPending ? (
        <Loader2Icon className="size-4 animate-spin" />
      ) : (
        <PenLineIcon className="size-4" />
      )}
      Draft this
    </Button>
  );
}

/* Bulleted bodies are the majority shape, so they get one renderer rather than
 * one per section. `renderItemAction` is the slot that keeps it that way: the
 * Post Idea Bank needs a per-item button and the other five bulleted sections do
 * not, and a second list component would have been the alternative. */
function BulletList({
  items,
  renderItemAction,
}: {
  items: readonly string[];
  renderItemAction?: (item: string) => React.ReactNode;
}) {
  return (
    <ul className="flex list-disc flex-col gap-2 pl-5 text-sm leading-relaxed">
      {items.map((item, index) => (
        <li key={index} className="wrap-break-word">
          {renderItemAction ? (
            /* items-start, not items-center: an idea can wrap to three lines and
               the button should stay level with the first of them. */
            <span className="flex items-start justify-between gap-2">
              <span className="min-w-0 flex-1">{item}</span>
              {renderItemAction(item)}
            </span>
          ) : (
            item
          )}
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
  renderItemAction,
}: {
  sectionKey: ContentPlanSectionKey;
  result: ContentPlanResult;
  /* Only reaches the bulleted branch — the registry's `draftable` is documented
     as meaningful for `kind: "bullets"` alone. */
  renderItemAction?: ((item: string) => React.ReactNode) | undefined;
}): React.ReactNode {
  switch (sectionKey) {
    case "positioning":
    case "postingStrategy": {
      const text = result[sectionKey];
      if (!text) return null;
      return (
        /* A quoted block inside the card — one step deeper, not outlined. */
        <p className="whitespace-pre-wrap wrap-break-word bg-(--ed-surface-deep) p-3 text-sm leading-relaxed">
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
      return (
        <BulletList
          items={items}
          {...(renderItemAction ? { renderItemAction } : {})}
        />
      );
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
                    {/* Tags, not controls — TechBadge rather than tech-chip,
                        which would imply they could be pressed. */}
                    {week.formats.map((format) => (
                      <TechBadge key={format}>{format}</TechBadge>
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
  draft,
}: {
  sectionKey: ContentPlanSectionKey;
  result: ContentPlanResult;
  draft?: ContentPlanDraftControls | undefined;
}) {
  const section = CONTENT_PLAN_SECTION_ENTRIES.find(
    (entry) => entry.key === sectionKey,
  );
  /* The registry decides which sections get the action, not this component —
     see `draftable` in content-plan-sections.ts. */
  const renderItemAction =
    section?.draftable && draft
      ? (item: string) => <DraftIdeaButton idea={item} controls={draft} />
      : undefined;
  const body = ContentPlanSectionBody({
    sectionKey,
    result,
    renderItemAction,
  });
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
  draft,
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
          draft={draft}
        />
      ))}
    </div>
  );
}

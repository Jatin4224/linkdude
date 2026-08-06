/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use client";

/**
 * SOURCE OF TRUTH KEYWORDS: AnalysisResult, AnalysisResultProps, RewriteBlock,
 *   HeadlineChoices, SectionStats, IssueList, SCORE_BANDS, SEVERITY_STYLES
 *
 * WHAT:  Renders a completed profile analysis — what the profile contains, the
 *        score, prioritized findings, headline choices, the About rewrite, and
 *        the plan-gated per-section critiques.
 * WHY:   Takes the whole StoredProfileAnalysis rather than just the critique,
 *        because half of this view describes the INPUT: the section counts and
 *        the headline under the title come from what was analyzed, not from what
 *        the model said about it. Passing only the critique would mean
 *        re-deriving those from a second prop and letting the two disagree.
 *
 *        Rewrites stay the product, so each one keeps a copy button and is shown
 *        as finished text rather than advice about text. The score is banded
 *        into words because a bare number invites arguing with the number.
 * WHERE: Rendered by profile-analyzer.tsx for both a fresh analysis and a
 *        history selection — they are the same type, so there is no branch.
 */

import * as React from "react";
import {
  AwardIcon,
  BriefcaseIcon,
  CheckIcon,
  CopyIcon,
  FolderGitIcon,
  GraduationCapIcon,
  HeartHandshakeIcon,
  LanguagesIcon,
  LightbulbIcon,
  NewspaperIcon,
  ThumbsUpIcon,
  WrenchIcon,
} from "lucide-react";
import { toast } from "sonner";

import type {
  ProfileIssueSeverity,
  ProfileSectionKey,
  SectionFeedback,
  SectionInsight,
  StoredProfileAnalysis,
} from "@/lib/types";
import { PROFILE_ISSUE_SEVERITIES } from "@/lib/types";
import {
  PROFILE_SECTIONS,
  PROFILE_SECTION_ENTRIES,
  DEEP_INSIGHT_SECTIONS,
} from "@/lib/config/profile-sections";
import { LockedSection } from "@/components/global/locked-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export interface AnalysisResultProps {
  analysis: StoredProfileAnalysis;
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

/**
 * SOURCE OF TRUTH KEYWORDS: bandFor, SCORE_BANDS
 *
 * WHAT:  Maps a 0-100 score onto its band label and token classes.
 * WHY:   Exported so the history list labels a saved score the SAME way this
 *        pane labels a fresh one — a second copy of the thresholds would let
 *        the two disagree about what "Strong" means.
 * WHERE: Used here and by analysis-history.tsx.
 */
export function bandFor(score: number): { label: string; className: string } {
  return SCORE_BANDS.find((band) => score >= band.min) ?? BASE_BAND;
}

/* Theme tokens only — a severity is a semantic state, so it reads from the same
 * palette as the rest of the app rather than fixed colours that break in one of
 * the two themes. */
const SEVERITY_STYLES: Record<
  ProfileIssueSeverity,
  { label: string; className: string }
> = {
  critical: {
    label: "Critical",
    className: "border-destructive/40 bg-destructive/10 text-destructive",
  },
  warning: {
    label: "Needs attention",
    className: "border-border bg-muted text-foreground",
  },
  polish: {
    label: "Polish",
    className: "border-border bg-transparent text-muted-foreground",
  },
};

/* One icon per structured section, so the stat tiles are scannable without
 * reading every label. Keyed by ProfileSectionKey so a new section is a compile
 * error here rather than a tile with a blank space where its icon belongs. */
const SECTION_ICONS: Record<ProfileSectionKey, React.ComponentType<{ className?: string }>> = {
  experience: BriefcaseIcon,
  projects: FolderGitIcon,
  certifications: AwardIcon,
  education: GraduationCapIcon,
  skills: WrenchIcon,
  languages: LanguagesIcon,
  volunteering: HeartHandshakeIcon,
  articles: NewspaperIcon,
};

/* How many findings are shown before the list collapses. Sized so the pane
 * leads with what to fix first rather than with a wall of every nitpick. */
const VISIBLE_ISSUES = 3;

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
  badge,
  feedback,
}: {
  title: string;
  badge?: string;
  feedback: SectionFeedback;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          {title}
          {badge ? (
            <Badge variant="outline" className="font-normal">
              {badge}
            </Badge>
          ) : null}
        </CardTitle>
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

/**
 * SOURCE OF TRUTH KEYWORDS: SectionStats
 *
 * WHAT:  The count tiles — how many roles, projects, certifications and degrees
 *        the analyzed profile actually contained.
 * WHY:   Counted from the stored input rather than reported by the model, so the
 *        numbers are facts rather than something that can be hallucinated. This
 *        is the whole reason the sections are structured: a flattened paragraph
 *        cannot be counted. A zero is shown rather than hidden — an empty
 *        Projects section is itself a finding, and hiding it hides the gap.
 */
function SectionStats({ sections }: { sections: StoredProfileAnalysis["input"]["sections"] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {PROFILE_SECTION_ENTRIES.map(({ key, label }) => {
        const Icon = SECTION_ICONS[key];
        const count = sections[key].length;
        return (
          <div
            key={key}
            className="flex flex-col gap-1 rounded-md border p-3"
          >
            <span className="text-2xl font-semibold tabular-nums">{count}</span>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Icon className="size-3.5" />
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * SOURCE OF TRUTH KEYWORDS: HeadlineChoices
 *
 * WHAT:  The recommended headline plus its alternatives, as a pick-one list.
 * WHY:   A headline is 220 characters the user will read a dozen times before
 *        committing, and the reflex response to a single suggestion is "not
 *        quite". Presenting the options as a choice — with the copy button
 *        acting on the SELECTED one — turns the output into a decision the user
 *        makes rather than a verdict they accept or discard.
 *
 *        `rewrite` is always first because it is the model's recommendation;
 *        `alternatives` is empty on analyses saved before it existed, in which
 *        case this degrades to exactly the old single-rewrite block.
 */
function HeadlineChoices({
  feedback,
}: {
  feedback: StoredProfileAnalysis["result"]["headlineFeedback"];
}) {
  const options = [feedback.rewrite, ...feedback.alternatives];
  const [selected, setSelected] = React.useState(0);
  const active = options[selected] ?? feedback.rewrite;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          Headline
          {options.length > 1 ? (
            <Badge variant="outline" className="font-normal">
              Choose one
            </Badge>
          ) : null}
        </CardTitle>
        <CopyButton text={active} label="headline rewrite" />
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">{feedback.verdict}</p>
        <Separator />
        {options.map((option, index) => {
          const isActive = index === selected;
          return (
            <button
              key={option}
              type="button"
              onClick={() => setSelected(index)}
              aria-pressed={isActive}
              className={`flex flex-col gap-1.5 rounded-md border p-3 text-left text-sm leading-relaxed transition-colors ${
                isActive
                  ? "border-brand-border bg-brand-soft text-brand-soft-foreground"
                  : "bg-muted/40 hover:bg-muted"
              }`}
            >
              <span className="flex items-center justify-between gap-2 text-xs font-medium">
                {index === 0 ? "Recommended" : `Option ${index + 1}`}
                {isActive ? <CheckIcon className="size-3.5" /> : null}
              </span>
              <span className="whitespace-pre-wrap wrap-break-word">
                {option}
              </span>
              {/* LinkedIn hard-limits the headline, so the length is shown on the
                  thing being chosen rather than discovered on paste. */}
              <span className="text-xs opacity-70">
                {option.length} characters
              </span>
            </button>
          );
        })}
      </CardContent>
    </Card>
  );
}

/**
 * SOURCE OF TRUTH KEYWORDS: IssueList
 *
 * WHAT:  Every finding, worst first, collapsed to the top few.
 * WHY:   Sorted by PROFILE_ISSUE_SEVERITIES order rather than by a second copy
 *        of the ranking, so "critical before polish" is declared once. Collapsed
 *        because the cap was raised to 14 — a full list buries the two things
 *        actually worth doing today under a dozen refinements.
 */
function IssueList({
  improvements,
}: {
  improvements: StoredProfileAnalysis["result"]["improvements"];
}) {
  const [expanded, setExpanded] = React.useState(false);

  const sorted = React.useMemo(
    () =>
      [...improvements].sort(
        (a, b) =>
          PROFILE_ISSUE_SEVERITIES.indexOf(a.severity) -
          PROFILE_ISSUE_SEVERITIES.indexOf(b.severity),
      ),
    [improvements],
  );

  const visible = expanded ? sorted : sorted.slice(0, VISIBLE_ISSUES);
  const hidden = sorted.length - visible.length;
  const needsAttention = sorted.filter(
    (item) => item.severity !== "polish",
  ).length;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <LightbulbIcon className="size-4 text-brand-soft-foreground" />
          Profile issues
        </CardTitle>
        <Badge
          variant="outline"
          className={
            needsAttention > 0
              ? SEVERITY_STYLES.warning.className
              : SEVERITY_STYLES.polish.className
          }
        >
          {needsAttention > 0
            ? `${needsAttention} need attention`
            : "Nothing urgent"}
        </Badge>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {visible.map((improvement, index) => {
          const severity = SEVERITY_STYLES[improvement.severity];
          return (
            <React.Fragment key={`${improvement.area}-${improvement.issue}`}>
              {index > 0 ? <Separator /> : null}
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  {/* The area tag is what lets a finding point back at the field
                      it came from, instead of floating free of the profile. */}
                  <Badge variant="outline" className="font-normal capitalize">
                    {improvement.area}
                  </Badge>
                  <Badge variant="outline" className={severity.className}>
                    {severity.label}
                  </Badge>
                </div>
                <p className="text-sm font-medium">{improvement.issue}</p>
                <div className="flex items-start justify-between gap-3">
                  <p className="whitespace-pre-wrap wrap-break-word text-sm leading-relaxed text-muted-foreground">
                    {improvement.fix}
                  </p>
                  <CopyButton text={improvement.fix} label="fix" />
                </div>
              </div>
            </React.Fragment>
          );
        })}

        {hidden > 0 || expanded ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="self-start"
            onClick={() => setExpanded((current) => !current)}
          >
            {expanded
              ? "Show fewer findings"
              : `${hidden} more finding${hidden === 1 ? "" : "s"} in the full review`}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

/* One gated section's critique. Rendered inside LockedSection, so this body is
 * only reached when the plan includes it — which is also when the model was
 * asked to produce it. */
function SectionInsightBody({ insight }: { insight: SectionInsight }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">{insight.verdict}</p>
      <Separator />
      {insight.rewrites.map((rewrite) => (
        <div key={rewrite.target} className="flex flex-col gap-2">
          {/* `target` names the entry being replaced — without it the user gets
              three paragraphs and has to work out which role each one is for. */}
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-medium">{rewrite.target}</p>
            <CopyButton text={rewrite.rewrite} label={`${rewrite.target} rewrite`} />
          </div>
          <p className="whitespace-pre-wrap wrap-break-word rounded-md border bg-muted/40 p-3 text-sm leading-relaxed">
            {rewrite.rewrite}
          </p>
        </div>
      ))}
    </div>
  );
}

export function AnalysisResult({ analysis }: AnalysisResultProps) {
  const { input, result } = analysis;
  const band = bandFor(result.score);

  return (
    <div className="flex flex-col gap-4">
      <Card className="border-t-2 border-t-brand">
        <CardContent className="flex flex-col gap-4 p-4">
          {/* The analyzed headline, so a history selection is identifiable at a
              glance without opening the form it came from. */}
          <p className="text-sm font-medium wrap-break-word">
            {input.headline}
          </p>
          <SectionStats sections={input.sections} />
          <Separator />
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-3xl font-semibold tabular-nums">
              {result.score}
            </span>
            <span className="text-sm text-muted-foreground">/ 100</span>
            <Badge variant="outline" className={band.className}>
              {band.label}
            </Badge>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {result.summary}
          </p>
        </CardContent>
      </Card>

      <IssueList improvements={result.improvements} />

      <HeadlineChoices feedback={result.headlineFeedback} />
      <RewriteBlock
        title="About"
        badge="Ready to use"
        feedback={result.aboutFeedback}
      />

      {/* Gated panels always render, locked or not: a free-tier user who cannot
          see that Experience feedback exists has no reason to upgrade for it.
          The content behind the lock was never generated, which is what makes a
          free analysis genuinely cheaper — LockedSection says so explicitly. */}
      {DEEP_INSIGHT_SECTIONS.map((key) => {
        const insight = result.sectionInsights.find(
          (entry) => entry.section === key,
        );
        const Icon = SECTION_ICONS[key];
        return (
          <LockedSection
            key={key}
            resource="profileDeepInsights"
            title={PROFILE_SECTIONS[key].label}
            badge={key === "experience" ? "Professional" : "Portfolio"}
            icon={<Icon className="size-4 text-brand-soft-foreground" />}
            teaser={`Per-entry rewrites for your ${PROFILE_SECTIONS[key].label.toLowerCase()}, in your own register.`}
          >
            {insight ? (
              <SectionInsightBody insight={insight} />
            ) : (
              /* Unlocked, but the section was empty when the analysis ran, so
                 there was nothing to critique. Saying which it is stops this
                 reading as a failed generation. */
              <p className="text-sm text-muted-foreground">
                No {PROFILE_SECTIONS[key].label.toLowerCase()} were included in
                this analysis. Add some to the form and run it again.
              </p>
            )}
          </LockedSection>
        );
      })}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ThumbsUpIcon className="size-4 text-brand-soft-foreground" />
            What&apos;s working
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {result.strengths.map((strength, index) => (
            <React.Fragment key={strength}>
              {index > 0 ? <Separator /> : null}
              <p className="text-sm leading-relaxed">{strength}</p>
            </React.Fragment>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

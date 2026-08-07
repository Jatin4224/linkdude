/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: CONTENT_PLAN_SECTIONS, ContentPlanSectionDefinition,
 *   CONTENT_PLAN_SECTION_ENTRIES, serializeContentPlanAnswers,
 *   serializeContentPlanSection, contentPlanSectionCopyText
 *
 * WHAT:  What each section of a generated strategy MEANS — its heading, how it
 *        renders, and whether it is worth a copy button.
 * WHY:   contentPlanResultSchema deliberately gives the ten sections only four
 *        shapes (prose, bullets, pillars, calendar) so there are four renderers
 *        rather than ten cards. That uniformity only works if the per-section
 *        meaning lives somewhere — this is that place. Adding a section is one
 *        entry here plus one field on the schema; the result view, the copy
 *        buttons and the export all iterate this registry and pick it up.
 * WHERE: Read by the content-plan result view and by the copy handlers.
 */

import {
  CONTENT_PLAN_SECTION_KEYS,
  type ContentPlanResult,
  type ContentPlanSectionKey,
  type ContentPlanDraftAnswers,
} from "@/lib/types/content-plan";
import {
  CONTENT_PLAN_STEP_ENTRIES,
  contentPlanAnswerText,
} from "./content-plan-steps";

/**
 * SOURCE OF TRUTH KEYWORDS: ContentPlanSectionDefinition
 *
 * WHAT:  Everything the app needs to render and copy one strategy section.
 * WHERE: Implemented by CONTENT_PLAN_SECTIONS below.
 */
export interface ContentPlanSectionDefinition {
  /** Heading text, without the emoji. */
  readonly label: string;
  /**
   * Leading glyph. An emoji rather than a lucide icon because these headings
   * are also what the user copies out into a doc, where an icon component does
   * not survive the clipboard but an emoji does.
   */
  readonly emoji: string;
  /**
   * Which renderer draws the body. Maps to the field's shape in
   * contentPlanResultSchema — a mismatch is caught by the exhaustive switch in
   * the result view rather than by rendering nothing.
   */
  readonly kind: "prose" | "bullets" | "pillars" | "calendar";
  /**
   * Whether the card gets a copy button. False for sections that are a critique
   * rather than something to publish — copying your own gap analysis into a post
   * is not a thing anyone wants to do.
   */
  readonly copyable: boolean;
  /** One-line hint under the heading; empty when the heading says it all. */
  readonly description: string;
}

/**
 * SOURCE OF TRUTH KEYWORDS: CONTENT_PLAN_SECTIONS
 *
 * WHAT:  Every strategy section, keyed by ContentPlanSectionKey.
 * WHY:   `Record<ContentPlanSectionKey, …>` so adding a key to
 *        CONTENT_PLAN_SECTION_KEYS without describing it here is a compile error
 *        rather than a section that silently never renders.
 */
export const CONTENT_PLAN_SECTIONS: Record<
  ContentPlanSectionKey,
  ContentPlanSectionDefinition
> = {
  positioning: {
    label: "Profile Positioning",
    emoji: "🎯",
    kind: "prose",
    /* The single most copy-and-paste-able output in the app: it is literally the
     * headline and About text the user is about to put on their profile. */
    copyable: true,
    description: "Your headline and About, rewritten",
  },
  targetAudience: {
    label: "Target Audience",
    emoji: "👥",
    kind: "bullets",
    copyable: false,
    description: "Who this plan is written to reach",
  },
  contentFormats: {
    label: "Content Formats",
    emoji: "📌",
    kind: "bullets",
    copyable: false,
    description: "The formats that suit your material",
  },
  contentPillars: {
    label: "Content Pillars",
    emoji: "🏛️",
    kind: "pillars",
    copyable: true,
    description: "The themes you post against every week",
  },
  calendar: {
    label: "30-Day Calendar",
    emoji: "📅",
    kind: "calendar",
    copyable: true,
    description: "Four weeks, each with a focus and formats",
  },
  postIdeas: {
    label: "Post Idea Bank",
    emoji: "💡",
    kind: "bullets",
    copyable: true,
    description: "Ready to draft, in your own material",
  },
  hooks: {
    label: "Hook Bank",
    emoji: "🪝",
    kind: "bullets",
    copyable: true,
    description: "Opening lines that earn the second line",
  },
  ctas: {
    label: "CTA Strategy",
    emoji: "📢",
    kind: "bullets",
    copyable: true,
    description: "What you ask readers to do",
  },
  postingStrategy: {
    label: "Posting Strategy",
    emoji: "📈",
    kind: "prose",
    copyable: false,
    description: "Cadence, timing and engagement",
  },
  gaps: {
    label: "Gap Analysis",
    emoji: "⚠️",
    kind: "bullets",
    /* A critique of the current profile, not something to publish. */
    copyable: false,
    description: "What is holding the profile back today",
  },
};

/**
 * SOURCE OF TRUTH KEYWORDS: CONTENT_PLAN_SECTION_ENTRIES
 *
 * WHAT:  The registry as an ordered array, for rendering.
 * WHY:   Object key order is not a contract; this is. The order here is the
 *        order the cards appear in — positioning first because it is the one
 *        thing the user acts on immediately.
 */
export const CONTENT_PLAN_SECTION_ENTRIES = CONTENT_PLAN_SECTION_KEYS.map(
  (key) => ({ key, ...CONTENT_PLAN_SECTIONS[key] }),
);

/**
 * SOURCE OF TRUTH KEYWORDS: serializeContentPlanAnswers
 *
 * WHAT:  The chat answers rendered as the prose the model reads.
 * WHY:   The model reads text, not JSON — feeding it raw objects spends tokens
 *        on braces and reliably degrades output. Labelled from the step registry
 *        so a reworded question reaches the prompt with the same wording the
 *        user saw, and skips anything unanswered rather than sending "undefined"
 *        for the model to interpret.
 * WHERE: buildContentPlanPrompt in src/services/ai.service.ts.
 */
export function serializeContentPlanAnswers(
  answers: ContentPlanDraftAnswers,
): string {
  return CONTENT_PLAN_STEP_ENTRIES.map((step) => {
    const text = contentPlanAnswerText(answers, step.key);
    return text ? `${step.promptLabel}: ${text}` : "";
  })
    .filter(Boolean)
    .join("\n");
}

/**
 * SOURCE OF TRUTH KEYWORDS: serializeContentPlanSection, contentPlanSectionCopyText
 *
 * WHAT:  One generated section as plain text, for the clipboard.
 * WHY:   Every copyable section needs this and each has a different shape, so
 *        without one place to do it the result view would carry a `switch` for
 *        rendering and a second, separately-maintained `switch` for copying.
 *        The exhaustive switch on `kind` means a fifth shape is a compile error
 *        here rather than a copy button that silently yields "[object Object]".
 * WHERE: The copy button on each result card.
 */
export function serializeContentPlanSection(
  result: ContentPlanResult,
  key: ContentPlanSectionKey,
): string {
  switch (key) {
    case "positioning":
      return result.positioning;
    case "postingStrategy":
      return result.postingStrategy;
    case "targetAudience":
      return result.targetAudience.map((item) => `• ${item}`).join("\n");
    case "contentFormats":
      return result.contentFormats.map((item) => `• ${item}`).join("\n");
    case "postIdeas":
      return result.postIdeas.map((item) => `• ${item}`).join("\n");
    case "hooks":
      return result.hooks.map((item) => `• ${item}`).join("\n");
    case "ctas":
      return result.ctas.map((item) => `• ${item}`).join("\n");
    case "gaps":
      return result.gaps.map((item) => `• ${item}`).join("\n");
    case "contentPillars":
      return result.contentPillars
        .map((pillar) => `${pillar.title}\n${pillar.description}`)
        .join("\n\n");
    case "calendar":
      return result.calendar
        .map((week) =>
          [
            `Week ${week.week}`,
            week.focus,
            week.formats.map((format) => `• ${format}`).join("\n"),
          ]
            .filter(Boolean)
            .join("\n"),
        )
        .join("\n\n");
  }
}

export function contentPlanSectionCopyText(
  result: ContentPlanResult,
  key: ContentPlanSectionKey,
): string {
  const section = CONTENT_PLAN_SECTIONS[key];
  return `${section.label}\n\n${serializeContentPlanSection(result, key)}`;
}

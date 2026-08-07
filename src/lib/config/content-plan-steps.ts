/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: CONTENT_PLAN_STEPS, ContentPlanStepDefinition,
 *   CONTENT_PLAN_STEP_ENTRIES, CONTENT_PLAN_QUESTION_KEYS, isContentPlanAnswered,
 *   nextContentPlanStep, firstUnansweredContentPlanStep, contentPlanAnswerText
 *
 * WHAT:  What each question in the guided chat MEANS — the wording the bot uses,
 *        the quick-reply chips it offers, and how the answer is edited later.
 * WHY:   The conversation is scripted, not model-driven: the questions are the
 *        same for everyone, so paying for a model call to decide what to ask next
 *        would buy nothing but latency and non-determinism. This registry is that
 *        script. Adding, reordering or rewording a question is ONE entry here —
 *        the chat, the Refine bar and the generation prompt all iterate
 *        CONTENT_PLAN_STEP_ENTRIES and pick it up with no further change.
 *
 *        Registry-driven for the same reason as PROFILE_SECTIONS and
 *        AI_PROVIDERS: the alternative is the same strings copied into a chat
 *        component, an edit bar and a prompt builder, drifting independently.
 *
 *        Because the conversation is derived from this rather than stored,
 *        rewording a question retroactively improves saved sessions instead of
 *        leaving them quoting text that no longer exists anywhere.
 * WHERE: Read by the content-plan chat, the Refine bar, and the generation
 *        prompt builder in src/services/ai.service.ts.
 */

import {
  CONTENT_PLAN_STEP_KEYS,
  type ContentPlanDraftAnswers,
  type ContentPlanStepKey,
} from "@/lib/types/content-plan";

/**
 * SOURCE OF TRUTH KEYWORDS: ContentPlanStepDefinition
 *
 * WHAT:  Everything the app needs to ask one question and edit its answer.
 * WHERE: Implemented by CONTENT_PLAN_STEPS below.
 */
export interface ContentPlanStepDefinition {
  /** Exactly what the bot says. */
  readonly prompt: string;
  /**
   * `url` steps render the validated URL form; `choice` steps render chips.
   * Two kinds rather than a component per step — a third kind is a renderer,
   * not a rewrite.
   */
  readonly kind: "url" | "choice";
  /**
   * Quick-reply chips. Empty for the url step. These are suggestions, not the
   * closed set: `allowFreeText` decides whether the user can answer off-menu,
   * which is why the answer schema validates a bounded string rather than an
   * enum of these values.
   */
  readonly options: readonly string[];
  /** Whether "Other" is offered — a typed answer alongside the chips. */
  readonly allowFreeText: boolean;
  /** Whether more than one chip can be picked. Only `goals` sets this. */
  readonly multiSelect: boolean;
  /** Placeholder for the free-text input. */
  readonly placeholder: string;
  /** Label on the Refine bar button, e.g. "🎯 Edit Goal". */
  readonly editLabel: string;
  /** How this answer is introduced to the model in the generation prompt. */
  readonly promptLabel: string;
}

/**
 * SOURCE OF TRUTH KEYWORDS: CONTENT_PLAN_STEPS
 *
 * WHAT:  Every question, keyed by ContentPlanStepKey.
 * WHY:   `Record<ContentPlanStepKey, …>` so adding a key to
 *        CONTENT_PLAN_STEP_KEYS without describing it here is a compile error
 *        rather than a step that renders as a blank bubble.
 */
export const CONTENT_PLAN_STEPS: Record<
  ContentPlanStepKey,
  ContentPlanStepDefinition
> = {
  profileUrl: {
    prompt:
      "Let's build your content plan. Paste your LinkedIn profile URL and I'll read it first.",
    kind: "url",
    options: [],
    allowFreeText: false,
    multiSelect: false,
    placeholder: "https://www.linkedin.com/in/your-name",
    editLabel: "🔗 Edit Profile",
    promptLabel: "LinkedIn profile",
  },
  role: {
    prompt: "What best describes what you do?",
    kind: "choice",
    options: [
      "Developer",
      "Designer",
      "Founder",
      "Marketer",
      "Product Manager",
      "Student",
    ],
    allowFreeText: true,
    multiSelect: false,
    placeholder: "Tell me what you do",
    editLabel: "👤 Edit Role",
    promptLabel: "Role",
  },
  niche: {
    prompt: "What niche do you want to be known for?",
    kind: "choice",
    options: [
      "Tech",
      "AI / ML",
      "Design",
      "Marketing",
      "Finance",
      "Health",
      "Education",
    ],
    allowFreeText: true,
    multiSelect: false,
    placeholder: "Name your niche",
    editLabel: "🧭 Edit Niche",
    promptLabel: "Niche",
  },
  audience: {
    prompt: "Who do you want to reach?",
    kind: "choice",
    options: [
      "AI startups",
      "Recruiters",
      "Founders",
      "Fellow engineers",
      "Enterprise buyers",
      "Beginners",
    ],
    allowFreeText: true,
    multiSelect: false,
    placeholder: "Describe your audience",
    editLabel: "👥 Edit Audience",
    promptLabel: "Target audience",
  },
  goals: {
    prompt: "What are you here to do? Pick up to two.",
    kind: "choice",
    options: [
      "Grow audience",
      "Find a job",
      "Build authority",
      "Generate leads",
      "Hire people",
    ],
    allowFreeText: true,
    /* The only multi-select step. Growing an audience and landing a job pull a
     * strategy in genuinely different directions, and plenty of people want
     * both — forcing one would throw away a distinction the plan can act on. */
    multiSelect: true,
    placeholder: "Describe your goal",
    editLabel: "🎯 Edit Goal",
    promptLabel: "Goals",
  },
};

/**
 * SOURCE OF TRUTH KEYWORDS: CONTENT_PLAN_STEP_ENTRIES
 *
 * WHAT:  The registry as an ordered array — the script, in order.
 * WHY:   Object key order is not a contract; this is. The order here is the
 *        order the chat asks and the Refine bar lists.
 */
export const CONTENT_PLAN_STEP_ENTRIES = CONTENT_PLAN_STEP_KEYS.map((key) => ({
  key,
  ...CONTENT_PLAN_STEPS[key],
}));

/**
 * SOURCE OF TRUTH KEYWORDS: CONTENT_PLAN_QUESTION_KEYS
 *
 * WHAT:  The steps asked with chips, i.e. everything after the profile URL.
 * WHY:   The URL step is structurally different — it runs a paid lookup and a
 *        model call rather than recording an answer — so the places that only
 *        care about the questionnaire (the Refine bar, the progress counter)
 *        derive the list from `kind` instead of slicing off index 0 and breaking
 *        the day a second url-kind step appears.
 */
export const CONTENT_PLAN_QUESTION_KEYS = CONTENT_PLAN_STEP_KEYS.filter(
  (key) => CONTENT_PLAN_STEPS[key].kind === "choice",
);

/**
 * SOURCE OF TRUTH KEYWORDS: contentPlanAnswerText
 *
 * WHAT:  One answer as the single line the chat bubble and the prompt both show.
 * WHY:   `goals` is an array and everything else is a string. Centralised so the
 *        bubble, the Refine bar and the prompt cannot render the same answer
 *        three different ways — and so a second multi-select step later is one
 *        change here rather than three.
 * WHERE: The chat's replayed user bubbles; serializeContentPlanAnswers.
 */
export function contentPlanAnswerText(
  answers: ContentPlanDraftAnswers,
  key: ContentPlanStepKey,
): string {
  const value = answers[key];
  if (value === undefined) return "";
  return Array.isArray(value) ? value.join(", ") : value;
}

/**
 * SOURCE OF TRUTH KEYWORDS: isContentPlanAnswered
 *
 * WHAT:  Whether a step has a usable answer yet.
 * WHY:   An empty string and an empty array both mean "not answered", and both
 *        are reachable — a draft row written mid-edit holds exactly that. One
 *        predicate so the resume branch and the next-step logic agree on what
 *        counts as done.
 */
export function isContentPlanAnswered(
  answers: ContentPlanDraftAnswers,
  key: ContentPlanStepKey,
): boolean {
  const value = answers[key];
  if (value === undefined) return false;
  return Array.isArray(value) ? value.length > 0 : value.trim().length > 0;
}

/**
 * SOURCE OF TRUTH KEYWORDS: firstUnansweredContentPlanStep, nextContentPlanStep
 *
 * WHAT:  Where a resumed session should pick up, and what follows a given step.
 * WHY:   The chat never stores "which step am I on". Deriving it from the answers
 *        means a session resumed on another device lands in the same place, and
 *        an answer edited through the Refine bar cannot leave a saved cursor
 *        pointing at a question that is now already answered.
 *
 *        Returns null when everything is answered — the caller reads that as
 *        "ready to generate" rather than needing a separate flag.
 * WHERE: The chat orchestrator's resume and advance logic.
 */
export function firstUnansweredContentPlanStep(
  answers: ContentPlanDraftAnswers,
): ContentPlanStepKey | null {
  return (
    CONTENT_PLAN_STEP_KEYS.find((key) => !isContentPlanAnswered(answers, key)) ??
    null
  );
}

export function nextContentPlanStep(
  key: ContentPlanStepKey,
): ContentPlanStepKey | null {
  const index = CONTENT_PLAN_STEP_KEYS.indexOf(key);
  return CONTENT_PLAN_STEP_KEYS[index + 1] ?? null;
}

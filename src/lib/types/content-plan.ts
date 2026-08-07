/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: CONTENT_PLAN_STEP_KEYS, ContentPlanStepKey,
 *   CONTENT_PLAN_SECTION_KEYS, ContentPlanSectionKey, CONTENT_PLAN_STATUSES,
 *   ContentPlanStatus, contentPlanAnswersSchema, ContentPlanAnswers,
 *   contentPlanDraftAnswersSchema, ContentPlanDraftAnswers,
 *   contentPlanInsightsSchema, ContentPlanInsights, contentPlanResultSchema,
 *   ContentPlanResult, contentPlanPillarSchema, ContentPlanPillar,
 *   contentPlanCalendarWeekSchema, ContentPlanCalendarWeek,
 *   startContentPlanSchema, saveContentPlanProgressSchema,
 *   generateContentPlanSchema, StoredContentPlan
 *
 * WHAT:  Input and output contracts for the guided Personalized Content Plan —
 *        the answers collected in the chat, and the strategy the model returns.
 * WHY:   The step keys and section keys are declared here as const tuples and
 *        the meaning of each lives in src/lib/config/content-plan-steps.ts and
 *        content-plan-sections.ts, keyed by these tuples. That split is what
 *        stops the two from drifting: those registries are
 *        `Record<ContentPlanStepKey, …>`, so adding a key here without
 *        describing it there is a compile error rather than a blank card.
 *
 *        contentPlanResultSchema doubles as the `generateObject` contract and
 *        the validation boundary, so model output is typed rather than trusted —
 *        the same arrangement as profileAnalysisSchema.
 * WHERE: Router inputs for the contentPlan router; consumed by
 *        src/services/ai.service.ts, content-plan.service.ts, and the
 *        content-plan route components.
 */

import { z } from "zod";

/* Imported rather than duplicated: the URL a content plan starts from is the
 * same LinkedIn member-profile URL a lookup validates, and a second regex here
 * would be a second thing to keep correct. */
import { LINKEDIN_PROFILE_URL_PATTERN } from "./profile-lookup";
import type { FetchedProfile } from "./profile-lookup";

/**
 * SOURCE OF TRUTH KEYWORDS: CONTENT_PLAN_STEP_KEYS, ContentPlanStepKey,
 *   contentPlanStepKeySchema
 *
 * WHAT:  The questions the guided chat asks, in the order it asks them.
 * WHY:   Order is a contract here, not incidental: the chat walks this array to
 *        decide what comes next, and the Refine bar renders one button per entry.
 *        Declared as a tuple rather than inferred from the config registry so the
 *        registry can be `Record<ContentPlanStepKey, …>` — which is what makes a
 *        described-nowhere step fail to compile.
 * WHERE: CONTENT_PLAN_STEPS in src/lib/config/content-plan-steps.ts; the chat
 *        orchestrator; the Refine bar.
 */
export const CONTENT_PLAN_STEP_KEYS = [
  "profileUrl",
  "role",
  "niche",
  "audience",
  "goals",
] as const;
export const contentPlanStepKeySchema = z.enum(CONTENT_PLAN_STEP_KEYS);
export type ContentPlanStepKey = z.infer<typeof contentPlanStepKeySchema>;

/**
 * SOURCE OF TRUTH KEYWORDS: CONTENT_PLAN_SECTION_KEYS, ContentPlanSectionKey
 *
 * WHAT:  The sections of the generated strategy, in render order.
 * WHY:   Same reasoning as the step keys — the result view iterates this rather
 *        than hard-coding ten cards, so a section is added by extending this
 *        tuple, describing it in the config registry, and adding its field to
 *        contentPlanResultSchema. Nothing in the view changes.
 * WHERE: CONTENT_PLAN_SECTIONS in src/lib/config/content-plan-sections.ts; the
 *        result view.
 */
export const CONTENT_PLAN_SECTION_KEYS = [
  "positioning",
  "targetAudience",
  "contentFormats",
  "contentPillars",
  "calendar",
  "postIdeas",
  "hooks",
  "ctas",
  "postingStrategy",
  "gaps",
] as const;
export const contentPlanSectionKeySchema = z.enum(CONTENT_PLAN_SECTION_KEYS);
export type ContentPlanSectionKey = z.infer<typeof contentPlanSectionKeySchema>;

/**
 * SOURCE OF TRUTH KEYWORDS: CONTENT_PLAN_STATUSES, ContentPlanStatus
 *
 * WHAT:  Where a session is: still answering, generated, or explicitly kept.
 * WHY:   "ready" and "saved" are distinct because the strategy is persisted the
 *        moment it is generated — the org has already been charged for it, so a
 *        refresh must not destroy it. "saved" records that the user then chose
 *        to keep it, which is what the Save button means and all it means.
 * WHERE: ContentPlan.status; the chat orchestrator's resume branch.
 */
export const CONTENT_PLAN_STATUSES = ["collecting", "ready", "saved"] as const;
export const contentPlanStatusSchema = z.enum(CONTENT_PLAN_STATUSES);
export type ContentPlanStatus = z.infer<typeof contentPlanStatusSchema>;

/* Ceilings for a chat answer. Generous enough for a typed "Other" reply, tight
 * enough that a pasted essay cannot bloat the prompt — every answer is
 * interpolated into the generation prompt verbatim. */
export const CONTENT_PLAN_ANSWER_MAX = 120;
/** Two goals at most: the plan has to serve them both, and three is a wish list. */
export const CONTENT_PLAN_GOALS_MAX = 2;

/**
 * SOURCE OF TRUTH KEYWORDS: contentPlanAnswersSchema, ContentPlanAnswers
 *
 * WHAT:  A complete set of chat answers — what the strategy is generated from.
 * WHY:   Validated in full only at the point of generation. Partial answers are
 *        legitimate for the whole life of a session, which is what
 *        contentPlanDraftAnswersSchema below is for; requiring completeness on
 *        every progress save would make it impossible to store a session the
 *        user has not finished, and resuming is the point.
 *
 *        `goals` is an array because the mockup answers both "Grow audience" and
 *        "Find a job" — those pull a strategy in different directions and the
 *        plan is expected to serve both, so collapsing them to one would throw
 *        away the distinction the user just drew.
 * WHERE: Router input for contentPlan.create; the generation prompt.
 */
export const contentPlanAnswersSchema = z.object({
  profileUrl: z
    .string()
    .trim()
    .regex(
      LINKEDIN_PROFILE_URL_PATTERN,
      "Enter a LinkedIn profile URL, e.g. https://www.linkedin.com/in/your-name",
    ),
  role: z.string().trim().min(1).max(CONTENT_PLAN_ANSWER_MAX),
  niche: z.string().trim().min(1).max(CONTENT_PLAN_ANSWER_MAX),
  audience: z.string().trim().min(1).max(CONTENT_PLAN_ANSWER_MAX),
  goals: z
    .array(z.string().trim().min(1).max(CONTENT_PLAN_ANSWER_MAX))
    .min(1)
    .max(CONTENT_PLAN_GOALS_MAX),
});
export type ContentPlanAnswers = z.infer<typeof contentPlanAnswersSchema>;

/**
 * SOURCE OF TRUTH KEYWORDS: contentPlanDraftAnswersSchema, ContentPlanDraftAnswers
 *
 * WHAT:  Answers as they exist mid-session — every field optional.
 * WHY:   The stored `answers` column is read back through this, not through the
 *        full schema. A session interrupted after two questions must still parse
 *        on resume; under the strict schema it would fail validation and the
 *        user would silently lose the progress the feature promises to keep.
 * WHERE: ContentPlan.answers on read; router input for contentPlan.saveProgress.
 */
export const contentPlanDraftAnswersSchema = contentPlanAnswersSchema.partial();
export type ContentPlanDraftAnswers = z.infer<
  typeof contentPlanDraftAnswersSchema
>;

/**
 * SOURCE OF TRUTH KEYWORDS: contentPlanInsightsSchema, ContentPlanInsights
 *
 * WHAT:  The short read-back shown right after the profile is fetched.
 * WHY:   Deliberately small. Its job is to prove the app actually read the
 *        profile before it starts asking questions — a full critique already
 *        exists as its own feature, and duplicating it here would be a second
 *        expensive call to say something the user can get elsewhere.
 * WHERE: Returned by aiService.generateProfileBrief via contentPlan.brief;
 *        stored on ContentPlan.insights; rendered as the "Profile Insights" card.
 */
export const contentPlanInsightsSchema = z.object({
  bullets: z.array(z.string().min(1).max(400)).min(2).max(4).default([]),
});
export type ContentPlanInsights = z.infer<typeof contentPlanInsightsSchema>;

/**
 * SOURCE OF TRUTH KEYWORDS: contentPlanPillarSchema, ContentPlanPillar
 *
 * WHAT:  One recurring content theme — its name and what belongs under it.
 * WHY:   A title alone is a label the user has to interpret; the description is
 *        what makes a pillar something they can post against on a Tuesday.
 */
export const contentPlanPillarSchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().min(1).max(400),
});
export type ContentPlanPillar = z.infer<typeof contentPlanPillarSchema>;

/**
 * SOURCE OF TRUTH KEYWORDS: contentPlanCalendarWeekSchema, ContentPlanCalendarWeek
 *
 * WHAT:  One week of the 30-day calendar — its theme and the formats to ship.
 * WHY:   Weekly rather than daily. A day-by-day calendar reads as a commitment
 *        the user will break by Thursday and then abandon; a weekly focus with
 *        two concrete formats is a plan someone actually follows, and it keeps
 *        the generated payload inside the transaction budget.
 */
export const contentPlanCalendarWeekSchema = z.object({
  week: z.number().int().min(1).max(4),
  focus: z.string().min(1).max(400),
  formats: z.array(z.string().min(1).max(200)).max(4).default([]),
});
export type ContentPlanCalendarWeek = z.infer<
  typeof contentPlanCalendarWeekSchema
>;

/**
 * SOURCE OF TRUTH KEYWORDS: contentPlanResultSchema, ContentPlanResult
 *
 * WHAT:  The full generated strategy — one field per CONTENT_PLAN_SECTION_KEYS.
 * WHY:   Handed straight to `generateObject`, so this declaration is both the
 *        instruction to the model and the guarantee to the UI. Array bounds are
 *        deliberate: they keep each card readable AND give the model a concrete
 *        target instead of an open-ended list that trails off into filler.
 *
 *        Every array is `.default([])` so a section the model omits does not
 *        fail the whole generation the org has already paid for — and so a plan
 *        saved before a new section existed keeps parsing instead of vanishing
 *        from the page with no error anywhere.
 * WHERE: Returned by aiService.generateContentPlan via contentPlan.create;
 *        stored on ContentPlan.result; rendered by the result view.
 */
export const contentPlanResultSchema = z.object({
  positioning: z.string().min(1).max(2000),
  targetAudience: z.array(z.string().min(1).max(400)).max(4).default([]),
  contentFormats: z.array(z.string().min(1).max(200)).max(5).default([]),
  contentPillars: z.array(contentPlanPillarSchema).max(5).default([]),
  calendar: z.array(contentPlanCalendarWeekSchema).max(4).default([]),
  postIdeas: z.array(z.string().min(1).max(400)).max(6).default([]),
  hooks: z.array(z.string().min(1).max(300)).max(6).default([]),
  ctas: z.array(z.string().min(1).max(300)).max(3).default([]),
  postingStrategy: z.string().min(1).max(1500),
  gaps: z.array(z.string().min(1).max(400)).max(4).default([]),
});
export type ContentPlanResult = z.infer<typeof contentPlanResultSchema>;

/**
 * SOURCE OF TRUTH KEYWORDS: startContentPlanSchema, StartContentPlanValues
 *
 * WHAT:  Input for the first step — the profile the plan is built from.
 * WHY:   Only the URL. Everything else about the profile is fetched, so asking
 *        for more here would be asking the user to retype what the lookup is
 *        about to retrieve.
 * WHERE: Resolver for the URL step form; router input for contentPlan.brief.
 */
export const startContentPlanSchema = contentPlanAnswersSchema.pick({
  profileUrl: true,
});
export type StartContentPlanValues = z.infer<typeof startContentPlanSchema>;

/**
 * SOURCE OF TRUTH KEYWORDS: saveContentPlanProgressSchema,
 *   SaveContentPlanProgressValues
 *
 * WHAT:  Input for persisting a partially-answered session.
 * WHY:   Takes the whole draft rather than one step's answer so a save is
 *        idempotent and order-independent: replaying it cannot half-apply, and
 *        the Refine bar — which edits an answer in the middle of a finished set
 *        — reuses the same call instead of needing its own.
 * WHERE: Router input for contentPlan.saveProgress.
 */
export const saveContentPlanProgressSchema = z.object({
  answers: contentPlanDraftAnswersSchema,
});
export type SaveContentPlanProgressValues = z.infer<
  typeof saveContentPlanProgressSchema
>;

/**
 * SOURCE OF TRUTH KEYWORDS: generateContentPlanSchema, GenerateContentPlanValues
 *
 * WHAT:  Input for the metered generation — a complete answer set.
 * WHY:   Sends the answers rather than trusting the stored draft so the plan is
 *        generated from exactly what the user just confirmed on screen, and so a
 *        Refine regeneration cannot race a progress save and produce a strategy
 *        for an answer the user already changed.
 * WHERE: Router input for contentPlan.create.
 */
export const generateContentPlanSchema = z.object({
  answers: contentPlanAnswersSchema,
});
export type GenerateContentPlanValues = z.infer<
  typeof generateContentPlanSchema
>;

/**
 * SOURCE OF TRUTH KEYWORDS: StoredContentPlan
 *
 * WHAT:  A persisted session as it leaves the server.
 * WHY:   `answers`, `insights`, `profile` and `result` are typed rather than
 *        Prisma.JsonValue. They live in Json columns, so Prisma hands back
 *        untyped values; the service parses each through its schema before it
 *        crosses this boundary, which is what lets the chat render a resumed
 *        session and a just-generated one with the same code and no branch.
 * WHERE: Returned by every contentPlan procedure; consumed by the chat.
 */
export interface StoredContentPlan {
  id: string;
  status: ContentPlanStatus;
  profileUrl: string | null;
  /** The profile snapshot this session started from; null before the lookup. */
  profile: FetchedProfile | null;
  insights: ContentPlanInsights | null;
  /** Partial for the whole life of a "collecting" session — see the draft schema. */
  answers: ContentPlanDraftAnswers;
  result: ContentPlanResult | null;
  createdAt: Date;
  updatedAt: Date;
}

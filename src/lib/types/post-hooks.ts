/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: POST_GOALS, PostGoal, postGoalSchema,
 *   DEFAULT_POST_GOAL, HOOK_FORMULA_KEYS, HookFormulaKey, hookFormulaKeySchema,
 *   hookOpeningSchema, HookOpening, hookFormulaSchema, HookFormula,
 *   postOpeningChoiceSchema, PostOpeningChoice, POST_ALTERNATIVE_OPENINGS,
 *   POST_OPENING_MAX, engagement goal, hook formulas
 *
 * WHAT:  Contracts for shaping a post around what the member wants from it: the
 *        engagement goals, the closed set of hook formulas, and an opening line
 *        written with one of them.
 * WHY:   Closed sets, so the prompt gives the model a precise description for
 *        each value (HOOK_FORMULAS) and the model can only name a formula the app
 *        knows how to label. Free text in either place would let the UI and the
 *        prompt drift apart.
 * WHERE: generatePostSchema and generatedPostSchema in ./ai; HOOK_FORMULAS and
 *        POST_GOAL_LABELS in config; the composer's goal picker and opening lines.
 */

import { z } from "zod";

/**
 * SOURCE OF TRUTH KEYWORDS: POST_GOALS, PostGoal, postGoalSchema,
 *   DEFAULT_POST_GOAL
 *
 * WHAT:  What the member wants a post to earn.
 * WHY:   Each goal is earned by different post shapes (a controlled comparison
 *        draws comments, a framework draws saves), so the goal decides which hook
 *        formulas the model chooses between. "any" lets the model pick from all.
 */
export const POST_GOALS = ["any", "comments", "reposts", "likes", "saves"] as const;
export const postGoalSchema = z.enum(POST_GOALS);
export type PostGoal = z.infer<typeof postGoalSchema>;
export const DEFAULT_POST_GOAL: PostGoal = "any";

/**
 * SOURCE OF TRUTH KEYWORDS: HOOK_FORMULA_KEYS, HookFormulaKey,
 *   hookFormulaKeySchema
 *
 * WHAT:  The hook formulas a post can be shaped with.
 * WHY:   Adapted from the 20 formulas in linkedin-skills. The comment-gate lead
 *        magnet is left out (LinkedIn now demotes it), as are two formulas that
 *        need a commitment or a platform argument most topics lack.
 */
export const HOOK_FORMULA_KEYS = [
  "controlledAB",
  "contrarianReceipts",
  "timeAnchor",
  "curiosityGap",
  "falseBinary",
  "namedGratitude",
  "ripObituary",
  "paidVsFree",
  "divergingCurves",
  "emotionalColdOpen",
  "baitAndSwitch",
  "statusStrip",
  "explainSimply",
  "oddPrecision",
  "evidenceBridge",
  "yearOverYear",
] as const;
export const hookFormulaKeySchema = z.enum(HOOK_FORMULA_KEYS);
export type HookFormulaKey = z.infer<typeof hookFormulaKeySchema>;

/**
 * SOURCE OF TRUTH KEYWORDS: POST_ALTERNATIVE_OPENINGS, POST_OPENING_MAX
 *
 * WHAT:  How many alternative first lines a generation returns, and the longest
 *        one allowed.
 */
export const POST_ALTERNATIVE_OPENINGS = 2;
export const POST_OPENING_MAX = 300;

/**
 * SOURCE OF TRUTH KEYWORDS: hookOpeningSchema, HookOpening
 *
 * WHAT:  One alternative first line for a post, and the formula it uses.
 */
export const hookOpeningSchema = z.object({
  formula: hookFormulaKeySchema,
  line: z.string().trim().min(1).max(POST_OPENING_MAX),
});
export type HookOpening = z.infer<typeof hookOpeningSchema>;

/**
 * SOURCE OF TRUTH KEYWORDS: hookFormulaSchema, HookFormula
 *
 * WHAT:  How the app describes one formula: its label, the goals it serves, the
 *        shape the model should write, and whether it needs real specifics.
 * WHY:   `needsSpecifics` marks formulas built on numbers, names or dates, so the
 *        model is told to use them only when the topic supplies those facts,
 *        never by inventing them.
 */
export const hookFormulaSchema = z.object({
  label: z.string().min(1),
  goals: z.array(postGoalSchema),
  shape: z.string().min(1),
  needsSpecifics: z.boolean(),
});
export type HookFormula = z.infer<typeof hookFormulaSchema>;

/**
 * SOURCE OF TRUTH KEYWORDS: postOpeningChoiceSchema, PostOpeningChoice
 *
 * WHAT:  An opening line the member can pick in the composer: the generated one
 *        or an alternative.
 * WHY:   The formula is nullable because the member's own first line may not
 *        map to any formula.
 */
export const postOpeningChoiceSchema = z.object({
  formula: hookFormulaKeySchema.nullable(),
  line: z.string(),
});
export type PostOpeningChoice = z.infer<typeof postOpeningChoiceSchema>;

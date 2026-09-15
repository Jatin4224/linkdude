/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: POST_CHECK_CODES, PostCheckCode,
 *   postCheckCodeSchema, POST_CHECK_SEVERITIES, PostCheckSeverity,
 *   postCheckIssueSchema, PostCheckIssue, PostCheckResult, PostCheckRule,
 *   PostWordRange, PostCheckOptions, post check, Check my post
 *
 * WHAT:  Contracts for the pre-publish post check: the closed set of problems it
 *        can report, how serious each one is, and what a check returns.
 * WHY:   A closed code set, so the copy for every problem (POST_CHECK_RULES) is a
 *        compile-time Record, and so "Fix it" sends the server CODES rather than
 *        free text. The instructions the model receives are then always the
 *        app's own wording, never something typed into a request.
 * WHERE: src/lib/post-check.ts, POST_CHECK_RULES and POST_LENGTH_WORD_RANGES in
 *        post-writing.ts, the "fix" branch of generatePostSchema, and the
 *        PostCheckPanel component.
 */

import { z } from "zod";

import type { PostLength } from "./ai";

/**
 * SOURCE OF TRUTH KEYWORDS: POST_CHECK_SEVERITIES, PostCheckSeverity
 *
 * WHAT:  How serious a problem is.
 * WHY:   "blocker" means fix it before posting; "warning" means worth a look.
 *        Neither stops publishing: the member always decides.
 */
export const POST_CHECK_SEVERITIES = ["blocker", "warning"] as const;
export const postCheckSeveritySchema = z.enum(POST_CHECK_SEVERITIES);
export type PostCheckSeverity = z.infer<typeof postCheckSeveritySchema>;

/**
 * SOURCE OF TRUTH KEYWORDS: POST_CHECK_CODES, PostCheckCode, postCheckCodeSchema
 *
 * WHAT:  Every problem the post check can report.
 * WHY:   Listed blockers first, so a result in this order already reads
 *        most-serious first.
 */
export const POST_CHECK_CODES = [
  "tooLong",
  "linkInBody",
  "dashes",
  "questionOpener",
  "weakOpener",
  "announcementOpener",
  "sincerityMarker",
  "allCapsLine",
  "revealBridge",
  "negativeParallel",
  "genericCloser",
  "aiWordCluster",
  "hookTooLong",
  "lengthOutOfRange",
  "tooManyHashtags",
  "aiPhrase",
  "staccato",
  "tooManyFragments",
  "hedging",
  "emojiCluster",
  "commentGate",
  "noSpecifics",
] as const;
export const postCheckCodeSchema = z.enum(POST_CHECK_CODES);
export type PostCheckCode = z.infer<typeof postCheckCodeSchema>;

/**
 * SOURCE OF TRUTH KEYWORDS: postCheckIssueSchema, PostCheckIssue
 *
 * WHAT:  One problem found in a draft, with the text that triggered it.
 * WHY:   The excerpt lets the member find the problem without guessing. It may
 *        be empty when the problem is an absence ("nothing specific").
 */
export const postCheckIssueSchema = z.object({
  code: postCheckCodeSchema,
  severity: postCheckSeveritySchema,
  excerpt: z.string(),
});
export type PostCheckIssue = z.infer<typeof postCheckIssueSchema>;

/**
 * SOURCE OF TRUTH KEYWORDS: postCheckResultSchema, PostCheckResult
 *
 * WHAT:  What a check returns: the problems, most serious first, plus counts.
 */
export const postCheckResultSchema = z.object({
  issues: z.array(postCheckIssueSchema),
  blockerCount: z.number().int().min(0),
  warningCount: z.number().int().min(0),
  wordCount: z.number().int().min(0),
});
export type PostCheckResult = z.infer<typeof postCheckResultSchema>;

/**
 * SOURCE OF TRUTH KEYWORDS: postCheckRuleSchema, PostCheckRule
 *
 * WHAT:  The severity and member-facing copy for one problem.
 */
export const postCheckRuleSchema = z.object({
  severity: postCheckSeveritySchema,
  title: z.string().min(1),
  fix: z.string().min(1),
});
export type PostCheckRule = z.infer<typeof postCheckRuleSchema>;

/**
 * SOURCE OF TRUTH KEYWORDS: postWordRangeSchema, PostWordRange
 *
 * WHAT:  The word and character targets for one post length.
 * WHY:   One set of numbers read by both the generator prompt and the post
 *        check, so "medium" means the same thing to both.
 */
export const postWordRangeSchema = z.object({
  minWords: z.number().int().positive(),
  maxWords: z.number().int().positive(),
  minChars: z.number().int().positive(),
  maxChars: z.number().int().positive(),
});
export type PostWordRange = z.infer<typeof postWordRangeSchema>;

/**
 * SOURCE OF TRUTH KEYWORDS: PostCheckOptions
 *
 * WHAT:  Optional context for a check.
 * WHY:   The length target is only known when the member picked one, so the
 *        length check runs only when it is given.
 */
export interface PostCheckOptions {
  length?: PostLength | undefined;
}

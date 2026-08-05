/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: analyzeProfileSchema, AnalyzeProfileValues,
 *   profileAnalysisSchema, ProfileAnalysis, SectionFeedback,
 *   ProfileImprovement, listAnalysesSchema, discardAnalysisSchema,
 *   StoredProfileAnalysis
 *
 * WHAT:  Input and output contracts for AI profile analysis — what the user
 *        pastes in, and the structured critique the model returns.
 *
 *        The URL-lookup contract lives in ./profile-lookup, because fetching a
 *        profile is a shared capability rather than part of this feature. It is
 *        re-exported below so existing importers keep resolving.
 * WHY:   The profile is PASTED, not fetched. LinkedIn's `/v2/userinfo` returns
 *        only `{ sub, name, picture }` under the scopes this app holds (see
 *        LinkedInUserInfo in src/services/linkedin.service.ts), and LinkedIn
 *        blocks automated reads of profile pages — so there is no path to the
 *        headline or About text other than the user supplying it. Splitting the
 *        input into named sections rather than one blob lets the prompt address
 *        each part directly and lets feedback be attributed back to a section.
 *        `profileAnalysisSchema` doubles as the `generateObject` schema and the
 *        validation boundary, so model output is typed rather than trusted.
 * WHERE: Router input for profileAnalysis.create; consumed by
 *        src/services/ai.service.ts and the profile-analysis route components.
 */

import { z } from "zod";

/* Imported (not just re-exported below) because the schemas in this file
 * validate against them — `export ... from` alone does not bring a binding into
 * local scope. */
import {
  PROFILE_ABOUT_MAX,
  PROFILE_EXPERIENCE_MAX,
  PROFILE_HEADLINE_MAX,
} from "./profile-lookup";

/* The URL contract, the vendor payload shapes, and LinkedIn's field ceilings
 * moved to ./profile-lookup — a lookup is a capability, not part of this
 * feature. Re-exported so existing importers of this module keep resolving. */
export {
  PROFILE_SOURCE_KEYS,
  profileSourceSchema,
  LINKEDIN_PROFILE_URL_PATTERN,
  fetchProfileSchema,
  fetchedProfileSchema,
  apifyProfileSchema,
  brightDataProfileSchema,
  scrapedErrorItemSchema,
  PROFILE_HEADLINE_MAX,
  PROFILE_ABOUT_MAX,
  PROFILE_EXPERIENCE_MAX,
} from "./profile-lookup";
export type {
  ProfileSource,
  FetchProfileValues,
  FetchedProfile,
  CachedProfileLookup,
  ApifyProfile,
  BrightDataProfile,
} from "./profile-lookup";

/**
 * SOURCE OF TRUTH KEYWORDS: analyzeProfileSchema, AnalyzeProfileValues
 *
 * WHAT:  What the user pastes in.
 * WHY:   Headline and About are required because they carry essentially all of
 *        a profile's positioning — an analysis without them would be guesswork.
 *        The About minimum exists so the model has something to critique rather
 *        than inventing a profile from a fragment. Experience is optional: it
 *        materially improves the analysis but plenty of users won't paste it.
 * WHERE: Resolver for the profile form; router input for profileAnalysis.create.
 */
export const analyzeProfileSchema = z.object({
  headline: z
    .string()
    .trim()
    .min(10, "Paste your headline — at least 10 characters")
    .max(
      PROFILE_HEADLINE_MAX,
      `Headlines are limited to ${PROFILE_HEADLINE_MAX} characters`,
    ),
  about: z
    .string()
    .trim()
    .min(50, "Paste your About section — at least 50 characters to analyze")
    .max(
      PROFILE_ABOUT_MAX,
      `About is limited to ${PROFILE_ABOUT_MAX} characters`,
    ),
  experience: z
    .string()
    .trim()
    .max(
      PROFILE_EXPERIENCE_MAX,
      `Experience is limited to ${PROFILE_EXPERIENCE_MAX} characters`,
    )
    .optional(),
});
export type AnalyzeProfileValues = z.infer<typeof analyzeProfileSchema>;

/**
 * SOURCE OF TRUTH KEYWORDS: SectionFeedback
 *
 * WHAT:  Critique of one profile section plus a ready-to-paste replacement.
 * WHY:   `rewrite` is the product. A verdict alone leaves the user to do the
 *        writing, which is the part they came here to avoid.
 */
export const sectionFeedbackSchema = z.object({
  verdict: z.string().min(1).max(400),
  rewrite: z.string().min(1).max(PROFILE_ABOUT_MAX),
});
export type SectionFeedback = z.infer<typeof sectionFeedbackSchema>;

export const profileImprovementSchema = z.object({
  issue: z.string().min(1).max(300),
  fix: z.string().min(1).max(600),
});
export type ProfileImprovement = z.infer<typeof profileImprovementSchema>;

/**
 * SOURCE OF TRUTH KEYWORDS: profileAnalysisSchema, ProfileAnalysis
 *
 * WHAT:  The structured critique the model returns.
 * WHY:   Handed straight to `generateObject`, so this one declaration is both
 *        the instruction to the model and the guarantee to the UI — there is no
 *        JSON parsing to get wrong and no shape drift between the two. Array
 *        bounds are deliberate: they keep the result readable AND give the model
 *        a concrete target instead of an open-ended list that trails into
 *        filler. Score is an int so it renders without formatting.
 * WHERE: Returned by aiService.analyzeLinkedInProfile via
 *        profileAnalysis.create; rendered by the analysis result component.
 */
export const profileAnalysisSchema = z.object({
  score: z.number().int().min(0).max(100),
  summary: z.string().min(1).max(500),
  headlineFeedback: sectionFeedbackSchema,
  aboutFeedback: sectionFeedbackSchema,
  strengths: z.array(z.string().min(1).max(300)).min(1).max(3),
  improvements: z.array(profileImprovementSchema).min(1).max(4),
});
export type ProfileAnalysis = z.infer<typeof profileAnalysisSchema>;

/**
 * SOURCE OF TRUTH KEYWORDS: listAnalysesSchema, ListAnalysesValues
 *
 * WHAT:  Input for reading an organization's saved analyses.
 * WHY:   Mirrors listPostsSchema — a bounded `take` rather than open pagination,
 *        because the history is a sidebar strip, not a browsable archive, and
 *        each row carries a full critique payload.
 * WHERE: Router input for profileAnalysis.list.
 */
export const listAnalysesSchema = z.object({
  limit: z.number().int().min(1).max(50).default(10),
});
export type ListAnalysesValues = z.infer<typeof listAnalysesSchema>;

/**
 * SOURCE OF TRUTH KEYWORDS: discardAnalysisSchema, DiscardAnalysisValues
 *
 * WHAT:  Identifies a saved analysis to forget.
 * WHY:   Named "discard", not "delete", throughout the stack — the verb decides
 *        whether the usage counter is refunded, and this one must NOT refund.
 *        See the router procedure for the full reasoning.
 * WHERE: Router input for profileAnalysis.discard.
 */
export const discardAnalysisSchema = z.object({
  analysisId: z.string().min(1),
});
export type DiscardAnalysisValues = z.infer<typeof discardAnalysisSchema>;

/**
 * SOURCE OF TRUTH KEYWORDS: StoredProfileAnalysis
 *
 * WHAT:  A persisted analysis as it leaves the server — row metadata plus the
 *        critique itself.
 * WHY:   `result` is typed ProfileAnalysis rather than Prisma.JsonValue. The row
 *        is stored in a Json column, so Prisma hands back an untyped value; the
 *        service parses it through profileAnalysisSchema before it crosses this
 *        boundary, which keeps the UI reading the SAME type whether a critique
 *        just came from the model or was loaded from history — AnalysisResult
 *        renders both without a branch.
 * WHERE: Returned by profileAnalysis.create and profileAnalysis.list; consumed
 *        by the analyzer page and its history list.
 */
export interface StoredProfileAnalysis {
  id: string;
  /** Denormalised for the list; always equals `result.score`. */
  score: number;
  /** Denormalised for the list; always equals `result.summary`. */
  summary: string;
  createdAt: Date;
  result: ProfileAnalysis;
  /**
   * The exact input this critique was produced from. Returned — not just
   * stored — so a past run can be reloaded into the form and re-analyzed after
   * an edit. Columns that are written but never read are pure cost; this is
   * what makes keeping them correct.
   */
  input: AnalyzeProfileValues;
}

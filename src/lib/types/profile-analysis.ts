/*
 * Copyright (c) 2026 Web Prodigies LLC
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: analyzeProfileSchema, AnalyzeProfileValues,
 *   profileAnalysisSchema, ProfileAnalysis, SectionFeedback,
 *   ProfileImprovement, PROFILE_HEADLINE_MAX, PROFILE_ABOUT_MAX,
 *   PROFILE_EXPERIENCE_MAX
 *
 * WHAT:  Input and output contracts for AI profile analysis — what the user
 *        pastes in, and the structured critique the model returns.
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

import { z } from 'zod'

/**
 * SOURCE OF TRUTH KEYWORDS: PROFILE_SOURCE_KEYS, ProfileSource,
 *   profileSourceSchema
 *
 * WHAT:  The third-party vendors that can turn a profile URL into profile text.
 * WHY:   Closed set so PROFILE_SOURCE is validated rather than trusted. Vendors
 *        in this category disappear — Proxycurl was sued by LinkedIn and shut
 *        down in 2025 — so adding a replacement is one key here plus one entry
 *        in PROFILE_SOURCES.
 * WHERE: Drives the registry in src/lib/config/profile-source.ts.
 */
export const PROFILE_SOURCE_KEYS = ['apify', 'brightdata'] as const
export const profileSourceSchema = z.enum(PROFILE_SOURCE_KEYS)
export type ProfileSource = z.infer<typeof profileSourceSchema>

/**
 * SOURCE OF TRUTH KEYWORDS: fetchProfileSchema, FetchProfileValues,
 *   LINKEDIN_PROFILE_URL_PATTERN
 *
 * WHAT:  Input for a URL lookup.
 * WHY:   The URL is checked against LinkedIn's `/in/` member-profile shape
 *        before it reaches the vendor. Every lookup costs real money, so an
 *        obvious typo — a company page, a bare domain, someone else's site —
 *        should fail locally and free rather than burning a paid call to learn
 *        the same thing.
 * WHERE: Router input for profileAnalysis.fetch; resolver for the URL tab.
 */
export const LINKEDIN_PROFILE_URL_PATTERN =
  /^https?:\/\/([a-z]{2,3}\.)?linkedin\.com\/in\/[^/?#\s]+\/?/i

export const fetchProfileSchema = z.object({
  profileUrl: z
    .string()
    .trim()
    .regex(
      LINKEDIN_PROFILE_URL_PATTERN,
      'Enter a LinkedIn profile URL, e.g. https://www.linkedin.com/in/your-name'
    ),
})
export type FetchProfileValues = z.infer<typeof fetchProfileSchema>

/* LinkedIn's own field ceilings, so an over-long paste is rejected here rather
 * than producing advice about text the user cannot actually save. */
export const PROFILE_HEADLINE_MAX = 220
export const PROFILE_ABOUT_MAX = 2600
export const PROFILE_EXPERIENCE_MAX = 5000

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
    .min(10, 'Paste your headline — at least 10 characters')
    .max(PROFILE_HEADLINE_MAX, `Headlines are limited to ${PROFILE_HEADLINE_MAX} characters`),
  about: z
    .string()
    .trim()
    .min(50, 'Paste your About section — at least 50 characters to analyze')
    .max(PROFILE_ABOUT_MAX, `About is limited to ${PROFILE_ABOUT_MAX} characters`),
  experience: z
    .string()
    .trim()
    .max(PROFILE_EXPERIENCE_MAX, `Experience is limited to ${PROFILE_EXPERIENCE_MAX} characters`)
    .optional(),
})
export type AnalyzeProfileValues = z.infer<typeof analyzeProfileSchema>

/**
 * SOURCE OF TRUTH KEYWORDS: brightDataProfileSchema, BrightDataProfile
 *
 * WHAT:  The subset of Bright Data's LinkedIn profile record this app reads.
 * WHY:   EVERY field is optional on purpose. This is scraped data, not an API
 *        contract: fields come and go per profile (a user with no About, no
 *        listed roles), and the vendor can reshape its schema without notice.
 *        A strict schema would turn "this profile has no certifications" into a
 *        hard parse failure. Unknown keys are allowed through rather than
 *        rejected, so a vendor ADDING a field never breaks the lookup.
 *        Consequently nothing here may be assumed present — the mapper supplies
 *        the fallbacks and the form is still user-editable afterwards.
 * WHERE: Parsed in src/services/profile-source.service.ts and mapped onto
 *        AnalyzeProfileValues.
 */
const brightDataExperienceSchema = z.looseObject({
  title: z.string().nullish(),
  company: z.string().nullish(),
  description: z.string().nullish(),
  start_date: z.string().nullish(),
  end_date: z.string().nullish(),
})

/**
 * SOURCE OF TRUTH KEYWORDS: apifyProfileSchema, ApifyProfile
 *
 * WHAT:  The subset of the Apify actor's LinkedIn record this app reads.
 * WHY:   Same rationale as the Bright Data schema — everything optional, extra
 *        keys allowed through — because this is scraped output, not a contract.
 *        Shapes verified against a live response rather than documentation: the
 *        roles array carries NO description field, only position/company/
 *        duration, so experience arrives as a factual role list rather than the
 *        prose a user would paste. That is a real limitation of the URL path and
 *        the reason the fetched form stays editable.
 * WHERE: Parsed in src/services/profile-source.service.ts.
 */
const apifyExperienceSchema = z.looseObject({
  position: z.string().nullish(),
  companyName: z.string().nullish(),
  duration: z.string().nullish(),
  /* `{ year, month? }` rather than a string, so it is read structurally. */
  startDate: z.looseObject({ year: z.number().nullish() }).nullish(),
})

export const apifyProfileSchema = z.looseObject({
  name: z.string().nullish(),
  headline: z.string().nullish(),
  about: z.string().nullish(),
  experience: z.array(apifyExperienceSchema).nullish(),
})
export type ApifyProfile = z.infer<typeof apifyProfileSchema>

/**
 * SOURCE OF TRUTH KEYWORDS: scrapedErrorItemSchema
 *
 * WHAT:  Detects the vendor reporting failure INSIDE a successful HTTP response.
 * WHY:   Observed in the wild: an actor answered HTTP 201 with `[{ error: "..." }]`
 *        in the dataset. Because the profile schemas are intentionally loose,
 *        such an item parses cleanly as a profile with every field absent — so
 *        without this check a vendor-side failure would surface as "this profile
 *        looks empty" and the real message would be discarded.
 * WHERE: Checked before mapping in src/services/profile-source.service.ts.
 */
export const scrapedErrorItemSchema = z.object({ error: z.string().min(1) })

export const brightDataProfileSchema = z.looseObject({
  name: z.string().nullish(),
  /* Bright Data has used both `position` and `headline` for the tagline
   * depending on collector version; both are read and the first non-empty wins. */
  position: z.string().nullish(),
  headline: z.string().nullish(),
  about: z.string().nullish(),
  summary: z.string().nullish(),
  city: z.string().nullish(),
  current_company: z.looseObject({ name: z.string().nullish() }).nullish(),
  experience: z.array(brightDataExperienceSchema).nullish(),
})
export type BrightDataProfile = z.infer<typeof brightDataProfileSchema>

/**
 * SOURCE OF TRUTH KEYWORDS: FetchedProfile
 *
 * WHAT:  A vendor lookup mapped onto the fields the analysis form holds.
 * WHY:   Deliberately the same shape the user would have typed, so the URL tab
 *        POPULATES the paste form rather than bypassing it. The user sees and
 *        can correct whatever the scraper returned before spending an analysis
 *        on it — scraped data is frequently incomplete or subtly wrong, and a
 *        critique of the wrong text is worse than no critique.
 * WHERE: Returned by profileAnalysis.fetch; fills the form in the analyzer.
 */
export interface FetchedProfile {
  headline: string
  about: string
  experience: string
  /** Display name, shown so the user can confirm the right profile was pulled. */
  name: string | null
}

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
})
export type SectionFeedback = z.infer<typeof sectionFeedbackSchema>

export const profileImprovementSchema = z.object({
  issue: z.string().min(1).max(300),
  fix: z.string().min(1).max(600),
})
export type ProfileImprovement = z.infer<typeof profileImprovementSchema>

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
})
export type ProfileAnalysis = z.infer<typeof profileAnalysisSchema>

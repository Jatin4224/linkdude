/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: PROFILE_SOURCE_KEYS, ProfileSource,
 *   profileSourceSchema, LINKEDIN_PROFILE_URL_PATTERN, fetchProfileSchema,
 *   FetchProfileValues, fetchedProfileSchema, FetchedProfile,
 *   CachedProfileLookup, apifyProfileSchema, brightDataProfileSchema,
 *   scrapedErrorItemSchema, PROFILE_HEADLINE_MAX, PROFILE_ABOUT_MAX,
 *   PROFILE_EXPERIENCE_MAX
 *
 * WHAT:  Everything about turning a LinkedIn URL into profile text — the vendor
 *        set, the URL contract, the raw vendor payload shapes, and the mapped
 *        result.
 * WHY:   Split out of profile-analysis.ts because a lookup is a CAPABILITY, not
 *        a feature. Profile analysis was simply the first caller; outreach
 *        drafting and anything else needing "who is this person" reads the same
 *        types. Keeping them under the analyzer would have forced every future
 *        consumer to import from a feature it has nothing to do with.
 *
 *        Dependency direction is deliberate: profile-analysis.ts imports from
 *        HERE, never the reverse. The shared capability must not know about the
 *        features built on it.
 * WHERE: Consumed by src/services/profile-source.service.ts (vendor HTTP),
 *        src/services/profile-lookup.service.ts (cache), the profileLookup
 *        router, and src/lib/types/profile-analysis.ts.
 */

import { z } from "zod";

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
export const PROFILE_SOURCE_KEYS = ["apify", "brightdata"] as const;
export const profileSourceSchema = z.enum(PROFILE_SOURCE_KEYS);
export type ProfileSource = z.infer<typeof profileSourceSchema>;

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
 * WHERE: Router input for profileLookup.get and profileLookup.create.
 */
export const LINKEDIN_PROFILE_URL_PATTERN =
  /^https?:\/\/([a-z]{2,3}\.)?linkedin\.com\/in\/[^/?#\s]+\/?/i;

export const fetchProfileSchema = z.object({
  profileUrl: z
    .string()
    .trim()
    .regex(
      LINKEDIN_PROFILE_URL_PATTERN,
      "Enter a LinkedIn profile URL, e.g. https://www.linkedin.com/in/your-name",
    ),
});
export type FetchProfileValues = z.infer<typeof fetchProfileSchema>;

/* LinkedIn's own field ceilings. Shared: the vendor mapper truncates to them so
 * a scrape cannot exceed what LinkedIn itself allows, and the analysis form
 * validates against them so an over-long paste is rejected before it produces
 * advice about text the user cannot actually save. */
export const PROFILE_HEADLINE_MAX = 220;
export const PROFILE_ABOUT_MAX = 2600;
export const PROFILE_EXPERIENCE_MAX = 5000;

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
 *        FetchedProfile.
 */
const brightDataExperienceSchema = z.looseObject({
  title: z.string().nullish(),
  company: z.string().nullish(),
  description: z.string().nullish(),
  start_date: z.string().nullish(),
  end_date: z.string().nullish(),
});

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
});
export type BrightDataProfile = z.infer<typeof brightDataProfileSchema>;

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
});

export const apifyProfileSchema = z.looseObject({
  name: z.string().nullish(),
  headline: z.string().nullish(),
  about: z.string().nullish(),
  experience: z.array(apifyExperienceSchema).nullish(),
});
export type ApifyProfile = z.infer<typeof apifyProfileSchema>;

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
export const scrapedErrorItemSchema = z.object({ error: z.string().min(1) });

/**
 * SOURCE OF TRUTH KEYWORDS: fetchedProfileSchema, FetchedProfile
 *
 * WHAT:  A vendor lookup mapped onto plain profile fields.
 * WHY:   Deliberately the same shape a user would type, so the URL path
 *        POPULATES a form rather than bypassing it — whoever consumes this can
 *        let the user correct whatever the scraper returned before acting on it.
 *        Scraped data is frequently incomplete or subtly wrong.
 *
 *        A Zod schema rather than a bare interface because this value is cached
 *        in a Json column: it has to be re-validated coming back out, the same
 *        way profileAnalysisSchema guards ProfileAnalysis.result.
 * WHERE: Returned by profileLookup.get / profileLookup.create; stored in
 *        ProfileLookup.profile.
 */
export const fetchedProfileSchema = z.object({
  headline: z.string(),
  about: z.string(),
  experience: z.string(),
  /** Display name, shown so the caller can confirm the right profile was pulled. */
  name: z.string().nullable(),
});
export type FetchedProfile = z.infer<typeof fetchedProfileSchema>;

/**
 * SOURCE OF TRUTH KEYWORDS: CachedProfileLookup
 *
 * WHAT:  A cached lookup plus when it was fetched.
 * WHY:   `fetchedAt` crosses the wire so the UI can say "we already have this
 *        from 3 days ago — use it, or spend a lookup on a fresh one?" Hiding the
 *        age would force the user to choose between stale data and a charge with
 *        no information to decide on.
 * WHERE: Returned by profileLookup.get.
 */
export interface CachedProfileLookup {
  profile: FetchedProfile;
  fetchedAt: Date;
}

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
 *   PROFILE_EXPERIENCE_MAX, profileSectionItemSchema, ProfileSectionItem,
 *   PROFILE_SECTION_KEYS, ProfileSectionKey, profileSectionsSchema,
 *   ProfileSections, PROFILE_SECTION_MAX_ITEMS
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

/* Ceilings for one entry inside a structured section. `detail` is generous
 * because a role description is prose; the other two are single lines. */
export const PROFILE_ITEM_LABEL_MAX = 200;
export const PROFILE_ITEM_META_MAX = 160;
export const PROFILE_ITEM_DETAIL_MAX = 2000;
/* Caps the prompt: a 60-role career would blow the context budget and the
 * analysis is about positioning, not an exhaustive audit. */
export const PROFILE_SECTION_MAX_ITEMS = 25;

/**
 * SOURCE OF TRUTH KEYWORDS: profileSectionItemSchema, ProfileSectionItem
 *
 * WHAT:  One entry in any structured profile section — a role, a project, a
 *        certification, a degree.
 * WHY:   ONE item shape for all four sections rather than four bespoke schemas.
 *        Every section is the same thing structurally: a primary line, a
 *        secondary line, and optional prose. Four shapes would mean four form
 *        components, four prompt serializers, four mappers and four sets of
 *        result rendering — the duplication CLAUDE.md exists to prevent. What
 *        each slot MEANS per section is described once in
 *        src/lib/config/profile-sections.ts, so adding a fifth section (skills,
 *        publications) is a registry entry and nothing else.
 *
 *        Structured rather than one blob of prose because the result view counts
 *        entries ("3 Experience, 2 Certifications") and attributes feedback to a
 *        specific one. Neither is possible once roles are flattened into a
 *        paragraph.
 * WHERE: Composed into profileSectionsSchema below; rendered by the global
 *        repeatable-section component; serialized into the analysis prompt.
 */
export const profileSectionItemSchema = z.object({
  /** Primary line — role title, project name, certification, school. */
  label: z
    .string()
    .trim()
    .min(1, "Add a title, or remove this entry")
    .max(PROFILE_ITEM_LABEL_MAX),
  /** Secondary line — "Company · 2022-2024", "Issuer · 2024", a project link. */
  meta: z.string().trim().max(PROFILE_ITEM_META_MAX),
  /** Free prose. Frequently empty: scrapers rarely return role descriptions. */
  detail: z.string().trim().max(PROFILE_ITEM_DETAIL_MAX),
});
export type ProfileSectionItem = z.infer<typeof profileSectionItemSchema>;

/**
 * SOURCE OF TRUTH KEYWORDS: PROFILE_SECTION_KEYS, ProfileSectionKey,
 *   profileSectionKeySchema
 *
 * WHAT:  The structured sections of a profile beyond headline and About.
 * WHY:   A closed set so the model can attribute a finding to a real section
 *        rather than inventing a label, and so the result view's stat tiles are
 *        driven by the same list the form renders.
 * WHERE: Keys the registry in src/lib/config/profile-sections.ts and the
 *        `section` tag on profileImprovementSchema.
 */
export const PROFILE_SECTION_KEYS = [
  "experience",
  "projects",
  "certifications",
  "education",
] as const;
export const profileSectionKeySchema = z.enum(PROFILE_SECTION_KEYS);
export type ProfileSectionKey = z.infer<typeof profileSectionKeySchema>;

/**
 * SOURCE OF TRUTH KEYWORDS: profileSectionsSchema, ProfileSections
 *
 * WHAT:  All four structured sections of one profile.
 * WHY:   Every section is REQUIRED-but-possibly-empty rather than optional or
 *        defaulted. That is a deliberate constraint, not an oversight: this
 *        schema is the resolver for the profile form, and a zod `.default()`
 *        makes the parsed INPUT type diverge from the OUTPUT type — which
 *        react-hook-form reports as an unresolvable `Resolver<A>` vs
 *        `Resolver<B>` mismatch under exactOptionalPropertyTypes. Requiring all
 *        four keeps one type on both sides and gives every consumer a total
 *        value with no possibly-undefined array to guard.
 *
 *        Backward compatibility is therefore handled by the CALLERS, each in the
 *        way that suits it: fetchedProfileSchema defaults the whole object so a
 *        cache row written before sections existed still parses (a failure there
 *        re-bills a vendor lookup), and toProfileSections falls back to the
 *        legacy experience prose when the column is null.
 * WHERE: Carried on FetchedProfile and on AnalyzeProfileValues.
 */
export const profileSectionsSchema = z.object({
  experience: z.array(profileSectionItemSchema).max(PROFILE_SECTION_MAX_ITEMS),
  projects: z.array(profileSectionItemSchema).max(PROFILE_SECTION_MAX_ITEMS),
  certifications: z
    .array(profileSectionItemSchema)
    .max(PROFILE_SECTION_MAX_ITEMS),
  education: z.array(profileSectionItemSchema).max(PROFILE_SECTION_MAX_ITEMS),
});
export type ProfileSections = z.infer<typeof profileSectionsSchema>;

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

/* The remaining sections. Bright Data's collector uses snake_case and has more
 * than one spelling in circulation per section, so each is read under every name
 * observed and the first non-empty one wins in the mapper. */
const brightDataProjectSchema = z.looseObject({
  title: z.string().nullish(),
  name: z.string().nullish(),
  description: z.string().nullish(),
  url: z.string().nullish(),
  start_date: z.string().nullish(),
  end_date: z.string().nullish(),
});

const brightDataCertificationSchema = z.looseObject({
  title: z.string().nullish(),
  name: z.string().nullish(),
  subtitle: z.string().nullish(),
  issuer: z.string().nullish(),
  meta: z.string().nullish(),
});

const brightDataEducationSchema = z.looseObject({
  title: z.string().nullish(),
  institute_name: z.string().nullish(),
  degree: z.string().nullish(),
  field: z.string().nullish(),
  start_year: z.string().nullish(),
  end_year: z.string().nullish(),
  description: z.string().nullish(),
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
  projects: z.array(brightDataProjectSchema).nullish(),
  certifications: z.array(brightDataCertificationSchema).nullish(),
  education: z.array(brightDataEducationSchema).nullish(),
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
/* A date arrives as either a plain string or `{ year, month }` depending on the
 * tier that produced the record, so both are accepted and normalised by the
 * mapper rather than one shape being assumed. */
const apifyDateSchema = z
  .union([z.string(), z.looseObject({ year: z.number().nullish() })])
  .nullish();

/**
 * SOURCE OF TRUTH KEYWORDS: apifyItemSchema, ApifyItem
 *
 * WHAT:  One entry in any Apify profile section, read under every key name the
 *        actor is known to use for it.
 * WHY:   ONE wide schema for all four sections instead of a bespoke one each,
 *        because the actor's inner key names are undocumented, differ per
 *        section, and differ again per fallback tier. A live response proved the
 *        cost of guessing: the top-level `experience`, `education` and
 *        `certifications` arrays were all present and populated, while the
 *        mapper read `position`/`companyName` and produced zero entries — the
 *        loose schema turned every unmatched key into silence rather than an
 *        error.
 *
 *        So the net is cast wide deliberately. Extra nullish keys cost nothing
 *        (the schema is loose and every field is optional), and the mapper picks
 *        the first non-empty candidate per slot. A vendor renaming one field
 *        degrades to a slightly thinner entry instead of an empty section.
 * WHERE: Parsed in src/services/profile-source.service.ts, where
 *        firstText picks between the candidates.
 */
const apifyItemSchema = z.looseObject({
  /* Primary-label candidates, across roles, projects, certs and schools. */
  title: z.string().nullish(),
  position: z.string().nullish(),
  name: z.string().nullish(),
  role: z.string().nullish(),
  jobTitle: z.string().nullish(),
  schoolName: z.string().nullish(),
  school: z.string().nullish(),
  institution: z.string().nullish(),
  instituteName: z.string().nullish(),
  institute_name: z.string().nullish(),

  /* Secondary-line candidates — employer, issuer, degree, field. */
  companyName: z.string().nullish(),
  company: z.string().nullish(),
  company_name: z.string().nullish(),
  subtitle: z.string().nullish(),
  issuer: z.string().nullish(),
  authority: z.string().nullish(),
  organization: z.string().nullish(),
  degree: z.string().nullish(),
  degreeName: z.string().nullish(),
  fieldOfStudy: z.string().nullish(),
  field: z.string().nullish(),
  field_of_study: z.string().nullish(),
  location: z.string().nullish(),

  /* Date candidates. LinkedIn's own components put the range in `caption`. */
  duration: z.string().nullish(),
  dateRange: z.string().nullish(),
  date_range: z.string().nullish(),
  date: z.string().nullish(),
  years: z.string().nullish(),
  caption: z.string().nullish(),
  start_date: z.string().nullish(),
  end_date: z.string().nullish(),
  startDate: apifyDateSchema,
  endDate: apifyDateSchema,

  /* Prose candidates. */
  description: z.string().nullish(),
  summary: z.string().nullish(),
  details: z.string().nullish(),
  metadata: z.string().nullish(),

  url: z.string().nullish(),
  link: z.string().nullish(),
});
export type ApifyItem = z.infer<typeof apifyItemSchema>;

export const apifyProfileSchema = z.looseObject({
  name: z.string().nullish(),
  headline: z.string().nullish(),
  about: z.string().nullish(),
  /* The documented spelling. Reality returned `about` on the tier that was
   * verified, but the actor's docs say `summary` — both are read so a tier that
   * follows the docs stops silently producing an empty About. */
  summary: z.string().nullish(),
  /* Each section under every spelling seen. `experience`, `education` and
   * `certifications` are the ones a live response confirmed. */
  experience: z.array(apifyItemSchema).nullish(),
  experiences: z.array(apifyItemSchema).nullish(),
  projects: z.array(apifyItemSchema).nullish(),
  certifications: z.array(apifyItemSchema).nullish(),
  licenseAndCertificates: z.array(apifyItemSchema).nullish(),
  education: z.array(apifyItemSchema).nullish(),
  educations: z.array(apifyItemSchema).nullish(),
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
  /**
   * Roles flattened to prose. Retained alongside `sections.experience` because
   * rows written before the structured sections existed hold only this, and it
   * is what the legacy ProfileAnalysis.experience column stores.
   */
  experience: z.string(),
  /** Display name, shown so the caller can confirm the right profile was pulled. */
  name: z.string().nullable(),
  /**
   * Structured sections. REQUIRED, with no default — deliberately the opposite
   * call to every other backward-compatibility decision around this feature, for
   * a reason specific to what this schema guards.
   *
   * Everywhere else, a missing new field means "an old row that is still
   * perfectly usable", so defaulting it keeps the row alive. Here the row is a
   * CACHE of a vendor scrape, and a cached entry with no sections is not an old
   * row that still works — it is a copy of a scrape taken before the app knew
   * how to read roles, projects, certifications or education. Defaulting it to
   * empty would serve that permanently-incomplete result for the rest of the
   * seven-day TTL and make a re-fetch impossible, which is exactly the "it only
   * ever returns the headline" symptom.
   *
   * Failing to parse is the correct outcome: readCachedLookup treats it as a
   * miss, and the next lookup goes to the vendor and comes back through the
   * current mappers. It costs one lookup per previously-cached profile, once.
   */
  sections: profileSectionsSchema,
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

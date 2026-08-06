/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "server-only";

/**
 * SOURCE OF TRUTH KEYWORDS: fetchProfileFromUrl, PROFILE_MAPPERS,
 *   mapApifyProfile, mapBrightDataProfile, joinRoles, firstRecord,
 *   describePayload
 *
 * WHAT:  Turns a LinkedIn profile URL into the text the analysis form holds, via
 *        the configured third-party data vendor.
 * WHY:   `server-only` because this file reads the vendor API key; importing it
 *        into a client bundle would ship a billable credential to the browser.
 *        All vendor HTTP lives here so the endpoint shape, the timeout, and the
 *        "scraped data is never complete" mapping are implemented once and the
 *        router stays pure business logic.
 *
 *        The call is SYNCHRONOUS by design. Both vendors also offer async job
 *        APIs that return an id to poll; polling would run inside the tRPC
 *        mutation transaction and hold a Postgres connection for the entire job.
 *        Even synchronously a lookup runs tens of seconds, which is why this is
 *        its own endpoint rather than a step inside analysis — chaining a scrape
 *        to a model call would blow the transaction after already spending money.
 *
 *        Failure handling is unusually defensive because it was written against
 *        observed behaviour, not documentation: these vendors report failure as
 *        an empty array, as an `error` key inside an HTTP 201, and as several
 *        4xx codes that each need a DIFFERENT remedy in the message.
 * WHERE: Called by src/trpc/routers/profile-analysis.ts. Reads its vendor from
 *        src/lib/config/profile-source.ts; imported with `import *`.
 */

import {
  getProfileSource,
  getProfileSourceApiKey,
  PROFILE_FETCH_TIMEOUT_MS,
  PROFILE_SOURCE,
} from "@/lib/config/profile-source";
import {
  apifyProfileSchema,
  brightDataProfileSchema,
  scrapedErrorItemSchema,
  PROFILE_ABOUT_MAX,
  PROFILE_EXPERIENCE_MAX,
  PROFILE_HEADLINE_MAX,
  PROFILE_SECTION_KEYS,
  PROFILE_SECTION_MAX_ITEMS,
  PROFILE_SKILLS_MAX_ITEMS,
  type ApifyItem,
  type SkillLikeEntry,
  type ApifyProfile,
  type BrightDataProfile,
  type FetchedProfile,
  type ProfileSections,
  type ProfileSectionItem,
  type ProfileSource,
} from "@/lib/types/profile-lookup";
import {
  serializeProfileSection,
  toProfileSectionItem,
} from "@/lib/config/profile-sections";

/* Vendor responses are wrapped in an array — one record per requested URL —
 * even from the single-URL synchronous endpoint. An EMPTY array is a distinct
 * and common outcome (private profile, unreachable URL, scrape that found
 * nothing), so it is reported separately rather than collapsing into `undefined`
 * and failing schema validation as if the shape were wrong. */
function firstRecord(payload: unknown): { record: unknown; empty: boolean } {
  if (Array.isArray(payload)) {
    return payload.length === 0
      ? { record: null, empty: true }
      : { record: payload[0], empty: false };
  }
  return { record: payload, empty: payload == null };
}

/* Enough of the payload to identify a shape change without dumping scraped
 * personal data into the logs. */
function describePayload(value: unknown): string {
  if (value == null) return String(value);
  if (Array.isArray(value)) return `array[${value.length}]`;
  if (typeof value === "object")
    return `object{${Object.keys(value).join(",")}}`;
  return typeof value;
}

/**
 * SOURCE OF TRUTH KEYWORDS: describeSampleItems
 *
 * WHAT:  For every array on the record, the key names of its FIRST entry.
 * WHY:   The difference between "the vendor sent nothing" and "the vendor sent
 *        it under a name we don't read" lives one level down, inside the array
 *        entries — and only the second of those is fixable for free. Reports
 *        `array[0]` for a genuinely empty section so the two are distinguishable
 *        at a glance. Key names only: the values are scraped personal data and
 *        must never reach a log.
 */
function describeSampleItems(record: unknown): string {
  if (record == null || typeof record !== "object" || Array.isArray(record)) {
    return describePayload(record);
  }

  return Object.entries(record)
    .filter((entry): entry is [string, unknown[]] => Array.isArray(entry[1]))
    .map(([key, items]) =>
      items.length === 0
        ? `${key}=array[0]`
        : `${key}[0]=${describePayload(items[0])}`,
    )
    .join(" ");
}

/**
 * SOURCE OF TRUTH KEYWORDS: collectSection
 *
 * WHAT:  Turns a raw vendor array into validated section items.
 * WHY:   Drops entries with no title (an untitled row is not a countable thing)
 *        and caps the count, so one profile with a 60-role history cannot blow
 *        the schema maximum AFTER the lookup has already been billed. Shared by
 *        both vendors because the only per-vendor part is which keys carry the
 *        label, the meta and the detail — that stays in the mappers.
 */
function collectSection<TRaw>(
  raw: readonly TRaw[] | null | undefined,
  toItem: (entry: TRaw) => ProfileSectionItem | null,
  maxItems: number = PROFILE_SECTION_MAX_ITEMS,
): ProfileSectionItem[] {
  return (raw ?? [])
    .map(toItem)
    .filter((item): item is ProfileSectionItem => item !== null)
    .slice(0, maxItems);
}

/* The flat `experience` string is DERIVED from the structured roles rather than
 * built separately, so the two can never disagree about the same career. It
 * survives only because the ProfileAnalysis.experience column and pre-sections
 * cache rows still speak it. */
function flattenExperience(items: readonly ProfileSectionItem[]): string {
  return serializeProfileSection(items).slice(0, PROFILE_EXPERIENCE_MAX);
}

/**
 * SOURCE OF TRUTH KEYWORDS: mapBrightDataProfile
 *
 * WHAT:  Maps a vendor record onto the analysis form's fields.
 * WHY:   Every field is optional upstream, so each one falls back to an empty
 *        string rather than throwing. An incomplete result is still useful — the
 *        form is editable and the user fills the gaps — whereas a thrown error
 *        would discard a lookup that already cost money. Both known spellings of
 *        the headline and About fields are read because the collector has used
 *        different names across versions.
 */
function mapBrightDataProfile(profile: BrightDataProfile): FetchedProfile {
  const headline = (profile.position ?? profile.headline ?? "").trim();
  const about = (profile.about ?? profile.summary ?? "").trim();

  const sections: ProfileSections = {
    experience: collectSection(profile.experience, (role) =>
      toProfileSectionItem(
        role.title,
        [role.company, [role.start_date, role.end_date].filter(Boolean).join(" - ")],
        role.description,
      ),
    ),
    projects: collectSection(profile.projects, (project) =>
      toProfileSectionItem(
        project.title ?? project.name,
        [
          project.url,
          [project.start_date, project.end_date].filter(Boolean).join(" - "),
        ],
        project.description,
      ),
    ),
    certifications: collectSection(profile.certifications, (cert) =>
      toProfileSectionItem(cert.title ?? cert.name, [
        cert.subtitle ?? cert.issuer,
        cert.meta,
      ]),
    ),
    education: collectSection(profile.education, (school) =>
      toProfileSectionItem(
        school.institute_name ?? school.title,
        [
          school.degree,
          school.field,
          [school.start_year, school.end_year].filter(Boolean).join(" - "),
        ],
        school.description,
      ),
    ),
    skills: collectSection(
      profile.skills,
      toTextOrItem,
      PROFILE_SKILLS_MAX_ITEMS,
    ),
    languages: collectSection(profile.languages, toTextOrItem),
    volunteering: collectSection(profile.volunteer_experience, (entry) =>
      toProfileSectionItem(
        entry.title ?? entry.name,
        [[entry.start_date, entry.end_date].filter(Boolean).join(" - ")],
        entry.description,
      ),
    ),
    articles: collectSection(profile.posts, (entry) =>
      toProfileSectionItem(entry.title ?? entry.name, [
        entry.url,
        entry.start_date,
      ]),
    ),
  };

  return {
    headline: headline.slice(0, PROFILE_HEADLINE_MAX),
    about: about.slice(0, PROFILE_ABOUT_MAX),
    experience: flattenExperience(sections.experience),
    name: profile.name?.trim() || null,
    sections,
  };
}

/**
 * SOURCE OF TRUTH KEYWORDS: firstText, apifyDateText
 *
 * WHAT:  Picks the first non-empty candidate from the many key names one Apify
 *        field can arrive under, and flattens a date that may be a string or a
 *        `{ year }` object.
 * WHY:   The actor's inner key names are undocumented and vary per section and
 *        per fallback tier. Reading one name and hoping is what produced empty
 *        sections from a response that demonstrably contained the data, so every
 *        slot reads an ordered list of candidates and takes the first that is
 *        actually populated.
 */
function firstText(
  ...candidates: ReadonlyArray<string | null | undefined>
): string {
  return candidates.find((value) => (value ?? "").trim().length > 0)?.trim() ?? "";
}

function apifyDateText(value: ApifyItem["startDate"]): string {
  if (typeof value === "string") return value;
  if (value && typeof value.year === "number") return String(value.year);
  return "";
}

/* Skills and languages arrive as bare strings as often as objects, and a skill
 * carries nothing but its name either way. Normalised here so the section shape
 * is the same regardless of which form the vendor sent. */
function toTextOrItem(entry: SkillLikeEntry): ProfileSectionItem | null {
  if (typeof entry === "string") return toProfileSectionItem(entry, []);
  return toProfileSectionItem(
    firstText(entry.name, entry.title),
    [firstText(entry.subtitle, entry.caption, entry.metadata)],
  );
}

/* On the tier verified in 2026 this actor returned roles WITHOUT descriptions —
 * only position, company and duration — so experience reads thinner than a
 * pasted section. The mapper now CARRIES a description when one is present,
 * because the fuller fallback tiers and the actor's own docs both claim it; the
 * previous version hardcoded it away, which made a richer response impossible to
 * receive even if the vendor sent one.
 *
 * Every section key is read under both spellings the actor is known to use. The
 * cost of a wrong guess is silent: a loose schema turns a renamed field into an
 * empty section rather than an error, so reading both is the only cheap defence. */
function mapApifyProfile(profile: ApifyProfile): FetchedProfile {
  /* Every date candidate collapsed to one string, so each section's meta line
   * only has to choose between "a range" and "two endpoints". */
  const dateOf = (item: ApifyItem): string =>
    firstText(
      item.duration,
      item.dateRange,
      item.date_range,
      item.date,
      item.years,
      item.caption,
      [
        firstText(item.start_date, apifyDateText(item.startDate)),
        firstText(item.end_date, apifyDateText(item.endDate)),
      ]
        .filter(Boolean)
        .join(" - "),
    );

  const sections: ProfileSections = {
    experience: collectSection(
      profile.experience ?? profile.experiences,
      (role) =>
        toProfileSectionItem(
          firstText(role.title, role.position, role.role, role.jobTitle),
          [
            firstText(
              role.companyName,
              role.company,
              role.company_name,
              role.subtitle,
            ),
            dateOf(role),
            role.location,
          ],
          firstText(role.description, role.summary, role.details),
        ),
    ),
    projects: collectSection(profile.projects, (project) =>
      toProfileSectionItem(
        firstText(project.title, project.name),
        [firstText(project.url, project.link), dateOf(project)],
        firstText(project.description, project.summary, project.details),
      ),
    ),
    certifications: collectSection(
      profile.certifications ?? profile.licenseAndCertificates,
      (cert) =>
        toProfileSectionItem(firstText(cert.title, cert.name), [
          firstText(
            cert.subtitle,
            cert.issuer,
            cert.authority,
            cert.organization,
          ),
          dateOf(cert),
        ]),
    ),
    education: collectSection(
      profile.education ?? profile.educations,
      (school) =>
        toProfileSectionItem(
          firstText(
            school.schoolName,
            school.school,
            school.institution,
            school.instituteName,
            school.institute_name,
            school.title,
            school.name,
          ),
          [
            firstText(school.degree, school.degreeName, school.subtitle),
            firstText(
              school.fieldOfStudy,
              school.field,
              school.field_of_study,
            ),
            dateOf(school),
          ],
          firstText(school.description, school.summary),
        ),
    ),
    skills: collectSection(
      profile.topSkills ?? profile.skills,
      toTextOrItem,
      PROFILE_SKILLS_MAX_ITEMS,
    ),
    languages: collectSection(profile.languages, toTextOrItem),
    volunteering: collectSection(
      profile.volunteer_experience ?? profile.volunteerExperience,
      (entry) =>
        toProfileSectionItem(
          firstText(entry.title, entry.role, entry.position),
          [
            firstText(entry.organization, entry.companyName, entry.subtitle),
            dateOf(entry),
          ],
          firstText(entry.description, entry.summary),
        ),
    ),
    articles: collectSection(profile.articles ?? profile.posts, (entry) =>
      toProfileSectionItem(firstText(entry.title, entry.name), [
        firstText(entry.url, entry.link),
        dateOf(entry),
      ]),
    ),
  };

  return {
    headline: (profile.headline ?? "").trim().slice(0, PROFILE_HEADLINE_MAX),
    about: (profile.about ?? profile.summary ?? "")
      .trim()
      .slice(0, PROFILE_ABOUT_MAX),
    experience: flattenExperience(sections.experience),
    name: profile.name?.trim() || null,
    sections,
  };
}

/**
 * SOURCE OF TRUTH KEYWORDS: PROFILE_MAPPERS
 *
 * WHAT:  Per-vendor translation from a raw record to FetchedProfile.
 * WHY:   Keyed by ProfileSource so adding a vendor is one entry here plus one in
 *        PROFILE_SOURCES — the Record type makes a missing mapper a compile
 *        error rather than a runtime surprise. Everything downstream sees only
 *        FetchedProfile and never learns which vendor produced it.
 */
const PROFILE_MAPPERS: Record<
  ProfileSource,
  (raw: unknown) => FetchedProfile | null
> = {
  apify: (raw) => {
    const parsed = apifyProfileSchema.safeParse(raw);
    return parsed.success ? mapApifyProfile(parsed.data) : null;
  },
  brightdata: (raw) => {
    const parsed = brightDataProfileSchema.safeParse(raw);
    return parsed.success ? mapBrightDataProfile(parsed.data) : null;
  },
};

/**
 * SOURCE OF TRUTH KEYWORDS: fetchProfileFromUrl
 *
 * WHAT:  Fetches one public LinkedIn profile through the configured vendor.
 * WHY:   Aborts at PROFILE_FETCH_TIMEOUT_MS rather than inheriting fetch's
 *        default of none: a hung vendor would otherwise stall the request until
 *        the transaction died. Errors are rewritten into user-facing sentences
 *        because raw vendor messages leak endpoint and billing detail.
 * WHERE: Called by profileAnalysis.fetch.
 */
export async function fetchProfileFromUrl(
  profileUrl: string,
): Promise<FetchedProfile> {
  const source = getProfileSource();
  const apiKey = getProfileSourceApiKey();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROFILE_FETCH_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(source.endpoint, {
      method: "POST",
      headers: source.buildHeaders(apiKey),
      body: source.buildBody(profileUrl),
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(
        "The profile lookup took too long. Try again, or paste your profile details manually.",
      );
    }
    throw new Error(
      "Could not reach the profile lookup service. Paste your details manually.",
    );
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    /* Logged in full for the operator; the user gets a sentence they can act on. */
    const body = await response.text().catch(() => "");
    console.error(
      `[profile-source] ${source.label} lookup failed (${response.status}):`,
      body.slice(0, 300),
    );

    /* Operator-facing failures need to name the actual remedy, and these three
     * have DIFFERENT remedies that all look alike from the outside. Reporting any
     * of them as "this profile may be private" sends the user to inspect their own
     * URL while the real fix is in a vendor dashboard. Ordered most specific first:
     *   - Apify gates pay-per-result actors behind a one-time permission approval
     *     and answers 403 until it is granted; that is a single click, not a
     *     billing problem, so it must not be reported as one.
     *   - Bright Data answers an unbilled account with 400 "Customer is not active".
     *   - 401/402 are credentials and payment respectively. */
    const needsActorApproval =
      /permission|not-approved|approvePermissions/i.test(body);
    const isAccountProblem =
      response.status === 401 ||
      response.status === 402 ||
      /not active|suspend|billing|payment|quota|credit|exceed/i.test(body);

    if (needsActorApproval) {
      throw new Error(
        `URL lookup needs a one-time approval in the ${source.label} console before it can run. Paste your details manually for now.`,
      );
    }

    throw new Error(
      isAccountProblem
        ? `URL lookup is unavailable — the ${source.label} account is not active or is out of credit. Paste your details manually for now.`
        : "Could not fetch that profile. It may be private or unavailable — paste your details manually.",
    );
  }

  const payload: unknown = await response.json();
  const { record, empty } = firstRecord(payload);

  /* The vendor ran but produced nothing. Distinct from a shape change: the fix
   * is the user's (check the URL / the profile is private), not the operator's. */
  if (empty) {
    console.error(
      `[profile-source] ${source.label} returned no records for ${profileUrl}`,
    );
    throw new Error(
      "No profile was found at that URL. Check the link, or paste your details manually — private profiles cannot be read.",
    );
  }

  /* A vendor can report failure INSIDE a 2xx: an actor was observed answering
   * HTTP 201 with `[{ error: "..." }]`. The profile schemas are loose by design,
   * so that item would otherwise parse as a profile with everything absent and
   * be reported as an empty profile, discarding the real reason. */
  const vendorError = scrapedErrorItemSchema.safeParse(record);
  if (vendorError.success) {
    console.error(
      `[profile-source] ${source.label} returned an error item:`,
      vendorError.data.error,
    );
    throw new Error(
      /free .*plan|not available on|upgrade/i.test(vendorError.data.error)
        ? `URL lookup is not available on the current ${source.label} plan. Paste your details manually for now.`
        : "Could not fetch that profile. Paste your details manually.",
    );
  }

  const mapped = PROFILE_MAPPERS[PROFILE_SOURCE](record);
  if (!mapped) {
    /* Logged with the actual shape — key names only, never scraped values — so a
     * vendor renaming fields is diagnosable from the server log instead of
     * needing this code re-run by hand. */
    console.error(
      `[profile-source] unexpected ${source.label} response shape:`,
      `payload=${describePayload(payload)}`,
      `record=${describePayload(record)}`,
    );
    throw new Error(
      "The profile lookup returned an unexpected result. Paste your details manually.",
    );
  }

  /* A record with neither a headline nor an About is a private or empty profile.
   * Saying so is more useful than handing back a blank form. */
  if (!mapped.headline && !mapped.about) {
    throw new Error(
      "That profile returned no headline or About text. It may be private — paste your details manually.",
    );
  }

  /* The single most useful log line in this file, and the one that was missing.
   *
   * The profile schemas are `looseObject` with every field `.nullish()`, which
   * means they parse ANY object — including one whose keys the mappers do not
   * recognise. So `PROFILE_MAPPERS` never returns null for an object record and
   * the "unexpected shape" branch above is effectively unreachable: a vendor
   * renaming `about` to `summary`, or returning a search-engine snippet instead
   * of a profile, surfaces as a half-empty form with NOTHING in the server log
   * to say which of those happened.
   *
   * Logging the record's top-level key names — names only, never scraped values
   * — turns "the fetch only filled the headline" from a guess into a fact: if
   * the keys are absent, the vendor genuinely returned a thin result and the
   * answer is a vendor change; if they are present under different spellings,
   * the answer is a mapper change and costs nothing. */
  const emptySections = PROFILE_SECTION_KEYS.filter(
    (key) => mapped.sections[key].length === 0,
  );
  if (emptySections.length > 0) {
    console.warn(
      `[profile-source] ${source.label} produced no entries for: ${emptySections.join(", ")}.`,
      `record keys: ${describePayload(record)}`,
      /* The INNER keys, which is the part that actually matters. A live response
       * had `experience` and `education` populated at the top level while the
       * mapper read the wrong key names inside each entry and produced nothing —
       * top-level keys alone could not distinguish that from an empty array.
       * Names only, never scraped values. */
      `sample item keys: ${describeSampleItems(record)}`,
    );
  }

  return mapped;
}

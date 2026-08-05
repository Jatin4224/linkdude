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
  type ApifyProfile,
  type BrightDataProfile,
  type FetchedProfile,
  type ProfileSource,
} from "@/lib/types/profile-lookup";

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

/* Roles arrive structured but the model reads prose, so they are flattened into
 * the same shape a user would have pasted. Truncated to the schema ceiling
 * because a long career easily exceeds it and a hard validation failure here
 * would waste the lookup the user just paid for. */
/* `description` is a required key holding a nullable value, not an optional key:
 * under exactOptionalPropertyTypes those are different types, and the vendor
 * schemas produce `string | null | undefined` rather than an absent property. */
function joinRoles(
  roles: ReadonlyArray<{
    header: string;
    description: string | null | undefined;
  }>,
): string {
  return roles
    .map((role) => [role.header, role.description].filter(Boolean).join("\n"))
    .filter((entry) => entry.trim().length > 0)
    .join("\n\n")
    .slice(0, PROFILE_EXPERIENCE_MAX);
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

  return {
    headline: headline.slice(0, PROFILE_HEADLINE_MAX),
    about: about.slice(0, PROFILE_ABOUT_MAX),
    experience: joinRoles(
      (profile.experience ?? []).map((role) => ({
        header: [
          [role.title, role.company].filter(Boolean).join(" at "),
          [role.start_date, role.end_date].filter(Boolean).join(" - "),
        ]
          .filter(Boolean)
          .join(" "),
        description: role.description,
      })),
    ),
    name: profile.name?.trim() || null,
  };
}

/* The actor returns roles WITHOUT descriptions — only position, company, and
 * duration — so experience is reconstructed as a factual role list. It reads
 * thinner than a pasted Experience section, which is fine: the field stays
 * editable, and the analysis prompt is told not to fault a section it wasn't
 * given rather than inventing achievements to fill the gap. */
function mapApifyProfile(profile: ApifyProfile): FetchedProfile {
  return {
    headline: (profile.headline ?? "").trim().slice(0, PROFILE_HEADLINE_MAX),
    about: (profile.about ?? "").trim().slice(0, PROFILE_ABOUT_MAX),
    experience: joinRoles(
      (profile.experience ?? []).map((role) => ({
        header: [
          role.position,
          role.companyName,
          role.duration,
          role.startDate?.year ? `from ${role.startDate.year}` : "",
        ]
          .filter(Boolean)
          .join(" | "),
        description: null,
      })),
    ),
    name: profile.name?.trim() || null,
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

  return mapped;
}

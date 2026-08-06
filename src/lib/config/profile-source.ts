/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: PROFILE_SOURCES, PROFILE_SOURCE, getProfileSource,
 *   isProfileFetchConfigured, BRIGHTDATA_API_KEY, BRIGHTDATA_DATASET_ID,
 *   PROFILE_FETCH_TIMEOUT_MS, ProfileSourceDefinition
 *
 * WHAT:  Configuration for fetching a LinkedIn profile from a URL — the vendor
 *        registry plus the accessors that resolve the active one.
 * WHY:   LinkedIn exposes no profile text to this app and blocks automated reads
 *        of profile pages, so a URL lookup necessarily goes through a
 *        third-party data vendor. Vendors in this category are unstable —
 *        Proxycurl, the long-time default, was sued by LinkedIn in January 2025
 *        and shut down entirely by that July — so the vendor is registry-driven
 *        exactly like AI_PROVIDERS: swapping one is an env change plus a single
 *        entry, never a grep across services. Fails soft like ./stripe.ts: with
 *        no key the URL tab reports "not configured" and the paste path, which
 *        needs no vendor at all, keeps working.
 * WHERE: Consumed by src/services/profile-source.service.ts. Never import a
 *        vendor endpoint anywhere else.
 */

import {
  profileSourceSchema,
  type ProfileSource,
} from "@/lib/types/profile-analysis";

/**
 * SOURCE OF TRUTH KEYWORDS: ProfileSourceDefinition
 *
 * WHAT:  What the fetch layer needs to talk to one vendor.
 * WHERE: Implemented by PROFILE_SOURCES below.
 */
export interface ProfileSourceDefinition {
  readonly label: string;
  readonly apiKeyEnvVar: string;
  readonly consoleUrl: string;
  /** Absolute endpoint for ONE synchronous profile lookup. */
  readonly endpoint: string;
  readonly buildHeaders: (apiKey: string) => Record<string, string>;
  /** Vendors disagree on the request shape, so each builds its own body. */
  readonly buildBody: (profileUrl: string) => string;
}

/* Bright Data's "LinkedIn People Profile" collector. The id is static across
 * accounts, so it is pinned here rather than configured per install. */
const BRIGHTDATA_DATASET_ID = "gd_l1viktl72bvl7bjuj0";

/* Both vendors are called SYNCHRONOUSLY. Each also offers an async job API
 * (Bright Data /trigger, Apify /runs) that returns an id to poll — unusable
 * here, because polling inside the tRPC mutation transaction would hold a
 * Postgres connection for the entire job. */
const BRIGHTDATA_SCRAPE_ENDPOINT =
  "https://api.brightdata.com/datasets/v3/scrape";

/* Cookie-free actor: it scrapes public profiles through its own proxies rather
 * than driving a logged-in session. Actors that ask for a `li_at` cookie are
 * deliberately avoided — they act as the account whose cookie is supplied, which
 * puts a real person's LinkedIn at risk of restriction.
 *
 * Verified callable via the API on Apify's FREE plan. That is not a given and is
 * the binding constraint on this choice: `dev_fusion~linkedin-profile-scraper`
 * (the better-known actor) answers HTTP 201 with the dataset item
 * `{ error: "Users on the free Apify plan can run the actor through the UI and
 * not via other methods." }`. Re-verify free-plan API access before swapping
 * this id — the actor page does not state the restriction. */
const APIFY_ACTOR_ID = "thirdwatch~linkedin-profile-scraper";

/**
 * SOURCE OF TRUTH KEYWORDS: PROFILE_FETCH_TIMEOUT_MS
 *
 * WHAT:  Hard ceiling on one vendor lookup.
 * WHY:   The fetch is deliberately its OWN endpoint rather than a step inside
 *        analysis: scraping plus ~25s of model time would blow the transaction
 *        while holding a database connection the whole time.
 *
 *        Sized from measurement, not documentation. A direct lookup that finds
 *        nothing already takes ~26s before giving up, and the recovery tiers
 *        (residential retry, then premium fallback) run only AFTER that — so the
 *        worst realistic case is well past a minute. 75s lets the slow path
 *        actually complete; below that we would pay for fallbacks and then abort
 *        before collecting the result.
 * WHERE: Applied in src/services/profile-source.service.ts. Must stay safely
 *        under the fetch procedure's txTimeout in the profileAnalysis router.
 */
export const PROFILE_FETCH_TIMEOUT_MS = 75_000;

/**
 * SOURCE OF TRUTH KEYWORDS: PROFILE_MAPPER_VERSION
 *
 * WHAT:  Stamped onto every cached lookup. Bump it whenever a vendor mapper
 *        changes what it extracts.
 * WHY:   Cached lookups live for seven days, and `profileLookup.create` serves
 *        the cache before it calls the vendor. So a mapper FIX cannot reach any
 *        profile that was already looked up — the improved code never runs, and
 *        the user keeps seeing the thin result that motivated the fix, with no
 *        way to force a refresh short of waiting out the TTL.
 *
 *        That is not hypothetical: a lookup cached under a mapper that read the
 *        wrong key names stored four empty sections, and those empty sections
 *        re-validate perfectly against the current schema. Schema validation
 *        cannot catch this class of staleness because the SHAPE is fine and only
 *        the CONTENT is impoverished. A version stamp can.
 *
 *        Bumping costs one re-fetch per previously-cached profile, once. Leaving
 *        it stale costs a week of the fix appearing not to work.
 *
 *        Version history:
 *          1 — headline/about/flattened experience only
 *          2 — structured sections; Apify items read under every observed
 *              key-name spelling rather than one guess
 * WHERE: Written by writeCachedLookup, checked by readCachedLookup.
 */
export const PROFILE_MAPPER_VERSION = 2;

/**
 * SOURCE OF TRUTH KEYWORDS: PROFILE_SOURCES
 *
 * WHAT:  Every profile-data vendor the app knows how to call.
 * WHY:   One entry per vendor keeps the service layer vendor-agnostic, so a
 *        vendor shutting down is a config change rather than a rewrite.
 */
export const PROFILE_SOURCES: Record<ProfileSource, ProfileSourceDefinition> = {
  apify: {
    label: "Apify",
    apiKeyEnvVar: "APIFY_API_TOKEN",
    consoleUrl: "https://console.apify.com/settings/integrations",
    /* run-sync-get-dataset-items runs the actor and returns its results in one
     * request. The token goes in the Authorization header rather than the `?token=`
     * query parameter both forms support, so it cannot leak through request logs. */
    endpoint: `https://api.apify.com/v2/acts/${APIFY_ACTOR_ID}/run-sync-get-dataset-items`,
    buildHeaders: (apiKey) => ({
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    }),
    /* The deeper fallback tiers are OFF by default and a plain lookup returns an
     * EMPTY array — after ~26s — whenever LinkedIn authwalls the direct fetch,
     * which the actor itself calls "common in 2026". A lookup that finds nothing
     * still costs the wait, so both recovery tiers are enabled deliberately:
     *   preferFullProfile  - residential retry before falling back to partial
     *                        search-engine results, so About/experience are real
     *                        profile text rather than a search snippet
     *   usePremiumFallback - last resort once every other tier has failed
     * Both raise the per-lookup cost against the $5 monthly credit. Turn them off
     * to stretch the credit at the price of more empty results.
     * maxProfiles is pinned to 1: only one URL is ever sent, so this caps the
     * blast radius if that ever changes by accident. */
    buildBody: (profileUrl) =>
      JSON.stringify({
        profileUrls: [profileUrl],
        maxProfiles: 1,
        useFallbacks: true,
        preferFullProfile: true,
        usePremiumFallback: true,
      }),
  },
  brightdata: {
    label: "Bright Data",
    apiKeyEnvVar: "BRIGHTDATA_API_KEY",
    consoleUrl: "https://brightdata.com/cp/api_tokens",
    endpoint: `${BRIGHTDATA_SCRAPE_ENDPOINT}?dataset_id=${BRIGHTDATA_DATASET_ID}&format=json`,
    buildHeaders: (apiKey) => ({
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    }),
    buildBody: (profileUrl) => JSON.stringify([{ url: profileUrl }]),
  },
};

/**
 * SOURCE OF TRUTH KEYWORDS: PROFILE_SOURCE
 *
 * WHAT:  The vendor this deployment uses. Defaults to Bright Data.
 * WHY:   Parsed with `.catch` so a misspelled PROFILE_SOURCE falls back rather
 *        than taking the process down — the same fail-soft contract as ./ai.ts.
 */
export const PROFILE_SOURCE: ProfileSource = profileSourceSchema
  .catch("apify")
  .parse(process.env["PROFILE_SOURCE"]);

export function getProfileSource(): ProfileSourceDefinition {
  return PROFILE_SOURCES[PROFILE_SOURCE];
}

/**
 * SOURCE OF TRUTH KEYWORDS: isProfileFetchConfigured
 *
 * WHAT:  True when the active vendor's API key is set.
 * WHERE: Guard in the profileAnalysis router and the UI, so an install without
 *        a vendor key hides the URL tab instead of offering a button that
 *        always errors. The paste path is unaffected.
 */
export function isProfileFetchConfigured(): boolean {
  return Boolean(process.env[getProfileSource().apiKeyEnvVar]);
}

/**
 * SOURCE OF TRUTH KEYWORDS: getProfileSourceApiKey
 *
 * WHAT:  The active vendor's API key, or a clear error naming what to set.
 * WHERE: Called by src/services/profile-source.service.ts only.
 */
export function getProfileSourceApiKey(): string {
  const source = getProfileSource();
  const key = process.env[source.apiKeyEnvVar];
  if (!key) {
    throw new Error(
      `[profile-source] ${source.apiKeyEnvVar} is not set. URL lookups are unavailable until it is configured. Get a token at ${source.consoleUrl}.`,
    );
  }
  return key;
}

/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "server-only";

/**
 * SOURCE OF TRUTH KEYWORDS: normaliseProfileUrl, readCachedLookup,
 *   writeCachedLookup, PROFILE_LOOKUP_TTL_MS, CachedProfileLookup,
 *   ProfileLookup, fetchedProfileSchema
 *
 * WHAT:  The cache in front of paid vendor lookups — read a stored profile,
 *        store a fresh one.
 * WHY:   `server-only` per the service rule. This file exists purely because
 *        lookups cost money per call: the same profile gets requested again on
 *        a retry, a page reload, or by a second feature, and without a cache
 *        each of those is another invoice line for byte-identical data.
 *
 *        Deliberately separate from profile-source.service.ts, which owns the
 *        vendor HTTP and touches no database. This one owns the database and
 *        makes no network calls. The router decides between them — that
 *        decision is business logic and belongs there, not in a service.
 * WHERE: Called by src/trpc/routers/profile-lookup.ts with `import *`.
 */

import type { DbClient } from "@/lib/config/prisma";
import { fetchedProfileSchema } from "@/lib/types/profile-lookup";
import type {
  CachedProfileLookup,
  FetchedProfile,
} from "@/lib/types/profile-lookup";

/**
 * SOURCE OF TRUTH KEYWORDS: PROFILE_LOOKUP_TTL_MS
 *
 * WHAT:  How long a cached lookup is considered current.
 * WHY:   Profiles change slowly — a headline rewrite is a monthly event, not a
 *        daily one — so a short TTL would spend money re-fetching text that has
 *        not moved. Seven days is long enough to absorb a normal working
 *        session and any retries, short enough that a user who updates their
 *        profile and comes back next week sees the change. The UI shows the age
 *        and offers a fresh fetch, so this ceiling never traps anyone.
 */
export const PROFILE_LOOKUP_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * SOURCE OF TRUTH KEYWORDS: normaliseProfileUrl
 *
 * WHAT:  Reduces a LinkedIn profile URL to one canonical cache key.
 * WHY:   `/in/jatin`, `/in/jatin/`, `/IN/Jatin`, and `?utm_source=x` are one
 *        person. Keyed raw they would be four cache entries and therefore four
 *        charges. Lowercased, stripped of query/hash and any trailing slash, and
 *        with the host collapsed so `uk.linkedin.com` and `www.linkedin.com`
 *        agree.
 * WHERE: Applied on every read and write below, so a caller can never bypass it.
 */
export function normaliseProfileUrl(profileUrl: string): string {
  const trimmed = profileUrl.trim().toLowerCase();
  /* Strip query and hash first — tracking params are the common case. */
  const withoutQuery = trimmed.split(/[?#]/)[0] ?? trimmed;
  const withoutSlash = withoutQuery.replace(/\/+$/, "");
  /* Collapse scheme and any regional/www subdomain to one canonical host. */
  return withoutSlash.replace(
    /^https?:\/\/([a-z]{2,3}\.)?linkedin\.com/,
    "https://linkedin.com",
  );
}

/**
 * SOURCE OF TRUTH KEYWORDS: readCachedLookup
 *
 * WHAT:  A previously fetched profile for this org, or null when absent, stale,
 *        or unreadable.
 * WHY:   Scoped by organizationId as part of the unique key, never globally: a
 *        shared cache would reveal which profiles another tenant has looked at.
 *
 *        Returns null rather than throwing on a parse failure, for the same
 *        reason the analysis history does — a row written under an older shape
 *        should cost one re-fetch, not break lookups entirely.
 * WHERE: Read by profileLookup.get, and by profileLookup.create before it
 *        spends a vendor call.
 */
export async function readCachedLookup(
  db: DbClient,
  organizationId: string,
  profileUrl: string,
  ttlMs: number = PROFILE_LOOKUP_TTL_MS,
): Promise<CachedProfileLookup | null> {
  const row = await db.profileLookup.findUnique({
    where: {
      organizationId_profileUrl: {
        organizationId,
        profileUrl: normaliseProfileUrl(profileUrl),
      },
    },
    select: { profile: true, fetchedAt: true },
  });
  if (!row) return null;

  if (Date.now() - row.fetchedAt.getTime() > ttlMs) return null;

  const parsed = fetchedProfileSchema.safeParse(row.profile);
  if (!parsed.success) return null;

  return { profile: parsed.data, fetchedAt: row.fetchedAt };
}

/**
 * SOURCE OF TRUTH KEYWORDS: writeCachedLookup
 *
 * WHAT:  Stores a freshly fetched profile, replacing any previous entry.
 * WHY:   `upsert` on the (organizationId, profileUrl) unique key so a refresh
 *        overwrites rather than appending — this table is a cache with one row
 *        per profile, not a history. `fetchedAt` is set explicitly so a refresh
 *        resets the TTL clock even when the mapped profile is unchanged.
 * WHERE: Called by profileLookup.create after a successful vendor call.
 */
export async function writeCachedLookup(
  db: DbClient,
  organizationId: string,
  profileUrl: string,
  profile: FetchedProfile,
): Promise<void> {
  const key = normaliseProfileUrl(profileUrl);
  const fetchedAt = new Date();

  await db.profileLookup.upsert({
    where: { organizationId_profileUrl: { organizationId, profileUrl: key } },
    create: { organizationId, profileUrl: key, profile, fetchedAt },
    update: { profile, fetchedAt },
  });
}

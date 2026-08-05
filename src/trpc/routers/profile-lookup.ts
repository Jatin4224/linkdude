/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: profileLookupRouter, profileLookup.status,
 *   profileLookup.get, profileLookup.create
 *
 * WHAT:  Turning a LinkedIn profile URL into profile text — the shared
 *        capability, not a step inside any one feature.
 * WHY:   Lifted out of the profile-analysis router because a lookup is wanted by
 *        more than the analyzer (outreach drafting next), and under the old
 *        shape every caller would have needed `profileAnalysis:create` and would
 *        have shared the analyzer's rate limit. Mounted as `profileLookup` so
 *        `profileLookup.create` matches the RESOURCES key and auto-wires the
 *        per-plan lookup quota, the counter, the rate limit, and the audit row.
 *
 *        The split between `get` and `create` is the important part — see below.
 * WHERE: Mounted in src/trpc/routers/_app. Delegates to
 *        profile-source.service.ts (vendor HTTP) and profile-lookup.service.ts
 *        (cache).
 */

import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createTRPCRouter } from "../init";
import { protectedProcedure } from "../procedures";
import { permissions } from "@/lib/better-auth/permissions";
import { fetchProfileSchema } from "@/lib/types";
import {
  isProfileFetchConfigured,
  getProfileSource,
} from "@/lib/config/profile-source";
import * as profileSourceService from "@/services/profile-source.service";
import * as profileLookupService from "@/services/profile-lookup.service";

const withOrganization = z.object({ organizationId: z.string().min(1) });

export const profileLookupRouter = createTRPCRouter({
  /**
   * SOURCE OF TRUTH KEYWORDS: profileLookup.status
   *
   * WHAT:  Whether URL lookups are available on this deployment.
   * WHY:   Whether a vendor key is set is a server fact — the key is never in a
   *        client bundle, so the UI cannot determine this on its own. Exposing
   *        it lets a caller hide the URL field entirely rather than render a
   *        button that always errors. Returns a boolean only; the key, the
   *        vendor endpoint, and the env var name stay server-side.
   * WHERE: Queried by any surface offering a URL field.
   */
  status: protectedProcedure()
    .input(withOrganization)
    .query(() => ({ canFetchByUrl: isProfileFetchConfigured() })),

  /**
   * SOURCE OF TRUTH KEYWORDS: profileLookup.get
   *
   * WHAT:  A cached profile for this URL, or null. Costs nothing.
   * WHY:   This exists because the counter wiring in protectedProcedure has NO
   *        opt-out: any `<resource>.create` increments the quota. Serving a
   *        cache hit from `create` would therefore charge a lookup for data that
   *        cost nothing — so the free path has to be a different procedure.
   *
   *        Gated on `read`, not `create`, so a member who may reuse what the org
   *        already paid for does not also need permission to spend on new
   *        lookups.
   * WHERE: Called before `create` so the UI can offer the cached copy first.
   */
  get: protectedProcedure({
    requirePermission: permissions.PROFILE_LOOKUP_READ,
  })
    .input(fetchProfileSchema.extend(withOrganization.shape))
    .query(async ({ ctx, input }) =>
      profileLookupService.readCachedLookup(
        ctx.db,
        input.organizationId,
        input.profileUrl,
      ),
    ),

  /**
   * SOURCE OF TRUTH KEYWORDS: profileLookup.create
   *
   * WHAT:  Spends one lookup: calls the vendor, caches the result, returns it.
   * WHY:   Named `create` so the quota, counter, rate limit, and audit row wire
   *        themselves from the registry entry. Every call here is a real charge,
   *        which is why the cache is checked FIRST and short-circuits before the
   *        vendor is touched — a duplicate request inside the TTL must not bill
   *        twice even if the client forgets to call `get`.
   *
   *        The cache check happens inside the handler rather than being trusted
   *        to the caller because the counter increments regardless of what this
   *        handler does; short-circuiting saves the vendor charge, not the quota
   *        unit. That asymmetry is deliberate — `create` means "I intend to
   *        spend a lookup", and honouring that keeps the counter honest.
   * WHERE: Called when the user explicitly asks for a fresh fetch.
   */
  create: protectedProcedure({
    requirePermission: permissions.PROFILE_LOOKUP_CREATE,
    /* Must exceed PROFILE_FETCH_TIMEOUT_MS (75s) or the transaction dies before
     * the service's own abort fires, turning a clean "lookup timed out" into an
     * opaque Prisma error. Kept a mutation rather than a query — which would
     * skip the transaction entirely — because React Query refetches queries on
     * window focus, and each refetch here is a BILLED vendor call. */
    txTimeout: 90_000,
  })
    .input(fetchProfileSchema.extend(withOrganization.shape))
    .mutation(async ({ ctx, input }) => {
      if (!isProfileFetchConfigured()) {
        const source = getProfileSource();
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `URL lookups are not configured. Add ${source.apiKeyEnvVar} to enable them, or paste your profile details manually.`,
        });
      }

      /* Cheapest possible path first: never pay a vendor for something already
       * on disk and current. */
      const cached = await profileLookupService.readCachedLookup(
        ctx.db,
        input.organizationId,
        input.profileUrl,
      );
      if (cached) return cached.profile;

      let profile: Awaited<
        ReturnType<typeof profileSourceService.fetchProfileFromUrl>
      >;
      try {
        profile = await profileSourceService.fetchProfileFromUrl(
          input.profileUrl,
        );
      } catch (error) {
        /* The service already rewrites vendor failures into user-facing
         * sentences that end in "paste your details manually", so the message
         * passes through rather than being flattened to a generic one. */
        throw new TRPCError({
          code: "BAD_GATEWAY",
          message:
            error instanceof Error
              ? error.message
              : "Could not fetch that profile. Paste your details manually.",
        });
      }

      await profileLookupService.writeCachedLookup(
        ctx.db,
        input.organizationId,
        input.profileUrl,
        profile,
      );

      return profile;
    }),
});

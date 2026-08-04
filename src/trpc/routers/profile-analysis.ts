/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: profileAnalysisRouter, profileAnalysis.create
 *
 * WHAT:  Turns a pasted LinkedIn profile into a structured critique.
 * WHY:   Mounted as `profileAnalysis` so the path `profileAnalysis.create`
 *        matches the RESOURCES key — that is what auto-wires the per-plan
 *        analysis quota, the usage counter, the rate limit, and the permission
 *        gate. Metered separately from `aiGeneration` because an analysis sends
 *        an entire profile and asks for structured output, costing several times
 *        what a post draft does; sharing a counter would let one analysis
 *        silently consume a handful of drafts.
 * WHERE: Mounted in src/trpc/routers/_app; delegates to
 *        src/services/ai.service.ts. Consumed by the profile-analysis route.
 */

import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createTRPCRouter } from "../init";
import { protectedProcedure } from "../procedures";
import { permissions } from "@/lib/better-auth/permissions";
import { analyzeProfileSchema, fetchProfileSchema } from "@/lib/types";
import { isAiConfigured, getAiProvider } from "@/lib/config";
import {
  isProfileFetchConfigured,
  getProfileSource,
} from "@/lib/config/profile-source";
import * as aiService from "@/services/ai.service";
import * as profileSourceService from "@/services/profile-source.service";

export const profileAnalysisRouter = createTRPCRouter({
  /**
   * SOURCE OF TRUTH KEYWORDS: profileAnalysis.fetchStatus
   *
   * WHAT:  Whether URL lookups are available on this deployment.
   * WHY:   Whether a vendor key is set is a server fact — the key is never in a
   *        client bundle, so the UI cannot determine this on its own. Exposing
   *        it lets the analyzer hide the URL field entirely rather than render a
   *        button that always errors. Returns a boolean only; the key, the
   *        vendor endpoint, and the env var name stay server-side.
   * WHERE: Queried by the analyzer to decide whether to show the URL field.
   */
  fetchStatus: protectedProcedure()
    .input(z.object({ organizationId: z.string().min(1) }))
    .query(() => ({ canFetchByUrl: isProfileFetchConfigured() })),

  /**
   * SOURCE OF TRUTH KEYWORDS: profileAnalysis.fetch
   *
   * WHAT:  Pulls a public LinkedIn profile via the configured data vendor and
   *        returns it as form fields — it does NOT analyze.
   * WHY:   Separate from `create` for two reasons. Mechanically, a 10-30s vendor
   *        scrape chained to a ~25s model call would sit against the 60s
   *        txTimeout and fail intermittently while holding a database
   *        connection. Practically, scraped profiles are often incomplete or
   *        subtly wrong, so the result populates the form for the user to review
   *        before an analysis is spent on it. Deliberately NOT named `create`:
   *        that verb would increment the analysis counter, and a lookup is not
   *        an analysis. Its cost is contained by the `fetch` rate limit in
   *        RESOURCES instead.
   * WHERE: Called by the analyzer's URL tab.
   */
  fetch: protectedProcedure({
    requirePermission: permissions.PROFILE_ANALYSIS_CREATE,
    /* Must exceed PROFILE_FETCH_TIMEOUT_MS (75s) or the transaction dies before
     * the service's own abort fires, turning a clean "lookup timed out" into an
     * opaque Prisma error. Kept a mutation rather than a query — which would
     * skip the transaction entirely — because React Query refetches queries on
     * window focus, and each refetch here is a BILLED vendor call. Holding a
     * connection this long is the accepted cost of not spending money by
     * accident; revisit if Neon pool pressure ever shows up. */
    txTimeout: 90_000,
    /* Nothing is created or changed — an audit row per lookup would be noise. */
    audit: false,
  })
    .input(
      fetchProfileSchema.and(z.object({ organizationId: z.string().min(1) })),
    )
    .mutation(async ({ input }) => {
      if (!isProfileFetchConfigured()) {
        const source = getProfileSource();
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `URL lookups are not configured. Add ${source.apiKeyEnvVar} to enable them, or paste your profile details manually.`,
        });
      }

      try {
        return await profileSourceService.fetchProfileFromUrl(input.profileUrl);
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
    }),

  /**
   * SOURCE OF TRUTH KEYWORDS: profileAnalysis.create
   *
   * WHAT:  Analyzes a profile and returns the critique un-persisted.
   * WHY:   Named `create` (not `analyze`) so the `<resource>.<verb>` convention
   *        fires the quota and counter wiring in protectedProcedure. Nothing is
   *        written to the database — the result lives in the page until the user
   *        acts on it, so the counter measures model spend, which is the thing
   *        that actually costs money.
   * WHERE: Called by the profile-analysis form.
   */
  create: protectedProcedure({
    requirePermission: permissions.PROFILE_ANALYSIS_CREATE,
    /* The model call runs inside the factory's mutation tx, so the tx stays open
     * for the full round trip and the 10s default would expire mid-analysis.
     * Structured output over a whole profile is slower than drafting a post. */
    txTimeout: 60_000,
  })
    .input(
      analyzeProfileSchema.and(z.object({ organizationId: z.string().min(1) })),
    )
    .mutation(async ({ input }) => {
      /* Fail before the quota is spent: an unconfigured key is an operator
       * problem, and the user shouldn't lose an analysis to it. */
      if (!isAiConfigured()) {
        const provider = getAiProvider();
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `AI analysis is not configured. Add ${provider.apiKeyEnvVar} to enable it.`,
        });
      }

      try {
        return await aiService.analyzeLinkedInProfile(input);
      } catch (error) {
        /* Provider overload (503) and schema-validation failures both land here.
         * Re-thrown as a tRPC error so the page can render the reason inline
         * rather than a generic 500. */
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Profile analysis failed. Please try again.",
        });
      }
    }),
});

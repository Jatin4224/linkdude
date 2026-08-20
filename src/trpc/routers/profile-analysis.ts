/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: profileAnalysisRouter, profileAnalysis.create,
 *   profileAnalysis.list, profileAnalysis.discard
 *
 * WHAT:  Turns a pasted LinkedIn profile into a structured critique, keeps the
 *        result, and reads the org's saved analyses back.
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

import { createTRPCRouter, toProcedureError } from "../init";
import { protectedProcedure } from "../procedures";
import { permissions } from "@/lib/better-auth/permissions";
import {
  analyzeProfileSchema,
  listAnalysesSchema,
  discardAnalysisSchema,
} from "@/lib/types";
import { isAiConfigured, getAiProvider } from "@/lib/config";
import { serializeProfileSection } from "@/lib/config/profile-sections";
import { checkBooleanFeature } from "@/lib/feature-gate";
import { PROFILE_EXPERIENCE_MAX } from "@/lib/types";
import * as aiService from "@/services/ai.service";
import * as profileAnalysisService from "@/services/profile-analysis.service";

export const profileAnalysisRouter = createTRPCRouter({
  /* `fetch` and `fetchStatus` used to live here. They moved to the
   * profileLookup router: fetching a profile is a shared capability, and under
   * this namespace every future caller would have needed
   * `profileAnalysis:create` and would have shared this feature's rate limit. */

  /**
   * SOURCE OF TRUTH KEYWORDS: profileAnalysis.create
   *
   * WHAT:  Analyzes a profile, saves the critique, and returns the saved row.
   * WHY:   Named `create` (not `analyze`) so the `<resource>.<verb>` convention
   *        fires the quota and counter wiring in protectedProcedure. The counter
   *        measures model spend, which is the thing that actually costs money —
   *        and that is precisely why the result is PERSISTED: the charge lands
   *        the moment the model answers, so without a row a refresh would
   *        destroy something the org has already paid for.
   *
   *        The model call and the write share the procedure's transaction, so a
   *        failed write rolls the usage increment back with it. The org is never
   *        billed a quota unit for an analysis it cannot see.
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
    .mutation(async ({ ctx, input }) => {
      /* Fail before the quota is spent: an unconfigured key is an operator
       * problem, and the user shouldn't lose an analysis to it. */
      if (!isAiConfigured()) {
        const provider = getAiProvider();
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `AI analysis is not configured. Add ${provider.apiKeyEnvVar} to enable it.`,
        });
      }

      /* Business logic, so it belongs here rather than in either service: the
       * plan decides WHAT IS ASKED FOR, not merely what is rendered. Resolved
       * before the model call so the locked sections are never generated —
       * gating them in the component instead would mean paying for output the
       * user is not allowed to read. `profileDeepInsights` is a flag-only
       * resource with no procedures of its own, so nothing auto-enforces it;
       * this is the enforcement. */
      const deepInsights = await checkBooleanFeature(
        input.organizationId,
        "profileDeepInsights",
      );

      /* The legacy experience column still speaks flattened prose. Derived from
       * the structured roles rather than collected separately, so the column and
       * the sections can never describe different careers. */
      const experience =
        input.experience ??
        serializeProfileSection(input.sections.experience).slice(
          0,
          PROFILE_EXPERIENCE_MAX,
        );

      try {
        const analysis = await aiService.analyzeLinkedInProfile(input, {
          deepInsights,
        });
        return await profileAnalysisService.recordAnalysis(ctx.db, {
          organizationId: input.organizationId,
          authorId: ctx.user.id,
          headline: input.headline,
          about: input.about,
          sections: input.sections,
          ...(experience ? { experience } : {}),
          analysis,
        });
      } catch (error) {
        /* Provider overload (503), schema-validation failures, and a failed
         * save all land here — the classifier separates them so the page can
         * render an accurate reason inline rather than the vendor's own text.
         * Still a throw, because this is inside the procedure transaction and
         * the throw is what rolls the usage increment back. */
        throw toProcedureError(error, {
          context: "profileAnalysis.create",
          fallbackMessage: "Profile analysis failed. Please try again.",
          messages: {
            AI_OUTPUT_UNUSABLE:
              "The AI returned an analysis we couldn't read. Please try again.",
          },
        });
      }
    }),

  /**
   * SOURCE OF TRUTH KEYWORDS: profileAnalysis.list
   *
   * WHAT:  This organization's saved analyses, newest first.
   * WHY:   A read-only query, so no counter and no audit row — nothing was
   *        spent. Gated on `read` rather than `create` so a member who may
   *        review past critiques does not also need permission to buy new ones.
   * WHERE: Backs the history strip on the profile-analysis page.
   */
  list: protectedProcedure({
    requirePermission: permissions.PROFILE_ANALYSIS_READ,
  })
    .input(listAnalysesSchema.extend({ organizationId: z.string().min(1) }))
    .query(async ({ ctx, input }) =>
      profileAnalysisService.listAnalyses(
        ctx.db,
        input.organizationId,
        input.limit,
      ),
    ),

  /**
   * SOURCE OF TRUTH KEYWORDS: profileAnalysis.discard
   *
   * WHAT:  Forgets a saved analysis.
   * WHY:   Named `discard` and NOT `delete`, deliberately. The counter wiring in
   *        protectedProcedure decrements on any `<resource>.delete` path, which
   *        is right for a quota counting things HELD and wrong for this one,
   *        which counts MODEL SPEND: the API call is already paid for, and
   *        dropping the row does not un-spend it. Under the `delete` name,
   *        analyze → delete → analyze would be an unlimited free tier. Renaming
   *        the verb is the escape hatch the registry documents (see
   *        getMutationFeatureMap in src/lib/resources.ts) — it keeps both the
   *        server bump and the client optimistic map from firing, with no
   *        special-casing in the infrastructure layer.
   *
   *        NOT_FOUND on a no-op so a stale list row reports honestly instead of
   *        silently succeeding.
   * WHERE: Called by the history strip's discard button.
   */
  discard: protectedProcedure({
    requirePermission: permissions.PROFILE_ANALYSIS_DISCARD,
  })
    .input(discardAnalysisSchema.extend({ organizationId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const { count } = await profileAnalysisService.discardAnalysis(
        ctx.db,
        input.organizationId,
        input.analysisId,
      );
      if (count === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "That analysis no longer exists.",
        });
      }
      return { id: input.analysisId };
    }),
});

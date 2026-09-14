/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: contentPlanRouter, contentPlan.get,
 *   contentPlan.brief, contentPlan.saveProgress, contentPlan.create,
 *   contentPlan.save, contentPlan.discard
 *
 * WHAT:  The guided Personalized Content Plan — reads a member's open session,
 *        opens one against a profile, records answers as they arrive, generates
 *        the strategy, and keeps or discards it.
 * WHY:   Mounted as `contentPlan` so `contentPlan.create` matches the RESOURCES
 *        key — that is what auto-wires the per-plan quota, the usage counter, the
 *        rate limit, the audit row, and the permission gate. Metered separately
 *        from profileAnalysis and aiGeneration because one plan asks for ten
 *        structured sections over a whole profile: it is the largest single
 *        generation in the app, and a shared counter would hide that behind a
 *        number sized for post drafts.
 *
 *        The verbs are split along what each one SPENDS, not along what it
 *        touches — see each procedure.
 * WHERE: Mounted in src/trpc/routers/_app; delegates to
 *        src/services/content-plan.service.ts, profile-lookup.service.ts and
 *        ai.service.ts. Consumed by the content-plan route.
 */

import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  assertAiConfigured,
  createTRPCRouter,
  toProcedureError,
} from "../init";
import { protectedProcedure } from "../procedures";
import { permissions } from "@/lib/better-auth/permissions";
import {
  generateContentPlanSchema,
  saveContentPlanProgressSchema,
  startContentPlanSchema,
} from "@/lib/types";
import * as aiService from "@/services/ai.service";
import * as contentPlanService from "@/services/content-plan.service";
import * as profileLookupService from "@/services/profile-lookup.service";
import * as voiceProfileService from "@/services/voice-profile.service";

const withOrganization = z.object({ organizationId: z.string().min(1) });

export const contentPlanRouter = createTRPCRouter({
  /**
   * SOURCE OF TRUTH KEYWORDS: contentPlan.get
   *
   * WHAT:  This member's open session, or null.
   * WHY:   A read-only query, so no counter and no audit — nothing was spent.
   *        Gated on `read` rather than `create` so a member who may revisit a
   *        plan does not also need permission to buy new ones.
   *
   *        This is the whole of the "Welcome back!" mechanism. The conversation
   *        is not stored; the chat rebuilds it by replaying the step registry
   *        against the answers on this row, which is why resuming works across
   *        devices and why rewording a question improves old sessions rather than
   *        corrupting them.
   * WHERE: Queried on mount by the content-plan chat.
   */
  get: protectedProcedure({
    requirePermission: permissions.CONTENT_PLAN_READ,
  })
    .input(withOrganization)
    .query(async ({ ctx, input }) =>
      contentPlanService.readContentPlan(
        ctx.db,
        input.organizationId,
        ctx.user.id,
      ),
    ),

  /**
   * SOURCE OF TRUTH KEYWORDS: contentPlan.brief
   *
   * WHAT:  Opens a session: reads the cached profile for a URL, generates the
   *        short "Profile Insights" read-back, and stores both.
   * WHY:   Named `brief`, NOT `create`, and that is the load-bearing part. The
   *        counter wiring fires on `<resource>.create`, and the quota unit for
   *        this feature is a GENERATED STRATEGY — charging one here would bill a
   *        user who pasted a URL and then closed the tab.
   *
   *        It reads the lookup CACHE rather than fetching. Fetching is
   *        profileLookup's job and is metered by profileLookup's own quota; the
   *        client runs that first. Re-reading the cache server-side rather than
   *        accepting profile data in the input is what stops a caller from
   *        handing us a profile that was never looked up — this procedure can
   *        only ever describe a profile the org has actually paid for.
   *
   *        Still rate-limited despite not being quota-metered: it is a model
   *        call, and a stuck client should not be able to make hundreds of them.
   * WHERE: Called by the chat's URL step, after profileLookup.get/create.
   */
  brief: protectedProcedure({
    requirePermission: permissions.CONTENT_PLAN_CREATE,
    /* The model call runs inside the factory's mutation tx, so the tx stays open
     * for the full round trip and the 10s default would expire mid-call. Shorter
     * than `create` below: this prompt asks for a few sentences, not ten
     * sections. */
    txTimeout: 45_000,
  })
    .input(startContentPlanSchema.extend(withOrganization.shape))
    .mutation(async ({ ctx, input }) => {
      /* Fail before any quota is spent: an unconfigured key is an operator
       * problem, and the user should not lose a plan to it. */
      assertAiConfigured("AI generation", "content plans");

      const cached = await profileLookupService.readCachedLookup(
        ctx.db,
        input.organizationId,
        input.profileUrl,
      );
      /* PRECONDITION_FAILED rather than NOT_FOUND: nothing is missing, the
       * caller simply skipped the step that pays for the profile. The message
       * names the fix because the client can act on it directly. */
      if (!cached) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "That profile has not been looked up yet. Fetch the profile first, then start the plan.",
        });
      }

      try {
        const insights = await aiService.generateProfileBrief(cached.profile);
        return await contentPlanService.startContentPlan(ctx.db, {
          organizationId: input.organizationId,
          authorId: ctx.user.id,
          profileUrl: input.profileUrl,
          profile: cached.profile,
          insights,
        });
      } catch (error) {
        /* Lookup runs against a third party, so UPSTREAM_UNAVAILABLE is the
         * common case here rather than a model failure — classifying it says so
         * instead of blaming the app for someone else's outage. */
        throw toProcedureError(error, {
          context: "contentPlan.readProfile",
          fallbackMessage: "Could not read that profile. Please try again.",
        });
      }
    }),

  /**
   * SOURCE OF TRUTH KEYWORDS: contentPlan.saveProgress
   *
   * WHAT:  Persists the answers collected so far.
   * WHY:   Gated on `update`, not `create`. This is the call that makes the
   *        session survive a refresh, so it fires after every answer — putting it
   *        behind the same permission as generation would mean a member who may
   *        answer questions needs permission to spend quota, and putting it on a
   *        `create` path would bill them once per question.
   *
   *        NOT_FOUND on a no-op so a client working against a session that was
   *        discarded in another tab is told, rather than silently answering into
   *        nothing for the rest of the flow.
   * WHERE: Called by the chat after each answer, and by the Refine bar.
   */
  saveProgress: protectedProcedure({
    requirePermission: permissions.CONTENT_PLAN_UPDATE,
  })
    .input(saveContentPlanProgressSchema.extend(withOrganization.shape))
    .mutation(async ({ ctx, input }) => {
      const { count } = await contentPlanService.saveContentPlanProgress(
        ctx.db,
        input.organizationId,
        ctx.user.id,
        input.answers,
      );
      if (count === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "That content plan session no longer exists.",
        });
      }
      return { saved: true };
    }),

  /**
   * SOURCE OF TRUTH KEYWORDS: contentPlan.create
   *
   * WHAT:  Generates the strategy, saves it, and returns the saved session.
   * WHY:   Named `create` (not `generate`) so the `<resource>.<verb>` convention
   *        fires the quota, counter, rate limit and audit wiring. The counter
   *        measures model spend, which is the thing that actually costs money —
   *        and that is precisely why the result is PERSISTED: the charge lands
   *        the moment the model answers, so without a row a refresh would destroy
   *        something the org has already paid for.
   *
   *        A Refine regeneration comes back through here and costs another unit.
   *        That is correct rather than harsh — it is a second model call of the
   *        same size — and it is what stops the Refine bar from being an
   *        unmetered "generate again" button.
   *
   *        The profile is read from the SESSION, never from the input. The client
   *        sends the answers because those are what the user just confirmed on
   *        screen, but the profile is the expensive, verified half and must come
   *        from what the server already stored.
   * WHERE: Called when the last question is answered, and by the Refine bar.
   */
  create: protectedProcedure({
    requirePermission: permissions.CONTENT_PLAN_CREATE,
    /* Ten structured sections over a whole profile — the slowest generation in
     * the app, and it runs inside the factory's mutation tx. Must exceed
     * CONTENT_PLAN_TIMEOUT_MS (90s) in ai.service.ts, or the transaction dies
     * before the SDK's own abort fires and a clean "generation timed out" turns
     * into an opaque Prisma error. Same relationship profileLookup.create keeps
     * with its vendor timeout. */
    txTimeout: 110_000,
  })
    .input(generateContentPlanSchema.extend(withOrganization.shape))
    .mutation(async ({ ctx, input }) => {
      /* Fail before any quota is spent: an unconfigured key is an operator
       * problem, and the user should not lose a plan to it. */
      assertAiConfigured("AI generation", "content plans");

      const session = await contentPlanService.readContentPlan(
        ctx.db,
        input.organizationId,
        ctx.user.id,
      );
      /* Both failures are the same to the user — there is nothing to build a
       * plan from — but they are checked separately because a session whose
       * profile failed to parse is a real state (an older payload shape) and
       * "start again from the URL" is the fix for both. */
      if (!session || !session.profile) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "Start by pasting your LinkedIn profile URL before generating a plan.",
        });
      }

      /* Read server-side for the same reason the profile is: hooks and ideas are
       * worded in a voice this member actually extracted, never one a caller
       * supplied. Null when none is active. */
      const voice = await voiceProfileService.readResolvedVoice(
        ctx.db,
        input.organizationId,
        ctx.user.id,
      );

      try {
        const result = await aiService.generateContentPlan(
          input.answers,
          session.profile,
          voice,
        );
        return await contentPlanService.recordContentPlan(ctx.db, {
          organizationId: input.organizationId,
          authorId: ctx.user.id,
          answers: input.answers,
          result,
        });
      } catch (error) {
        /* Provider overload, schema-validation failure, and a failed save all
         * land here — the classifier tells them apart so the chat can show an
         * accurate reason inline. Still a throw, because this is inside the
         * procedure transaction and the throw is what rolls the usage increment
         * back. The org is never billed a plan it cannot see. */
        throw toProcedureError(error, {
          context: "contentPlan.create",
          fallbackMessage: "Content plan generation failed. Please try again.",
          messages: {
            AI_OUTPUT_UNUSABLE:
              "The AI returned a plan we couldn't read. Try again, or narrow the brief.",
          },
        });
      }
    }),

  /**
   * SOURCE OF TRUTH KEYWORDS: contentPlan.save
   *
   * WHAT:  Marks a generated strategy as one the user chose to keep.
   * WHY:   The strategy is already on disk before this runs — it has to be, since
   *        the org paid for it. So Save records INTENT, nothing more, which is
   *        why it is an `update` and costs nothing. NOT_FOUND on a no-op catches
   *        the one case that matters: a Save arriving for a session with no
   *        result, which means the client and the server disagree about state.
   * WHERE: The Save button on the "Your Strategy is Ready" bar.
   */
  save: protectedProcedure({
    requirePermission: permissions.CONTENT_PLAN_UPDATE,
  })
    .input(withOrganization)
    .mutation(async ({ ctx, input }) => {
      const { count } = await contentPlanService.markContentPlanSaved(
        ctx.db,
        input.organizationId,
        ctx.user.id,
      );
      if (count === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "There is no generated plan to save.",
        });
      }
      return { saved: true };
    }),

  /**
   * SOURCE OF TRUTH KEYWORDS: contentPlan.discard
   *
   * WHAT:  Throws away this member's session so a new one can start.
   * WHY:   Named `discard` and NOT `delete`, deliberately. The counter wiring in
   *        protectedProcedure decrements on any `<resource>.delete` path, which
   *        is right for a quota counting things HELD and wrong for this one,
   *        which counts MODEL SPEND: the API call is already paid for, and
   *        dropping the row does not un-spend it. Under the `delete` name,
   *        generate → New → generate would be an unlimited free tier. Renaming
   *        the verb is the escape hatch the registry documents (see
   *        getMutationFeatureMap in src/lib/resources.ts) — it keeps both the
   *        server bump and the client optimistic map from firing, with no
   *        special-casing in the infrastructure layer.
   *
   *        Succeeds on a no-op, unlike the procedures above. "Start New" is
   *        reachable with no session open, and starting fresh when nothing exists
   *        has already achieved what the user asked for.
   * WHERE: The New / Start New buttons.
   */
  discard: protectedProcedure({
    requirePermission: permissions.CONTENT_PLAN_DISCARD,
  })
    .input(withOrganization)
    .mutation(async ({ ctx, input }) => {
      await contentPlanService.discardContentPlan(
        ctx.db,
        input.organizationId,
        ctx.user.id,
      );
      return { discarded: true };
    }),
});

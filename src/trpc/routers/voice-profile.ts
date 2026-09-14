/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: voiceProfileRouter, voiceProfile.get,
 *   voiceProfile.suggestSamples, voiceProfile.create, voiceProfile.update,
 *   voiceProfile.revert, voiceProfile.discard
 *
 * WHAT:  A member's writing voice: read it, get sample suggestions from their
 *        published posts, extract a voice, edit or switch it, undo the last
 *        extraction, or throw it away.
 * WHY:   Mounted as `voiceProfile` so every path matches the RESOURCES key, which
 *        is what auto-wires the extraction quota, the usage counter, the rate
 *        limit, the permission gate and the audit rows.
 *
 *        As in contentPlan, the verbs are split along what each one SPENDS:
 *        `create` is the only model call and the only thing metered; everything
 *        else edits a voice the org already paid for.
 * WHERE: Mounted in src/trpc/routers/_app; delegates to voice-profile.service,
 *        ai.service and linkedin.service. Consumed by the voice route and the
 *        composer's voice line.
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
  VOICE_SAMPLE_MAX_CHARS,
  VOICE_SAMPLE_MIN_CHARS,
  VOICE_SAMPLES_MAX,
  extractVoiceProfileSchema,
  updateVoiceProfileSchema,
  type VoiceSample,
} from "@/lib/types";
import {
  VOICE_EXTRACTION_TIMEOUT_MS,
  VOICE_EXTRACTOR_VERSION,
  VOICE_SUGGESTED_SAMPLES_LIMIT,
} from "@/lib/config";
import * as aiService from "@/services/ai.service";
import * as linkedinService from "@/services/linkedin.service";
import * as voiceProfileService from "@/services/voice-profile.service";

const withOrganization = z.object({ organizationId: z.string().min(1) });

export const voiceProfileRouter = createTRPCRouter({
  /**
   * SOURCE OF TRUTH KEYWORDS: voiceProfile.get
   *
   * WHAT:  This member's voice profile, or null.
   * WHY:   A query, so no counter and no audit. Gated on `read` so a member who
   *        can see their voice does not also need permission to buy a new one.
   * WHERE: The voice workspace on mount; the composer's voice line.
   */
  get: protectedProcedure({
    requirePermission: permissions.VOICE_PROFILE_READ,
  })
    .input(withOrganization)
    .query(async ({ ctx, input }) =>
      voiceProfileService.readVoiceProfile(
        ctx.db,
        input.organizationId,
        ctx.user.id,
      ),
    ),

  /**
   * SOURCE OF TRUTH KEYWORDS: voiceProfile.suggestSamples
   *
   * WHAT:  This member's recent published posts that are long enough to learn
   *        from, shaped as samples the form can add.
   * WHY:   A query on purpose: it creates nothing and spends nothing, and the
   *        path guardrail only governs mutations. Gated on `create` because the
   *        suggestions are only useful to someone allowed to extract.
   *
   *        These are suggestions the member ticks, never auto-included, so the
   *        samples stored on an extraction are always exactly what the model saw.
   *        Reuses listPublishedPosts rather than a second post query.
   * WHERE: "Add from my published posts" in the samples form.
   */
  suggestSamples: protectedProcedure({
    requirePermission: permissions.VOICE_PROFILE_CREATE,
  })
    .input(withOrganization)
    .query(async ({ ctx, input }): Promise<VoiceSample[]> => {
      const posts = await linkedinService.listPublishedPosts(
        ctx.db,
        input.organizationId,
        VOICE_SUGGESTED_SAMPLES_LIMIT,
        ctx.user.id,
      );

      return posts
        .map((post) => post.commentary.trim())
        .filter(
          (text) =>
            text.length >= VOICE_SAMPLE_MIN_CHARS &&
            text.length <= VOICE_SAMPLE_MAX_CHARS,
        )
        .slice(0, VOICE_SAMPLES_MAX)
        .map((text): VoiceSample => ({ text, source: "linkedinPost" }));
    }),

  /**
   * SOURCE OF TRUTH KEYWORDS: voiceProfile.create
   *
   * WHAT:  Extracts a voice from the submitted posts, stores it, and returns the
   *        saved profile.
   * WHY:   Named `create` so the `<resource>.<verb>` convention fires the quota,
   *        counter, rate limit and audit wiring. A re-extraction comes back
   *        through here and costs another unit: it is a fresh model call of the
   *        same size.
   *
   *        The model call and the write share the procedure's transaction, so a
   *        failed write or an unusable model response rolls the usage increment
   *        back. The org is never billed for a voice it cannot see.
   * WHERE: The Extract button in the samples form.
   */
  create: protectedProcedure({
    requirePermission: permissions.VOICE_PROFILE_CREATE,
    /* The model call runs inside the factory's mutation tx. Must exceed
     * VOICE_EXTRACTION_TIMEOUT_MS so the SDK's own abort fires first and the
     * member gets a legible "timed out" instead of an opaque Prisma error. */
    txTimeout: VOICE_EXTRACTION_TIMEOUT_MS + 20_000,
  })
    .input(extractVoiceProfileSchema.extend(withOrganization.shape))
    .mutation(async ({ ctx, input }) => {
      /* Fail before the quota is spent: an unconfigured key is an operator
       * problem, and the member should not lose an extraction to it. */
      assertAiConfigured("AI generation", "voice extraction");

      try {
        const descriptor = await aiService.extractVoiceProfile(input.samples);
        return await voiceProfileService.recordVoiceExtraction(ctx.db, {
          organizationId: input.organizationId,
          authorId: ctx.user.id,
          extraction: {
            samples: input.samples,
            descriptor,
            extractorVersion: VOICE_EXTRACTOR_VERSION,
            extractedAt: new Date().toISOString(),
          },
        });
      } catch (error) {
        /* Still a throw, because it is what rolls the usage increment back. */
        throw toProcedureError(error, {
          context: "voiceProfile.create",
          fallbackMessage: "Voice extraction failed. Please try again.",
          messages: {
            AI_OUTPUT_UNUSABLE:
              "The AI couldn't describe a voice from these posts. Try again, or add longer posts.",
          },
        });
      }
    }),

  /**
   * SOURCE OF TRUTH KEYWORDS: voiceProfile.update
   *
   * WHAT:  Saves the member's overrides, or switches the voice on or off.
   * WHY:   Two edits on one verb because both buy nothing, and the verb IS the
   *        permission, quota and audit key. The discriminated input keeps them
   *        distinct, and `{input.field}` puts which edit happened in the audit
   *        line. The union cannot be `.extend()`ed, so the org is attached with
   *        `.and()`, as aiGeneration.create does.
   *
   *        NOT_FOUND when there is no profile, so a stale tab editing a discarded
   *        voice is told rather than silently saving into nothing.
   * WHERE: The overrides form's Save; the "Use in drafts" switch.
   */
  update: protectedProcedure({
    requirePermission: permissions.VOICE_PROFILE_UPDATE,
  })
    .input(updateVoiceProfileSchema.and(withOrganization))
    .mutation(async ({ ctx, input }) => {
      const { count } =
        input.field === "overrides"
          ? await voiceProfileService.writeVoiceOverrides(
              ctx.db,
              input.organizationId,
              ctx.user.id,
              input.overrides,
            )
          : await voiceProfileService.setVoiceActive(
              ctx.db,
              input.organizationId,
              ctx.user.id,
              input.isActive,
            );

      if (count === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Extract your voice before editing it.",
        });
      }
      return { updated: true };
    }),

  /**
   * SOURCE OF TRUTH KEYWORDS: voiceProfile.revert
   *
   * WHAT:  Goes back to the previous extraction, and returns the saved profile.
   * WHY:   Its own verb, not `update`, because it changes what the generators read
   *        without a model call and deserves its own audit line. Throws when there
   *        is nothing to go back to: the throw rolls back the audit row, which
   *        would otherwise record a revert that never happened.
   * WHERE: The Revert button on the voice card.
   */
  revert: protectedProcedure({
    requirePermission: permissions.VOICE_PROFILE_REVERT,
  })
    .input(withOrganization)
    .mutation(async ({ ctx, input }) => {
      const reverted = await voiceProfileService.revertVoiceProfile(
        ctx.db,
        input.organizationId,
        ctx.user.id,
      );
      if (!reverted) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "There is no previous voice to go back to.",
        });
      }
      return reverted;
    }),

  /**
   * SOURCE OF TRUTH KEYWORDS: voiceProfile.discard
   *
   * WHAT:  Throws this member's voice away.
   * WHY:   Named `discard` and NOT `delete`, deliberately: the factory refunds a
   *        quota slot on any `<resource>.delete`, and this counter measures model
   *        spend. Under `delete`, extract → remove → extract would be free.
   *        Succeeds on a no-op, like contentPlan.discard.
   * WHERE: The Discard action on the voice card.
   */
  discard: protectedProcedure({
    requirePermission: permissions.VOICE_PROFILE_DISCARD,
  })
    .input(withOrganization)
    .mutation(async ({ ctx, input }) => {
      await voiceProfileService.discardVoiceProfile(
        ctx.db,
        input.organizationId,
        ctx.user.id,
      );
      return { discarded: true };
    }),
});

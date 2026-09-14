/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: aiGenerationRouter
 *
 * WHAT:  Turns a topic or blog URL into LinkedIn post copy, written in the
 *        member's own voice when they have one active.
 * WHY:   Mounted as `aiGeneration` so the path `aiGeneration.create` matches the
 *        RESOURCES key — that is what auto-wires the per-plan generation quota,
 *        the usage counter, the rate limit, and the permission gate. Kept
 *        separate from `linkedinPosts` on purpose: drafting is metered on its
 *        own budget because a user burns generations iterating on copy without
 *        ever publishing. txTimeout is raised on create because the model call
 *        happens inside the factory's tx and outlives the 10s default.
 * WHERE: Mounted in src/trpc/routers/_app; delegates to
 *        src/services/ai.service.ts and reads the voice through
 *        voice-profile.service.ts. Consumed by the composer's Generate button.
 */

import { z } from "zod";

import {
  assertAiConfigured,
  createTRPCRouter,
  toProcedureError,
} from "../init";
import { protectedProcedure } from "../procedures";
import { permissions } from "@/lib/better-auth/permissions";
import { generatePostSchema } from "@/lib/types";
import * as aiService from "@/services/ai.service";
import * as voiceProfileService from "@/services/voice-profile.service";

export const aiGenerationRouter = createTRPCRouter({
  /**
   * SOURCE OF TRUTH KEYWORDS: aiGeneration.create
   *
   * WHAT:  Generates post copy and returns it un-persisted.
   * WHY:   Named `create` (not `generate`) so the `<resource>.<verb>` convention
   *        fires the quota and counter wiring in protectedProcedure. Nothing is
   *        written to the database — the draft lives in the composer until the
   *        user publishes, so the counter measures model spend, which is the
   *        thing that actually costs money.
   * WHERE: Called by the composer form, and by the content plan's "Draft this".
   */
  create: protectedProcedure({
    requirePermission: permissions.AI_GENERATION_CREATE,
    /* The model call runs inside the factory's mutation tx, so the tx stays open
     * for the full round trip. The 10s default expires mid-generation and the
     * usage bump then fails on a closed tx. Sized for the blog path, which adds
     * web-fetch round trips on top of generation. */
    txTimeout: 60_000,
  })
    .input(
      generatePostSchema.and(z.object({ organizationId: z.string().min(1) })),
    )
    .mutation(async ({ ctx, input }) => {
      /* Fail before the quota is spent: an unconfigured key is an operator
       * problem, and the user shouldn't lose a generation to it. */
      assertAiConfigured();

      /* Read server-side, never accepted as input, so a caller cannot hand the
       * model a voice this member never extracted. Null when none is active,
       * which keeps the default house style. */
      const voice = await voiceProfileService.readResolvedVoice(
        ctx.db,
        input.organizationId,
        ctx.user.id,
      );

      try {
        return await aiService.generateLinkedInPost(input, voice);
      } catch (error) {
        /* Provider and validation failures both surface here. The classifier
         * decides which of the two it was and gives the composer a reason it can
         * render inline — previously this handed the composer the provider's own
         * message, which is how model IDs and quota numbers reached the UI. */
        throw toProcedureError(error, {
          context: "aiGeneration.create",
          fallbackMessage: "Post generation failed. Please try again.",
          messages: {
            AI_OUTPUT_UNUSABLE:
              "The AI returned a post we couldn't use. Try again, or rephrase your topic.",
          },
        });
      }
    }),
});

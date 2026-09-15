/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: ideaAnglesRouter, ideaAngles.create, expand idea,
 *   idea angles
 *
 * WHAT:  Expands one of the member's saved ideas into specific post angles.
 * WHY:   Mounted as `ideaAngles` so `ideaAngles.create` matches the RESOURCES key,
 *        which wires the expansion allowance, rate limit, permission and audit
 *        row. The idea is read on the server by id, scoped to the caller, so an
 *        expansion can only ever be of their own idea. Nothing is stored: the
 *        member chooses what to keep from the dialog.
 * WHERE: Mounted in src/trpc/routers/_app; reads through post-ideas.service and
 *        voice-profile.service, and calls ai.service. Consumed by the Ideas page.
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
import { expandPostIdeaSchema } from "@/lib/types";
import * as aiService from "@/services/ai.service";
import * as postIdeasService from "@/services/post-ideas.service";
import * as voiceProfileService from "@/services/voice-profile.service";

const withOrganization = z.object({ organizationId: z.string().min(1) });

export const ideaAnglesRouter = createTRPCRouter({
  create: protectedProcedure({
    requirePermission: permissions.IDEA_ANGLES_CREATE,
    /* The model call runs inside the factory's transaction; the 10s default
     * would expire mid-call. */
    txTimeout: 60_000,
  })
    .input(expandPostIdeaSchema.extend(withOrganization.shape))
    .mutation(async ({ ctx, input }) => {
      /* Fail before the allowance is spent: a missing key is an operator
       * problem. */
      assertAiConfigured("AI generation", "idea angles");

      const idea = await postIdeasService.getPostIdea(
        ctx.db,
        input.organizationId,
        ctx.user.id,
        input.id,
      );
      if (!idea) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "That idea no longer exists.",
        });
      }

      const voice = await voiceProfileService.readResolvedVoice(
        ctx.db,
        input.organizationId,
        ctx.user.id,
      );

      try {
        return await aiService.expandPostIdea(idea.text, voice);
      } catch (error) {
        /* Still a throw, so the expansion is not charged. */
        throw toProcedureError(error, {
          context: "ideaAngles.create",
          fallbackMessage: "Couldn't expand that idea. Please try again.",
          messages: {
            AI_OUTPUT_UNUSABLE:
              "The AI returned angles we couldn't use. Try again, or add a little more to the idea.",
          },
        });
      }
    }),
});

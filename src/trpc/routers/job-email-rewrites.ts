/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: jobEmailRewritesRouter, jobEmailRewrites.create,
 *   rewrite job email, shorter, more formal, different angle, new subject
 *
 * WHAT:  Revises a Job Assist draft on one instruction and returns the updated
 *        subject, body and LinkedIn message.
 * WHY:   Its own RESOURCES key with its own, larger allowance (decided
 *        2026-09-15), so polishing a draft never uses up the member's email
 *        allowance. Mounted as `jobEmailRewrites` so `jobEmailRewrites.create`
 *        auto-wires that quota, the counter, rate limit and audit row.
 *
 *        The merge is decided here: "New subject" replaces only the subject, and
 *        every other rewrite keeps the subject the member already has. The
 *        sign-off is never sent to the model at all, so no rewrite can touch it.
 * WHERE: Mounted in src/trpc/routers/_app; consumed by the rewrite buttons in the
 *        Job Assist result editor.
 */

import { z } from "zod";

import {
  assertAiConfigured,
  createTRPCRouter,
  toProcedureError,
} from "../init";
import { protectedProcedure } from "../procedures";
import { permissions } from "@/lib/better-auth/permissions";
import { rewriteJobEmailSchema } from "@/lib/types";
import * as aiService from "@/services/ai.service";
import * as candidateProfileService from "@/services/candidate-profile.service";
import * as voiceProfileService from "@/services/voice-profile.service";

const withOrganization = z.object({ organizationId: z.string().min(1) });

export const jobEmailRewritesRouter = createTRPCRouter({
  /**
   * SOURCE OF TRUTH KEYWORDS: jobEmailRewrites.create
   *
   * WHAT:  One rewrite of the member's current draft.
   * WHY:   Named `create` so the rewrite allowance is checked and spent. A failed
   *        rewrite throws, which rolls the unit back.
   * WHERE: The Shorter / More formal / Different angle / New subject buttons.
   */
  create: protectedProcedure({
    requirePermission: permissions.JOB_EMAIL_REWRITES_CREATE,
    /* Must exceed JOB_EMAIL_TIMEOUT_MS, as on jobEmails.create. */
    txTimeout: 60_000,
  })
    .input(rewriteJobEmailSchema.extend(withOrganization.shape))
    .mutation(async ({ ctx, input }) => {
      assertAiConfigured("AI generation", "email rewrites");

      const voice = await voiceProfileService.readResolvedVoice(
        ctx.db,
        input.organizationId,
        ctx.user.id,
      );
      const profile = await candidateProfileService.readCandidateProfile(
        ctx.db,
        input.organizationId,
        ctx.user.id,
      );

      try {
        const rewritten = await aiService.rewriteJobEmail(input, profile, voice);

        return input.instruction === "newSubject"
          ? {
              instruction: input.instruction,
              subject: rewritten.subject,
              body: input.body,
              linkedinMessage: input.linkedinMessage,
            }
          : {
              instruction: input.instruction,
              subject: input.subject,
              body: rewritten.body,
              linkedinMessage: rewritten.linkedinMessage,
            };
      } catch (error) {
        throw toProcedureError(error, {
          context: "jobEmailRewrites.create",
          fallbackMessage: "The rewrite didn't work. Please try again.",
          messages: {
            AI_OUTPUT_UNUSABLE:
              "The AI returned a rewrite we couldn't use. Try again.",
          },
        });
      }
    }),
});

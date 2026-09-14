/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: jobEmailsRouter, jobEmails.create, job email
 *   writer, hiring post email, match check, sign-off
 *
 * WHAT:  Turns a pasted hiring post into a subject, an email, a sign-off, a
 *        LinkedIn message and a match check, returned without being stored.
 * WHY:   Mounted as `jobEmails` so `jobEmails.create` matches the RESOURCES key,
 *        which auto-wires the quota, usage counter, rate limit, permission gate
 *        and audit row. Nothing is persisted, the aiGeneration precedent: the
 *        draft lives on screen until the member sends it from their own mail
 *        client, so the counter measures model spend.
 * WHERE: Mounted in src/trpc/routers/_app; delegates to ai.service and reads the
 *        voice and saved profile through their services. Consumed by the Job
 *        Assist page.
 */

import { z } from "zod";

import {
  assertAiConfigured,
  createTRPCRouter,
  toProcedureError,
} from "../init";
import { protectedProcedure } from "../procedures";
import { permissions } from "@/lib/better-auth/permissions";
import { buildJobEmailSignature } from "@/lib/config";
import { generateJobEmailSchema, jobEmailRecipientSchema } from "@/lib/types";
import * as aiService from "@/services/ai.service";
import * as candidateProfileService from "@/services/candidate-profile.service";
import * as voiceProfileService from "@/services/voice-profile.service";

const withOrganization = z.object({ organizationId: z.string().min(1) });

export const jobEmailsRouter = createTRPCRouter({
  /**
   * SOURCE OF TRUTH KEYWORDS: jobEmails.create
   *
   * WHAT:  Writes one job email, its LinkedIn message and match check, and seeds
   *        the sign-off from the member's saved details.
   * WHY:   Named `create` so the `<resource>.<verb>` convention fires the quota.
   *        The voice and the saved profile are read on the server, never taken
   *        from the input, so the facts in an email are always the member's own.
   *        A recipient the member typed always wins over one the model read off
   *        the post, and a model-read address is kept only if it is a real one.
   * WHERE: The Write my email button on the Job Assist form.
   */
  create: protectedProcedure({
    requirePermission: permissions.JOB_EMAILS_CREATE,
    /* The model call runs inside the factory's transaction; must exceed
     * JOB_EMAIL_TIMEOUT_MS so the SDK's own timeout fires first. */
    txTimeout: 60_000,
  })
    .input(generateJobEmailSchema.extend(withOrganization.shape))
    .mutation(async ({ ctx, input }) => {
      /* Fail before the quota is spent: an unconfigured key is an operator
       * problem, and the member should not lose an email to it. */
      assertAiConfigured("AI generation", "job emails");

      /* Sequential, not Promise.all: both read through the same transaction
       * client, which runs one query at a time. */
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
        const email = await aiService.generateJobEmail(
          input,
          profile,
          profile?.fullName || ctx.user.name,
          voice,
        );
        const extracted = jobEmailRecipientSchema.safeParse(email.recipientEmail);

        return {
          company: email.company,
          role: email.role,
          contactName: email.contactName,
          recipientEmail:
            input.recipientEmail || (extracted.success ? extracted.data : ""),
          matchedRequirements: email.matchedRequirements,
          missingRequirements: email.missingRequirements,
          subject: email.subject,
          body: email.body,
          signature: buildJobEmailSignature(profile, ctx.user.name),
          linkedinMessage: email.linkedinMessage,
        };
      } catch (error) {
        /* Still a throw, because it rolls the usage increment back. */
        throw toProcedureError(error, {
          context: "jobEmails.create",
          fallbackMessage: "The email couldn't be written. Please try again.",
          messages: {
            AI_OUTPUT_UNUSABLE:
              "The AI returned an email we couldn't use. Try again, or paste more of the post.",
          },
        });
      }
    }),
});

/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: jobEmailsRouter, jobEmails.create, job email
 *   writer, hiring post email
 *
 * WHAT:  Turns a pasted hiring post into a subject, an email and a LinkedIn
 *        message the member can send, returned without being stored.
 * WHY:   Mounted as `jobEmails` so `jobEmails.create` matches the RESOURCES key,
 *        which auto-wires the quota, usage counter, rate limit, permission gate
 *        and audit row. Nothing is persisted, the aiGeneration precedent: the
 *        draft lives on screen until the member sends it from their own mail
 *        client, so the counter measures model spend, which is what costs money.
 * WHERE: Mounted in src/trpc/routers/_app; delegates to ai.service and reads the
 *        voice through voice-profile.service. Consumed by the Job Assist page.
 */

import { z } from "zod";

import {
  assertAiConfigured,
  createTRPCRouter,
  toProcedureError,
} from "../init";
import { protectedProcedure } from "../procedures";
import { permissions } from "@/lib/better-auth/permissions";
import { generateJobEmailSchema, jobEmailRecipientSchema } from "@/lib/types";
import * as aiService from "@/services/ai.service";
import * as voiceProfileService from "@/services/voice-profile.service";

const withOrganization = z.object({ organizationId: z.string().min(1) });

export const jobEmailsRouter = createTRPCRouter({
  /**
   * SOURCE OF TRUTH KEYWORDS: jobEmails.create
   *
   * WHAT:  Writes one job email and LinkedIn message.
   * WHY:   Named `create` so the `<resource>.<verb>` convention fires the quota.
   *        A recipient the member typed always wins over one the model read off
   *        the post, and an address from the model is kept only if it is a real
   *        address, because a model can return something that merely looks like
   *        one.
   * WHERE: The Generate button on the Job Assist form.
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

      /* Read server-side, never accepted as input. Null when none is active. */
      const voice = await voiceProfileService.readResolvedVoice(
        ctx.db,
        input.organizationId,
        ctx.user.id,
      );

      try {
        const email = await aiService.generateJobEmail(
          input,
          ctx.user.name,
          voice,
        );
        const extracted = jobEmailRecipientSchema.safeParse(email.recipientEmail);

        return {
          company: email.company,
          role: email.role,
          recipientEmail:
            input.recipientEmail || (extracted.success ? extracted.data : ""),
          subject: email.subject,
          body: email.body,
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

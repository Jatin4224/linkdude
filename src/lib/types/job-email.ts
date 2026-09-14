/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: job email, Job Assist, generateJobEmailSchema,
 *   GenerateJobEmailValues, generatedJobEmailSchema, GeneratedJobEmail,
 *   jobEmailDraftSchema, JobEmailDraftValues, jobEmailRecipientSchema,
 *   DEFAULT_JOB_EMAIL_REQUEST, hiring post, recruiter email
 *
 * WHAT:  Contracts for the job email writer: what the member submits, what the
 *        model returns, and the editable draft they send.
 * WHY:   Three schemas because the three shapes genuinely differ. The request
 *        carries the raw post and the member's facts; the model's output adds
 *        the company and role it read off the post; the draft is only what goes
 *        into an email client, validated again because the member edits it.
 *
 *        `recipientEmail` is "" or a real address, never anything in between, so
 *        a half-typed address can never reach Gmail's compose window.
 * WHERE: Router input for jobEmails.create; consumed by ai.service.ts and the
 *        Job Assist route components.
 */

import { z } from "zod";

/**
 * SOURCE OF TRUTH KEYWORDS: JOB_POST_MIN, JOB_POST_MAX, JOB_HIGHLIGHTS_MAX,
 *   JOB_EMAIL_SUBJECT_MAX, JOB_EMAIL_BODY_MAX, JOB_LINKEDIN_MESSAGE_MAX,
 *   JOB_COMPANY_MAX, JOB_ROLE_MAX
 *
 * WHAT:  Ceilings for every field.
 * WHY:   The post and facts are interpolated into the prompt, so unbounded input
 *        is spend. The output ceilings keep the email short enough that a
 *        recruiter reads it, with headroom so a slightly long draft is never
 *        thrown away after it was paid for.
 */
export const JOB_POST_MIN = 40;
export const JOB_POST_MAX = 6000;
export const JOB_HIGHLIGHTS_MAX = 1000;
export const JOB_EMAIL_SUBJECT_MAX = 150;
export const JOB_EMAIL_BODY_MAX = 2500;
export const JOB_LINKEDIN_MESSAGE_MAX = 600;
export const JOB_COMPANY_MAX = 120;
export const JOB_ROLE_MAX = 120;

/**
 * SOURCE OF TRUTH KEYWORDS: jobEmailRecipientSchema
 *
 * WHAT:  An empty string or a valid email address, whitespace trimmed.
 * WHERE: The request, the draft, and the router's check on an address the model
 *        read off the post.
 */
export const jobEmailRecipientSchema = z
  .string()
  .trim()
  .pipe(z.union([z.literal(""), z.email("Enter a valid email address")]));

/**
 * SOURCE OF TRUTH KEYWORDS: generateJobEmailSchema, GenerateJobEmailValues,
 *   DEFAULT_JOB_EMAIL_REQUEST
 *
 * WHAT:  What the member submits: the hiring post, a few true facts about
 *        themselves, and optionally the recruiter's address.
 * WHY:   The facts field is what stops the email being generic or invented.
 *        Without it the model has nothing true to say about the member, so the
 *        prompt turns every missing specific into a marked placeholder instead.
 * WHERE: Router input for jobEmails.create; resolver for the Job Assist form.
 */
export const generateJobEmailSchema = z.object({
  jobPost: z
    .string()
    .trim()
    .min(JOB_POST_MIN, `Paste the full post, at least ${JOB_POST_MIN} characters`)
    .max(JOB_POST_MAX, `Keep the post under ${JOB_POST_MAX} characters`),
  highlights: z
    .string()
    .trim()
    .max(JOB_HIGHLIGHTS_MAX, `Keep this under ${JOB_HIGHLIGHTS_MAX} characters`),
  recipientEmail: jobEmailRecipientSchema,
});
export type GenerateJobEmailValues = z.infer<typeof generateJobEmailSchema>;

export const DEFAULT_JOB_EMAIL_REQUEST: GenerateJobEmailValues = {
  jobPost: "",
  highlights: "",
  recipientEmail: "",
};

/**
 * SOURCE OF TRUTH KEYWORDS: generatedJobEmailSchema, GeneratedJobEmail
 *
 * WHAT:  What the model returns.
 * WHY:   Doubles as the structured-output contract and the validation boundary.
 *        Company, role and recipient are empty strings when the post does not
 *        say, never guesses. The recipient is re-checked by the router, because
 *        a model can still return something that only looks like an address.
 * WHERE: Returned by aiService.generateJobEmail.
 */
export const generatedJobEmailSchema = z.object({
  company: z.string().max(JOB_COMPANY_MAX),
  role: z.string().max(JOB_ROLE_MAX),
  recipientEmail: z.string().max(254),
  subject: z.string().min(1).max(JOB_EMAIL_SUBJECT_MAX),
  body: z.string().min(1).max(JOB_EMAIL_BODY_MAX),
  linkedinMessage: z.string().min(1).max(JOB_LINKEDIN_MESSAGE_MAX),
});
export type GeneratedJobEmail = z.infer<typeof generatedJobEmailSchema>;

/**
 * SOURCE OF TRUTH KEYWORDS: jobEmailDraftSchema, JobEmailDraftValues
 *
 * WHAT:  The editable draft: recipient, subject, body and LinkedIn message.
 * WHY:   The member edits before sending, so what reaches the email client is
 *        validated again rather than trusted because the model produced it.
 * WHERE: Resolver for the Job Assist result editor; the email link builders.
 */
export const jobEmailDraftSchema = z.object({
  recipientEmail: jobEmailRecipientSchema,
  subject: z
    .string()
    .trim()
    .min(1, "Add a subject")
    .max(JOB_EMAIL_SUBJECT_MAX, `Keep the subject under ${JOB_EMAIL_SUBJECT_MAX} characters`),
  body: z
    .string()
    .trim()
    .min(1, "The email is empty")
    .max(JOB_EMAIL_BODY_MAX, `Keep the email under ${JOB_EMAIL_BODY_MAX} characters`),
  linkedinMessage: z
    .string()
    .trim()
    .max(
      JOB_LINKEDIN_MESSAGE_MAX,
      `Keep the message under ${JOB_LINKEDIN_MESSAGE_MAX} characters`,
    ),
});
export type JobEmailDraftValues = z.infer<typeof jobEmailDraftSchema>;

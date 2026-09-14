/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: job email, Job Assist, generateJobEmailSchema,
 *   GenerateJobEmailValues, generatedJobEmailSchema, GeneratedJobEmail,
 *   jobEmailDraftSchema, JobEmailDraftValues, jobEmailRecipientSchema,
 *   candidateProfileSchema, CandidateProfileValues, rewriteJobEmailSchema,
 *   JOB_EMAIL_REWRITE_INSTRUCTIONS, match check, hiring post, recruiter email
 *
 * WHAT:  Contracts for Job Assist: the member's saved details, what they submit
 *        for one job, what the model returns, the editable draft they send, and
 *        a rewrite of that draft.
 * WHY:   Separate schemas because the shapes genuinely differ. The saved profile
 *        is written once and reused; the request carries one job; the model's
 *        output adds what it read off the post and how well the member matches
 *        it; the draft is only what reaches an email client, validated again
 *        because the member edits it.
 *
 *        Every "optional" text field is a string that may be empty, never
 *        undefined, so forms always hold a concrete value.
 * WHERE: Router inputs for jobEmails, jobEmailRewrites and candidateProfile;
 *        consumed by ai.service.ts, candidate-profile.service.ts and the Job
 *        Assist route components.
 */

import { z } from "zod";

/**
 * SOURCE OF TRUTH KEYWORDS: JOB_POST_MIN, JOB_POST_MAX, JOB_HIGHLIGHTS_MAX,
 *   JOB_EMAIL_SUBJECT_MAX, JOB_EMAIL_BODY_MAX, JOB_EMAIL_SIGNATURE_MAX,
 *   JOB_LINKEDIN_MESSAGE_MAX, JOB_COMPANY_MAX, JOB_ROLE_MAX,
 *   JOB_CONTACT_NAME_MAX, JOB_REQUIREMENT_MAX, JOB_REQUIREMENTS_MAX
 *
 * WHAT:  Ceilings for every Job Assist field.
 * WHY:   Inputs are interpolated into prompts, so unbounded input is spend.
 *        Output ceilings keep an email short enough to be read, with headroom so
 *        a slightly long draft is never thrown away after it was paid for.
 */
export const JOB_POST_MIN = 40;
export const JOB_POST_MAX = 6000;
export const JOB_HIGHLIGHTS_MAX = 1000;
export const JOB_EMAIL_SUBJECT_MAX = 150;
export const JOB_EMAIL_BODY_MAX = 2500;
export const JOB_EMAIL_SIGNATURE_MAX = 600;
export const JOB_LINKEDIN_MESSAGE_MAX = 600;
export const JOB_COMPANY_MAX = 120;
export const JOB_ROLE_MAX = 120;
export const JOB_CONTACT_NAME_MAX = 80;
export const JOB_REQUIREMENT_MAX = 80;
export const JOB_REQUIREMENTS_MAX = 10;

/**
 * SOURCE OF TRUTH KEYWORDS: CANDIDATE_NAME_MAX, CANDIDATE_TEXT_MAX,
 *   CANDIDATE_SKILLS_MAX, CANDIDATE_EXPERIENCE_MAX, CANDIDATE_EDUCATION_MAX,
 *   CANDIDATE_URL_MAX, CANDIDATE_PHONE_MAX
 *
 * WHAT:  Ceilings for the saved "About me" details.
 */
export const CANDIDATE_NAME_MAX = 120;
export const CANDIDATE_TEXT_MAX = 160;
export const CANDIDATE_SKILLS_MAX = 600;
export const CANDIDATE_EXPERIENCE_MAX = 2500;
export const CANDIDATE_EDUCATION_MAX = 400;
export const CANDIDATE_URL_MAX = 300;
export const CANDIDATE_PHONE_MAX = 30;

/* A trimmed string that may be empty, capped with a readable message. */
function boundedText(max: number) {
  return z.string().trim().max(max, `Keep this under ${max} characters`);
}

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
 * SOURCE OF TRUTH KEYWORDS: optionalWebLinkSchema
 *
 * WHAT:  An empty string or a full http(s) link.
 * WHY:   These links are printed into a sign-off a recruiter clicks, so only web
 *        links are accepted, never another URL scheme.
 */
export const optionalWebLinkSchema = z
  .string()
  .trim()
  .max(CANDIDATE_URL_MAX, `Keep the link under ${CANDIDATE_URL_MAX} characters`)
  .pipe(
    z.union([
      z.literal(""),
      z.url({
        protocol: /^https?$/,
        error: "Enter a full link starting with https://",
      }),
    ]),
  );

/**
 * SOURCE OF TRUTH KEYWORDS: candidateProfileSchema, CandidateProfileValues,
 *   DEFAULT_CANDIDATE_PROFILE, About me
 *
 * WHAT:  The member's saved details, written once and used in every job email.
 * WHY:   Retyping the same facts for every application was the biggest friction
 *        in v1. The writing fields (headline, skills, experience, education,
 *        location, availability) are what the model reads; the contact fields
 *        (links, phone) only ever go into the sign-off, which the app builds
 *        itself, so the model can never invent a link or a number.
 *
 *        The phone is stored but printed only when `includePhone` is on: a phone
 *        number in every cold email is a choice, not a default.
 * WHERE: Router input for candidateProfile.update; resolver for the About me
 *        card; read by jobEmails.create and jobEmailRewrites.create.
 */
export const candidateProfileSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(1, "Enter your name")
    .max(CANDIDATE_NAME_MAX, `Keep your name under ${CANDIDATE_NAME_MAX} characters`),
  headline: boundedText(CANDIDATE_TEXT_MAX),
  skills: boundedText(CANDIDATE_SKILLS_MAX),
  experience: boundedText(CANDIDATE_EXPERIENCE_MAX),
  education: boundedText(CANDIDATE_EDUCATION_MAX),
  location: boundedText(CANDIDATE_TEXT_MAX),
  availability: boundedText(CANDIDATE_TEXT_MAX),
  linkedinUrl: optionalWebLinkSchema,
  portfolioUrl: optionalWebLinkSchema,
  githubUrl: optionalWebLinkSchema,
  phone: z
    .string()
    .trim()
    .max(CANDIDATE_PHONE_MAX, `Keep the number under ${CANDIDATE_PHONE_MAX} characters`)
    .regex(/^[+\d\s().-]*$/, "Use digits, spaces, +, ( ) and - only"),
  includePhone: z.boolean(),
});
export type CandidateProfileValues = z.infer<typeof candidateProfileSchema>;

export const DEFAULT_CANDIDATE_PROFILE: CandidateProfileValues = {
  fullName: "",
  headline: "",
  skills: "",
  experience: "",
  education: "",
  location: "",
  availability: "",
  linkedinUrl: "",
  portfolioUrl: "",
  githubUrl: "",
  phone: "",
  includePhone: false,
};

/**
 * SOURCE OF TRUTH KEYWORDS: generateJobEmailSchema, GenerateJobEmailValues,
 *   DEFAULT_JOB_EMAIL_REQUEST
 *
 * WHAT:  What the member submits for one job: the hiring post, optional company
 *        and role for posts that don't say, notes specific to this job, and
 *        optionally the recruiter's address.
 * WHY:   `highlights` stays alongside the saved profile for facts that only
 *        matter to one job ("I used their product last year").
 * WHERE: Router input for jobEmails.create; resolver for the Job Assist form.
 */
export const generateJobEmailSchema = z.object({
  jobPost: z
    .string()
    .trim()
    .min(JOB_POST_MIN, `Paste the full post, at least ${JOB_POST_MIN} characters`)
    .max(JOB_POST_MAX, `Keep the post under ${JOB_POST_MAX} characters`),
  company: boundedText(JOB_COMPANY_MAX),
  role: boundedText(JOB_ROLE_MAX),
  highlights: boundedText(JOB_HIGHLIGHTS_MAX),
  recipientEmail: jobEmailRecipientSchema,
});
export type GenerateJobEmailValues = z.infer<typeof generateJobEmailSchema>;

export const DEFAULT_JOB_EMAIL_REQUEST: GenerateJobEmailValues = {
  jobPost: "",
  company: "",
  role: "",
  highlights: "",
  recipientEmail: "",
};

/**
 * SOURCE OF TRUTH KEYWORDS: generatedJobEmailSchema, GeneratedJobEmail,
 *   matchedRequirements, missingRequirements
 *
 * WHAT:  What the model returns: what it read off the post (company, role, the
 *        person hiring, their address), the match check, and the drafts.
 * WHY:   The match check rides in the same call, so it costs nothing extra.
 *        Everything read off the post is an empty string or empty list when the
 *        post doesn't say, never a guess. The body carries no sign-off: the app
 *        builds that separately from the saved profile.
 * WHERE: Returned by aiService.generateJobEmail.
 */
export const generatedJobEmailSchema = z.object({
  company: z.string().max(JOB_COMPANY_MAX),
  role: z.string().max(JOB_ROLE_MAX),
  contactName: z.string().max(JOB_CONTACT_NAME_MAX),
  recipientEmail: z.string().max(254),
  matchedRequirements: z
    .array(z.string().min(1).max(JOB_REQUIREMENT_MAX))
    .max(JOB_REQUIREMENTS_MAX),
  missingRequirements: z
    .array(z.string().min(1).max(JOB_REQUIREMENT_MAX))
    .max(JOB_REQUIREMENTS_MAX),
  subject: z.string().min(1).max(JOB_EMAIL_SUBJECT_MAX),
  body: z.string().min(1).max(JOB_EMAIL_BODY_MAX),
  linkedinMessage: z.string().min(1).max(JOB_LINKEDIN_MESSAGE_MAX),
});
export type GeneratedJobEmail = z.infer<typeof generatedJobEmailSchema>;

/**
 * SOURCE OF TRUTH KEYWORDS: jobEmailDraftSchema, JobEmailDraftValues
 *
 * WHAT:  The editable draft: recipient, subject, body, sign-off and LinkedIn
 *        message.
 * WHY:   The sign-off is its own field so a rewrite can never touch the member's
 *        contact details, and so they can adjust it per email.
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
  signature: boundedText(JOB_EMAIL_SIGNATURE_MAX),
  linkedinMessage: z
    .string()
    .trim()
    .max(
      JOB_LINKEDIN_MESSAGE_MAX,
      `Keep the message under ${JOB_LINKEDIN_MESSAGE_MAX} characters`,
    ),
});
export type JobEmailDraftValues = z.infer<typeof jobEmailDraftSchema>;

/**
 * SOURCE OF TRUTH KEYWORDS: JOB_EMAIL_REWRITE_INSTRUCTIONS,
 *   JobEmailRewriteInstruction, jobEmailRewriteInstructionSchema
 *
 * WHAT:  The one-click rewrites a draft offers.
 * WHY:   A closed set, so the prompt gives the model a precise directive per
 *        value instead of passing free text through.
 * WHERE: rewriteJobEmailSchema; JOB_EMAIL_REWRITE_LABELS; the result editor.
 */
export const JOB_EMAIL_REWRITE_INSTRUCTIONS = [
  "shorter",
  "moreFormal",
  "differentAngle",
  "newSubject",
] as const;
export const jobEmailRewriteInstructionSchema = z.enum(
  JOB_EMAIL_REWRITE_INSTRUCTIONS,
);
export type JobEmailRewriteInstruction = z.infer<
  typeof jobEmailRewriteInstructionSchema
>;

/**
 * SOURCE OF TRUTH KEYWORDS: rewriteJobEmailDraftSchema,
 *   RewriteJobEmailDraftValues
 *
 * WHAT:  The editor's half of a rewrite: the instruction and the draft as the
 *        member currently has it.
 * WHY:   The CURRENT draft is sent, not the original, so a rewrite keeps any
 *        placeholder the member has already filled in and any edit they made.
 *        The sign-off is not part of it, so no rewrite can change it.
 * WHERE: The result editor's rewrite buttons; extended below with the job.
 */
export const rewriteJobEmailDraftSchema = z.object({
  instruction: jobEmailRewriteInstructionSchema,
  subject: jobEmailDraftSchema.shape.subject,
  body: jobEmailDraftSchema.shape.body,
  linkedinMessage: jobEmailDraftSchema.shape.linkedinMessage,
});
export type RewriteJobEmailDraftValues = z.infer<
  typeof rewriteJobEmailDraftSchema
>;

/**
 * SOURCE OF TRUTH KEYWORDS: rewriteJobEmailSchema, RewriteJobEmailValues
 *
 * WHAT:  Full input for a rewrite: the draft half plus the hiring post and job
 *        notes the draft was written for.
 * WHY:   The post and notes are sent again so the model rewrites against the
 *        same true facts as the first draft, not from the email alone.
 * WHERE: Router input for jobEmailRewrites.create.
 */
export const rewriteJobEmailSchema = rewriteJobEmailDraftSchema.extend({
  jobPost: generateJobEmailSchema.shape.jobPost,
  highlights: generateJobEmailSchema.shape.highlights,
});
export type RewriteJobEmailValues = z.infer<typeof rewriteJobEmailSchema>;

/**
 * SOURCE OF TRUTH KEYWORDS: rewrittenJobEmailSchema, RewrittenJobEmail
 *
 * WHAT:  What the model returns for a rewrite.
 * WHERE: Returned by aiService.rewriteJobEmail.
 */
export const rewrittenJobEmailSchema = generatedJobEmailSchema.pick({
  subject: true,
  body: true,
  linkedinMessage: true,
});
export type RewrittenJobEmail = z.infer<typeof rewrittenJobEmailSchema>;

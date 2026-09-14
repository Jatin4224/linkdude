/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: JOB_EMAIL_MAX_TOKENS, JOB_EMAIL_TIMEOUT_MS,
 *   buildGmailComposeUrl, buildMailtoUrl, composeEmailBody,
 *   buildJobEmailSignature, JOB_PLACEHOLDER_PATTERN, JOB_EMAIL_REWRITE_LABELS,
 *   open in Gmail, mailto, email sign-off
 *
 * WHAT:  The model budget for Job Assist, the sign-off built from the member's
 *        saved details, the links that open a draft in Gmail or any email app,
 *        how placeholders are spotted, and the rewrite button labels.
 * WHY:   Sending from the app itself needs Google to verify it for Gmail access,
 *        which takes weeks and may require a paid security assessment. A compose
 *        link needs no approval: the member's browser opens their own mailbox
 *        with the draft filled in, and they press Send (decided 2026-09-15).
 *
 *        The sign-off is built HERE, deterministically, never by the model, so a
 *        link or phone number in an email is always exactly what the member saved.
 *
 *        Values are encoded with encodeURIComponent rather than URLSearchParams,
 *        which writes spaces as "+" and can leave literal plus signs in a draft.
 * WHERE: ai.service (budget), the jobEmails router (sign-off), and the Job
 *        Assist result editor (links, placeholders, rewrite labels).
 */

import type {
  CandidateProfileValues,
  JobEmailDraftValues,
  JobEmailRewriteInstruction,
} from "@/lib/types/job-email";

/* A short structured object, but thinking providers spend reasoning tokens from
 * the same budget, so it is sized above the global 4096. */
export const JOB_EMAIL_MAX_TOKENS = 8192;
/* Must stay under the Job Assist routers' txTimeout. */
export const JOB_EMAIL_TIMEOUT_MS = 45_000;

/**
 * SOURCE OF TRUTH KEYWORDS: JOB_PLACEHOLDER_PATTERN
 *
 * WHAT:  Matches a marked placeholder such as "[years of experience]".
 * WHY:   The prompt writes one wherever a true fact was missing. Sending an
 *        email that still contains one would be embarrassing, so the editor
 *        lists them and jumps to each before the member opens their mail client.
 */
export const JOB_PLACEHOLDER_PATTERN = /\[[^\]\n]{2,60}\]/g;

/**
 * SOURCE OF TRUTH KEYWORDS: JOB_EMAIL_REWRITE_LABELS
 *
 * WHAT:  The label on each rewrite button.
 * WHY:   `Record<…>` over the instruction tuple, so a new rewrite without a label
 *        is a compile error rather than a blank button.
 */
export const JOB_EMAIL_REWRITE_LABELS: Record<JobEmailRewriteInstruction, string> =
  {
    shorter: "Shorter",
    moreFormal: "More formal",
    differentAngle: "Different angle",
    newSubject: "New subject",
  };

/**
 * SOURCE OF TRUTH KEYWORDS: buildJobEmailSignature
 *
 * WHAT:  The sign-off block: a closing, the member's name, their phone when they
 *        chose to include it, and their links.
 * WHY:   Built from saved details only. With no saved profile it falls back to
 *        the account name, so every email still ends with a real name.
 * WHERE: jobEmails.create, to seed the draft's sign-off.
 */
export function buildJobEmailSignature(
  profile: CandidateProfileValues | null,
  fallbackName: string,
): string {
  const lines = ["Best regards,", profile?.fullName || fallbackName];
  if (profile) {
    if (profile.includePhone && profile.phone) lines.push(profile.phone);
    lines.push(profile.linkedinUrl, profile.portfolioUrl, profile.githubUrl);
  }
  return lines.filter((line) => line.trim().length > 0).join("\n");
}

/**
 * SOURCE OF TRUTH KEYWORDS: composeEmailBody
 *
 * WHAT:  The body and sign-off joined the way they are sent.
 * WHERE: The compose link builders and the editor's Copy button.
 */
export function composeEmailBody(body: string, signature: string): string {
  const trimmedSignature = signature.trim();
  return trimmedSignature ? `${body.trimEnd()}\n\n${trimmedSignature}` : body;
}

type ComposableDraft = Pick<
  JobEmailDraftValues,
  "recipientEmail" | "subject" | "body" | "signature"
>;

/**
 * SOURCE OF TRUTH KEYWORDS: buildGmailComposeUrl
 *
 * WHAT:  A link that opens Gmail's compose window with the draft filled in.
 * WHY:   Gmail's long-standing compose URL. It opens in whichever Google account
 *        the member is signed into, and a missing recipient simply leaves the To
 *        field empty for them to fill.
 */
export function buildGmailComposeUrl({
  recipientEmail,
  subject,
  body,
  signature,
}: ComposableDraft): string {
  const params = [
    `view=cm`,
    `fs=1`,
    ...(recipientEmail ? [`to=${encodeURIComponent(recipientEmail)}`] : []),
    `su=${encodeURIComponent(subject)}`,
    `body=${encodeURIComponent(composeEmailBody(body, signature))}`,
  ];
  return `https://mail.google.com/mail/?${params.join("&")}`;
}

/**
 * SOURCE OF TRUTH KEYWORDS: buildMailtoUrl
 *
 * WHAT:  A mailto: link for members who use Outlook, Apple Mail or another app.
 * WHY:   Line breaks are sent as CRLF, which the mailto standard (RFC 6068)
 *        requires; some clients collapse a bare LF into one long line.
 */
export function buildMailtoUrl({
  recipientEmail,
  subject,
  body,
  signature,
}: ComposableDraft): string {
  const crlfBody = composeEmailBody(body, signature).replace(/\r?\n/g, "\r\n");
  return `mailto:${recipientEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(crlfBody)}`;
}

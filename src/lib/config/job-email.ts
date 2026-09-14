/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: JOB_EMAIL_MAX_TOKENS, JOB_EMAIL_TIMEOUT_MS,
 *   buildGmailComposeUrl, buildMailtoUrl, JOB_PLACEHOLDER_PATTERN, open in
 *   Gmail, mailto, email compose link
 *
 * WHAT:  The model budget for one job email, the links that open a draft in
 *        Gmail or the member's own email app, and how placeholders are spotted.
 * WHY:   Sending from the app itself needs Google to verify it for Gmail access,
 *        which takes weeks and may require a paid security assessment. A compose
 *        link needs no approval at all: the member's own browser opens their own
 *        mailbox with the draft filled in, and they press Send (decided
 *        2026-09-15). One-click send through Corsair can replace this later
 *        without changing the draft itself.
 *
 *        Values are encoded with encodeURIComponent rather than URLSearchParams,
 *        which writes spaces as "+" and can leave literal plus signs in a draft.
 * WHERE: ai.service.generateJobEmail (budget) and the Job Assist result editor
 *        (links, placeholder check).
 */

import type { JobEmailDraftValues } from "@/lib/types/job-email";

/* A short structured object, but thinking providers spend reasoning tokens from
 * the same budget, so it is sized above the global 4096. */
export const JOB_EMAIL_MAX_TOKENS = 8192;
/* Must stay under jobEmails.create's txTimeout. */
export const JOB_EMAIL_TIMEOUT_MS = 45_000;

/**
 * SOURCE OF TRUTH KEYWORDS: JOB_PLACEHOLDER_PATTERN
 *
 * WHAT:  Matches a marked placeholder such as "[years of experience]".
 * WHY:   The prompt writes one wherever a true fact was missing. Sending an
 *        email that still contains one would be embarrassing, so the editor
 *        lists them before the member opens their mail client.
 */
export const JOB_PLACEHOLDER_PATTERN = /\[[^\]\n]{2,60}\]/g;

type ComposableDraft = Pick<
  JobEmailDraftValues,
  "recipientEmail" | "subject" | "body"
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
}: ComposableDraft): string {
  const params = [
    `view=cm`,
    `fs=1`,
    ...(recipientEmail ? [`to=${encodeURIComponent(recipientEmail)}`] : []),
    `su=${encodeURIComponent(subject)}`,
    `body=${encodeURIComponent(body)}`,
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
}: ComposableDraft): string {
  const crlfBody = body.replace(/\r?\n/g, "\r\n");
  return `mailto:${recipientEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(crlfBody)}`;
}

/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: isLinkedInConfigured, getLinkedInCredentials,
 *   LINKEDIN_SCOPES, LINKEDIN_API_VERSION, LINKEDIN_ENDPOINTS,
 *   LINKEDIN_REDIRECT_PATH, getLinkedInRedirectUri, LINKEDIN_MAX_COMMENTARY,
 *   LinkedInCredentials, LINKEDIN_MAX_DOCUMENT_BYTES,
 *   LINKEDIN_MAX_DOCUMENT_PAGES, LINKEDIN_DOCUMENT_POLL_INTERVAL_MS,
 *   LINKEDIN_DOCUMENT_POLL_TIMEOUT_MS
 *
 * WHAT:  LinkedIn OAuth credentials, scopes, API version, and endpoint
 *        constants — the ONE place these literals live.
 * WHY:   Fails soft like src/lib/config/stripe.ts: with no client id/secret the
 *        app still boots and the LinkedIn surface reports "not connected"
 *        rather than crashing. Centralizing the endpoints means the versioned
 *        API header (which LinkedIn sunsets on a rolling schedule) is bumped in
 *        one file.
 * WHERE: Consumed by src/services/linkedin.service.ts and the OAuth route
 *        handlers under src/app/api/linkedin/*.
 */

import { APP_URL } from "./branding";

/**
 * SOURCE OF TRUTH KEYWORDS: LINKEDIN_SCOPES
 *
 * WHAT:  The OAuth scopes requested at connect time.
 * WHY:   `openid`/`profile` come from the "Sign In with LinkedIn using OpenID
 *        Connect" product and yield the person URN via /v2/userinfo;
 *        `w_member_social` comes from "Share on LinkedIn" and is what actually
 *        permits posting. Reading a member's own posts back would need
 *        `r_member_social`, which LinkedIn restricts to approved partners —
 *        hence the local LinkedInPost table instead.
 */
export const LINKEDIN_SCOPES = [
  "openid",
  "profile",
  "w_member_social",
] as const;

/* LinkedIn's versioned APIs require a `LinkedIn-Version: YYYYMM` header and
 * sunset old versions on a rolling schedule. Overridable by env so a version
 * bump doesn't need a deploy of new code. */
export const LINKEDIN_API_VERSION =
  process.env["LINKEDIN_API_VERSION"] ?? "202601";

/* LinkedIn rejects commentary longer than this with FIELD_LENGTH_TOO_LONG. */
export const LINKEDIN_MAX_COMMENTARY = 3000;

export const LINKEDIN_REDIRECT_PATH = "/api/linkedin/callback";

/* Name of the httpOnly cookie binding an in-flight OAuth handshake to this
 * browser. Lives here rather than in a route file because Next.js restricts
 * which symbols a route module may export. */
export const LINKEDIN_OAUTH_STATE_COOKIE = "linkedin_oauth_state";

export const LINKEDIN_ENDPOINTS = {
  authorization: "https://www.linkedin.com/oauth/v2/authorization",
  accessToken: "https://www.linkedin.com/oauth/v2/accessToken",
  userinfo: "https://api.linkedin.com/v2/userinfo",
  posts: "https://api.linkedin.com/rest/posts",
  images: "https://api.linkedin.com/rest/images",
  /* Document posts — the swipeable carousel format. Same host and the same
   * `?action=initializeUpload` shape as images; it needs no extra scope, because
   * w_member_social already covers posting on the member's behalf. */
  documents: "https://api.linkedin.com/rest/documents",
} as const;

/**
 * SOURCE OF TRUTH KEYWORDS: LINKEDIN_MAX_DOCUMENT_BYTES,
 *   LINKEDIN_MAX_DOCUMENT_PAGES, LINKEDIN_DOCUMENT_POLL_INTERVAL_MS,
 *   LINKEDIN_DOCUMENT_POLL_TIMEOUT_MS
 *
 * WHAT:  LinkedIn's own ceilings for document assets, and how long to wait for
 *        one to finish processing.
 * WHY:   The limits are LinkedIn's published maxima (100 MB, 300 pages, and PDF
 *        among the accepted types). Checked locally so an oversized deck fails
 *        with our message instead of a vendor 400 the user cannot act on.
 *
 *        The POLL constants exist because documents are NOT synchronous —
 *        LinkedIn's docs state outright that `SYNCHRONOUS_UPLOAD` is unsupported
 *        here. An uploaded asset moves WAITING_UPLOAD → PROCESSING → AVAILABLE,
 *        and referencing it in a post before it is AVAILABLE is what produces a
 *        published post with no deck attached. Images have no such step, which is
 *        why the image path can post immediately and this one cannot.
 */
export const LINKEDIN_MAX_DOCUMENT_BYTES = 100 * 1024 * 1024;
export const LINKEDIN_MAX_DOCUMENT_PAGES = 300;

/* Generous relative to the real wait — a 12-slide PDF is typically AVAILABLE
 * within a couple of seconds — but bounded, so a stuck asset fails the publish
 * with a clear message instead of holding a transaction open indefinitely. */
export const LINKEDIN_DOCUMENT_POLL_INTERVAL_MS = 1_000;
export const LINKEDIN_DOCUMENT_POLL_TIMEOUT_MS = 30_000;

export interface LinkedInCredentials {
  clientId: string;
  clientSecret: string;
}

/**
 * SOURCE OF TRUTH KEYWORDS: isLinkedInConfigured
 *
 * WHAT:  True when both LinkedIn OAuth credentials are set.
 * WHERE: Guard in the integrations router and the OAuth routes, so an
 *        unconfigured install renders a disabled Connect button instead of
 *        bouncing the user to a LinkedIn error page.
 */
export function isLinkedInConfigured(): boolean {
  return Boolean(
    process.env["LINKEDIN_CLIENT_ID"] && process.env["LINKEDIN_CLIENT_SECRET"],
  );
}

/**
 * SOURCE OF TRUTH KEYWORDS: getLinkedInCredentials
 *
 * WHAT:  Returns the OAuth client id/secret, throwing a clear error if unset.
 * WHERE: Called by the LinkedIn service for every token exchange.
 */
export function getLinkedInCredentials(): LinkedInCredentials {
  const clientId = process.env["LINKEDIN_CLIENT_ID"];
  const clientSecret = process.env["LINKEDIN_CLIENT_SECRET"];
  if (!clientId || !clientSecret) {
    throw new Error(
      "[linkedin] LINKEDIN_CLIENT_ID / LINKEDIN_CLIENT_SECRET are not set. " +
        "LinkedIn publishing is unavailable until both are configured.",
    );
  }
  return { clientId, clientSecret };
}

/**
 * SOURCE OF TRUTH KEYWORDS: getLinkedInRedirectUri
 *
 * WHAT:  The absolute callback URL registered on the LinkedIn app.
 * WHY:   Derived from APP_URL so local and production resolve correctly from
 *        one env var; LinkedIn rejects any redirect_uri that isn't an exact
 *        string match of a registered URL.
 * WHERE: Used when building the authorization URL and again on token exchange
 *        (LinkedIn requires it in both).
 */
export function getLinkedInRedirectUri(): string {
  return new URL(LINKEDIN_REDIRECT_PATH, APP_URL).toString();
}

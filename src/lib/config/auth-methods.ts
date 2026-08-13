/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: EMAIL_AUTH_ENABLED, GOOGLE_AUTH_ENABLED,
 *   NEXT_PUBLIC_EMAIL_AUTH_ENABLED, NEXT_PUBLIC_GOOGLE_CLIENT_ID, auth methods,
 *   email password toggle, google only, sign-in methods, social only
 *
 * WHAT:  Which sign-in methods the app offers — email+password and Google.
 * WHY:   Turning email+password off is a config decision, not a code edit:
 *        commenting the form out leaves a half-wired auth surface (live
 *        /forgot-password routes, live /api/auth/sign-up/email endpoint) and
 *        has to be manually undone later. One flag drives the UI, the router
 *        bounces, AND the Better Auth server config, so the three can never
 *        disagree.
 *
 *        Only NEXT_PUBLIC_* vars are read here: this module is imported by
 *        client components, so GOOGLE_CLIENT_SECRET must never be touched —
 *        the server pairs the id with the secret in
 *        src/lib/better-auth/auth.ts (resolveGoogleProvider).
 * WHERE: Read by src/lib/better-auth/auth.ts (server enforcement),
 *        src/components/global/auth/auth-form.tsx (which surface renders), and
 *        src/proxy.ts (password-route bounces). Mirrors the flag shape of
 *        src/lib/config/registration.ts.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: GOOGLE_AUTH_ENABLED
 *
 * WHAT:  Whether Google sign-in is wired, from the client's point of view.
 * WHY:   The public client id is the only half of the credential pair a browser
 *        may see. The server additionally requires GOOGLE_CLIENT_SECRET before
 *        it registers the provider, so this being true means "show the button",
 *        not "the provider is definitely live".
 * WHERE: The Google button gate in auth-form.tsx and the EMAIL_AUTH_ENABLED
 *        failsafe below.
 */
export const GOOGLE_AUTH_ENABLED = Boolean(
  process.env["NEXT_PUBLIC_GOOGLE_CLIENT_ID"],
);

/**
 * SOURCE OF TRUTH KEYWORDS: EMAIL_AUTH_ENABLED
 *
 * WHAT:  Whether email+password sign-in / sign-up is offered at all.
 * WHY:   Set NEXT_PUBLIC_EMAIL_AUTH_ENABLED=false to run Google-only — the
 *        escape hatch for a deploy with no transactional email provider, where
 *        an email sign-up would dead-end on a verification mail that can never
 *        arrive.
 *
 *        The `|| !GOOGLE_AUTH_ENABLED` clause is a deliberate failsafe: turning
 *        email off while Google is unconfigured would leave the app with ZERO
 *        ways in and lock everyone out, including the owner. The flag only
 *        takes effect once there is another door.
 * WHERE: auth.ts (emailAndPassword.enabled + the implicit-signup guard),
 *        auth-form.tsx (which form renders), proxy.ts (password-route bounces).
 */
export const EMAIL_AUTH_ENABLED =
  process.env["NEXT_PUBLIC_EMAIL_AUTH_ENABLED"] !== "false" ||
  !GOOGLE_AUTH_ENABLED;

/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "server-only";

/**
 * SOURCE OF TRUTH KEYWORDS: redirectIfAuthenticated, session guard,
 *   persistent session, already signed in, auth page bounce, getCachedSession,
 *   ROUTES.dashboard, sign-in redirect, session persistence
 *
 * WHAT:  The signed-in → dashboard half of the auth gate. Call it at the top of
 *        any (auth) page that a user WITH a live session has no business
 *        seeing, and it forwards them to the dashboard instead.
 * WHY:   The gate used to run one direction only — (dashboard)/layout.tsx
 *        bounces anonymous users to /sign-in, but nothing bounced a signed-in
 *        user off /sign-in. Better Auth's cookie is persistent (maxAge =
 *        session.expiresIn, 7 days), so reopening the app left a user with a
 *        perfectly valid session staring at the sign-in form, which reads as
 *        "it signed me out" even though it never did. Resolving this on the
 *        SERVER — before render, like the dashboard layout — means there is no
 *        client loading window in which the form can flash.
 *
 *        It is a function rather than an (auth)/layout.tsx on purpose: that
 *        group also holds /accept-invitation and /reset-password, which a
 *        signed-in user legitimately needs to reach. A blanket layout gate
 *        would break invitations. Each page opts in instead.
 * WHERE: Called by src/app/(auth)/sign-in/page.tsx and sign-up/page.tsx.
 *        Pairs with the anonymous → /sign-in redirect in
 *        src/app/(dashboard)/layout.tsx.
 */

import { redirect } from "next/navigation";

import { getCachedSession } from "@/lib/better-auth/auth";
import { ROUTES } from "@/lib/config";

/**
 * SOURCE OF TRUTH KEYWORDS: redirectIfAuthenticated
 *
 * WHAT:  Forwards to ROUTES.dashboard when the request carries a valid
 *        session; returns normally (so the page renders) when it does not.
 * WHY:   Targets the dashboard rather than branching on org membership — the
 *        dashboard layout already owns the no-org → onboarding hop, and
 *        duplicating that decision here would leave two places to update.
 *        Reads through getCachedSession so a page using this costs no extra
 *        query when the rest of the request already resolved the session.
 * WHERE: The first statement of the sign-in and sign-up pages.
 */
export async function redirectIfAuthenticated(): Promise<void> {
  const session = await getCachedSession();
  if (session) redirect(ROUTES.dashboard);
}

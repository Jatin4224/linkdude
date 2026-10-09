/*
 *   *
 *    *    */

/**
 * SOURCE OF TRUTH KEYWORDS: SignInPage, redirectIfAuthenticated
 *
 * WHAT:  /sign-in route — renders the shared AuthShell + AuthForm in
 *        sign-in mode. This is the route AUTH_ROUTES.signIn points at, and
 *        the destination AuthRedirectObserver pushes unauthenticated users to.
 *        A visitor who ALREADY has a session never sees the form: the guard
 *        forwards them to the dashboard first.
 * WHY:   Stays a thin shell so all auth UI logic lives in one global form
 *        component; mode swap is the only difference from /sign-up. The guard
 *        closes the other half of the gate — the dashboard layout turns
 *        anonymous users away, and this turns signed-in users away — so
 *        reopening the app on a live session lands on the dashboard instead of
 *        a sign-in form the user does not need.
 * WHERE: Linked from AUTH_ROUTES.signIn (src/lib/config/auth-routes.ts);
 *        proxy.ts bounces /sign-up here when registration is closed. Guard
 *        lives in src/lib/better-auth/session-guards.ts.
 */

import type { Metadata } from "next";

import { AuthForm, AuthShell } from "@/components/global/auth";
import { redirectIfAuthenticated } from "@/lib/better-auth/session-guards";

export const metadata: Metadata = {
  title: "Sign in",
};

export default async function SignInPage() {
  await redirectIfAuthenticated();

  return (
    <AuthShell variant="action">
      <AuthForm mode="sign-in" />
    </AuthShell>
  );
}

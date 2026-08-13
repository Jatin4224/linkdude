/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: proxy, config, CLOSED_AUTH_ROUTES
 *
 * WHAT:  Next.js 16 routing middleware — short-circuits static assets, forwards
 *        x-pathname/x-hostname to RSCs, and redirects any (auth) route a flag
 *        has switched off (/sign-up when registration is closed; the
 *        password-recovery routes when email auth is off).
 * WHY:   File is named `proxy.ts` (Next.js 16 rename of `middleware.ts`) and
 *        propagation goes on REQUEST headers via NextResponse.next({ request })
 *        — response headers would only reach the browser, not RSCs.
 * WHERE: Reads REGISTRATION_OPEN from src/lib/config/registration and
 *        EMAIL_AUTH_ENABLED from src/lib/config/auth-methods; downstream RSCs
 *        and route handlers read the injected headers via `await headers()`.
 */

import { NextRequest, NextResponse } from "next/server";
import { REGISTRATION_OPEN } from "@/lib/config/registration";
import { EMAIL_AUTH_ENABLED } from "@/lib/config/auth-methods";
import { AUTH_ROUTES } from "@/lib/config/auth-routes";

/**
 * SOURCE OF TRUTH KEYWORDS: CLOSED_AUTH_ROUTES
 *
 * WHAT:  The (auth) routes that must not be reachable given the current flags —
 *        /sign-up when registration is closed, and the password-recovery pair
 *        when email auth is off.
 * WHY:   Built once at module load from the flags, so the per-request check is
 *        a list scan rather than a chain of conditionals that grows with every
 *        new flag. Cosmetically hiding a link is not enough: these pages render
 *        forms against endpoints Better Auth has already taken down, so a
 *        bookmarked URL would otherwise land on a form that can only fail.
 * WHERE: Read by proxy() below; routes come from src/lib/config/auth-routes.ts.
 */
const CLOSED_AUTH_ROUTES: readonly string[] = [
  ...(REGISTRATION_OPEN ? [] : [AUTH_ROUTES.signUp]),
  ...(EMAIL_AUTH_ENABLED
    ? []
    : [AUTH_ROUTES.forgotPassword, AUTH_ROUTES.resetPassword]),
];

/**
 * SOURCE OF TRUTH KEYWORDS: proxy
 *
 * WHAT:  Per-request entry point — static-asset bypass, optional sign-up
 *        redirect, and request-header propagation.
 * WHY:   Runs on every dynamic request; keep work cheap. Header injection is
 *        the propagation channel for cross-cutting context (org id, locale,
 *        flag bucket) to RSCs and route handlers.
 * WHERE: Wired by Next.js automatically; matcher excludes static assets.
 */
export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const hostname = request.headers.get("host") || request.nextUrl.hostname;

  /* Belt-and-braces with the matcher below: if someone relaxes the matcher
   * later, this runtime check still keeps the function out of static-asset
   * paths. */
  if (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.startsWith("/images/") ||
    pathname.startsWith("/fonts/") ||
    /\.(png|jpg|jpeg|gif|svg|ico|webp|css|js|woff|woff2|ttf|eot)$/.test(
      pathname,
    )
  ) {
    return NextResponse.next();
  }

  /* A route switched off by a flag — bounce to sign-in so the user sees a
   * sensible page instead of a form whose endpoint no longer exists. The real
   * enforcement is server-side (the DB hook in auth.ts for closed registration,
   * emailAndPassword.enabled for email auth); this redirect just makes the UX
   * cleaner. Toggled by NEXT_PUBLIC_REGISTRATION_OPEN and
   * NEXT_PUBLIC_EMAIL_AUTH_ENABLED. */
  if (
    CLOSED_AUTH_ROUTES.some(
      (route) => pathname === route || pathname.startsWith(`${route}/`),
    )
  ) {
    const url = request.nextUrl.clone();
    url.pathname = AUTH_ROUTES.signIn;
    return NextResponse.redirect(url, 302);
  }

  /* RSCs can't access the raw NextRequest, so stamp the pathname/hostname
   * onto the REQUEST headers we forward downstream. Setting them on the
   * response would only leak them to the browser — RSCs read request headers
   * via `await headers()`, not response headers. */
  const forwardedHeaders = new Headers(request.headers);
  forwardedHeaders.set("x-pathname", pathname);
  forwardedHeaders.set("x-hostname", hostname);
  return NextResponse.next({ request: { headers: forwardedHeaders } });
}

/**
 * SOURCE OF TRUTH KEYWORDS: config
 *
 * WHAT:  Matcher excluding static-asset paths so proxy isn't invoked for them.
 * WHY:   Belt-and-braces with the runtime guard inside proxy(); keeps the
 *        function out of the request path for assets entirely.
 * WHERE: Read by Next.js at build time; pairs with the runtime check in proxy().
 */
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sw\\.js|images|fonts).*)",
  ],
};

/*
 * Copyright (c) 2026 Web Prodigies LLC
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: LINKEDIN_OAUTH_STATE_COOKIE, GET
 *
 * WHAT:  Starts the LinkedIn OAuth handshake — mints a CSRF state, binds it to
 *        an httpOnly cookie, and redirects to LinkedIn's consent screen.
 * WHY:   A route handler rather than a Better Auth social provider: this is an
 *        ACTION connection (permission to post as the member), not a sign-in
 *        method. Wiring it as a login provider would let someone authenticate
 *        with LinkedIn, which is a different product decision.
 *        The state cookie is the CSRF defence — LinkedIn echoes `state` back and
 *        the callback refuses anything it didn't mint.
 * WHERE: Linked to by the connect button; pairs with
 *        src/app/api/linkedin/callback/route.ts.
 */

import { randomBytes } from 'node:crypto'
import { NextResponse } from 'next/server'

import { getCachedSession } from '@/lib/better-auth/auth'
import { createTRPCContext } from '@/trpc/init'
import {
  APP_URL,
  AUTH_ROUTES,
  ROUTES,
  isLinkedInConfigured,
  LINKEDIN_OAUTH_STATE_COOKIE,
} from '@/lib/config'
import { buildAuthorizationUrl } from '@/services/linkedin.service'

export async function GET(): Promise<NextResponse> {
  const session = await getCachedSession()
  if (!session) {
    return NextResponse.redirect(new URL(AUTH_ROUTES.signIn, APP_URL))
  }

  if (!isLinkedInConfigured()) {
    return NextResponse.redirect(
      new URL(`${ROUTES.dashboard}/post-generation?error=not_configured`, APP_URL)
    )
  }

  /* The connection is stored against the ACTIVE organization, so refuse to
   * start a handshake we couldn't attribute on the way back. */
  const ctx = await createTRPCContext()
  await ctx.resolveAuth()
  const activeOrganization = await ctx.getActiveOrganization()
  if (!activeOrganization) {
    return NextResponse.redirect(new URL(ROUTES.onboarding, APP_URL))
  }

  const state = randomBytes(32).toString('hex')
  const response = NextResponse.redirect(buildAuthorizationUrl(state))

  response.cookies.set(LINKEDIN_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    /* Long enough for a slow consent screen, short enough that a stale value
     * can't be replayed later. */
    maxAge: 10 * 60,
  })

  return response
}

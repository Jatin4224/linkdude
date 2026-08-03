/*
 * Copyright (c) 2026 Web Prodigies LLC
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: GET, linkedinCallbackRoute
 *
 * WHAT:  Completes the LinkedIn OAuth handshake — verifies CSRF state, trades
 *        the code for tokens, reads the member profile, and stores the
 *        connection against the active organization.
 * WHY:   Every failure path redirects back to the composer with an `error`
 *        query param instead of rendering a raw error page: the user is
 *        mid-flow and needs to land somewhere they can retry. The state cookie
 *        is cleared on every outcome so a stale value can't be replayed.
 * WHERE: Registered as the redirect URL on the LinkedIn app; pairs with
 *        src/app/api/linkedin/connect/route.ts.
 */

import { timingSafeEqual } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'

import { getCachedSession } from '@/lib/better-auth/auth'
import { createTRPCContext } from '@/trpc/init'
import { prisma } from '@/lib/config/prisma'
import { APP_URL, AUTH_ROUTES, ROUTES, LINKEDIN_OAUTH_STATE_COOKIE } from '@/lib/config'
import * as linkedinService from '@/services/linkedin.service'

const COMPOSER_PATH = `${ROUTES.dashboard}/post-generation`

function redirectToComposer(status: 'connected' | string): NextResponse {
  const url = new URL(COMPOSER_PATH, APP_URL)
  if (status === 'connected') {
    url.searchParams.set('connected', '1')
  } else {
    url.searchParams.set('error', status)
  }
  const response = NextResponse.redirect(url)
  /* Single-use by construction — clear on success and failure alike. */
  response.cookies.delete(LINKEDIN_OAUTH_STATE_COOKIE)
  return response
}

/* Constant-time compare so the state check can't be narrowed by timing. */
function statesMatch(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await getCachedSession()
  if (!session) {
    return NextResponse.redirect(new URL(AUTH_ROUTES.signIn, APP_URL))
  }

  const params = request.nextUrl.searchParams

  /* The user pressed Cancel on LinkedIn's consent screen, or LinkedIn refused
   * the app. Either way there's no code to exchange. */
  const oauthError = params.get('error')
  if (oauthError) {
    return redirectToComposer(oauthError === 'user_cancelled_login' ? 'cancelled' : 'denied')
  }

  const code = params.get('code')
  const state = params.get('state')
  const expectedState = request.cookies.get(LINKEDIN_OAUTH_STATE_COOKIE)?.value

  if (!code || !state || !expectedState || !statesMatch(state, expectedState)) {
    return redirectToComposer('invalid_state')
  }

  const ctx = await createTRPCContext()
  await ctx.resolveAuth()
  const activeOrganization = await ctx.getActiveOrganization()
  if (!activeOrganization) {
    return NextResponse.redirect(new URL(ROUTES.onboarding, APP_URL))
  }

  try {
    const token = await linkedinService.exchangeCodeForToken(code)
    const profile = await linkedinService.fetchMemberProfile(token.access_token)

    await linkedinService.upsertConnection(prisma, {
      organizationId: activeOrganization.id,
      userId: session.user.id,
      /* The OIDC `sub` claim IS the person id; this URN is the `author` on
       * every post we publish. */
      personUrn: `urn:li:person:${profile.sub}`,
      name: profile.name ?? session.user.name,
      avatarUrl: profile.picture ?? null,
      token,
    })

    return redirectToComposer('connected')
  } catch (error) {
    /* Log server-side (the message can carry LinkedIn response detail) but hand
     * the browser only an opaque code. */
    console.error('[linkedin] callback failed:', error)
    return redirectToComposer('exchange_failed')
  }
}

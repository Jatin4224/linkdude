/*
 * Copyright (c) 2026 Web Prodigies LLC
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import 'server-only'

/**
 * SOURCE OF TRUTH KEYWORDS: LINKEDIN_ACCOUNT_SAFE_SELECT, buildAuthorizationUrl,
 *   exchangeCodeForToken, fetchMemberProfile, upsertConnection,
 *   disconnectAccount, getConnectionStatus, getValidAccessToken, uploadImage,
 *   publishPost, recordPublishedPost, listPublishedPosts, deletePublishedPost,
 *   LinkedInTokenResponse, LinkedInUserInfo, PublishPostResult
 *
 * WHAT:  Every LinkedIn touchpoint — the OAuth handshake, credential storage
 *        and refresh, image upload, post publishing, and the local post record.
 * WHY:   `server-only` because this file reads bearer tokens off the
 *        LinkedInAccount row; importing it into a client bundle would ship
 *        posting credentials to the browser. All LinkedIn HTTP lives here so
 *        the versioned-API headers and the x-restli-id response quirk are
 *        implemented once, and callers stay pure business logic.
 * WHERE: Called by src/trpc/routers/linkedin-posts.ts, integrations.ts, and the
 *        OAuth route handlers under src/app/api/linkedin/*. DB access takes the
 *        caller's `db` client so it can join a transaction.
 */

import type { DbClient } from '@/lib/config/prisma'
import type { LinkedInAccount, Prisma } from '@/generated/prisma'
import {
  getLinkedInCredentials,
  getLinkedInRedirectUri,
  isLinkedInConfigured,
  LINKEDIN_API_VERSION,
  LINKEDIN_ENDPOINTS,
  LINKEDIN_SCOPES,
} from '@/lib/config/linkedin'
import type { LinkedInConnectionStatus, PostImageValues } from '@/lib/types/linkedin'

/**
 * SOURCE OF TRUTH KEYWORDS: LINKEDIN_ACCOUNT_SAFE_SELECT
 *
 * WHAT:  The only field set from LinkedInAccount allowed to leave the server.
 * WHY:   accessToken / refreshToken sit on the same row. Selecting the model
 *        wholesale into a tRPC response would hand a browser the credentials to
 *        post as the user. Mirrors the AUDIT_LOG_SAFE_SELECT convention.
 * WHERE: Used by getConnectionStatus — the only connection read a client sees.
 */
export const LINKEDIN_ACCOUNT_SAFE_SELECT = {
  name: true,
  avatarUrl: true,
  expiresAt: true,
  refreshToken: false,
} as const satisfies Prisma.LinkedInAccountSelect

/* Refresh this far ahead of expiry so a long publish doesn't straddle it. */
const TOKEN_REFRESH_SKEW_MS = 5 * 60 * 1000

interface LinkedInTokenResponse {
  access_token: string
  expires_in: number
  refresh_token?: string
  refresh_token_expires_in?: number
  scope?: string
}

interface LinkedInUserInfo {
  sub: string
  name?: string
  picture?: string
}

interface LinkedInImageUploadResponse {
  value: { uploadUrl: string; image: string }
}

export interface PublishPostResult {
  postUrn: string
  imageUrn: string | null
}

/* LinkedIn returns errors as JSON with a `message`, but not always — a 5xx can
 * be HTML. Read as text and surface a bounded excerpt so failures are
 * diagnosable without dumping a whole error page into the UI. */
async function readError(response: Response, context: string): Promise<Error> {
  const body = await response.text().catch(() => '')
  return new Error(
    `[linkedin] ${context} failed (${response.status}): ${body.slice(0, 300) || 'no response body'}`
  )
}

/* Every versioned LinkedIn REST call needs these three headers; the API
 * rejects the request outright without them. */
function restHeaders(accessToken: string): Record<string, string> {
  return {
    Authorization: `Bearer ${accessToken}`,
    'X-Restli-Protocol-Version': '2.0.0',
    'LinkedIn-Version': LINKEDIN_API_VERSION,
  }
}

// ---------------------------------------------------------------------------
// OAuth
// ---------------------------------------------------------------------------

/**
 * SOURCE OF TRUTH KEYWORDS: buildAuthorizationUrl
 *
 * WHAT:  The LinkedIn consent URL to redirect the user to.
 * WHY:   `state` is generated and cookie-bound by the caller; LinkedIn echoes
 *        it back so the callback can prove the response belongs to a handshake
 *        this browser started (CSRF).
 * WHERE: Called by src/app/api/linkedin/connect/route.ts.
 */
export function buildAuthorizationUrl(state: string): string {
  const { clientId } = getLinkedInCredentials()
  const url = new URL(LINKEDIN_ENDPOINTS.authorization)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', getLinkedInRedirectUri())
  url.searchParams.set('state', state)
  url.searchParams.set('scope', LINKEDIN_SCOPES.join(' '))
  return url.toString()
}

/**
 * SOURCE OF TRUTH KEYWORDS: exchangeCodeForToken
 *
 * WHAT:  Trades the callback's authorization code for an access token.
 * WHY:   LinkedIn requires the same redirect_uri here as on the authorize call
 *        and rejects the exchange if they differ by even a trailing slash —
 *        both read from getLinkedInRedirectUri so they cannot drift.
 * WHERE: Called by the callback route.
 */
export async function exchangeCodeForToken(code: string): Promise<LinkedInTokenResponse> {
  const { clientId, clientSecret } = getLinkedInCredentials()

  const response = await fetch(LINKEDIN_ENDPOINTS.accessToken, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: getLinkedInRedirectUri(),
    }),
  })

  if (!response.ok) throw await readError(response, 'token exchange')
  return (await response.json()) as LinkedInTokenResponse
}

/**
 * SOURCE OF TRUTH KEYWORDS: refreshAccessToken
 *
 * WHAT:  Exchanges a refresh token for a fresh access token.
 * WHY:   Only apps LinkedIn has approved for refresh tokens ever receive one,
 *        which is why the stored column is nullable and callers must handle the
 *        reconnect path.
 */
async function refreshAccessToken(refreshToken: string): Promise<LinkedInTokenResponse> {
  const { clientId, clientSecret } = getLinkedInCredentials()

  const response = await fetch(LINKEDIN_ENDPOINTS.accessToken, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  })

  if (!response.ok) throw await readError(response, 'token refresh')
  return (await response.json()) as LinkedInTokenResponse
}

/**
 * SOURCE OF TRUTH KEYWORDS: fetchMemberProfile
 *
 * WHAT:  Reads the authorized member's OIDC profile.
 * WHY:   The `sub` claim is the person id; `urn:li:person:{sub}` is the author
 *        on every post we publish. Name and picture are cached on our row so the
 *        composer preview renders without a LinkedIn round trip per page load.
 * WHERE: Called once per connection, from the callback route.
 */
export async function fetchMemberProfile(accessToken: string): Promise<LinkedInUserInfo> {
  const response = await fetch(LINKEDIN_ENDPOINTS.userinfo, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!response.ok) throw await readError(response, 'userinfo')
  return (await response.json()) as LinkedInUserInfo
}

// ---------------------------------------------------------------------------
// Connection persistence
// ---------------------------------------------------------------------------

export interface UpsertConnectionArgs {
  organizationId: string
  userId: string
  personUrn: string
  name: string
  avatarUrl: string | null
  token: LinkedInTokenResponse
}

/**
 * SOURCE OF TRUTH KEYWORDS: upsertConnection
 *
 * WHAT:  Stores (or replaces) an organization's LinkedIn connection.
 * WHY:   Upsert on the unique organizationId so reconnecting — the normal path
 *        once a token expires — overwrites in place instead of erroring on a
 *        duplicate or accumulating dead rows.
 * WHERE: Called by the callback route.
 */
export async function upsertConnection(
  db: DbClient,
  args: UpsertConnectionArgs
): Promise<LinkedInAccount> {
  const now = Date.now()
  const expiresAt = new Date(now + args.token.expires_in * 1000)
  const refreshTokenExpiresAt = args.token.refresh_token_expires_in
    ? new Date(now + args.token.refresh_token_expires_in * 1000)
    : null

  const data = {
    userId: args.userId,
    personUrn: args.personUrn,
    name: args.name,
    avatarUrl: args.avatarUrl,
    accessToken: args.token.access_token,
    refreshToken: args.token.refresh_token ?? null,
    expiresAt,
    refreshTokenExpiresAt,
    scope: args.token.scope ?? LINKEDIN_SCOPES.join(' '),
  }

  return db.linkedInAccount.upsert({
    where: { organizationId: args.organizationId },
    create: { organizationId: args.organizationId, ...data },
    update: data,
  })
}

/**
 * SOURCE OF TRUTH KEYWORDS: disconnectAccount
 *
 * WHAT:  Drops an organization's LinkedIn connection.
 * WHY:   deleteMany rather than delete so disconnecting an already-disconnected
 *        org is idempotent instead of throwing P2025.
 */
export async function disconnectAccount(db: DbClient, organizationId: string): Promise<void> {
  await db.linkedInAccount.deleteMany({ where: { organizationId } })
}

/**
 * SOURCE OF TRUTH KEYWORDS: getConnectionStatus
 *
 * WHAT:  The client-safe connection state for an organization.
 * WHY:   Returns only LINKEDIN_ACCOUNT_SAFE_SELECT fields — never tokens.
 *        `needsReconnect` is computed here because the UI can't: it depends on
 *        whether LinkedIn issued this app a refresh token at all, which only the
 *        server row knows.
 * WHERE: Returned by integrations.read.
 */
export async function getConnectionStatus(
  db: DbClient,
  organizationId: string
): Promise<LinkedInConnectionStatus> {
  const configured = isLinkedInConfigured()
  const account = await db.linkedInAccount.findUnique({
    where: { organizationId },
    select: { name: true, avatarUrl: true, expiresAt: true, refreshToken: true },
  })

  if (!account) {
    return {
      connected: false,
      configured,
      name: null,
      avatarUrl: null,
      expiresAt: null,
      needsReconnect: false,
    }
  }

  /* Expired with no refresh token means the only way back is a fresh consent
   * flow — surfaced so the UI can say "Reconnect" rather than failing at publish. */
  const expired = account.expiresAt.getTime() <= Date.now()
  return {
    connected: true,
    configured,
    name: account.name,
    avatarUrl: account.avatarUrl,
    expiresAt: account.expiresAt,
    needsReconnect: expired && !account.refreshToken,
  }
}

/**
 * SOURCE OF TRUTH KEYWORDS: getValidAccessToken
 *
 * WHAT:  Returns a usable access token + person URN, refreshing if near expiry.
 * WHY:   Centralizes the expiry decision so no caller publishes with a token
 *        that dies mid-request. When the token is stale and no refresh token
 *        exists, it throws a reconnect-specific message rather than letting
 *        LinkedIn answer 401 with an opaque body.
 * WHERE: Called by the publish path.
 */
export async function getValidAccessToken(
  db: DbClient,
  organizationId: string
): Promise<{ accessToken: string; personUrn: string; accountId: string }> {
  const account = await db.linkedInAccount.findUnique({ where: { organizationId } })
  if (!account) {
    throw new Error('No LinkedIn account is connected for this organization.')
  }

  const stale = account.expiresAt.getTime() - TOKEN_REFRESH_SKEW_MS <= Date.now()
  if (!stale) {
    return {
      accessToken: account.accessToken,
      personUrn: account.personUrn,
      accountId: account.id,
    }
  }

  if (!account.refreshToken) {
    throw new Error(
      'Your LinkedIn connection has expired. Reconnect your account to keep publishing.'
    )
  }

  const token = await refreshAccessToken(account.refreshToken)
  const now = Date.now()
  const updated = await db.linkedInAccount.update({
    where: { organizationId },
    data: {
      accessToken: token.access_token,
      expiresAt: new Date(now + token.expires_in * 1000),
      /* LinkedIn may or may not rotate the refresh token — keep the old one
       * when it doesn't, or the connection silently becomes unrefreshable. */
      refreshToken: token.refresh_token ?? account.refreshToken,
      refreshTokenExpiresAt: token.refresh_token_expires_in
        ? new Date(now + token.refresh_token_expires_in * 1000)
        : account.refreshTokenExpiresAt,
    },
  })

  return {
    accessToken: updated.accessToken,
    personUrn: updated.personUrn,
    accountId: updated.id,
  }
}

// ---------------------------------------------------------------------------
// Publishing
// ---------------------------------------------------------------------------

/**
 * SOURCE OF TRUTH KEYWORDS: uploadImage
 *
 * WHAT:  Registers an upload with LinkedIn, PUTs the bytes, returns the URN.
 * WHY:   LinkedIn's image flow is two-legged: `?action=initializeUpload` hands
 *        back a single-use upload URL plus the URN the post will reference, and
 *        the binary goes to that URL — not to the API host. The URN is usable
 *        immediately; the post references it rather than embedding the image.
 * WHERE: Called by publishPost when the composer attached media.
 */
export async function uploadImage(
  accessToken: string,
  personUrn: string,
  image: PostImageValues
): Promise<string> {
  const initResponse = await fetch(`${LINKEDIN_ENDPOINTS.images}?action=initializeUpload`, {
    method: 'POST',
    headers: { ...restHeaders(accessToken), 'Content-Type': 'application/json' },
    body: JSON.stringify({ initializeUploadRequest: { owner: personUrn } }),
  })

  if (!initResponse.ok) throw await readError(initResponse, 'image upload initialize')
  const { value } = (await initResponse.json()) as LinkedInImageUploadResponse

  const binary = Buffer.from(image.data, 'base64')
  const uploadResponse = await fetch(value.uploadUrl, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': image.mimeType },
    body: new Uint8Array(binary),
  })

  if (!uploadResponse.ok) throw await readError(uploadResponse, 'image upload')
  return value.image
}

export interface PublishPostArgs {
  accessToken: string
  personUrn: string
  commentary: string
  image?: PostImageValues | undefined
}

/**
 * SOURCE OF TRUTH KEYWORDS: publishPost
 *
 * WHAT:  Publishes a post to the member's LinkedIn feed.
 * WHY:   The created post's URN arrives in the `x-restli-id` RESPONSE HEADER,
 *        not the body — the body is empty on 201. Reading it from the header is
 *        the only way to record what we published.
 * WHERE: Called by linkedinPosts.create.
 */
export async function publishPost(args: PublishPostArgs): Promise<PublishPostResult> {
  const imageUrn = args.image
    ? await uploadImage(args.accessToken, args.personUrn, args.image)
    : null

  const response = await fetch(LINKEDIN_ENDPOINTS.posts, {
    method: 'POST',
    headers: { ...restHeaders(args.accessToken), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      author: args.personUrn,
      commentary: args.commentary,
      visibility: 'PUBLIC',
      distribution: {
        feedDistribution: 'MAIN_FEED',
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      ...(imageUrn ? { content: { media: { id: imageUrn } } } : {}),
      lifecycleState: 'PUBLISHED',
      isReshareDisabledByAuthor: false,
    }),
  })

  if (!response.ok) throw await readError(response, 'publish post')

  const postUrn = response.headers.get('x-restli-id')
  if (!postUrn) {
    throw new Error('[linkedin] publish succeeded but returned no post URN (x-restli-id header).')
  }

  return { postUrn, imageUrn }
}

// ---------------------------------------------------------------------------
// Local post records
// ---------------------------------------------------------------------------

export interface RecordPublishedPostArgs {
  organizationId: string
  accountId: string
  authorId: string
  commentary: string
  postUrn: string
  imageUrn: string | null
}

/**
 * SOURCE OF TRUTH KEYWORDS: recordPublishedPost
 *
 * WHAT:  Writes our record of a post that LinkedIn accepted.
 * WHY:   This table is the only readable history: LinkedIn gates reading a
 *        member's own posts behind `r_member_social`, which is restricted to
 *        approved partners, so the feed can never be re-fetched.
 */
export async function recordPublishedPost(db: DbClient, args: RecordPublishedPostArgs) {
  return db.linkedInPost.create({ data: args })
}

/**
 * SOURCE OF TRUTH KEYWORDS: listPublishedPosts
 *
 * WHAT:  Recent posts for an organization, newest first.
 * WHERE: Backs the recent-posts strip under the composer.
 */
export async function listPublishedPosts(db: DbClient, organizationId: string, limit: number) {
  return db.linkedInPost.findMany({
    where: { organizationId },
    orderBy: { publishedAt: 'desc' },
    take: limit,
    select: {
      id: true,
      commentary: true,
      postUrn: true,
      imageUrn: true,
      publishedAt: true,
    },
  })
}

/**
 * SOURCE OF TRUTH KEYWORDS: deletePublishedPost
 *
 * WHAT:  Forgets our local record of a post.
 * WHY:   Scoped by organizationId as well as id so one tenant can never delete
 *        another's row by guessing a cuid. Does NOT delete from LinkedIn.
 */
export async function deletePublishedPost(
  db: DbClient,
  organizationId: string,
  postId: string
): Promise<void> {
  await db.linkedInPost.deleteMany({ where: { id: postId, organizationId } })
}

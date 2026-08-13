/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "server-only";

/**
 * SOURCE OF TRUTH KEYWORDS: LINKEDIN_ACCOUNT_SAFE_SELECT, POST_SAFE_SELECT,
 *   buildAuthorizationUrl, exchangeCodeForToken, fetchMemberProfile,
 *   upsertConnection, disconnectAccount, getConnectionStatus,
 *   getValidAccessToken, uploadImage, resolvePostImage, publishPost,
 *   recordPublishedPost, createScheduledPost, listPublishedPosts,
 *   listCalendarPosts, deletePublishedPost, publishDueScheduledPosts,
 *   reclaimStalePublishingPosts, markPostFailed, LinkedInTokenResponse,
 *   LinkedInUserInfo, PublishPostResult, PublishDueResult,
 *   DeletePostRecordResult
 *
 * WHAT:  Every LinkedIn touchpoint — the OAuth handshake, credential storage
 *        and refresh, image upload, post publishing, the local post record,
 *        and the background worker that publishes scheduled posts.
 * WHY:   `server-only` because this file reads bearer tokens off the
 *        LinkedInAccount row; importing it into a client bundle would ship
 *        posting credentials to the browser. All LinkedIn HTTP lives here so
 *        the versioned-API headers and the x-restli-id response quirk are
 *        implemented once, and callers stay pure business logic.
 * WHERE: Called by src/trpc/routers/linkedin-posts.ts, integrations.ts, and the
 *        OAuth route handlers under src/app/api/linkedin/*. DB access takes the
 *        caller's `db` client so it can join a transaction.
 */

import type { DbClient } from "@/lib/config/prisma";
import type { LinkedInAccount, LinkedInPost, Prisma } from "@/generated/prisma";
import {
  getLinkedInCredentials,
  getLinkedInRedirectUri,
  isLinkedInConfigured,
  LINKEDIN_API_VERSION,
  LINKEDIN_ENDPOINTS,
  LINKEDIN_SCOPES,
} from "@/lib/config/linkedin";
import { LINKEDIN_IMAGE_TRANSFORM } from "@/lib/config/imagekit";
import {
  MAX_PUBLISH_ATTEMPTS,
  PUBLISH_BATCH_SIZE,
  PUBLISHING_STALE_MS,
} from "@/lib/config/scheduler";
import type { LinkedInConnectionStatus } from "@/lib/types/linkedin";
import type {
  LinkedInImageBinary,
  LinkedInPostStatus,
  PostImageValues,
} from "@/lib/types";
import * as imagekitService from "@/services/imagekit.service";
import { logActivity } from "@/services/activity-log.service";

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
} as const satisfies Prisma.LinkedInAccountSelect;

/* Refresh this far ahead of expiry so a long publish doesn't straddle it. */
const TOKEN_REFRESH_SKEW_MS = 5 * 60 * 1000;

interface LinkedInTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
  scope?: string;
}

interface LinkedInUserInfo {
  sub: string;
  name?: string;
  picture?: string;
}

interface LinkedInImageUploadResponse {
  value: { uploadUrl: string; image: string };
}

export interface PublishPostResult {
  postUrn: string;
  imageUrn: string | null;
}

/* LinkedIn returns errors as JSON with a `message`, but not always — a 5xx can
 * be HTML. Read as text and surface a bounded excerpt so failures are
 * diagnosable without dumping a whole error page into the UI. */
async function readError(response: Response, context: string): Promise<Error> {
  const body = await response.text().catch(() => "");
  return new Error(
    `[linkedin] ${context} failed (${response.status}): ${body.slice(0, 300) || "no response body"}`,
  );
}

/* Every versioned LinkedIn REST call needs these three headers; the API
 * rejects the request outright without them. */
function restHeaders(accessToken: string): Record<string, string> {
  return {
    Authorization: `Bearer ${accessToken}`,
    "X-Restli-Protocol-Version": "2.0.0",
    "LinkedIn-Version": LINKEDIN_API_VERSION,
  };
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
  const { clientId } = getLinkedInCredentials();
  const url = new URL(LINKEDIN_ENDPOINTS.authorization);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", getLinkedInRedirectUri());
  url.searchParams.set("state", state);
  url.searchParams.set("scope", LINKEDIN_SCOPES.join(" "));
  return url.toString();
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
export async function exchangeCodeForToken(
  code: string,
): Promise<LinkedInTokenResponse> {
  const { clientId, clientSecret } = getLinkedInCredentials();

  const response = await fetch(LINKEDIN_ENDPOINTS.accessToken, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: getLinkedInRedirectUri(),
    }),
  });

  if (!response.ok) throw await readError(response, "token exchange");
  return (await response.json()) as LinkedInTokenResponse;
}

/**
 * SOURCE OF TRUTH KEYWORDS: refreshAccessToken
 *
 * WHAT:  Exchanges a refresh token for a fresh access token.
 * WHY:   Only apps LinkedIn has approved for refresh tokens ever receive one,
 *        which is why the stored column is nullable and callers must handle the
 *        reconnect path.
 */
async function refreshAccessToken(
  refreshToken: string,
): Promise<LinkedInTokenResponse> {
  const { clientId, clientSecret } = getLinkedInCredentials();

  const response = await fetch(LINKEDIN_ENDPOINTS.accessToken, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!response.ok) throw await readError(response, "token refresh");
  return (await response.json()) as LinkedInTokenResponse;
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
export async function fetchMemberProfile(
  accessToken: string,
): Promise<LinkedInUserInfo> {
  const response = await fetch(LINKEDIN_ENDPOINTS.userinfo, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw await readError(response, "userinfo");
  return (await response.json()) as LinkedInUserInfo;
}

// ---------------------------------------------------------------------------
// Connection persistence
// ---------------------------------------------------------------------------

export interface UpsertConnectionArgs {
  organizationId: string;
  userId: string;
  personUrn: string;
  name: string;
  avatarUrl: string | null;
  token: LinkedInTokenResponse;
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
  args: UpsertConnectionArgs,
): Promise<LinkedInAccount> {
  const now = Date.now();
  const expiresAt = new Date(now + args.token.expires_in * 1000);
  const refreshTokenExpiresAt = args.token.refresh_token_expires_in
    ? new Date(now + args.token.refresh_token_expires_in * 1000)
    : null;

  const data = {
    userId: args.userId,
    personUrn: args.personUrn,
    name: args.name,
    avatarUrl: args.avatarUrl,
    accessToken: args.token.access_token,
    refreshToken: args.token.refresh_token ?? null,
    expiresAt,
    refreshTokenExpiresAt,
    scope: args.token.scope ?? LINKEDIN_SCOPES.join(" "),
  };

  return db.linkedInAccount.upsert({
    where: { organizationId: args.organizationId },
    create: { organizationId: args.organizationId, ...data },
    update: data,
  });
}

/**
 * SOURCE OF TRUTH KEYWORDS: disconnectAccount, canceled, SetNull
 *
 * WHAT:  Drops an organization's LinkedIn connection and cancels anything still
 *        queued against it.
 * WHY:   deleteMany rather than delete so disconnecting an already-disconnected
 *        org is idempotent instead of throwing P2025.
 *
 *        Scheduled posts are cancelled FIRST, in the same transaction. The
 *        relation is onDelete: SetNull, so post rows now survive a disconnect —
 *        which is what preserves published history, but would otherwise leave
 *        queued posts waiting forever on a connection that no longer exists.
 *        The worker only claims `scheduled` rows, so moving them to `canceled`
 *        is what stops it retrying them to MAX_PUBLISH_ATTEMPTS and marking
 *        them `failed` with an error the user cannot act on.
 *
 *        `publishing` is deliberately excluded: the worker has already claimed
 *        that row and may be mid-call to LinkedIn. Same reasoning as
 *        CANCELABLE_POST_STATUSES.
 * WHERE: integrations.disconnect.
 */
export async function disconnectAccount(
  db: DbClient,
  organizationId: string,
): Promise<{ canceledPosts: number }> {
  const { count } = await db.linkedInPost.updateMany({
    where: { organizationId, status: STATUS.scheduled },
    data: { status: STATUS.canceled },
  });

  await db.linkedInAccount.deleteMany({ where: { organizationId } });

  return { canceledPosts: count };
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
  organizationId: string,
): Promise<LinkedInConnectionStatus> {
  const configured = isLinkedInConfigured();
  const account = await db.linkedInAccount.findUnique({
    where: { organizationId },
    select: {
      name: true,
      avatarUrl: true,
      expiresAt: true,
      refreshToken: true,
    },
  });

  if (!account) {
    return {
      connected: false,
      configured,
      name: null,
      avatarUrl: null,
      expiresAt: null,
      needsReconnect: false,
    };
  }

  /* Expired with no refresh token means the only way back is a fresh consent
   * flow — surfaced so the UI can say "Reconnect" rather than failing at publish. */
  const expired = account.expiresAt.getTime() <= Date.now();
  return {
    connected: true,
    configured,
    name: account.name,
    avatarUrl: account.avatarUrl,
    expiresAt: account.expiresAt,
    needsReconnect: expired && !account.refreshToken,
  };
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
  organizationId: string,
): Promise<{ accessToken: string; personUrn: string; accountId: string }> {
  const account = await db.linkedInAccount.findUnique({
    where: { organizationId },
  });
  if (!account) {
    throw new Error("No LinkedIn account is connected for this organization.");
  }

  const stale =
    account.expiresAt.getTime() - TOKEN_REFRESH_SKEW_MS <= Date.now();
  if (!stale) {
    return {
      accessToken: account.accessToken,
      personUrn: account.personUrn,
      accountId: account.id,
    };
  }

  if (!account.refreshToken) {
    throw new Error(
      "Your LinkedIn connection has expired. Reconnect your account to keep publishing.",
    );
  }

  const token = await refreshAccessToken(account.refreshToken);
  const now = Date.now();
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
  });

  return {
    accessToken: updated.accessToken,
    personUrn: updated.personUrn,
    accountId: updated.id,
  };
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
  image: LinkedInImageBinary,
): Promise<string> {
  const initResponse = await fetch(
    `${LINKEDIN_ENDPOINTS.images}?action=initializeUpload`,
    {
      method: "POST",
      headers: {
        ...restHeaders(accessToken),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ initializeUploadRequest: { owner: personUrn } }),
    },
  );

  if (!initResponse.ok)
    throw await readError(initResponse, "image upload initialize");
  const { value } = (await initResponse.json()) as LinkedInImageUploadResponse;

  const uploadResponse = await fetch(value.uploadUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": image.mimeType,
    },
    body: new Uint8Array(image.bytes),
  });

  if (!uploadResponse.ok) throw await readError(uploadResponse, "image upload");
  return value.image;
}

/**
 * SOURCE OF TRUTH KEYWORDS: resolvePostImage
 *
 * WHAT:  Turns a stored ImageKit reference into the bytes LinkedIn will accept.
 * WHY:   The single place the transform decision is made, so an immediate
 *        publish and a scheduled one can never render different pixels. Falls
 *        back to LINKEDIN_IMAGE_TRANSFORM when a post carries no custom edit —
 *        which is every post until the image editor writes `transform`.
 * WHERE: Called by publishPost; the only producer of LinkedInImageBinary.
 */
async function resolvePostImage(
  image: PostImageValues,
): Promise<LinkedInImageBinary> {
  return imagekitService.fetchImageBinary(
    imagekitService.buildTransformedUrl(
      image.url,
      image.transform ?? LINKEDIN_IMAGE_TRANSFORM,
    ),
  );
}

export interface PublishPostArgs {
  accessToken: string;
  personUrn: string;
  commentary: string;
  image?: PostImageValues | undefined;
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
export async function publishPost(
  args: PublishPostArgs,
): Promise<PublishPostResult> {
  /* Fetch the transformed image from ImageKit, then hand LinkedIn the bytes.
   * LinkedIn will not pull from a third-party URL, so this hop is unavoidable —
   * it is the only moment image bytes exist inside this app. */
  const imageUrn = args.image
    ? await uploadImage(
        args.accessToken,
        args.personUrn,
        await resolvePostImage(args.image),
      )
    : null;

  const response = await fetch(LINKEDIN_ENDPOINTS.posts, {
    method: "POST",
    headers: {
      ...restHeaders(args.accessToken),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      author: args.personUrn,
      commentary: args.commentary,
      visibility: "PUBLIC",
      distribution: {
        feedDistribution: "MAIN_FEED",
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      ...(imageUrn ? { content: { media: { id: imageUrn } } } : {}),
      lifecycleState: "PUBLISHED",
      isReshareDisabledByAuthor: false,
    }),
  });

  if (!response.ok) throw await readError(response, "publish post");

  const postUrn = response.headers.get("x-restli-id");
  if (!postUrn) {
    throw new Error(
      "[linkedin] publish succeeded but returned no post URN (x-restli-id header).",
    );
  }

  return { postUrn, imageUrn };
}

// ---------------------------------------------------------------------------
// Local post records
// ---------------------------------------------------------------------------

/* The legal values of LinkedInPost.status. schema.prisma stores it as a bare
 * String (this codebase has no Prisma enums), so this checked map is what stops
 * a typo'd literal from silently creating a status nothing ever queries. */
const STATUS = {
  scheduled: "scheduled",
  publishing: "publishing",
  published: "published",
  failed: "failed",
  canceled: "canceled",
} as const satisfies Record<LinkedInPostStatus, LinkedInPostStatus>;

/* Columns a client may read. Deliberately narrow: the row also carries
 * lastError and claimedAt, which are worker bookkeeping, not user content. */
const POST_SAFE_SELECT = {
  id: true,
  commentary: true,
  status: true,
  postUrn: true,
  imageUrn: true,
  imageUrl: true,
  imageTransform: true,
  scheduledFor: true,
  publishedAt: true,
  createdAt: true,
} as const satisfies Prisma.LinkedInPostSelect;

/* Rebuilds the ImageKit reference from its stored columns. Returns undefined
 * when the post has no image, which is exactly what publishPost expects. */
function toPostImage(post: LinkedInPost): PostImageValues | undefined {
  if (!post.imageFileId || !post.imageUrl) return undefined;
  return {
    fileId: post.imageFileId,
    url: post.imageUrl,
    ...(post.imageTransform ? { transform: post.imageTransform } : {}),
    /* Both halves required: a reference with only one of the two cannot be
     * reverted to, so a partial row reads as no original at all. */
    ...(post.originalFileId && post.originalUrl
      ? {
          original: { fileId: post.originalFileId, url: post.originalUrl },
        }
      : {}),
  };
}

/* Flattens an ImageKit reference onto the columns. One writer for both the
 * immediate and scheduled paths so they cannot drift. */
function imageColumns(image: PostImageValues | undefined) {
  return {
    imageFileId: image?.fileId ?? null,
    imageUrl: image?.url ?? null,
    imageTransform: image?.transform ?? null,
    /* Null unless an AI edit replaced the bytes — see the schema note on why a
     * transform never populates these. */
    originalFileId: image?.original?.fileId ?? null,
    originalUrl: image?.original?.url ?? null,
  };
}

export interface RecordPublishedPostArgs {
  organizationId: string;
  accountId: string;
  authorId: string;
  commentary: string;
  postUrn: string;
  imageUrn: string | null;
  image?: PostImageValues | undefined;
}

/**
 * SOURCE OF TRUTH KEYWORDS: recordPublishedPost
 *
 * WHAT:  Writes our record of a post that LinkedIn accepted.
 * WHY:   This table is the only readable history: LinkedIn gates reading a
 *        member's own posts behind `r_member_social`, which is restricted to
 *        approved partners, so the feed can never be re-fetched.
 *
 *        `publishedAt` is set explicitly because the column lost its
 *        `@default(now())` when scheduling landed — a scheduled row must not
 *        claim a publish time it does not have.
 */
export async function recordPublishedPost(
  db: DbClient,
  args: RecordPublishedPostArgs,
) {
  const { image, ...rest } = args;
  return db.linkedInPost.create({
    data: {
      ...rest,
      status: STATUS.published,
      publishedAt: new Date(),
      ...imageColumns(image),
    },
  });
}

export interface CreateScheduledPostArgs {
  organizationId: string;
  accountId: string;
  authorId: string;
  commentary: string;
  scheduledFor: Date;
  image?: PostImageValues | undefined;
}

/**
 * SOURCE OF TRUTH KEYWORDS: createScheduledPost
 *
 * WHAT:  Queues a post for the worker. No LinkedIn call happens here.
 * WHY:   Written by `linkedinPosts.create` — the SAME verb as an immediate
 *        publish — so the plan-limit gate and usage counter fire once, at the
 *        moment the user commits to the post. A dedicated `schedule` verb would
 *        have consumed no quota and let an org publish its plan limit twice.
 *
 *        The image is stored as an ImageKit reference rather than bytes: this
 *        row may sit for days, and a request payload cannot survive that.
 * WHERE: Called by linkedinPosts.create when input.scheduledFor is present.
 */
export async function createScheduledPost(
  db: DbClient,
  args: CreateScheduledPostArgs,
) {
  const { image, ...rest } = args;
  return db.linkedInPost.create({
    data: {
      ...rest,
      status: STATUS.scheduled,
      /* Explicitly null: a scheduled post has neither yet, and both columns are
       * what the worker fills in on success. */
      postUrn: null,
      publishedAt: null,
      ...imageColumns(image),
    },
  });
}

/**
 * SOURCE OF TRUTH KEYWORDS: listPublishedPosts
 *
 * WHAT:  Recent PUBLISHED posts for an organization, newest first.
 * WHY:   Filters on status so the composer's recent-posts strip never shows a
 *        post that hasn't gone out yet — a scheduled row would otherwise sort
 *        into the feed with a null publishedAt and read as already published.
 * WHERE: Backs the recent-posts strip under the composer.
 */
export async function listPublishedPosts(
  db: DbClient,
  organizationId: string,
  limit: number,
) {
  return db.linkedInPost.findMany({
    where: { organizationId, status: STATUS.published },
    orderBy: { publishedAt: "desc" },
    take: limit,
    select: POST_SAFE_SELECT,
  });
}

/**
 * SOURCE OF TRUTH KEYWORDS: listCalendarPosts
 *
 * WHAT:  Every post an org has planned or published inside a date window.
 * WHY:   The OR is the whole point: a scheduled post is placed on the calendar
 *        by `scheduledFor` and a published one by `publishedAt`, so a single
 *        date filter would silently drop half the grid.
 * WHERE: Backs linkedinPosts.listCalendar and the month grid.
 */
export async function listCalendarPosts(
  db: DbClient,
  organizationId: string,
  from: Date,
  to: Date,
) {
  return db.linkedInPost.findMany({
    where: {
      organizationId,
      OR: [
        { scheduledFor: { gte: from, lte: to } },
        { publishedAt: { gte: from, lte: to } },
      ],
    },
    orderBy: [{ scheduledFor: "asc" }, { publishedAt: "asc" }],
    select: POST_SAFE_SELECT,
  });
}

export interface DeletePostRecordResult {
  count: number;
  /** Set when the deleted row owned an ImageKit asset that should now go. */
  imageFileId: string | null;
  /** True when this removed a future post rather than forgetting a past one. */
  wasScheduled: boolean;
}

/**
 * SOURCE OF TRUTH KEYWORDS: deletePublishedPost, deletePostRecord
 *
 * WHAT:  Removes one post row — cancelling a scheduled post or forgetting a
 *        published record, depending on what the row is.
 * WHY:   ONE function for both because they are indistinguishable to the quota
 *        system: `linkedinPosts.delete` refunds a post slot either way, and
 *        which case applies is a property of the row, not of the caller.
 *
 *        A row in `publishing` is refused. The worker has already claimed it
 *        and may be mid-call to LinkedIn; deleting it would either strand a
 *        live post with no local record or race the worker's own update. The
 *        status guard is repeated in the delete itself, not just the read, so a
 *        claim landing between the two is still caught.
 *
 *        Scoped by organizationId as well as id so one tenant can never delete
 *        another's row by guessing a cuid. Does NOT delete from LinkedIn.
 *
 *        The `count` is returned rather than swallowed because the caller's
 *        return value drives the usage counter: computeDeleteDecrement in
 *        protectedProcedure only honours a `count` field, and anything else
 *        decrements by 1. Returning void meant deleting an already-deleted or
 *        other-tenant post still refunded a post slot.
 */
export async function deletePublishedPost(
  db: DbClient,
  organizationId: string,
  postId: string,
): Promise<DeletePostRecordResult> {
  const existing = await db.linkedInPost.findFirst({
    where: { id: postId, organizationId },
    select: { status: true, imageFileId: true },
  });

  if (!existing) return { count: 0, imageFileId: null, wasScheduled: false };

  if (existing.status === STATUS.publishing) {
    throw new Error(
      "This post is being published right now and can no longer be cancelled.",
    );
  }

  const { count } = await db.linkedInPost.deleteMany({
    where: {
      id: postId,
      organizationId,
      status: { not: STATUS.publishing },
    },
  });

  return {
    count,
    imageFileId: existing.imageFileId,
    wasScheduled:
      existing.status === STATUS.scheduled || existing.status === STATUS.failed,
  };
}

// ---------------------------------------------------------------------------
// Scheduled-post worker
//
// Runs OUTSIDE the request lifecycle, so it cannot use protectedProcedure —
// there is no session and no organizationId in a tRPC input. The sanctioned
// path (docs/03-procedures-and-routers.md) is calling these services with the
// prisma singleton, which is why every function here takes `db` first.
//
// Deliberately does NOT touch the usage counter: the post slot was spent at
// SCHEDULE time by linkedinPosts.create. Incrementing here would charge an org
// twice for one post.
// ---------------------------------------------------------------------------

export interface PublishDueResult {
  claimed: number;
  published: number;
  failed: number;
}

/**
 * SOURCE OF TRUTH KEYWORDS: reclaimStalePublishingPosts
 *
 * WHAT:  Returns rows stranded in `publishing` to `scheduled`.
 * WHY:   Only `scheduled` rows are ever claimed, so a worker that dies
 *        mid-publish would strand its post forever. The reclaimed row keeps its
 *        attemptCount, so a post that reliably kills the worker still hits
 *        MAX_PUBLISH_ATTEMPTS and stops instead of looping.
 * WHERE: Called at the top of every run by the trigger route.
 */
export async function reclaimStalePublishingPosts(
  db: DbClient,
  now: Date,
): Promise<{ count: number }> {
  const cutoff = new Date(now.getTime() - PUBLISHING_STALE_MS);
  return db.linkedInPost.updateMany({
    where: { status: STATUS.publishing, claimedAt: { lt: cutoff } },
    data: { status: STATUS.scheduled, claimedAt: null },
  });
}

/**
 * SOURCE OF TRUTH KEYWORDS: publishDueScheduledPosts
 *
 * WHAT:  Claims every post that is due and publishes it. The whole worker.
 * WHY:   The claim is a single atomic UPDATE guarded on `status = 'scheduled'`
 *        with `FOR UPDATE SKIP LOCKED`. That combination is what makes the
 *        trigger endpoint safe to call concurrently: two overlapping runs
 *        cannot claim the same row, so a post can never publish twice — the one
 *        failure mode that would be visible to the user's audience and
 *        impossible to undo.
 *
 *        Posts are published SEQUENTIALLY, never in parallel: LinkedIn
 *        rate-limits member posting, and the app's own limit is 5/min.
 * WHERE: Called by src/app/api/scheduled-posts/run/route.ts with the prisma
 *        singleton.
 */
export async function publishDueScheduledPosts(
  db: DbClient,
  now: Date,
): Promise<PublishDueResult> {
  const claimed = await db.$queryRaw<Array<{ id: string }>>`
    UPDATE "linkedin_post"
       SET "status" = ${STATUS.publishing},
           "attemptCount" = "attemptCount" + 1,
           "claimedAt" = ${now}
     WHERE "id" IN (
       SELECT "id" FROM "linkedin_post"
        WHERE "status" = ${STATUS.scheduled}
          AND "scheduledFor" <= ${now}
          AND "attemptCount" < ${MAX_PUBLISH_ATTEMPTS}
        ORDER BY "scheduledFor" ASC
        LIMIT ${PUBLISH_BATCH_SIZE}
        FOR UPDATE SKIP LOCKED
     )
    RETURNING "id"`;

  const result: PublishDueResult = {
    claimed: claimed.length,
    published: 0,
    failed: 0,
  };

  for (const { id } of claimed) {
    const post = await db.linkedInPost.findUnique({ where: { id } });
    /* Deleted between the claim and now — nothing to publish, nothing to fix. */
    if (!post) continue;

    let token: Awaited<ReturnType<typeof getValidAccessToken>>;
    try {
      token = await getValidAccessToken(db, post.organizationId);
    } catch (error) {
      /* A missing or unrefreshable connection is TERMINAL by construction:
       * retrying cannot conjure a token, and the fix is a human reconnecting.
       * Catching the token step separately is what lets this be decided
       * structurally instead of by matching on an error message. */
      await markPostFailed(db, post, error, true);
      result.failed += 1;
      continue;
    }

    try {
      const published = await publishPost({
        accessToken: token.accessToken,
        personUrn: token.personUrn,
        commentary: post.commentary,
        image: toPostImage(post),
      });

      await db.linkedInPost.update({
        where: { id: post.id },
        data: {
          status: STATUS.published,
          postUrn: published.postUrn,
          imageUrn: published.imageUrn,
          publishedAt: new Date(),
          lastError: null,
          claimedAt: null,
        },
      });

      /* Audit here even though create already logged the scheduling: the org
       * needs "your post went live at 09:00" as its own event. Calling
       * logActivity directly is legal precisely because there is no procedure
       * in this path to auto-audit it — the usual double-write warning does
       * not apply. */
      await logActivity(
        {
          userId: post.authorId,
          organizationId: post.organizationId,
          action: "publish",
          entity: "linkedinPosts",
          entityId: post.id,
          description: "Published a scheduled LinkedIn post",
        },
        db,
      );

      result.published += 1;
    } catch (error) {
      /* attemptCount was already incremented by the claim, so comparing it here
       * counts the attempt that just failed. */
      await markPostFailed(
        db,
        post,
        error,
        post.attemptCount >= MAX_PUBLISH_ATTEMPTS,
      );
      result.failed += 1;
    }
  }

  return result;
}

/* Records why a publish failed and decides whether to try again. A retryable
 * row returns to `scheduled` and is picked up by a later run — which is where
 * the backoff comes from, without a scheduler that knows anything about it. */
async function markPostFailed(
  db: DbClient,
  post: LinkedInPost,
  error: unknown,
  terminal: boolean,
): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  await db.linkedInPost.update({
    where: { id: post.id },
    data: {
      status: terminal ? STATUS.failed : STATUS.scheduled,
      /* Bounded — this is vendor error text rendered back to the user, and a
       * 5xx HTML page would otherwise land whole in the column. */
      lastError: message.slice(0, 500),
      claimedAt: null,
    },
  });
}

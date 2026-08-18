/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: LINKEDIN_IMAGE_MIME_TYPES, LinkedInImageMimeType,
 *   LinkedInImageBinary, PostDocumentValues, LINKEDIN_OAUTH_ERROR_CODES,
 *   LinkedInOAuthErrorCode,
 *   normalizeLinkedInOAuthError, LINKEDIN_POST_STATUSES, LinkedInPostStatus,
 *   isSchedulableStatus, scheduledForSchema, publishPostSchema,
 *   PublishPostValues, disconnectIntegrationSchema, listPostsSchema,
 *   deletePostSchema, listCalendarPostsSchema, ListCalendarPostsValues,
 *   LinkedInConnectionStatus, saveDraftSchema, SaveDraftValues,
 *   discardDraftSchema, getPostSchema, postStatusSchema,
 *   listLibraryPostsSchema, ListLibraryPostsValues
 *
 * WHAT:  Input contracts for publishing and scheduling LinkedIn posts, the post
 *        lifecycle states, and the client-safe connection-status shape.
 * WHY:   Images are referenced by ImageKit handle rather than carried as bytes
 *        (see src/lib/types/imagekit.ts) — a scheduled post publishes days after
 *        it was written and cannot hold its image in a request payload.
 *        LinkedInConnectionStatus is declared as its own type to guarantee
 *        tokens can never be widened into a client response by an accidental
 *        `select`.
 * WHERE: Consumed by src/services/linkedin.service.ts, the linkedinPosts and
 *        integrations routers, and the composer + calendar UI.
 */

import { z } from "zod";
import { LINKEDIN_MAX_COMMENTARY } from "@/lib/config/linkedin";
import { MIN_SCHEDULE_LEAD_MS } from "@/lib/config/scheduler";
import { postImageSchema } from "./imagekit";

/* LinkedIn's Images API accepts these for member posts. Still enforced at the
 * file picker even though ImageKit would store anything — LinkedIn is the
 * consumer, so its constraint is the real one. */
export const LINKEDIN_IMAGE_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
] as const;
export type LinkedInImageMimeType = (typeof LINKEDIN_IMAGE_MIME_TYPES)[number];

/**
 * SOURCE OF TRUTH KEYWORDS: LinkedInImageBinary
 *
 * WHAT:  Raw image bytes on their way to LinkedIn's upload endpoint.
 * WHY:   The publish path fetches the transformed image from ImageKit and hands
 *        LinkedIn the result. Bytes exist only for that hop — they are never an
 *        input contract, never persisted, and never cross the tRPC boundary.
 * WHERE: Produced by the publish path, consumed by uploadImage.
 */
export interface LinkedInImageBinary {
  mimeType: string;
  bytes: ArrayBuffer;
}

/**
 * SOURCE OF TRUTH KEYWORDS: PostDocumentValues
 *
 * WHAT:  The stored reference to a rendered carousel PDF, as the publish path
 *        needs it.
 * WHY:   Resolved SERVER-SIDE from a Document row rather than accepted from the
 *        client: the router is handed only an id, so a post can never be pointed
 *        at a file the organization does not own.
 *
 *        `title` rides along because LinkedIn DISPLAYS it — for a document post
 *        the title is the deck's visible name in the feed, unlike an image where
 *        no such field exists.
 * WHERE: Produced by the linkedinPosts router and the scheduled-post worker;
 *        consumed by publishPost.
 */
export interface PostDocumentValues {
  url: string;
  title: string;
}

/**
 * SOURCE OF TRUTH KEYWORDS: LINKEDIN_POST_STATUSES, LinkedInPostStatus,
 *   isSchedulableStatus
 *
 * WHAT:  The lifecycle of a LinkedInPost row.
 * WHY:   One row covers the whole life of a post rather than a separate drafts
 *        table, so status is what distinguishes "goes out Tuesday" from "went
 *        out". Mirrors the bare-String convention in schema.prisma — this
 *        codebase has no Prisma enums, so this array is the enforcement point.
 *
 *        `draft` is the state before the org has committed to anything: no
 *        quota spent, no LinkedIn connection required, no date. It leaves that
 *        state only through `linkedinPosts.create`, which promotes the row in
 *        place — see publishPostSchema.draftId.
 *
 *        `publishing` exists as a distinct state so the worker's claim is
 *        visible in the database: it is what makes double-publish impossible
 *        across overlapping runs, and what the stale-reaper looks for.
 * WHERE: Written by the linkedinPosts router and the scheduled-post worker;
 *        read by the calendar to decide how a post renders.
 */
export const LINKEDIN_POST_STATUSES = [
  "draft",
  "scheduled",
  "publishing",
  "published",
  "failed",
  "canceled",
] as const;
export type LinkedInPostStatus = (typeof LINKEDIN_POST_STATUSES)[number];

/* Statuses a user may still cancel. `publishing` is deliberately excluded —
 * cancelling a row the worker already claimed would race the LinkedIn call and
 * could delete a post that is about to go live. */
export const CANCELABLE_POST_STATUSES: readonly LinkedInPostStatus[] = [
  "scheduled",
  "failed",
];

/**
 * SOURCE OF TRUTH KEYWORDS: scheduledForSchema
 *
 * WHAT:  When a post should publish.
 * WHY:   The lead-time floor prevents a post from being scheduled into a poll
 *        that is already in flight — which would race the user's own
 *        confirmation toast. MIN_SCHEDULE_LEAD_MS lives in config/scheduler so
 *        the worker's timing assumptions are stated in one place.
 * WHERE: Optional field on publishPostSchema; drives the composer's date input.
 */
export const scheduledForSchema = z.coerce
  .date()
  .refine(
    (value) => value.getTime() > Date.now() + MIN_SCHEDULE_LEAD_MS,
    `Pick a time at least ${MIN_SCHEDULE_LEAD_MS / 60_000} minutes from now`,
  );

/**
 * SOURCE OF TRUTH KEYWORDS: LINKEDIN_OAUTH_ERROR_CODES, LinkedInOAuthErrorCode,
 *   normalizeLinkedInOAuthError
 *
 * WHAT:  The closed set of connection-failure codes the OAuth routes may put on
 *        the `?error=` param, and the normalizer that maps LinkedIn's raw code
 *        onto one of them.
 * WHY:   The callback used to collapse everything except an explicit cancel into
 *        `denied`, which destroyed the distinction that matters most: an app
 *        missing its LinkedIn products reports `invalid_scope_error`, and
 *        rendering that as "LinkedIn denied the request" sends the operator
 *        hunting the redirect URL instead of the Products tab. Normalizing
 *        against an allowlist also means a raw provider string is never
 *        reflected from the query param into the UI.
 * WHERE: Produced by src/app/api/linkedin/callback + connect routes; consumed by
 *        CALLBACK_ERROR_MESSAGES in the composer, which is typed against this
 *        union so a new code cannot ship without user-facing copy.
 */
export const LINKEDIN_OAUTH_ERROR_CODES = [
  "cancelled",
  "denied",
  "invalid_scope",
  "unauthorized_client",
  "server_error",
  "invalid_state",
  "exchange_failed",
  "not_configured",
] as const;
export type LinkedInOAuthErrorCode =
  (typeof LINKEDIN_OAUTH_ERROR_CODES)[number];

/* LinkedIn mixes standard OAuth 2.0 codes with its own `*_error` spellings, and
 * returns them on a page whose visible text is always the same generic failure —
 * so the raw code is the only signal distinguishing these causes. */
const LINKEDIN_OAUTH_ERROR_MAP: Record<string, LinkedInOAuthErrorCode> = {
  user_cancelled_login: "cancelled",
  user_cancelled_authorize: "cancelled",
  invalid_scope_error: "invalid_scope",
  unauthorized_scope_error: "invalid_scope",
  invalid_scope: "invalid_scope",
  unauthorized_client: "unauthorized_client",
  invalid_client: "unauthorized_client",
  access_denied: "denied",
  server_error: "server_error",
  temporarily_unavailable: "server_error",
};

/**
 * SOURCE OF TRUTH KEYWORDS: normalizeLinkedInOAuthError
 *
 * WHAT:  Maps a raw `?error=` value from LinkedIn to a known code.
 * WHY:   Unrecognized codes fall back to `denied` rather than passing through,
 *        so the union stays closed and the UI always has copy to render.
 * WHERE: Called by the LinkedIn callback route.
 */
export function normalizeLinkedInOAuthError(
  raw: string,
): LinkedInOAuthErrorCode {
  return LINKEDIN_OAUTH_ERROR_MAP[raw] ?? "denied";
}

/**
 * SOURCE OF TRUTH KEYWORDS: publishPostSchema, PublishPostValues
 *
 * WHAT:  Input contract for publishing a post to LinkedIn — now OR later.
 * WHY:   Capping commentary at LinkedIn's own 3000-character ceiling turns what
 *        would be a remote FIELD_LENGTH_TOO_LONG into a local field error the
 *        composer can render inline.
 *
 *        `scheduledFor` is an OPTIONAL FIELD rather than a separate schema and
 *        separate endpoint, and that is load-bearing: scheduling stays
 *        `linkedinPosts.create`, so the plan-limit gate and usage counter fire
 *        exactly once — when the user commits to the post — whether it goes out
 *        now or on Tuesday. A dedicated `schedule` verb would have spent no
 *        quota, letting an org publish its plan limit twice over.
 * WHERE: Router input for linkedinPosts.create; resolver for the composer form.
 */
const postContentSchema = z.object({
  commentary: z
    .string()
    .trim()
    .min(1, "Write something before publishing")
    .max(
      LINKEDIN_MAX_COMMENTARY,
      `Posts are limited to ${LINKEDIN_MAX_COMMENTARY} characters`,
    ),
  image: postImageSchema.optional(),
  /* A rendered carousel to publish as a LinkedIn DOCUMENT post. Just the id —
   * the url, filename and page count are read server-side from the Document row,
   * so a client cannot point a post at a file the org does not own. */
  documentId: z.string().min(1).optional(),
});

/* LinkedIn's Posts API takes ONE `content.media`. Sending both an image and a
 * document would silently drop one of them, so the impossible combination is
 * rejected rather than resolved by whichever the publish path happens to check
 * first.
 *
 * Declared once and applied to BOTH schemas below: a draft that could hold an
 * image and a deck at the same time would be unpublishable the moment it was
 * promoted, and the user would only find out at the Publish button. */
function carriesOneMedium(values: {
  image?: unknown;
  documentId?: string | undefined;
}): boolean {
  return !(values.image && values.documentId);
}
/* Not `as const`: zod's refine params type `path` as a MUTABLE PropertyKey[], so
 * a readonly tuple is rejected at the call site. */
const MEDIA_EXCLUSIVE_ERROR = {
  message: "A post can carry either an image or a carousel, not both",
  path: ["documentId"],
};

export const publishPostSchema = postContentSchema
  .extend({
    /* Absent ⇒ publish immediately. Present ⇒ queue it for the worker. */
    scheduledFor: scheduledForSchema.optional(),
    /* The draft this publish PROMOTES. Present ⇒ the server updates that row in
     * place instead of inserting a new one, so the draft does not survive as a
     * duplicate and the post slot is spent exactly once — here, by `create`,
     * rather than at save time. The commentary and media still come from the
     * request, because the user may have edited since the draft was loaded. */
    draftId: z.string().min(1).optional(),
  })
  .refine(carriesOneMedium, MEDIA_EXCLUSIVE_ERROR);
export type PublishPostValues = z.infer<typeof publishPostSchema>;

/**
 * SOURCE OF TRUTH KEYWORDS: saveDraftSchema, SaveDraftValues
 *
 * WHAT:  Input contract for saving a post the user is not ready to commit to.
 * WHY:   Deliberately NOT publishPostSchema: a draft has no `scheduledFor` (an
 *        unpublished post has no date, and accepting one here would create a
 *        queued post the worker publishes without the user ever pressing
 *        Publish) and no connected-account requirement.
 *
 *        `postId` present ⇒ update that draft, absent ⇒ create one. One verb for
 *        both because it is ONE user action — pressing Save repeatedly must not
 *        litter the library with copies — and neither branch touches the quota.
 * WHERE: Router input for linkedinPosts.draft; called by the composer's Save
 *        draft button.
 */
export const saveDraftSchema = postContentSchema
  .extend({
    postId: z.string().min(1).optional(),
  })
  .refine(carriesOneMedium, MEDIA_EXCLUSIVE_ERROR);
export type SaveDraftValues = z.infer<typeof saveDraftSchema>;

/**
 * SOURCE OF TRUTH KEYWORDS: discardDraftSchema
 *
 * WHAT:  Identifies a draft to throw away.
 * WHY:   Separate from deletePostSchema because the VERB is what matters, not the
 *        shape: `delete` decrements the post counter and `discard` does not, and
 *        a draft never spent a slot to refund. Same split as carousel.discard.
 */
export const discardDraftSchema = z.object({
  postId: z.string().min(1),
});

/**
 * SOURCE OF TRUTH KEYWORDS: getPostSchema
 *
 * WHAT:  Identifies one post row to read back.
 * WHERE: Router input for linkedinPosts.get; used by the composer to load a
 *        draft from `?draftId=`.
 */
export const getPostSchema = z.object({
  postId: z.string().min(1),
});

/**
 * SOURCE OF TRUTH KEYWORDS: postStatusSchema, listLibraryPostsSchema,
 *   ListLibraryPostsValues
 *
 * WHAT:  Paging, status filter and text search for the post library.
 * WHY:   Paged rather than range-bounded, unlike the calendar: a library grows
 *        without limit and a draft has no date to bound it by. `status` is
 *        validated against the union so the filter can never be a raw string the
 *        database has to interpret, and `search` is capped because it becomes a
 *        `contains` — an unbounded term is a free table scan.
 * WHERE: Router input for linkedinPosts.listLibrary.
 */
export const postStatusSchema = z.enum(LINKEDIN_POST_STATUSES);

export const listLibraryPostsSchema = z.object({
  /* page / pageSize are read by the factory's `paginate` option, which clamps
   * them — see resolvePaginationFor. Declared optional here so the client may
   * omit both and take the defaults. */
  page: z.number().int().positive().optional(),
  pageSize: z.number().int().positive().optional(),
  status: postStatusSchema.optional(),
  search: z.string().trim().max(200).optional(),
});
export type ListLibraryPostsValues = z.infer<typeof listLibraryPostsSchema>;

/**
 * SOURCE OF TRUTH KEYWORDS: listPostsSchema
 *
 * WHAT:  Paging input for the recent-posts strip.
 */
export const listPostsSchema = z.object({
  limit: z.number().int().min(1).max(50).default(10),
});

/**
 * SOURCE OF TRUTH KEYWORDS: listCalendarPostsSchema, ListCalendarPostsValues
 *
 * WHAT:  The visible date window for the content calendar.
 * WHY:   Bounded by month rather than paged: a calendar grid renders a fixed
 *        window, so the range IS the page. The span is capped so a crafted
 *        request can't ask for a decade of rows in one query.
 * WHERE: Router input for linkedinPosts.listCalendar.
 */
export const listCalendarPostsSchema = z
  .object({
    from: z.coerce.date(),
    to: z.coerce.date(),
  })
  .refine((value) => value.to.getTime() > value.from.getTime(), {
    message: "`to` must be after `from`",
    path: ["to"],
  })
  .refine(
    /* 100 days covers a six-week grid with room to spare; anything larger is
     * not a calendar view. */
    (value) =>
      value.to.getTime() - value.from.getTime() <= 100 * 24 * 60 * 60 * 1000,
    { message: "Date range is too large", path: ["to"] },
  );
export type ListCalendarPostsValues = z.infer<typeof listCalendarPostsSchema>;

/**
 * SOURCE OF TRUTH KEYWORDS: deletePostSchema
 *
 * WHAT:  Identifies a post row to remove — a scheduled post to cancel, or a
 *        published record to forget.
 * WHY:   One input for both because they are the same action to the quota
 *        system: `linkedinPosts.delete` refunds a post slot either way. Which
 *        one it is depends on the row's status, not on the caller.
 */
export const deletePostSchema = z.object({
  postId: z.string().min(1),
});

/**
 * SOURCE OF TRUTH KEYWORDS: disconnectIntegrationSchema
 *
 * WHAT:  Identifies which third-party connection to drop.
 * WHY:   Carries `provider` so the audit template
 *        ("Disconnected the {input.provider} account") interpolates, and so the
 *        same endpoint serves the next provider without a schema change.
 */
export const disconnectIntegrationSchema = z.object({
  provider: z.literal("linkedin"),
});

/**
 * SOURCE OF TRUTH KEYWORDS: LinkedInConnectionStatus
 *
 * WHAT:  The client-safe view of an org's LinkedIn connection.
 * WHY:   Explicitly enumerates the only fields allowed to reach a browser.
 *        Access and refresh tokens live on the same Prisma row, so returning
 *        the model directly would leak posting credentials; this type is what
 *        LINKEDIN_ACCOUNT_SAFE_SELECT is checked against.
 *        `needsReconnect` is surfaced because LinkedIn only issues refresh
 *        tokens to approved apps — without one, a connection simply expires
 *        after ~60 days and the user must reauthorize.
 * WHERE: Returned by integrations.read; consumed by the connect button.
 */
export interface LinkedInConnectionStatus {
  connected: boolean;
  configured: boolean;
  name: string | null;
  avatarUrl: string | null;
  expiresAt: Date | null;
  needsReconnect: boolean;
}

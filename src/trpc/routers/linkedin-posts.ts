/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: linkedinPostsRouter
 *
 * WHAT:  Publish a post to LinkedIn, list what this org has published, and
 *        forget a local record.
 * WHY:   Mounted as `linkedinPosts` so `linkedinPosts.create` matches the
 *        RESOURCES key and auto-wires the publish quota, usage counter, audit
 *        row, rate limit, and permission gate. The handler therefore contains
 *        only feature logic: resolve a live token, call LinkedIn, record what
 *        happened.
 * WHERE: Mounted in src/trpc/routers/_app; delegates to
 *        src/services/linkedin.service.ts. Consumed by the composer.
 */

import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createTRPCRouter } from "../init";
import { protectedProcedure } from "../procedures";
import { permissions } from "@/lib/better-auth/permissions";
import {
  publishPostSchema,
  listPostsSchema,
  listCalendarPostsSchema,
  deletePostSchema,
  type PostDocumentValues,
} from "@/lib/types";
import {
  isImageKitConfigured,
  isLinkedInConfigured,
  LINKEDIN_MAX_DOCUMENT_PAGES,
} from "@/lib/config";
import * as linkedinService from "@/services/linkedin.service";
import * as imagekitService from "@/services/imagekit.service";
import * as documentsService from "@/services/documents.service";

const withOrganization = z.object({ organizationId: z.string().min(1) });

export const linkedinPostsRouter = createTRPCRouter({
  /**
   * SOURCE OF TRUTH KEYWORDS: linkedinPosts.create
   *
   * WHAT:  Publishes to the connected member's feed and records the result.
   * WHY:   The LinkedIn call happens BEFORE the local write on purpose: if
   *        LinkedIn rejects the post, no row is written and the auto-audit /
   *        counter roll back with the transaction, so a failed publish never
   *        consumes quota or appears in history. The reverse order would leave
   *        a phantom post on a network error.
   * WHERE: Called by the composer's Publish button.
   */
  create: protectedProcedure({
    requirePermission: permissions.LINKEDIN_POSTS_CREATE,
    /* Publishing runs inside the factory's mutation tx, and the image path adds
     * an ImageKit fetch plus two LinkedIn round trips on top of the post call.
     * The 10s default expires mid-upload, which surfaces as a failed publish for
     * large images while small ones slip in under the wire. The scheduled branch
     * needs none of this budget — it writes one row — but the timeout is a
     * property of the procedure, so it is sized for the slow path. */
    txTimeout: 60_000,
  })
    .input(publishPostSchema.extend(withOrganization.shape))
    .mutation(async ({ ctx, input }) => {
      if (!isLinkedInConfigured()) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "LinkedIn is not configured. Add LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET to enable publishing.",
        });
      }

      /* Resolving the token on BOTH branches is deliberate. Scheduling against
       * a broken connection would queue a post that can only fail hours later,
       * when nobody is watching — better to refuse it here, while the user is
       * still looking at the composer. It also supplies accountId, which the
       * scheduled row needs to know who will publish it. */
      let token: Awaited<
        ReturnType<typeof linkedinService.getValidAccessToken>
      >;
      try {
        token = await linkedinService.getValidAccessToken(
          ctx.db,
          input.organizationId,
        );
      } catch (error) {
        /* Missing or expired-without-refresh connection is a user-actionable
         * state, not a server fault — surfaced so the UI can offer Reconnect. */
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            error instanceof Error
              ? error.message
              : "Connect a LinkedIn account to publish.",
        });
      }

      /* Resolved from the id SERVER-SIDE, scoped to this organization, so a
       * client cannot publish a file belonging to another tenant by guessing an
       * id. The url and title come from the row, never from the request. */
      let document: PostDocumentValues | undefined;
      if (input.documentId) {
        const stored = await documentsService.getDocument(
          input.organizationId,
          input.documentId,
          ctx.db,
        );
        if (!stored) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "That carousel PDF no longer exists. Render it again.",
          });
        }
        /* LinkedIn caps document posts at 300 pages. Checked here rather than at
         * upload time so an oversized deck is refused before any quota is spent
         * or bytes are moved. */
        if (stored.pageCount > LINKEDIN_MAX_DOCUMENT_PAGES) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `LinkedIn allows at most ${LINKEDIN_MAX_DOCUMENT_PAGES} pages in a document post.`,
          });
        }
        /* `title`, NOT `fileName`. LinkedIn shows this publicly on the post, and
         * fileName is a slug — sending it published the author's raw prompt as
         * the deck's name. Falls back for rows written before the column existed. */
        document = { url: stored.url, title: stored.title ?? stored.fileName };
      }

      /* SCHEDULED BRANCH — no LinkedIn call. The quota was just spent by this
       * same `create` verb, which is the entire reason scheduling lives here
       * instead of on a `schedule` procedure of its own. */
      if (input.scheduledFor) {
        return linkedinService.createScheduledPost(ctx.db, {
          organizationId: input.organizationId,
          accountId: token.accountId,
          authorId: ctx.user.id,
          commentary: input.commentary,
          scheduledFor: input.scheduledFor,
          image: input.image,
          documentId: input.documentId,
        });
      }

      let published: Awaited<ReturnType<typeof linkedinService.publishPost>>;
      try {
        published = await linkedinService.publishPost({
          accessToken: token.accessToken,
          personUrn: token.personUrn,
          commentary: input.commentary,
          image: input.image,
          document,
        });
      } catch (error) {
        throw new TRPCError({
          code: "BAD_GATEWAY",
          message:
            error instanceof Error
              ? error.message
              : "LinkedIn rejected the post. Please try again.",
        });
      }

      return linkedinService.recordPublishedPost(ctx.db, {
        organizationId: input.organizationId,
        accountId: token.accountId,
        authorId: ctx.user.id,
        commentary: input.commentary,
        postUrn: published.postUrn,
        imageUrn: published.imageUrn,
        documentUrn: published.documentUrn,
        image: input.image,
        documentId: input.documentId,
      });
    }),

  /**
   * SOURCE OF TRUTH KEYWORDS: linkedinPosts.uploadAuth
   *
   * WHAT:  Mints short-lived signed credentials for one browser upload.
   * WHY:   A QUERY, not a mutation — it creates nothing and must not consume
   *        post quota (a user may swap the image five times before publishing).
   *        Being a query is also why it needs no RESOURCES verb: the
   *        `<resource>.<verb>` guardrail in protectedProcedure only governs
   *        mutations. Gated on LINKEDIN_POSTS_CREATE anyway, because minting an
   *        upload token is only ever a step toward composing a post.
   * WHERE: Called by the global image-upload component before it POSTs a file
   *        directly to ImageKit.
   */
  uploadAuth: protectedProcedure({
    requirePermission: permissions.LINKEDIN_POSTS_CREATE,
  })
    .input(withOrganization)
    .query(async () => {
      if (!isImageKitConfigured()) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "Image uploads are not configured. Add IMAGEKIT_PUBLIC_KEY, IMAGEKIT_PRIVATE_KEY, and IMAGEKIT_URL_ENDPOINT to attach images.",
        });
      }
      return imagekitService.getUploadAuthParams();
    }),

  /**
   * SOURCE OF TRUTH KEYWORDS: linkedinPosts.listCalendar
   *
   * WHAT:  Everything planned or published inside the visible date window.
   * WHY:   Range-bounded rather than paged — a calendar renders a fixed window,
   *        so the range IS the page. Returns scheduled and published rows
   *        together because the grid draws them side by side.
   * WHERE: Backs the month grid on /dashboard/calendar.
   */
  listCalendar: protectedProcedure({
    /* Gated on the CALENDAR's permission, not the composer's, so one grant
     * governs both seeing the page and loading it. Splitting them would let an
     * admin grant a sidebar link to an empty screen. */
    requirePermission: permissions.CONTENT_CALENDAR_READ,
  })
    .input(listCalendarPostsSchema.and(withOrganization))
    .query(async ({ ctx, input }) =>
      linkedinService.listCalendarPosts(
        ctx.db,
        input.organizationId,
        input.from,
        input.to,
      ),
    ),

  /**
   * SOURCE OF TRUTH KEYWORDS: linkedinPosts.list
   *
   * WHAT:  Recent posts published by this organization, newest first.
   * WHY:   Served from our own table because LinkedIn gates reading a member's
   *        posts behind `r_member_social`, which it grants to approved partners
   *        only — there is no feed to sync.
   */
  list: protectedProcedure({
    requirePermission: permissions.LINKEDIN_POSTS_READ,
  })
    .input(listPostsSchema.extend(withOrganization.shape))
    .query(async ({ ctx, input }) =>
      linkedinService.listPublishedPosts(
        ctx.db,
        input.organizationId,
        input.limit,
      ),
    ),

  /**
   * SOURCE OF TRUTH KEYWORDS: linkedinPosts.delete
   *
   * WHAT:  Cancels a scheduled post, or forgets the record of a published one.
   * WHY:   ONE procedure for both because they are the same thing to the quota
   *        system — `delete` refunds a post slot either way — and which case
   *        applies is a property of the row, not a choice the caller makes.
   *        For a published post it explicitly does NOT delete from LinkedIn:
   *        the post stays live on the member's feed.
   *
   *        Returns the `count` from the delete, NOT `{ id }`. The counter math
   *        in protectedProcedure reads a `count` field off the result and falls
   *        back to decrementing by 1 for anything else — so returning the id
   *        meant deleting a row that did not exist (a stale list entry, another
   *        tenant's id) still handed back a post slot. That is the DELETE NO-OP
   *        rule; `count: 0` correctly moves nothing.
   */
  delete: protectedProcedure({
    requirePermission: permissions.LINKEDIN_POSTS_DELETE,
  })
    .input(deletePostSchema.extend(withOrganization.shape))
    .mutation(async ({ ctx, input }) => {
      let result: Awaited<
        ReturnType<typeof linkedinService.deletePublishedPost>
      >;
      try {
        result = await linkedinService.deletePublishedPost(
          ctx.db,
          input.organizationId,
          input.postId,
        );
      } catch (error) {
        /* The worker already claimed this row and may be mid-call to LinkedIn.
         * CONFLICT rather than NOT_FOUND: the post exists, it is simply past
         * the point of no return. */
        throw new TRPCError({
          code: "CONFLICT",
          message:
            error instanceof Error
              ? error.message
              : "That post can no longer be cancelled.",
        });
      }

      if (result.count === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "That post record no longer exists.",
        });
      }

      /* Cleanup AFTER the row is gone, and deliberately not awaited into the
       * transaction's success: deleteImage never throws, and an orphaned
       * ImageKit file is cheaper than a cancel that fails because a third-party
       * DELETE timed out. Only scheduled posts own their asset — a published
       * post's image already lives on LinkedIn. */
      if (result.wasScheduled && result.imageFileId) {
        await imagekitService.deleteImage(result.imageFileId);
      }

      return { id: input.postId, count: result.count };
    }),
});

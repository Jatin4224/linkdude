/*
 * Copyright (c) 2026 Web Prodigies LLC
 *
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

import { TRPCError } from '@trpc/server'
import { z } from 'zod'

import { createTRPCRouter } from '../init'
import { protectedProcedure } from '../procedures'
import { permissions } from '@/lib/better-auth/permissions'
import { publishPostSchema, listPostsSchema, deletePostSchema } from '@/lib/types'
import { isLinkedInConfigured } from '@/lib/config'
import * as linkedinService from '@/services/linkedin.service'

const withOrganization = z.object({ organizationId: z.string().min(1) })

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
  create: protectedProcedure({ requirePermission: permissions.LINKEDIN_POSTS_CREATE })
    .input(publishPostSchema.extend(withOrganization.shape))
    .mutation(async ({ ctx, input }) => {
      if (!isLinkedInConfigured()) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message:
            'LinkedIn is not configured. Add LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET to enable publishing.',
        })
      }

      let token: Awaited<ReturnType<typeof linkedinService.getValidAccessToken>>
      try {
        token = await linkedinService.getValidAccessToken(ctx.db, input.organizationId)
      } catch (error) {
        /* Missing or expired-without-refresh connection is a user-actionable
         * state, not a server fault — surfaced so the UI can offer Reconnect. */
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message:
            error instanceof Error ? error.message : 'Connect a LinkedIn account to publish.',
        })
      }

      let published: Awaited<ReturnType<typeof linkedinService.publishPost>>
      try {
        published = await linkedinService.publishPost({
          accessToken: token.accessToken,
          personUrn: token.personUrn,
          commentary: input.commentary,
          image: input.image,
        })
      } catch (error) {
        throw new TRPCError({
          code: 'BAD_GATEWAY',
          message:
            error instanceof Error ? error.message : 'LinkedIn rejected the post. Please try again.',
        })
      }

      return linkedinService.recordPublishedPost(ctx.db, {
        organizationId: input.organizationId,
        accountId: token.accountId,
        authorId: ctx.user.id,
        commentary: input.commentary,
        postUrn: published.postUrn,
        imageUrn: published.imageUrn,
      })
    }),

  /**
   * SOURCE OF TRUTH KEYWORDS: linkedinPosts.list
   *
   * WHAT:  Recent posts published by this organization, newest first.
   * WHY:   Served from our own table because LinkedIn gates reading a member's
   *        posts behind `r_member_social`, which it grants to approved partners
   *        only — there is no feed to sync.
   */
  list: protectedProcedure({ requirePermission: permissions.LINKEDIN_POSTS_READ })
    .input(listPostsSchema.extend(withOrganization.shape))
    .query(async ({ ctx, input }) =>
      linkedinService.listPublishedPosts(ctx.db, input.organizationId, input.limit)
    ),

  /**
   * SOURCE OF TRUTH KEYWORDS: linkedinPosts.delete
   *
   * WHAT:  Removes our local record of a post.
   * WHY:   Explicitly does NOT delete from LinkedIn — the post stays live on the
   *        member's feed. Named `delete` so the auto-wired counter decrements.
   */
  delete: protectedProcedure({ requirePermission: permissions.LINKEDIN_POSTS_DELETE })
    .input(deletePostSchema.extend(withOrganization.shape))
    .mutation(async ({ ctx, input }) => {
      await linkedinService.deletePublishedPost(ctx.db, input.organizationId, input.postId)
      return { id: input.postId }
    }),
})

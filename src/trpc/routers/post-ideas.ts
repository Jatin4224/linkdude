/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: postIdeasRouter, postIdeas.list, postIdeas.get,
 *   postIdeas.create, postIdeas.update, postIdeas.delete, idea inbox router
 *
 * WHAT:  Save, list, edit and delete a member's post ideas.
 * WHY:   Mounted as `postIdeas` so every path matches the RESOURCES key, which
 *        wires the permission gate, the idea limit (`create` spends a slot,
 *        `delete` refunds it), the rate limit and the audit rows. Every call is
 *        scoped to the calling member, read from the session, never the input.
 * WHERE: Mounted in src/trpc/routers/_app; delegates to post-ideas.service.
 *        Consumed by the Ideas page, the dashboard quick-add, and the composer.
 */

import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createTRPCRouter } from "../init";
import { protectedProcedure } from "../procedures";
import { permissions } from "@/lib/better-auth/permissions";
import {
  createPostIdeaSchema,
  listPostIdeasSchema,
  postIdeaIdSchema,
  updatePostIdeaSchema,
} from "@/lib/types";
import * as postIdeasService from "@/services/post-ideas.service";

const withOrganization = z.object({ organizationId: z.string().min(1) });

const IDEA_NOT_FOUND = "That idea no longer exists.";

export const postIdeasRouter = createTRPCRouter({
  list: protectedProcedure({
    requirePermission: permissions.POST_IDEAS_READ,
    paginate: true,
  })
    .input(listPostIdeasSchema.extend(withOrganization.shape))
    .query(async ({ ctx, input }) =>
      postIdeasService.listPostIdeas(
        ctx.db,
        input.organizationId,
        ctx.user.id,
        { status: input.status, search: input.search },
        ctx.pagination,
      ),
    ),

  /**
   * SOURCE OF TRUTH KEYWORDS: postIdeas.get
   *
   * WHAT:  One idea, for opening it in the composer.
   * WHERE: The composer page's `?ideaId=` seed.
   */
  get: protectedProcedure({
    requirePermission: permissions.POST_IDEAS_READ,
  })
    .input(postIdeaIdSchema.extend(withOrganization.shape))
    .query(async ({ ctx, input }) => {
      const idea = await postIdeasService.getPostIdea(
        ctx.db,
        input.organizationId,
        ctx.user.id,
        input.id,
      );
      if (!idea) {
        throw new TRPCError({ code: "NOT_FOUND", message: IDEA_NOT_FOUND });
      }
      return idea;
    }),

  create: protectedProcedure({
    requirePermission: permissions.POST_IDEAS_CREATE,
  })
    .input(createPostIdeaSchema.extend(withOrganization.shape))
    .mutation(async ({ ctx, input }) =>
      postIdeasService.createPostIdea(
        ctx.db,
        input.organizationId,
        ctx.user.id,
        input.text,
      ),
    ),

  /**
   * SOURCE OF TRUTH KEYWORDS: postIdeas.update
   *
   * WHAT:  Edits an idea's text or marks it used or new.
   * WHY:   One verb for both edits, the voiceProfile.update precedent. Neither
   *        spends or refunds a slot.
   */
  update: protectedProcedure({
    requirePermission: permissions.POST_IDEAS_UPDATE,
  })
    .input(updatePostIdeaSchema.and(withOrganization))
    .mutation(async ({ ctx, input }) => {
      const result =
        input.field === "text"
          ? await postIdeasService.updatePostIdeaText(
              ctx.db,
              input.organizationId,
              ctx.user.id,
              input.id,
              input.text,
            )
          : await postIdeasService.setPostIdeaStatus(
              ctx.db,
              input.organizationId,
              ctx.user.id,
              input.id,
              input.status,
            );

      if (result.count === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: IDEA_NOT_FOUND });
      }
      return { id: input.id, field: input.field };
    }),

  delete: protectedProcedure({
    requirePermission: permissions.POST_IDEAS_DELETE,
  })
    .input(postIdeaIdSchema.extend(withOrganization.shape))
    .mutation(async ({ ctx, input }) => {
      const result = await postIdeasService.deletePostIdea(
        ctx.db,
        input.organizationId,
        ctx.user.id,
        input.id,
      );
      if (result.count === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: IDEA_NOT_FOUND });
      }
      /* `count` drives the factory's refund of the idea slot. */
      return { id: input.id, count: result.count };
    }),
});

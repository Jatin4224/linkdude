/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: documentsRouter, documents.list, documents.get,
 *   documents.delete
 *
 * WHAT:  The library of files this workspace has generated — read and remove.
 * WHY:   Mounted as `documents` so the paths match the RESOURCES key, which is
 *        what wires the permission gate and the audit rows.
 *
 *        There is NO `create` verb, and the registry entry carries no `limit`.
 *        Documents are produced by `carousel.render`, in the same transaction
 *        that marks a deck ready — so a file and its owner can never disagree
 *        about whether it exists. A quota here would sit on a path nothing calls
 *        and silently never fire; storage volume is bounded by the carousel quota,
 *        which is the thing actually being metered.
 * WHERE: Mounted in src/trpc/routers/_app; delegates to documents.service and
 *        imagekit.service.
 */

import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createTRPCRouter } from "../init";
import { protectedProcedure } from "../procedures";
import { permissions } from "@/lib/better-auth/permissions";
import { listDocumentsSchema, deleteDocumentSchema } from "@/lib/types";
import * as documentsService from "@/services/documents.service";
import * as imagekitService from "@/services/imagekit.service";

const withOrganization = z.object({ organizationId: z.string().min(1) });

export const documentsRouter = createTRPCRouter({
  list: protectedProcedure({
    requirePermission: permissions.DOCUMENTS_READ,
    paginate: true,
  })
    .input(listDocumentsSchema.extend(withOrganization.shape))
    .query(async ({ ctx, input }) =>
      documentsService.listDocuments(
        input.organizationId,
        ctx.pagination,
        ctx.db,
      ),
    ),

  get: protectedProcedure({
    requirePermission: permissions.DOCUMENTS_READ,
  })
    .input(deleteDocumentSchema.extend(withOrganization.shape))
    .query(async ({ ctx, input }) => {
      const document = await documentsService.getDocument(
        input.organizationId,
        input.id,
        ctx.db,
      );
      if (!document) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "That document no longer exists.",
        });
      }
      return document;
    }),

  delete: protectedProcedure({
    requirePermission: permissions.DOCUMENTS_DELETE,
  })
    .input(deleteDocumentSchema.extend(withOrganization.shape))
    .mutation(async ({ ctx, input }) => {
      const result = await documentsService.deleteDocument(
        input.organizationId,
        input.id,
        ctx.db,
      );

      /* Checked before the not-found branch: a blocked delete removed nothing, so
       * `count` is 0 for both, and reporting "no longer exists" for a file that
       * plainly does would send the user looking for the wrong problem. */
      if (result.blockedBy > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message:
            result.blockedBy === 1
              ? "A scheduled post is set to publish this carousel. Cancel that post first, or leave the file in place."
              : `${result.blockedBy} scheduled posts are set to publish this carousel. Cancel them first, or leave the file in place.`,
        });
      }

      if (result.count === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "That document no longer exists.",
        });
      }

      /* AFTER the row is gone, never before: deleting the asset first would
       * strand a live row pointing at a file that no longer exists if the
       * transaction then rolled back. deleteImage never throws — an orphaned
       * asset costs kilobytes, while a thrown error would fail the user's delete.
       *
       * Any Carousel that pointed here keeps its slides and simply loses the
       * backlink, via the SetNull relation. Deleting a file is not deleting the
       * writing that produced it. */
      if (result.fileId) {
        await imagekitService.deleteImage(result.fileId);
      }

      /* `count` drives the factory's usage bookkeeping — see the DELETE NO-OP
       * rule. This resource carries no limit, so nothing decrements, but the
       * shape stays consistent with every other delete in the app. */
      return { id: input.id, count: result.count };
    }),
});

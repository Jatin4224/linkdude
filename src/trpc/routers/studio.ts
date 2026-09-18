/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: studioRouter, studio.create, studio.list,
 *   studio.get, studio.update, studio.render, studio.discard
 *
 * WHAT:  The studio lifecycle — clone a template into a project, edit its
 *        designs, export to a stored PNG, list and discard. Live preview is NOT
 *        here — see the note above `render`.
 * WHY:   Mounted as `studio` so every path matches the RESOURCES key, which is
 *        what auto-wires the per-plan quota, the usage counter, the rate limits,
 *        the permission gate and the audit rows.
 *
 *        `create` is the only verb that spends a slot. Rendering is local CPU, so
 *        charging per export would push members to accept a worse banner rather
 *        than iterate — the opposite of what a design tool is for. Re-rendering
 *        an edited design is free, deliberately.
 *
 *        `discard`, never `delete`: the factory REFUNDS a slot on `.delete`, so a
 *        refunding removal would make create → remove → create an unlimited free
 *        tier. Same reasoning as carousel and contentPlan.
 * WHERE: Mounted in src/trpc/routers/_app; delegates to studio.service,
 *        design-render.service and imagekit.service.
 */

import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createStructuredError, createTRPCRouter } from "../init";
import { classifyError } from "@/lib/errors";
import { protectedProcedure } from "../procedures";
import { permissions } from "@/lib/better-auth/permissions";
import {
  createStudioProjectSchema,
  updateStudioAssetSchema,
  renderStudioAssetSchema,
  getStudioProjectSchema,
  discardStudioProjectSchema,
  listStudioProjectsSchema,
  STUDIO_ASSET_KIND_CANVAS,
  STUDIO_ASSET_KIND_LABELS,
  type StudioAssetKind,
} from "@/lib/types";
import {
  isImageKitConfigured,
  buildDesignDoc,
  getStudioTemplate,
  isStudioTemplateKey,
  IMAGEKIT_STUDIO_FOLDER,
  STUDIO_PNG_MIME_TYPE,
  STUDIO_RENDER_TIMEOUT_MS,
  studioAssetFileName,
  studioAssetTitle,
} from "@/lib/config";
import * as designRenderService from "@/services/design-render.service";
import * as imagekitService from "@/services/imagekit.service";
import * as studioService from "@/services/studio.service";

const withOrganization = z.object({ organizationId: z.string().min(1) });

/* Phase 1 renders the banner only. Declared as a list rather than inlined so
 * phase 2 adds headshot and featured covers by extending one array — the create
 * procedure below already loops. */
const INITIAL_ASSET_KINDS: readonly StudioAssetKind[] = ["banner"];

export const studioRouter = createTRPCRouter({
  create: protectedProcedure({
    requirePermission: permissions.STUDIO_CREATE,
  })
    .input(createStudioProjectSchema.extend(withOrganization.shape))
    .mutation(async ({ ctx, input }) => {
      /* Rejected rather than defaulted. getStudioTemplate never throws, which is
       * right for RENDERING a row written before a rename — but accepting an
       * unknown id at create time would silently give someone a style they did
       * not choose, and spend their quota slot on it. */
      if (!isStudioTemplateKey(input.templateId)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "That style no longer exists. Pick another from the gallery.",
        });
      }

      const template = getStudioTemplate(input.templateId);

      const assets = INITIAL_ASSET_KINDS.map((kind, index) => ({
        kind,
        position: index,
        /* Cloned, not referenced — a stored design must keep rendering as the
         * member left it even after the archetype is edited. */
        doc: buildDesignDoc({
          templateId: input.templateId,
          archetypeId: template.archetype,
          canvas: STUDIO_ASSET_KIND_CANVAS[kind],
          paletteId: template.palette,
          content: template.sampleContent,
        }),
      }));

      return studioService.createStudioProjectRecord(ctx.db, {
        organizationId: input.organizationId,
        authorId: ctx.user.id,
        name: input.name,
        templateId: input.templateId,
        paletteId: template.palette,
        tone: template.tone,
        role: template.roles[0] ?? "founder",
        assets,
      });
    }),

  list: protectedProcedure({
    requirePermission: permissions.STUDIO_READ,
    paginate: true,
  })
    .input(listStudioProjectsSchema.extend(withOrganization.shape))
    .query(async ({ ctx, input }) =>
      studioService.listStudioProjects(
        ctx.db,
        input.organizationId,
        ctx.user.id,
        ctx.pagination,
      ),
    ),

  get: protectedProcedure({ requirePermission: permissions.STUDIO_READ })
    .input(getStudioProjectSchema.extend(withOrganization.shape))
    .query(async ({ ctx, input }) => {
      const project = await studioService.getStudioProject(
        ctx.db,
        input.organizationId,
        ctx.user.id,
        input.id,
      );

      if (!project) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "That profile no longer exists.",
        });
      }

      return project;
    }),

  update: protectedProcedure({ requirePermission: permissions.STUDIO_UPDATE })
    .input(updateStudioAssetSchema.extend(withOrganization.shape))
    .mutation(async ({ ctx, input }) => {
      /* The content ceilings are validated by the input schema, but the document
       * carries its own copy of the text — so the validated content is written
       * onto the doc here rather than trusting the two to already agree. */
      const doc = { ...input.doc, content: input.content };

      const { count } = await studioService.updateStudioAssetDoc(ctx.db, {
        organizationId: input.organizationId,
        projectId: input.id,
        assetId: input.assetId,
        doc,
      });

      if (count === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "That design no longer exists.",
        });
      }

      return { saved: true as const };
    }),

  /* NOTE: there is no `preview` procedure. Drawing an unsaved design lives at
   * POST /api/studio/preview instead, because the factory opens a transaction for
   * every mutation and a debounced render held a pooled connection long enough to
   * starve Better Auth of one. The full account is in that route handler. */

  render: protectedProcedure({
    requirePermission: permissions.STUDIO_RENDER,
    txTimeout: STUDIO_RENDER_TIMEOUT_MS + 30_000,
  })
    .input(renderStudioAssetSchema.extend(withOrganization.shape))
    .mutation(async ({ ctx, input }) => {
      /* Checked before any work, so a misconfigured deployment costs a clear
       * message rather than a rendered PNG with nowhere to go. */
      if (!isImageKitConfigured()) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "File storage is not configured. Add the ImageKit keys to export designs.",
        });
      }

      const project = await studioService.getStudioProject(
        ctx.db,
        input.organizationId,
        ctx.user.id,
        input.id,
      );
      const asset = project?.assets.find((row) => row.id === input.assetId);

      if (!project || !asset) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "That design no longer exists.",
        });
      }

      const label =
        STUDIO_ASSET_KIND_LABELS[asset.kind as StudioAssetKind] ?? "Design";
      const title = studioAssetTitle(project.name, label);
      const fileName = studioAssetFileName(title);

      try {
        const rendered = await designRenderService.renderDesignPng(asset.doc);

        /* The remote leg runs BEFORE the database write, so an upload failure
         * rolls the transaction back instead of leaving an asset marked ready
         * with no file behind it. */
        const uploaded = await imagekitService.uploadFileBytes(
          rendered.base64,
          fileName,
          IMAGEKIT_STUDIO_FOLDER,
        );

        const { asset: updated, supersededFileId } =
          await studioService.attachStudioAssetDocument(ctx.db, {
            organizationId: input.organizationId,
            assetId: input.assetId,
            fileId: uploaded.fileId,
            url: uploaded.url,
            fileName,
            title,
            mimeType: STUDIO_PNG_MIME_TYPE,
            byteSize: rendered.byteSize,
          });

        /* AFTER the commit, never inside it: deleting the old remote file in a
         * transaction that later rolls back destroys a file the database still
         * points at. Skipping it entirely leaks a file on every re-render. */
        if (supersededFileId) {
          await imagekitService.deleteImage(supersededFileId);
        }

        return updated;
      } catch (error) {
        const { trpcCode, ...cause } = classifyError(error, {
          context: "studio.render",
          fallbackMessage: "The export failed. Please try again.",
        });
        const message = `${cause.message} (ref: ${cause.traceId})`;

        /* DELIBERATELY not on ctx.db — the rethrow below rolls this transaction
         * back, and a write on the transactional client would be erased by the
         * very rollback that reports the failure. */
        await studioService.markStudioAssetFailed(
          input.organizationId,
          input.assetId,
          message,
        );

        throw createStructuredError(trpcCode, cause.message, cause);
      }
    }),

  discard: protectedProcedure({ requirePermission: permissions.STUDIO_DISCARD })
    .input(discardStudioProjectSchema.extend(withOrganization.shape))
    .mutation(async ({ ctx, input }) => {
      const { count } = await studioService.discardStudioProject(
        ctx.db,
        input.organizationId,
        ctx.user.id,
        input.id,
      );

      if (count === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "That profile no longer exists.",
        });
      }

      return { discarded: true as const };
    }),
});

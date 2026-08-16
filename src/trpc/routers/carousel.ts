/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: carouselRouter, carousel.create, carousel.render,
 *   carousel.update, carousel.discard, carousel.list, carousel.get
 *
 * WHAT:  The carousel lifecycle — draft a deck from a topic, edit its slides,
 *        render it to a stored PDF, list, read and discard.
 * WHY:   Mounted as `carousel` so every path matches the RESOURCES key — that is
 *        what auto-wires the per-plan quota, the usage counter, the rate limits,
 *        the permission gate and the audit rows.
 *
 *        `create` and `render` are separate verbs on purpose. Only `create` spends
 *        a quota slot, because the model call is what costs money; rendering is
 *        local CPU. Splitting them means a failed render never burns a generation
 *        the user already paid for, and re-rendering an edited deck is free —
 *        which is what makes editing the expected step rather than a luxury.
 *
 *        `discard`, never `delete`: the factory refunds a slot on `.delete`, and a
 *        refunding removal would make create → remove → create an unlimited free
 *        tier. Same reasoning as profileAnalysis and contentPlan.
 * WHERE: Mounted in src/trpc/routers/_app; delegates to ai.service,
 *        carousel.service and imagekit.service.
 */

import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createTRPCRouter } from "../init";
import { protectedProcedure } from "../procedures";
import { permissions } from "@/lib/better-auth/permissions";
import {
  generateCarouselSchema,
  updateCarouselSchema,
  renderCarouselSchema,
  getCarouselSchema,
  discardCarouselSchema,
  listCarouselsSchema,
} from "@/lib/types";
import {
  isAiConfigured,
  isImageKitConfigured,
  getAiProvider,
  IMAGEKIT_DOCUMENT_FOLDER,
  CAROUSEL_PDF_MIME_TYPE,
  CAROUSEL_RENDER_TIMEOUT_MS,
  carouselDocumentFileName,
} from "@/lib/config";
import * as aiService from "@/services/ai.service";
import * as carouselService from "@/services/carousel.service";
import * as imagekitService from "@/services/imagekit.service";

const withOrganization = z.object({ organizationId: z.string().min(1) });

export const carouselRouter = createTRPCRouter({
  create: protectedProcedure({
    requirePermission: permissions.CAROUSEL_CREATE,
    /* One structured generation covering every slide, which is the largest
     * single model call in this feature. Sized above ai.service's own carousel
     * timeout so the vendor call fails on its own terms with a legible message,
     * rather than the tx expiring underneath it and the usage bump then failing
     * on a closed transaction. */
    txTimeout: 120_000,
  })
    .input(generateCarouselSchema.extend(withOrganization.shape))
    .mutation(async ({ ctx, input }) => {
      /* Fail before the quota is spent — the same ordering aiGeneration uses. */
      if (!isAiConfigured()) {
        const provider = getAiProvider();
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `AI generation is not configured. Add ${provider.apiKeyEnvVar} to enable it.`,
        });
      }

      const slides = await aiService.generateCarouselSlides(input);

      return carouselService.createCarouselRecord(
        {
          organizationId: input.organizationId,
          authorId: ctx.user.id,
          topic: input.topic,
          templateId: input.templateId,
          pagePreset: input.page,
          slides,
        },
        ctx.db,
      );
    }),

  /* Not a quota verb. Editing slides buys nothing and must stay free, or users
   * accept a worse first draft rather than pay to improve it. */
  update: protectedProcedure({
    requirePermission: permissions.CAROUSEL_UPDATE,
  })
    .input(updateCarouselSchema.extend(withOrganization.shape))
    .mutation(async ({ ctx, input }) => {
      const result = await carouselService.updateCarouselRecord(
        {
          organizationId: input.organizationId,
          id: input.id,
          slides: input.slides,
          templateId: input.templateId,
          pagePreset: input.page,
        },
        ctx.db,
      );
      if (result.count === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "That carousel no longer exists.",
        });
      }
      return { id: input.id, count: result.count };
    }),

  render: protectedProcedure({
    requirePermission: permissions.CAROUSEL_RENDER,
    /* Rasterise up to twelve slides, then upload the PDF — all inside the
     * factory's mutation tx. Sized above CAROUSEL_RENDER_TIMEOUT_MS so the render
     * owns its own failure rather than the tx expiring under it. */
    txTimeout: CAROUSEL_RENDER_TIMEOUT_MS + 30_000,
  })
    .input(renderCarouselSchema.extend(withOrganization.shape))
    .mutation(async ({ ctx, input }) => {
      if (!isImageKitConfigured()) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "File storage is not configured. Add the ImageKit keys to render carousels.",
        });
      }

      const carousel = await carouselService.getCarousel(
        input.organizationId,
        input.id,
        ctx.db,
      );
      if (!carousel) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "That carousel no longer exists.",
        });
      }

      try {
        /* `carousel.slides` is already CarouselSlides — getCarousel validates it
         * on the way out, so a deck written by an older shape fails there with a
         * clear message rather than reaching the renderer. */
        const rendered = await carouselService.renderCarouselPdf(
          carousel.slides,
          carousel.templateId,
          carousel.pagePreset,
        );

        /* Remote leg BEFORE the database write, so an upload failure rolls the
         * whole transaction back rather than leaving a deck marked ready with no
         * file behind it. Same ordering linkedinPosts.create uses. */
        const uploaded = await imagekitService.uploadFileBytes(
          rendered.base64,
          carouselDocumentFileName(carousel.topic),
          IMAGEKIT_DOCUMENT_FOLDER,
        );

        const { carousel: updated, supersededFileId } =
          await carouselService.attachCarouselDocument(
            {
              organizationId: input.organizationId,
              carouselId: input.id,
              fileId: uploaded.fileId,
              url: uploaded.url,
              fileName: carouselDocumentFileName(carousel.topic),
              mimeType: CAROUSEL_PDF_MIME_TYPE,
              byteSize: rendered.byteSize,
              pageCount: rendered.pageCount,
            },
            ctx.db,
          );

        /* The file a previous render left behind. Deleted AFTER the tx commits —
         * never inside it, or a rollback would leave a live row pointing at an
         * asset that is already gone. deleteImage never throws. */
        if (supersededFileId) {
          await imagekitService.deleteImage(supersededFileId);
        }

        return updated;
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "The carousel render failed. Please try again.";

        /* Recorded so the failure is actionable in the UI rather than a status
         * with no explanation — the user may have navigated away before the
         * error toast landed.
         *
         * DELIBERATELY NOT ctx.db. Every mutation here runs inside the factory's
         * transaction, and the rethrow below rolls it back — a failure written
         * with the tx client would be erased by the very throw that reports it.
         * Omitting the argument uses the service's default client, so this one
         * write survives on its own. It is the single place in this router that
         * must escape the transaction, and that is the whole reason. */
        await carouselService.markCarouselFailed(
          input.organizationId,
          input.id,
          message,
        );

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message,
        });
      }
    }),

  list: protectedProcedure({
    requirePermission: permissions.CAROUSEL_READ,
    paginate: true,
  })
    .input(listCarouselsSchema.extend(withOrganization.shape))
    .query(async ({ ctx, input }) =>
      carouselService.listCarousels(
        input.organizationId,
        ctx.pagination,
        ctx.db,
      ),
    ),

  get: protectedProcedure({
    requirePermission: permissions.CAROUSEL_READ,
  })
    .input(getCarouselSchema.extend(withOrganization.shape))
    .query(async ({ ctx, input }) => {
      const carousel = await carouselService.getCarousel(
        input.organizationId,
        input.id,
        ctx.db,
      );
      if (!carousel) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "That carousel no longer exists.",
        });
      }
      return carousel;
    }),

  discard: protectedProcedure({
    requirePermission: permissions.CAROUSEL_DISCARD,
  })
    .input(discardCarouselSchema.extend(withOrganization.shape))
    .mutation(async ({ ctx, input }) => {
      const result = await carouselService.discardCarousel(
        input.organizationId,
        input.id,
        ctx.db,
      );
      if (result.count === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "That carousel no longer exists.",
        });
      }
      /* The rendered PDF is deliberately left in the documents library — see the
       * note on carouselService.discardCarousel. */
      return { id: input.id, count: result.count };
    }),
});

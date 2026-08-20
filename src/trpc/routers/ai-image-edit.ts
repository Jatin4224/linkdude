/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: aiImageEditRouter, aiImageEdit.create
 *
 * WHAT:  Rewrites an attached image from a text instruction and returns the new
 *        ImageKit reference, carrying the replaced one along as `original`.
 * WHY:   Mounted as `aiImageEdit` so the path `aiImageEdit.create` matches the
 *        RESOURCES key — that is what auto-wires the per-plan quota, the usage
 *        counter, the rate limit and the permission gate. Metered separately
 *        from aiGeneration because an image call costs far more than post copy
 *        and can be repeated on a whim without ever publishing.
 *
 *        Nothing is written to the database here. The edit lives in the composer
 *        until the user publishes, exactly like a generated draft — so the
 *        counter measures MODEL SPEND, which is the thing that costs money,
 *        rather than rows held.
 * WHERE: Mounted in src/trpc/routers/_app; delegates to ai.service.editImage and
 *        imagekit.service. Consumed by the global ai-image-edit dialog.
 */

import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createTRPCRouter, toProcedureError } from "../init";
import { protectedProcedure } from "../procedures";
import { permissions } from "@/lib/better-auth/permissions";
import { aiImageEditSchema } from "@/lib/types";
import {
  isAiImageConfigured,
  getAiProvider,
  LINKEDIN_IMAGE_TRANSFORM,
} from "@/lib/config";
import * as aiService from "@/services/ai.service";
import * as imagekitService from "@/services/imagekit.service";

export const aiImageEditRouter = createTRPCRouter({
  create: protectedProcedure({
    requirePermission: permissions.AI_IMAGE_EDIT_CREATE,
    /* Three network legs inside the factory's mutation tx — fetch from ImageKit,
     * the model call, then the upload back. Sized above ai.service's own 90s
     * image timeout so the vendor call fails on its own terms with a legible
     * message, rather than the tx expiring underneath it and the usage bump
     * then failing on a closed transaction. */
    txTimeout: 120_000,
  })
    .input(
      aiImageEditSchema.and(z.object({ organizationId: z.string().min(1) })),
    )
    .mutation(async ({ input }) => {
      /* Fail before the quota is spent. Two distinct causes — no image model on
       * this vendor, or no key — so the message names which. */
      if (!isAiImageConfigured()) {
        const provider = getAiProvider();
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: provider.createImageModel
            ? `AI image editing is not configured. Add ${provider.apiKeyEnvVar} to enable it.`
            : `${provider.label} cannot generate images. Set AI_PROVIDER to a vendor that supports them.`,
        });
      }

      try {
        /* The CURRENT pixels, not the raw upload: the user is editing what they
         * can see, so the model must receive the framing they already chose.
         * Feeding it the untransformed original would silently discard their
         * crop and hand back an image framed differently from the preview. */
        const source = await imagekitService.fetchImageBinary(
          imagekitService.buildTransformedUrl(
            input.image.url,
            input.image.transform ?? LINKEDIN_IMAGE_TRANSFORM,
          ),
        );

        const edited = await aiService.editImage(source, input.prompt);

        const uploaded = await imagekitService.uploadImageBytes(
          edited.base64,
          "ai-edit.png",
        );

        return {
          ...uploaded,
          /* The FIRST original wins. Chaining edits must keep pointing at the
           * user's real upload — carrying the previous AI result forward instead
           * would make Revert undo one step and strand the true source, which is
           * the one thing these columns exist to protect. */
          original: input.image.original ?? {
            fileId: input.image.fileId,
            url: input.image.url,
          },
          /* Transform deliberately dropped: the model returned pixels that
           * already have the requested framing baked in, so re-applying the old
           * crop on top would frame an already-framed image a second time. */
        };
      } catch (error) {
        /* The quota copy is overridden rather than left to the default because
         * this failure is usually PERMANENT here, not weather: image generation
         * is unavailable on a free vendor tier at all, so "try again in a
         * minute" would send the user in a circle. It still names no vendor,
         * plan or console URL — that is operator information, and the operator
         * reads it from the log line this classification writes. */
        throw toProcedureError(error, {
          context: "aiImageEdit.create",
          fallbackMessage: "The image edit failed. Please try again.",
          messages: {
            AI_QUOTA_EXHAUSTED:
              "AI image editing isn't available right now. Nothing was used from your plan — please contact support if this continues.",
          },
        });
      }
    }),
});

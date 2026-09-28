/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: carouselIllustrationRouter, carouselIllustration.create,
 *   generateSlideIllustration, slide illustration, AI image
 *
 * WHAT:  Generates an illustration for a carousel slide and stores it.
 * WHY:   Mounted as `carouselIllustration` so the path matches its RESOURCES key —
 *        which is what meters it SEPARATELY from `carousel`. Only
 *        `<resource>.create` spends a slot, and `carousel.create` already spends
 *        one on the deck, so an illustration sharing that key would charge a member
 *        an entire deck every time they regenerated one picture.
 *
 *        The division of labour this endpoint exists to enforce: the MODEL draws
 *        the picture, the RENDERER draws the words. Image models cannot render
 *        legible text, so asking one for a finished slide returns garbled lettering
 *        baked into the pixels. Generating only the illustration and compositing
 *        crisp type beside it is the thing neither a design tool nor an image model
 *        does on its own.
 *
 *        It takes a BRIEF and returns a STORED REFERENCE. It never reads or writes
 *        the deck: the client puts the reference on the slide it is editing and
 *        saves through `carousel.update`, so an illustration the member rejects is
 *        never persisted onto a deck. That also keeps this endpoint out of the
 *        Carousel table entirely, so a slow image call holds no row.
 * WHERE: Called by the illustrate control in the slide editor.
 */

import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { assertAiConfigured, createTRPCRouter, toProcedureError } from "../init";
import { protectedProcedure } from "../procedures";
import { permissions } from "@/lib/better-auth/permissions";
import { generateCarouselIllustrationSchema } from "@/lib/types";
import {
  isImageKitConfigured,
  IMAGEKIT_CAROUSEL_FOLDER,
  CAROUSEL_ILLUSTRATION_TIMEOUT_MS,
  carouselIllustrationFileName,
} from "@/lib/config";
import * as aiService from "@/services/ai.service";
import * as imagekitService from "@/services/imagekit.service";

const withOrganization = z.object({ organizationId: z.string().min(1) });

export const carouselIllustrationRouter = createTRPCRouter({
  create: protectedProcedure({
    requirePermission: permissions.CAROUSEL_ILLUSTRATION_CREATE,
    /* An image round trip runs to ninety seconds inside ai.service, so the
     * transaction has to outlast it — otherwise the tx expires underneath a call
     * that is still going and the usage bump then fails on a closed client. */
    txTimeout: CAROUSEL_ILLUSTRATION_TIMEOUT_MS + 30_000,
  })
    .input(generateCarouselIllustrationSchema.extend(withOrganization.shape))
    .mutation(async ({ input }) => {
      /* Both preconditions before any spend: the quota slot is taken by the
       * factory the moment this procedure runs, so failing afterwards on a missing
       * key would charge someone for nothing. */
      assertAiConfigured("image");

      if (!isImageKitConfigured()) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "File storage is not configured. Add the ImageKit keys to generate illustrations.",
        });
      }

      try {
        const generated = await aiService.generateSlideIllustration(input.brief);

        return await imagekitService.uploadFileBytes(
          generated.base64,
          carouselIllustrationFileName(input.brief),
          IMAGEKIT_CAROUSEL_FOLDER,
        );
      } catch (error) {
        throw toProcedureError(error, {
          context: "carouselIllustration.create",
          fallbackMessage: "That illustration could not be generated.",
        });
      }
    }),
});

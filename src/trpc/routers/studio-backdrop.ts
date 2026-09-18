/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: studioBackdropRouter, studioBackdrop.create,
 *   generateBackdrop, AI backdrop
 *
 * WHAT:  Generates a background image for a studio design and stores it.
 * WHY:   Mounted as `studioBackdrop` so the path matches its RESOURCES key —
 *        which is what meters it SEPARATELY from `studio`. Only
 *        `<resource>.create` spends a slot, and `studio.create` already spends
 *        one on the project, so a backdrop sharing that key would charge a member
 *        an entire profile for regenerating a texture.
 *
 *        The division of labour this endpoint exists to enforce: the MODEL draws
 *        the backdrop, the RENDERER draws the words. Image models cannot render
 *        legible text — asking one for a finished banner returns garbled
 *        lettering baked into the pixels. Generating only the texture and
 *        compositing crisp type over it is the thing neither a design tool nor an
 *        image model does on its own.
 * WHERE: Called by the studio editor's backdrop control; the returned image is
 *        written onto the design's `images.backdrop` and its `background` is
 *        switched to `{ kind: "image" }`.
 */

import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { assertAiConfigured, createTRPCRouter, toProcedureError } from "../init";
import { protectedProcedure } from "../procedures";
import { permissions } from "@/lib/better-auth/permissions";
import { generateStudioBackdropSchema } from "@/lib/types";
import {
  isImageKitConfigured,
  IMAGEKIT_STUDIO_FOLDER,
  STUDIO_BACKDROP_TIMEOUT_MS,
  studioBackdropFileName,
} from "@/lib/config";
import * as aiService from "@/services/ai.service";
import * as imagekitService from "@/services/imagekit.service";

const withOrganization = z.object({ organizationId: z.string().min(1) });

export const studioBackdropRouter = createTRPCRouter({
  create: protectedProcedure({
    requirePermission: permissions.STUDIO_BACKDROP_CREATE,
    /* An image round trip runs to ninety seconds inside ai.service, so the
     * transaction has to outlast it — otherwise the tx expires underneath a call
     * that is still going and the usage bump then fails on a closed client. */
    txTimeout: STUDIO_BACKDROP_TIMEOUT_MS + 30_000,
  })
    .input(generateStudioBackdropSchema.extend(withOrganization.shape))
    .mutation(async ({ input }) => {
      /* Both preconditions before any spend: the quota slot is taken by the
       * factory the moment this procedure runs, so failing afterwards on a
       * missing key would charge someone for nothing. */
      assertAiConfigured("image");

      if (!isImageKitConfigured()) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "File storage is not configured. Add the ImageKit keys to generate backdrops.",
        });
      }

      try {
        const generated = await aiService.generateBackdrop(input.brief);

        const uploaded = await imagekitService.uploadFileBytes(
          generated.base64,
          studioBackdropFileName(input.brief),
          IMAGEKIT_STUDIO_FOLDER,
        );

        /* Returns the stored reference, not the bytes. The client writes it onto
         * the design and saves through `studio.update`, so a generated backdrop
         * the member rejects is never persisted onto their design. */
        return uploaded;
      } catch (error) {
        throw toProcedureError(error, {
          context: "studioBackdrop.create",
          fallbackMessage: "That backdrop could not be generated.",
        });
      }
    }),
});

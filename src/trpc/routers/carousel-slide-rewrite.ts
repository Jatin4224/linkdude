/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: carouselSlideRewriteRouter, carouselSlideRewrite.create,
 *   rewriteCarouselSlide, reroll, per-slide regenerate
 *
 * WHAT:  Rewrites the copy on one slide of a deck.
 * WHY:   Mounted as `carouselSlideRewrite` so the path matches its RESOURCES key —
 *        which is what meters it SEPARATELY from `carousel`. Only
 *        `<resource>.create` spends a slot, and `carousel.create` already spends
 *        one on the deck, so a reroll sharing that key would charge a member a
 *        whole deck to reword one slide.
 *
 *        It reads the deck for its TOPIC and TEMPLATE, which are the deck's own
 *        facts and not the client's to assert, but takes the SLIDES from the
 *        request — because those are the editor's unsaved buffer, and rerolling
 *        against a stale copy of the neighbours is how a deck loses its thread.
 *
 *        Returns the rewritten slide WITHOUT saving it, the contract
 *        carouselIllustration and studioBackdrop both keep: the client puts it in
 *        the draft and `carousel.update` commits it, so a reroll the member
 *        dislikes is discarded by navigating away.
 *
 *        The merge happens HERE rather than in the client: `kind` is a position
 *        role and `illustration` is an image someone paid for, and neither is
 *        something a rewrite may drop. Doing it server-side means no client can
 *        get that wrong.
 * WHERE: Called by the rewrite control in the slide editor.
 */

import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { assertAiConfigured, createTRPCRouter, toProcedureError } from "../init";
import { protectedProcedure } from "../procedures";
import { permissions } from "@/lib/better-auth/permissions";
import { rewriteCarouselSlideSchema, type CarouselSlide } from "@/lib/types";
import { CAROUSEL_GENERATION_TIMEOUT_MS } from "@/lib/config";
import * as aiService from "@/services/ai.service";
import * as carouselService from "@/services/carousel.service";
import * as voiceProfileService from "@/services/voice-profile.service";

const withOrganization = z.object({ organizationId: z.string().min(1) });

export const carouselSlideRewriteRouter = createTRPCRouter({
  create: protectedProcedure({
    requirePermission: permissions.CAROUSEL_SLIDE_REWRITE_CREATE,
    txTimeout: CAROUSEL_GENERATION_TIMEOUT_MS + 30_000,
  })
    .input(rewriteCarouselSlideSchema.extend(withOrganization.shape))
    .mutation(async ({ ctx, input }): Promise<CarouselSlide> => {
      assertAiConfigured("text");

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

      const current = input.slides[input.index];
      if (!current) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "That slide is no longer part of the deck.",
        });
      }

      try {
        const voice = await voiceProfileService.readResolvedVoice(
          ctx.db,
          input.organizationId,
          ctx.user.id,
        );

        const copy = await aiService.rewriteCarouselSlide(
          {
            topic: carousel.topic,
            templateId: carousel.templateId,
            slides: input.slides,
            index: input.index,
            ...(input.instruction ? { instruction: input.instruction } : {}),
          },
          voice,
        );

        /* Merged onto the existing slide, never replacing it: the rewrite owns the
         * words, the deck owns the slide's role and its paid-for illustration. */
        return { ...current, ...copy };
      } catch (error) {
        throw toProcedureError(error, {
          context: "carouselSlideRewrite.create",
          fallbackMessage: "That slide could not be rewritten.",
        });
      }
    }),
});

/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: candidateProfileRouter, candidateProfile.get,
 *   candidateProfile.update, About me, Job Assist profile
 *
 * WHAT:  Reads and saves the member's "About me" details for Job Assist.
 * WHY:   Mounted as `candidateProfile` so both paths match the RESOURCES key,
 *        which wires the permission gate, rate limit and audit row. No quota:
 *        saving details buys nothing.
 * WHERE: Mounted in src/trpc/routers/_app; consumed by the About me card.
 */

import { z } from "zod";

import { createTRPCRouter } from "../init";
import { protectedProcedure } from "../procedures";
import { permissions } from "@/lib/better-auth/permissions";
import { candidateProfileSchema } from "@/lib/types";
import * as candidateProfileService from "@/services/candidate-profile.service";

const withOrganization = z.object({ organizationId: z.string().min(1) });

export const candidateProfileRouter = createTRPCRouter({
  /**
   * SOURCE OF TRUTH KEYWORDS: candidateProfile.get
   *
   * WHAT:  The member's saved details, or null, plus their account name.
   * WHY:   The account name lets the card pre-fill "Full name" the first time,
   *        so no one starts from an empty name field.
   */
  get: protectedProcedure({
    requirePermission: permissions.CANDIDATE_PROFILE_READ,
  })
    .input(withOrganization)
    .query(async ({ ctx, input }) => ({
      profile: await candidateProfileService.readCandidateProfile(
        ctx.db,
        input.organizationId,
        ctx.user.id,
      ),
      accountName: ctx.user.name,
    })),

  /**
   * SOURCE OF TRUTH KEYWORDS: candidateProfile.update
   *
   * WHAT:  Creates or replaces the member's saved details.
   * WHY:   `update` even for the first save, because the resource has no quota and
   *        a member only ever has one set of details.
   */
  update: protectedProcedure({
    requirePermission: permissions.CANDIDATE_PROFILE_UPDATE,
  })
    .input(candidateProfileSchema.extend(withOrganization.shape))
    .mutation(async ({ ctx, input }) => {
      const { organizationId, ...details } = input;
      await candidateProfileService.saveCandidateProfile(
        ctx.db,
        organizationId,
        ctx.user.id,
        details,
      );
      return { saved: true };
    }),
});

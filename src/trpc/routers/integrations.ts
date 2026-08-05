/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: integrationsRouter
 *
 * WHAT:  Connection state for third-party accounts, and disconnecting them.
 * WHY:   Reuses the pre-existing `integrations` RESOURCES entry rather than
 *        inventing a LinkedIn-specific resource, so the next provider plugs in
 *        by adding a branch here instead of a new registry entry, router, and
 *        permission set. Mounted as `integrations` so `integrations.disconnect`
 *        auto-wires the permission gate and the audit row.
 * WHERE: Mounted in src/trpc/routers/_app; delegates to
 *        src/services/linkedin.service.ts. Consumed by the connect button.
 */

import { z } from "zod";

import { createTRPCRouter } from "../init";
import { protectedProcedure } from "../procedures";
import { permissions } from "@/lib/better-auth/permissions";
import { disconnectIntegrationSchema } from "@/lib/types";
import type { LinkedInConnectionStatus } from "@/lib/types";
import * as linkedinService from "@/services/linkedin.service";

const withOrganization = z.object({ organizationId: z.string().min(1) });

export const integrationsRouter = createTRPCRouter({
  /**
   * SOURCE OF TRUTH KEYWORDS: integrations.linkedin
   *
   * WHAT:  The client-safe LinkedIn connection state for this organization.
   * WHY:   Returns LinkedInConnectionStatus, which enumerates the only fields
   *        allowed to reach a browser — the access and refresh tokens live on
   *        the same row, so the model is never returned directly.
   * WHERE: Drives the connect/reconnect button and gates the Publish action.
   */
  linkedin: protectedProcedure({
    requirePermission: permissions.INTEGRATIONS_READ,
  })
    .input(withOrganization)
    .query(async ({ ctx, input }): Promise<LinkedInConnectionStatus> =>
      linkedinService.getConnectionStatus(ctx.db, input.organizationId),
    ),

  /**
   * SOURCE OF TRUTH KEYWORDS: integrations.disconnect
   *
   * WHAT:  Drops a third-party connection for this organization.
   * WHY:   `provider` is on the input so the registry's audit template
   *        ("Disconnected the {input.provider} account") interpolates, and so
   *        adding the next provider needs no new endpoint.
   */
  disconnect: protectedProcedure({
    requirePermission: permissions.INTEGRATIONS_DISCONNECT,
  })
    .input(disconnectIntegrationSchema.extend(withOrganization.shape))
    .mutation(async ({ ctx, input }) => {
      await linkedinService.disconnectAccount(ctx.db, input.organizationId);
      return { provider: input.provider };
    }),
});

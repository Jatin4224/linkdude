/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: portalRouter, portalProcedure
 *
 * WHAT:  Platform-admin (portal) endpoints — a public-to-any-user `getAccess`
 *        plus admin-gated cross-tenant reads (organizations, users, overview,
 *        activity) and the analytics rollups behind the portal dashboard.
 * WHY:   Portal data spans ALL organizations, so these run on authProcedure (an
 *        identity, no org scope) rather than the org-scoped protectedProcedure.
 *        `portalProcedure` adds the platform-admin gate (owner email or portal
 *        membership) on top. `getAccess` stays ungated so the tenant UI can ask
 *        "should I show the Platform-admin link?" for the current user.
 * WHERE: Mounted as `portal` in src/trpc/routers/_app. Delegates to
 *        src/services/portal.service and src/services/portal-analytics.service.
 */

import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createTRPCRouter } from "../init";
import { authProcedure } from "../procedures";
import { isPortalEnabled } from "@/lib/config/portal";
import { analyticsRangeSchema } from "@/lib/types";
import {
  resolvePortalAdmin,
  listAllOrganizations,
  listAllUsers,
  getPortalOverview,
  listPlatformActivity,
} from "@/services/portal.service";
import * as analytics from "@/services/portal-analytics.service";

const PORTAL_PAGE_SIZE = 25;

function pageInput() {
  return z.object({ page: z.number().int().positive().optional() });
}

function toSkip(page: number | undefined): number {
  return ((page ?? 1) - 1) * PORTAL_PAGE_SIZE;
}

/* Platform-admin gate: logged-in AND (owner email OR portal-org member). */
const portalProcedure = authProcedure.use(async ({ ctx, next }) => {
  const isAdmin = await resolvePortalAdmin({
    id: ctx.user.id,
    email: ctx.user.email,
  });
  if (!isAdmin) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Platform admin access required",
    });
  }
  return next();
});

export const portalRouter = createTRPCRouter({
  /* Ungated (authed): lets the tenant UI decide whether to surface the portal
   * link for the current user without leaking who the owner is. */
  getAccess: authProcedure.query(async ({ ctx }) => ({
    enabled: isPortalEnabled(),
    isPortalAdmin: await resolvePortalAdmin({
      id: ctx.user.id,
      email: ctx.user.email,
    }),
  })),

  getOverview: portalProcedure.query(() => getPortalOverview()),

  listOrganizations: portalProcedure
    .input(pageInput())
    .query(({ input }) =>
      listAllOrganizations(toSkip(input.page), PORTAL_PAGE_SIZE),
    ),

  listUsers: portalProcedure
    .input(pageInput())
    .query(({ input }) => listAllUsers(toSkip(input.page), PORTAL_PAGE_SIZE)),

  listActivity: portalProcedure
    .input(pageInput())
    .query(({ input }) =>
      listPlatformActivity(toSkip(input.page), PORTAL_PAGE_SIZE),
    ),

  /* ─────────────────────────────────────────────────────────────────────
   * ANALYTICS — the portal dashboard.
   *
   * All queries, so the `<resource>.<verb>` guardrail in protectedProcedure
   * does not apply (it governs mutations only) and no RESOURCES entry is
   * needed: the registry describes TENANT features, and none of this is one.
   * They are still covered by the global apiLimiter inherited from
   * baseProcedure, and by the platform-admin gate above.
   *
   * Split by concern rather than served from one fat procedure so a slow
   * panel cannot delay the KPI tiles — each resolves independently.
   * ───────────────────────────────────────────────────────────────────── */

  getMetrics: portalProcedure
    .input(analyticsRangeSchema)
    .query(({ input }) => analytics.getPlatformMetrics(input.days)),

  getGrowthSeries: portalProcedure
    .input(analyticsRangeSchema)
    .query(({ input }) => analytics.getGrowthSeries(input.days)),

  getEngagementSeries: portalProcedure
    .input(analyticsRangeSchema)
    .query(({ input }) => analytics.getEngagementSeries(input.days)),

  getRetention: portalProcedure
    .input(analyticsRangeSchema)
    .query(({ input }) => analytics.getRetentionMetrics(input.days)),

  /* No range input: subscription mix is a point-in-time snapshot, not a
   * windowed series — "how many people pay me right now". */
  getRevenue: portalProcedure.query(() => analytics.getRevenueMetrics()),
});

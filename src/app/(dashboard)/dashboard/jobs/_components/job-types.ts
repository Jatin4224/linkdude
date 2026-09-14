/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: JobEmailResultData
 *
 * WHAT:  The exact shape jobEmails.create returns.
 * WHY:   Derived with `inferRouterOutputs` rather than restated, so the router
 *        stays the single source of truth. Same pattern as carousel-types.ts,
 *        which is why it lives beside its components: it declares no new shape.
 * WHERE: job-assist-workspace.tsx and job-email-result.tsx.
 */

import type { inferRouterOutputs } from "@trpc/server";

import type { AppRouter } from "@/trpc/routers/_app";

export type JobEmailResultData =
  inferRouterOutputs<AppRouter>["jobEmails"]["create"];

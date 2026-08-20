/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: CarouselListRow, CarouselDetail
 *
 * WHAT:  The exact row shapes the carousel router returns, aliased for the
 *        components that render them.
 * WHY:   Derived from the router with `inferRouterOutputs`, never restated — the
 *        select in carousel.service is the source of truth, so narrowing it later
 *        surfaces here as a compile error instead of an undefined cell. Same
 *        pattern as calendar-types.ts and member-types.ts.
 *
 *        Lives beside its components rather than in lib/types because it declares
 *        NO new shape: it is a view onto a contract that already exists. A type
 *        with its own fields would belong in lib/types.
 * WHERE: Imported by carousel-workspace.tsx.
 */

import type { inferRouterOutputs } from "@trpc/server";

import type { AppRouter } from "@/trpc/routers/_app";

export type CarouselListRow =
  inferRouterOutputs<AppRouter>["carousel"]["list"]["items"][number];

export type CarouselDetail = inferRouterOutputs<AppRouter>["carousel"]["get"];

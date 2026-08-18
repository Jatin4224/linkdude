/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: DocumentListRow
 *
 * WHAT:  The exact row shape documents.list returns.
 * WHY:   Derived with `inferRouterOutputs` rather than restated, so DOCUMENT_SAFE_SELECT
 *        in documents.service stays the single source of truth for what a client
 *        can see. Same pattern as calendar-types.ts and member-types.ts.
 * WHERE: Imported by documents-library.tsx.
 */

import type { inferRouterOutputs } from "@trpc/server";

import type { AppRouter } from "@/trpc/routers/_app";

export type DocumentListRow =
  inferRouterOutputs<AppRouter>["documents"]["list"]["items"][number];

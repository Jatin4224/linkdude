/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: POST, asset reap route, reapOrphanedAssets,
 *   REAP_RUN_PATH, cron, orphaned image
 *
 * WHAT:  Runs the orphaned-asset reap over every generated-file folder.
 *        Triggered on a schedule.
 * WHY:   A route handler on a Bearer secret, deliberately the SAME shape and the
 *        same secret as scheduled publishing — this codebase keeps no queue SDK,
 *        and a second trigger mechanism for a second background job would be a
 *        second thing to configure and forget.
 *
 *        Not a tRPC procedure, and not only because a cron has no session: this
 *        does bounded work against a vendor API with no tenant scope, which is the
 *        opposite of what the procedure factory's org-scoped, quota-metered,
 *        transaction-wrapped pipeline is for.
 *
 *        Returns the counts rather than 204, so whoever runs the schedule can see
 *        whether the cap was hit and shorten the interval instead of discovering a
 *        growing backlog months later.
 *
 *        NOT idempotent in the strict sense — it deletes — but it is safe to run
 *        repeatedly and safe to run concurrently: the worst a second overlapping
 *        run does is try to delete a file the first already removed, and
 *        deleteImage treats that as nothing.
 * WHERE: Point a cron at REAP_RUN_PATH with the scheduler secret. Daily is
 *        plenty; the grace period is twenty-four hours.
 */

import { timingSafeEqual } from "node:crypto";

import {
  getSchedulerSecret,
  isSchedulerConfigured,
} from "@/lib/config/scheduler";
import { isImageKitConfigured } from "@/lib/config";
import * as assetReaperService from "@/services/asset-reaper.service";

/* Long enough for a capped run of deletes against a remote API. */
export const maxDuration = 60;
export const dynamic = "force-dynamic";

/* Constant-time compare, matching the scheduled-posts trigger: a plain `===`
 * returns as soon as two bytes differ, which leaks the secret one character at a
 * time to anyone who can measure the response. */
function isAuthorizedTrigger(provided: string | null): boolean {
  if (!provided) return false;
  const expected = `Bearer ${getSchedulerSecret()}`;
  const providedBytes = Buffer.from(provided);
  const expectedBytes = Buffer.from(expected);
  if (providedBytes.length !== expectedBytes.length) return false;
  return timingSafeEqual(providedBytes, expectedBytes);
}

export async function POST(request: Request): Promise<Response> {
  if (!isSchedulerConfigured()) {
    /* 503, not 500: nothing is broken, the trigger simply isn't wired up. */
    return Response.json(
      { error: "Scheduled jobs are not configured." },
      { status: 503 },
    );
  }

  if (!isAuthorizedTrigger(request.headers.get("authorization"))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isImageKitConfigured()) {
    return Response.json(
      { error: "File storage is not configured." },
      { status: 503 },
    );
  }

  try {
    const result = await assetReaperService.reapOrphanedAssets(
      new Date(),
    );
    return Response.json(result, { status: 200 });
  } catch (error) {
    /* A failed reap deletes nothing — the reference scan runs before the first
     * delete, so an abort here means the library is untouched. Reported as 500 so
     * a scheduler retries rather than treating it as a clean run. */
    console.error("[assets] reap failed", error);
    return Response.json({ error: "That reap could not run." }, { status: 500 });
  }
}

/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: isSchedulerConfigured, getSchedulerSecret,
 *   MAX_PUBLISH_ATTEMPTS, PUBLISH_BATCH_SIZE, PUBLISHING_STALE_MS,
 *   MIN_SCHEDULE_LEAD_MS, SCHEDULER_RUN_PATH
 *
 * WHAT:  The shared secret and tuning constants for the scheduled-post worker.
 * WHY:   The trigger is deliberately VENDOR-NEUTRAL. Scheduled rows in the
 *        database are the source of truth for what is due; the provider's only
 *        job is to POST one idempotent URL on an interval. Upstash QStash,
 *        Vercel Cron, and a system crontab all send `Authorization: Bearer …`,
 *        so a single shared secret keeps every adapter byte-identical and makes
 *        switching providers an env-var change rather than a code change.
 *        Fails soft like the other integration configs: with no secret set the
 *        route 503s and the composer hides scheduling, rather than accepting
 *        posts that would never fire.
 * WHERE: Consumed by src/app/api/scheduled-posts/run/route.ts and the worker
 *        functions in src/services/linkedin.service.ts.
 */

/* Three tries, then the row goes terminal `failed` and stops being claimed.
 * Backoff is implicit — a failed row is simply picked up by a later poll. */
export const MAX_PUBLISH_ATTEMPTS = 3;

/* Rows claimed per invocation. Sized so a full batch finishes inside the
 * route's maxDuration even if several posts carry images; leftovers are claimed
 * by the next poll rather than risking a mid-batch timeout. */
export const PUBLISH_BATCH_SIZE = 25;

/* A row still in `publishing` after this long belongs to a worker that died
 * mid-flight. The reaper returns it to `scheduled`; without this a crash
 * strands the post forever, since only `scheduled` rows are ever claimed. */
export const PUBLISHING_STALE_MS = 10 * 60 * 1000;

/**
 * SOURCE OF TRUTH KEYWORDS: MIN_SCHEDULE_LEAD_MS
 *
 * WHAT:  How far ahead a post must be scheduled.
 * WHY:   A post scheduled 10 seconds out could be claimed by a poll already
 *        in flight, racing the user's own confirmation toast. Five minutes is
 *        comfortably longer than any sane poll interval.
 * WHERE: Enforced by scheduledForSchema in src/lib/types/linkedin.ts, which
 *        both the router and the composer form resolve against.
 */
export const MIN_SCHEDULE_LEAD_MS = 5 * 60 * 1000;

/* The one URL every adapter targets. Exported so docs and the setup checklist
 * quote it from here rather than restating the path. */
export const SCHEDULER_RUN_PATH = "/api/scheduled-posts/run";

/**
 * SOURCE OF TRUTH KEYWORDS: isSchedulerConfigured
 *
 * WHAT:  True when the shared trigger secret is set.
 * WHERE: Guard in the run route (503s without it) and in the composer, which
 *        hides "Schedule for later" so a user is never offered a control whose
 *        posts have nothing to publish them.
 */
export function isSchedulerConfigured(): boolean {
  return Boolean(process.env["SCHEDULER_SECRET"]);
}

/**
 * SOURCE OF TRUTH KEYWORDS: getSchedulerSecret
 *
 * WHAT:  The bearer secret the trigger must present, throwing if unset.
 * WHERE: Called by the run route to build the expected Authorization header.
 */
export function getSchedulerSecret(): string {
  const secret = process.env["SCHEDULER_SECRET"];
  if (!secret) {
    throw new Error(
      "[scheduler] SCHEDULER_SECRET is not set. Scheduled publishing is " +
        "disabled until it is configured.",
    );
  }
  return secret;
}

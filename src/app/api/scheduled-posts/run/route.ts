/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: scheduledPostsRunRoute, isAuthorizedTrigger,
 *   SCHEDULER_RUN_PATH
 *
 * WHAT:  The one endpoint that publishes due scheduled posts. Whatever calls it
 *        — Upstash QStash, Vercel Cron, a system crontab, curl — is the
 *        scheduler.
 * WHY:   Deliberately VENDOR-NEUTRAL. The database is the source of truth for
 *        what is due; the caller's only job is to say "wake up". That is what
 *        makes swapping schedulers an env-var change rather than a rewrite, and
 *        it is why no queue SDK appears anywhere in this codebase.
 *
 *        Safe to call concurrently and safe to call often: the claim inside
 *        publishDueScheduledPosts is a single atomic UPDATE with
 *        FOR UPDATE SKIP LOCKED, so two overlapping runs cannot claim the same
 *        row and a post can never publish twice.
 *
 *        Runs OUTSIDE the request lifecycle, so it passes the prisma singleton
 *        rather than a tRPC ctx.db — the seam documented in
 *        docs/03-procedures-and-routers.md. It cannot use protectedProcedure:
 *        there is no session and no organization here.
 * WHERE: Called on an interval by whatever scheduler the deployment uses. See
 *        SCHEDULER_SECRET in .env.example for wiring.
 */

import { timingSafeEqual } from "node:crypto";

import { prisma } from "@/lib/config/prisma";
import { getSchedulerSecret, isSchedulerConfigured } from "@/lib/config";
import * as linkedinService from "@/services/linkedin.service";

/* A full batch of image posts is several LinkedIn round trips each; the default
 * 10s would cut a healthy run short and leave rows in `publishing` for the
 * reaper to clean up. */
export const maxDuration = 60;

/* The worker reads and writes rows that change every minute — a cached response
 * here would mean the scheduler polls a stale success forever. */
export const dynamic = "force-dynamic";

/* Constant-time compare. A plain `===` returns as soon as two bytes differ,
 * which leaks the secret one character at a time to anyone who can measure the
 * response. Length is checked first because timingSafeEqual throws on a
 * mismatch — and length alone is not the secret. */
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
    /* 503, not 500: nothing is broken, the feature simply isn't wired up. A
     * scheduler reading status codes should back off, not alert. */
    return Response.json(
      { error: "Scheduled publishing is not configured." },
      { status: 503 },
    );
  }

  if (!isAuthorizedTrigger(request.headers.get("authorization"))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  try {
    /* Reap first: a row stranded by a crashed run is due right now, and this is
     * what lets it be claimed by the very next line. */
    const reclaimed = await linkedinService.reclaimStalePublishingPosts(
      prisma,
      now,
    );
    const result = await linkedinService.publishDueScheduledPosts(prisma, now);

    return Response.json({ ...result, reclaimed: reclaimed.count });
  } catch (error) {
    /* One post's failure is handled inside the worker and never reaches here;
     * this is the database-is-down case. 500 so the scheduler retries. */
    console.error("[scheduled-posts] run failed", error);
    return Response.json(
      { error: "Scheduled publish run failed." },
      { status: 500 },
    );
  }
}

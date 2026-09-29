/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "server-only";

/**
 * SOURCE OF TRUTH KEYWORDS: reapOrphanedIllustrations, ReapResult, orphaned image,
 *   grace period, asset reaper, ImageKit cleanup
 *
 * WHAT:  Deletes generated illustrations that no carousel slide points at.
 * WHY:   `carouselIllustration.create` uploads an image and hands back a
 *        reference; the client writes it onto a slide and `carousel.update`
 *        commits it. A member who generates one and then navigates away never
 *        commits anything, so the file exists and nothing remembers it. Saving and
 *        discarding are already collected at the point they orphan
 *        (`orphanedFileIds`); this is for the case where nothing was ever saved,
 *        which no write path can observe.
 *
 *        THIS FUNCTION DELETES CUSTOMER IMAGES, so it is written to fail closed.
 *        Four rules, each load-bearing:
 *
 *        1. THE REFERENCE SCAN RUNS FIRST AND MAY NOT FAIL. If listing what is
 *           referenced throws, the run aborts having deleted nothing. Treating a
 *           failed scan as "nothing is referenced" deletes the library.
 *        2. NOTHING YOUNGER THAN THE GRACE PERIOD IS TOUCHED. A file uploaded
 *           seconds ago is indistinguishable from an orphan by reference alone —
 *           the member is still looking at it in an unsaved draft.
 *        3. ONE FOLDER, NAMED EXPLICITLY. It reaps the illustration folder and
 *           nothing else: `/documents` holds PDFs owned by Document rows with
 *           their own delete verb, and `/linkedin-posts` holds member uploads.
 *        4. A CAP PER RUN. A reap that can delete everything in one pass is a bug
 *           away from doing exactly that; the backlog clears over several runs
 *           instead, and the count is returned so a caller can tell.
 * WHERE: src/app/api/assets/reap/run/route.ts, on the same vendor-neutral cron
 *        trigger as scheduled publishing.
 */

import { prisma, type DbClient } from "@/lib/config/prisma";
import {
  IMAGEKIT_CAROUSEL_FOLDER,
  REAP_BATCH_SIZE,
  REAP_GRACE_MS,
  REAP_PAGE_SIZE,
} from "@/lib/config";
import * as carouselService from "./carousel.service";
import * as imagekitService from "./imagekit.service";

export interface ReapResult {
  /** Files examined — that is, old enough to be candidates. */
  readonly examined: number;
  readonly deleted: number;
  /** True when the cap stopped the run with work still outstanding. */
  readonly capped: boolean;
}

export async function reapOrphanedIllustrations(
  now: Date,
  db: DbClient = prisma,
): Promise<ReapResult> {
  /* Rule 1. Deliberately not wrapped: a throw here aborts the run before a single
   * delete, which is the behaviour we want when we cannot tell what is live. */
  const referenced = await carouselService.listReferencedIllustrationFileIds(db);

  const cutoff = new Date(now.getTime() - REAP_GRACE_MS);
  let examined = 0;
  let deleted = 0;
  let skip = 0;

  for (;;) {
    const page = await imagekitService.listFolderFiles(
      IMAGEKIT_CAROUSEL_FOLDER,
      { limit: REAP_PAGE_SIZE, skip },
    );
    if (page.length === 0) break;

    /* Per PAGE, not cumulative: the cursor advances by how many files this page
     * left in place, and a running total would step over a file for every one
     * deleted on an earlier page. */
    let keptThisPage = 0;

    for (const file of page) {
      /* Rule 2. The listing is oldest-first, so the first file inside the grace
       * period means every file after it is too — nothing further can be reaped
       * this run. */
      if (file.createdAt > cutoff) return { examined, deleted, capped: false };

      examined += 1;
      if (referenced.has(file.fileId)) {
        keptThisPage += 1;
        continue;
      }

      /* deleteImage never throws; a file that resists deletion is reported by it
       * and retried on the next run rather than stopping this one. */
      await imagekitService.deleteImage(file.fileId);
      deleted += 1;

      /* Rule 4. */
      if (deleted >= REAP_BATCH_SIZE) {
        return { examined, deleted, capped: true };
      }
    }

    /* Only files left in place advance the cursor — a deleted file is gone from
     * the next listing, so counting it would step over its neighbour. */
    skip += keptThisPage;
    if (page.length < REAP_PAGE_SIZE) break;
  }

  return { examined, deleted, capped: false };
}

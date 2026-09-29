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
  REAP_FOLDERS,
  REAP_BATCH_SIZE,
  REAP_GRACE_MS,
  REAP_PAGE_SIZE,
} from "@/lib/config";
import * as imagekitService from "./imagekit.service";

/**
 * SOURCE OF TRUTH KEYWORDS: listReferencedAssetFileIds, reaper, orphan, fileId
 *
 * WHAT:  Every ImageKit file id this database knows about, from every column and
 *        JSON blob that can hold one.
 * WHY:   THE SAFETY HALF OF THE REAPER, and the reason it is one function rather
 *        than one per folder. The reaper deletes what this does not return, so the
 *        set may be over-inclusive with no consequence beyond a file living longer
 *        — and under-inclusive exactly once before someone loses work.
 *
 *        Listing every source together is what makes that auditable: the five
 *        places a file id can hide are visible in one screen, so adding a sixth
 *        column somewhere is a change someone can notice here.
 *
 *        It is NOT scoped per folder, deliberately. `/studio` holds two kinds of
 *        file with different owners — AI backdrops referenced by StudioAsset.doc,
 *        and rendered exports referenced by a Document row — so a scan that knew
 *        only about backdrops would read every finished export as an orphan.
 *        Unioning everything removes that whole class of mistake.
 *
 *        Reads every organisation, because the asset library is not partitioned by
 *        tenant: a per-org scan sees another org's files as unreferenced.
 *
 *        Walks raw JSON rather than the typed parsers on purpose. A row written by
 *        a shape this build does not understand still holds real file ids, and a
 *        strict parse would discard them — turning an unreadable row into one
 *        whose images get collected.
 * WHERE: reapOrphanedAssets, which aborts the run if this throws.
 */
export async function listReferencedAssetFileIds(
  db: DbClient = prisma,
): Promise<ReadonlySet<string>> {
  const referenced = new Set<string>();
  const add = (value: unknown) => {
    if (typeof value === "string" && value.length > 0) referenced.add(value);
  };

  const [documents, carousels, studioAssets, posts] = await Promise.all([
    db.document.findMany({ select: { fileId: true } }),
    db.carousel.findMany({ select: { slides: true } }),
    db.studioAsset.findMany({ select: { doc: true } }),
    db.linkedInPost.findMany({
      select: { imageFileId: true, originalFileId: true },
    }),
  ]);

  /* 1. Rendered artifacts — carousel PDFs and studio exports both land here. */
  for (const document of documents) add(document.fileId);

  /* 2. Slide illustrations, inside the deck's JSON. */
  for (const carousel of carousels) {
    if (!Array.isArray(carousel.slides)) continue;
    for (const slide of carousel.slides) {
      if (typeof slide !== "object" || slide === null) continue;
      const illustration = (slide as { illustration?: unknown }).illustration;
      if (typeof illustration !== "object" || illustration === null) continue;
      add((illustration as { fileId?: unknown }).fileId);
    }
  }

  /* 3. Studio images — backdrops, photos, logos — keyed by slot inside the doc. */
  for (const asset of studioAssets) {
    if (typeof asset.doc !== "object" || asset.doc === null) continue;
    const images = (asset.doc as { images?: unknown }).images;
    if (typeof images !== "object" || images === null) continue;
    for (const image of Object.values(images)) {
      if (typeof image !== "object" || image === null) continue;
      add((image as { fileId?: unknown }).fileId);
    }
  }

  /* 4 and 5. A post's image, and the original it was edited from. */
  for (const post of posts) {
    add(post.imageFileId);
    add(post.originalFileId);
  }

  return referenced;
}

export interface ReapResult {
  /** Files examined — that is, old enough to be candidates. */
  readonly examined: number;
  readonly deleted: number;
  /** True when the cap stopped the run with work still outstanding. */
  readonly capped: boolean;
}

export async function reapOrphanedAssets(
  now: Date,
  db: DbClient = prisma,
): Promise<ReapResult> {
  /* Rule 1. Deliberately not wrapped: a throw here aborts the run before a single
   * delete, which is the behaviour we want when we cannot tell what is live. */
  const referenced = await listReferencedAssetFileIds(db);

  const cutoff = new Date(now.getTime() - REAP_GRACE_MS);
  let examined = 0;
  let deleted = 0;

  for (const folder of REAP_FOLDERS) {
    const folderResult = await reapFolder({
      folder,
      referenced,
      cutoff,
      /* The cap is across the WHOLE run, not per folder — otherwise two folders
       * could delete twice the intended ceiling between them. */
      budget: REAP_BATCH_SIZE - deleted,
    });

    examined += folderResult.examined;
    deleted += folderResult.deleted;

    if (folderResult.capped) return { examined, deleted, capped: true };
  }

  return { examined, deleted, capped: false };
}

/* One folder's pass. Split out so the run-wide budget and the per-folder cursor
 * cannot be confused for each other. */
async function reapFolder(args: {
  folder: string;
  referenced: ReadonlySet<string>;
  cutoff: Date;
  budget: number;
}): Promise<ReapResult> {
  const { folder, referenced, cutoff, budget } = args;
  let examined = 0;
  let deleted = 0;
  let skip = 0;

  if (budget <= 0) return { examined, deleted, capped: true };

  for (;;) {
    const page = await imagekitService.listFolderFiles(folder, {
      limit: REAP_PAGE_SIZE,
      skip,
    });
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

      /* Rule 4, against this folder's share of the run-wide budget. */
      if (deleted >= budget) {
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

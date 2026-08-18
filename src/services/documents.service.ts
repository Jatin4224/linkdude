/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "server-only";

/**
 * SOURCE OF TRUTH KEYWORDS: listDocuments, getDocument, deleteDocument,
 *   DOCUMENT_SAFE_SELECT
 *
 * WHAT:  Pure Prisma access for the Document table — the library of files this
 *        app has generated.
 * WHY:   `server-only` for the same reason every service here is: it takes a
 *        DbClient and must never be reachable from a client bundle.
 *
 *        Documents are READ and DELETED here, never created. Creation belongs to
 *        whatever produced the file — today that is the carousel render, which
 *        writes the row in the same transaction that marks the deck ready, so a
 *        file and its owner can never disagree about whether it exists.
 * WHERE: Called by src/trpc/routers/documents.ts.
 */

import { prisma, type DbClient } from "@/lib/config/prisma";

/* Everything a client may read. `fileId` is deliberately EXCLUDED: it is the
 * vendor handle that authorises deletion, and no browser needs it — the delete
 * verb resolves it server-side from the row's own id. */
const DOCUMENT_SAFE_SELECT = {
  id: true,
  url: true,
  fileName: true,
  title: true,
  mimeType: true,
  byteSize: true,
  pageCount: true,
  createdAt: true,
  carousel: { select: { id: true, topic: true } },
} as const;

export async function listDocuments(
  organizationId: string,
  pagination: { skip: number; take: number },
  db: DbClient = prisma,
) {
  const [items, total] = await Promise.all([
    db.document.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      select: DOCUMENT_SAFE_SELECT,
      skip: pagination.skip,
      take: pagination.take,
    }),
    db.document.count({ where: { organizationId } }),
  ]);
  return { items, total };
}

export async function getDocument(
  organizationId: string,
  id: string,
  db: DbClient = prisma,
) {
  return db.document.findFirst({
    where: { id, organizationId },
    select: DOCUMENT_SAFE_SELECT,
  });
}

/**
 * SOURCE OF TRUTH KEYWORDS: deleteDocument
 *
 * WHAT:  Removes a document row, returning the row count and the vendor handle.
 *        Refuses when a scheduled post still depends on the file.
 * WHY:   Returns `count` because the procedure factory reads it to decide whether
 *        anything actually happened — the DELETE NO-OP rule. Returns `fileId` so
 *        the router can delete the ImageKit asset AFTER the transaction commits:
 *        removing it inside would leave a live row pointing at a deleted file if
 *        the transaction then rolled back. Same ordering the post-cancel path uses.
 *
 *        THE SCHEDULED-POST GUARD is the reason this is not a plain delete. The
 *        relation is SetNull, so deleting a PDF that a queued post points at
 *        would quietly blank its documentId — and the worker, hours later, would
 *        publish a text-only post where the user expected a carousel. That is
 *        both invisible at delete time and impossible to undo once it reaches an
 *        audience. Refusing is the only honest option: the user can cancel the
 *        post, or leave the file alone.
 *
 *        A PUBLISHED post is a different matter and does NOT block — LinkedIn
 *        holds its own copy of the asset, so removing ours changes nothing about
 *        what is already live. Likewise any Carousel pointing here is left
 *        standing with its documentId nulled; deleting the file does not delete
 *        the writing, and the deck simply re-renders.
 */
export async function deleteDocument(
  organizationId: string,
  id: string,
  db: DbClient = prisma,
) {
  const existing = await db.document.findFirst({
    where: { id, organizationId },
    select: { fileId: true },
  });
  if (!existing) return { count: 0, fileId: null, blockedBy: 0 };

  const blockedBy = await db.linkedInPost.count({
    where: {
      documentId: id,
      organizationId,
      /* Only states the worker can still act on. `publishing` counts too: that
       * row is mid-flight and about to read the file. */
      status: { in: ["scheduled", "publishing"] },
    },
  });
  if (blockedBy > 0) return { count: 0, fileId: null, blockedBy };

  const result = await db.document.deleteMany({
    where: { id, organizationId },
  });
  return { count: result.count, fileId: existing.fileId, blockedBy: 0 };
}

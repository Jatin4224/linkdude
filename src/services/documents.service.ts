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
 * WHY:   Returns `count` because the procedure factory reads it to decide whether
 *        anything actually happened — the DELETE NO-OP rule. Returns `fileId` so
 *        the router can delete the ImageKit asset AFTER the transaction commits:
 *        removing it inside would leave a live row pointing at a deleted file if
 *        the transaction then rolled back. Same ordering the post-cancel path uses.
 *
 *        Any Carousel pointing here is left standing, with its documentId nulled
 *        by the SetNull relation. Deleting the file does not delete the writing —
 *        the deck stays editable and simply re-renders.
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
  if (!existing) return { count: 0, fileId: null };

  const result = await db.document.deleteMany({
    where: { id, organizationId },
  });
  return { count: result.count, fileId: existing.fileId };
}

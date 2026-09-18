/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "server-only";

/**
 * SOURCE OF TRUTH KEYWORDS: listStudioProjects, getStudioProject,
 *   createStudioProjectRecord, updateStudioAssetDoc, attachStudioAssetDocument,
 *   markStudioAssetFailed, discardStudioProject, parseDesignDoc,
 *   updateStudioProjectText,
 *   STUDIO_PROJECT_SELECT, STUDIO_PROJECT_LIST_SELECT, StudioProjectRow
 *
 * WHAT:  The database half of the studio — every Prisma call the feature makes.
 * WHY:   `server-only` and pure Prisma, per the service rule: no auth, no audit,
 *        no transactions, no decisions. Those belong to the router.
 *
 *        `db` comes FIRST on every function so each write enlists in the
 *        procedure's transaction — the content-plan.service rule. Passing it
 *        last with a default (as the older carousel.service does) makes it easy
 *        to omit, and a write that quietly escapes the caller's transaction is
 *        the hardest kind of consistency bug to find.
 *
 *        Every Json column is parsed back through its schema HERE, so nothing
 *        untyped reaches a router. A Json column is `any` until something
 *        validates it, and doing that once at the boundary beats doing it in
 *        each caller.
 * WHERE: src/trpc/routers/studio.ts, imported with `import * as studioService`.
 */

import type { Prisma } from "@/generated/prisma";
/* The singleton is imported as a VALUE for exactly one function — see
 * markStudioAssetFailed, which must escape the caller's transaction. */
import { prisma, type DbClient } from "@/lib/config/prisma";
import { designDocSchema, type DesignDoc } from "@/lib/types/design-block";

/* Everything the editor needs. `doc` is included because the editor opens
 * straight into it — unlike the list below, where shipping every block list for
 * every row would be pure payload. The same split CAROUSEL_SAFE_SELECT and
 * CAROUSEL_LIST_SELECT draw. */
const STUDIO_PROJECT_SELECT = {
  id: true,
  name: true,
  templateId: true,
  paletteId: true,
  tone: true,
  role: true,
  headline: true,
  about: true,
  createdAt: true,
  updatedAt: true,
  assets: {
    select: {
      id: true,
      kind: true,
      position: true,
      doc: true,
      status: true,
      lastError: true,
      updatedAt: true,
      document: {
        select: {
          id: true,
          url: true,
          fileName: true,
          title: true,
          byteSize: true,
          createdAt: true,
        },
      },
    },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
  },
} as const satisfies Prisma.StudioProjectSelect;

/* The list view draws cards, not designs — so no `doc`, and only enough of the
 * document to show a thumbnail and a status. */
const STUDIO_PROJECT_LIST_SELECT = {
  id: true,
  name: true,
  templateId: true,
  paletteId: true,
  tone: true,
  role: true,
  createdAt: true,
  updatedAt: true,
  assets: {
    select: { id: true, kind: true, status: true, document: { select: { url: true } } },
    orderBy: [{ position: "asc" }],
  },
} as const satisfies Prisma.StudioProjectSelect;

/**
 * SOURCE OF TRUTH KEYWORDS: parseDesignDoc
 *
 * WHAT:  Validates a stored design on the way out of the database.
 * WHY:   Takes `Prisma.JsonValue` rather than `unknown`, deliberately: the
 *        narrower input documents that this is the DB boundary and nothing else,
 *        and it stops the function being reused as a general-purpose parser for
 *        client input, which has different trust rules.
 */
function parseDesignDoc(value: Prisma.JsonValue): DesignDoc {
  return designDocSchema.parse(value);
}

export async function listStudioProjects(
  db: DbClient,
  organizationId: string,
  authorId: string,
  pagination: { skip: number; take: number },
) {
  const [items, total] = await Promise.all([
    db.studioProject.findMany({
      where: { organizationId, authorId },
      select: STUDIO_PROJECT_LIST_SELECT,
      orderBy: { updatedAt: "desc" },
      skip: pagination.skip,
      take: pagination.take,
    }),
    db.studioProject.count({ where: { organizationId, authorId } }),
  ]);

  return { items, total };
}

/**
 * SOURCE OF TRUTH KEYWORDS: getStudioProject
 *
 * WHAT:  One project with its assets, designs already validated.
 * WHY:   Scoped by organization AND author: a profile is one member's, and a
 *        guessed id from a colleague must resolve to nothing rather than to
 *        someone else's half-finished banner. The same scoping post-ideas uses.
 */
export async function getStudioProject(
  db: DbClient,
  organizationId: string,
  authorId: string,
  id: string,
) {
  const project = await db.studioProject.findFirst({
    where: { id, organizationId, authorId },
    select: STUDIO_PROJECT_SELECT,
  });

  if (!project) return null;

  return {
    ...project,
    assets: project.assets.map((asset) => ({
      ...asset,
      doc: parseDesignDoc(asset.doc),
    })),
  };
}

/**
 * SOURCE OF TRUTH KEYWORDS: createStudioProjectRecord
 *
 * WHAT:  A new project and its first asset, in one write.
 * WHY:   Nested create rather than two calls: a project with no assets is not a
 *        thing the editor can open, so it must never exist even for the width of
 *        a failed second insert.
 */
export async function createStudioProjectRecord(
  db: DbClient,
  args: {
    organizationId: string;
    authorId: string;
    name: string;
    templateId: string;
    paletteId: string;
    tone: string;
    role: string;
    assets: readonly { kind: string; position: number; doc: DesignDoc }[];
  },
) {
  return db.studioProject.create({
    data: {
      organizationId: args.organizationId,
      authorId: args.authorId,
      name: args.name,
      templateId: args.templateId,
      paletteId: args.paletteId,
      tone: args.tone,
      role: args.role,
      assets: {
        create: args.assets.map((asset) => ({
          organizationId: args.organizationId,
          kind: asset.kind,
          position: asset.position,
          doc: asset.doc,
        })),
      },
    },
    select: STUDIO_PROJECT_SELECT,
  });
}

/**
 * SOURCE OF TRUTH KEYWORDS: updateStudioAssetDoc
 *
 * WHAT:  Replaces one asset's design.
 * WHY:   `updateMany` with the whole scope in the WHERE, returning `count`, so
 *        the router can tell "not yours" from "saved" without a second read —
 *        the pattern every service here follows.
 *
 *        Resets `status` to draft and clears `lastError`: an edited design has
 *        not been exported yet, and leaving it `ready` would point Download at a
 *        file that no longer matches what is on screen.
 */
export async function updateStudioAssetDoc(
  db: DbClient,
  args: {
    organizationId: string;
    projectId: string;
    assetId: string;
    doc: DesignDoc;
  },
): Promise<{ count: number }> {
  return db.studioAsset.updateMany({
    where: {
      id: args.assetId,
      projectId: args.projectId,
      organizationId: args.organizationId,
    },
    data: { doc: args.doc, status: "draft", lastError: null },
  });
}

/**
 * SOURCE OF TRUTH KEYWORDS: updateStudioProjectText
 *
 * WHAT:  Saves the project's name, headline and About copy.
 * WHY:   Separate from updateStudioAssetDoc because it changes NO pixels. An
 *        asset's status must not drop to "draft" when someone edits their About
 *        section — that would mark every exported image stale for a change none
 *        of them render.
 */
export async function updateStudioProjectText(
  db: DbClient,
  args: {
    organizationId: string;
    authorId: string;
    id: string;
    name?: string | undefined;
    headline?: string | undefined;
    about?: string | undefined;
  },
): Promise<{ count: number }> {
  return db.studioProject.updateMany({
    where: { id: args.id, organizationId: args.organizationId, authorId: args.authorId },
    data: {
      ...(args.name === undefined ? {} : { name: args.name }),
      ...(args.headline === undefined ? {} : { headline: args.headline }),
      ...(args.about === undefined ? {} : { about: args.about }),
    },
  });
}

/**
 * SOURCE OF TRUTH KEYWORDS: attachStudioAssetDocument
 *
 * WHAT:  Links a freshly uploaded PNG to its asset, and reports the file it
 *        replaced.
 * WHY:   Two invariants, both copied from attachCarouselDocument because both
 *        are things that bite in production:
 *
 *        1. ONE nested write, so an asset can never be `ready` with no document.
 *        2. The superseded Document ROW is deleted inside the transaction (our
 *           data, rolls back cleanly), but the superseded remote ASSET is only
 *           REPORTED — the caller deletes it after the commit. Deleting a remote
 *           file inside a transaction that later rolls back destroys a file the
 *           database still points at.
 */
export async function attachStudioAssetDocument(
  db: DbClient,
  args: {
    organizationId: string;
    assetId: string;
    fileId: string;
    url: string;
    fileName: string;
    title: string;
    mimeType: string;
    byteSize: number;
  },
) {
  const previous = await db.studioAsset.findFirst({
    where: { id: args.assetId, organizationId: args.organizationId },
    select: { document: { select: { id: true, fileId: true } } },
  });

  const asset = await db.studioAsset.update({
    where: { id: args.assetId },
    data: {
      status: "ready",
      lastError: null,
      document: {
        create: {
          organizationId: args.organizationId,
          fileId: args.fileId,
          url: args.url,
          fileName: args.fileName,
          title: args.title,
          mimeType: args.mimeType,
          byteSize: args.byteSize,
          /* A PNG is one page. The column is required and means "slides" on a
           * carousel PDF; storing 1 keeps a Document readable without teaching
           * it that some documents are images. */
          pageCount: 1,
        },
      },
    },
    select: {
      id: true,
      kind: true,
      status: true,
      lastError: true,
      document: {
        select: { id: true, url: true, fileName: true, title: true, byteSize: true },
      },
    },
  });

  if (previous?.document) {
    await db.document.delete({ where: { id: previous.document.id } });
  }

  return { asset, supersededFileId: previous?.document?.fileId ?? null };
}

/**
 * SOURCE OF TRUTH KEYWORDS: markStudioAssetFailed
 *
 * WHAT:  Records why a render failed.
 * WHY:   Note the absent `db` parameter — this one takes no client and always
 *        uses the singleton. That is the point: it is called from a catch block
 *        whose rethrow rolls the procedure's transaction back, and a write on
 *        `ctx.db` would be erased by the very rollback that reports the error.
 *        The opposite is a documented bug in this codebase's own notes.
 */
export async function markStudioAssetFailed(
  organizationId: string,
  assetId: string,
  message: string,
): Promise<{ count: number }> {
  return prisma.studioAsset.updateMany({
    where: { id: assetId, organizationId },
    data: { status: "failed", lastError: message },
  });
}

/**
 * SOURCE OF TRUTH KEYWORDS: discardStudioProject
 *
 * WHAT:  Removes a project and its assets.
 * WHY:   `deleteMany` returning count, so `0` is a clean NOT_FOUND rather than a
 *        thrown Prisma error. StudioAsset cascades from the project; the exported
 *        Documents deliberately DO NOT — the relation is SetNull, so a PNG the
 *        member already pasted into LinkedIn survives them throwing the design
 *        away.
 */
export async function discardStudioProject(
  db: DbClient,
  organizationId: string,
  authorId: string,
  id: string,
): Promise<{ count: number }> {
  return db.studioProject.deleteMany({ where: { id, organizationId, authorId } });
}

/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "server-only";

/**
 * SOURCE OF TRUTH KEYWORDS: listPostIdeas, getPostIdea, createPostIdea,
 *   updatePostIdeaText, setPostIdeaStatus, deletePostIdea, POST_IDEA_SELECT,
 *   idea inbox service
 *
 * WHAT:  The database half of the idea inbox.
 * WHY:   `server-only`, database access only, and `db` first so every write
 *        enlists in the procedure's transaction, the content-plan.service rule.
 *        Every query is scoped by organization AND author: ideas are one member's
 *        notes, and a guessed id from another member resolves to nothing.
 *
 *        Writes use `updateMany` / `deleteMany` so the scope sits in the WHERE and
 *        the returned `count` tells the router whether anything matched.
 * WHERE: src/trpc/routers/post-ideas.ts.
 */

import type { Prisma } from "@/generated/prisma";
import type { DbClient } from "@/lib/config/prisma";
import type {
  ListPostIdeasValues,
  PostIdeaStatus,
} from "@/lib/types/post-ideas";

/* Everything the inbox shows. `authorId` stays out: the caller is always the
 * author, so it tells the client nothing. */
const POST_IDEA_SELECT = {
  id: true,
  text: true,
  status: true,
  usedAt: true,
  createdAt: true,
  updatedAt: true,
} as const satisfies Prisma.PostIdeaSelect;

/**
 * SOURCE OF TRUTH KEYWORDS: listPostIdeas
 *
 * WHAT:  One page of a member's ideas, newest first, optionally narrowed by
 *        status or a text search.
 * WHY:   Search runs in the database, not over the returned page, so `total`
 *        and the rows agree and a match on page two is never reported missing.
 */
export async function listPostIdeas(
  db: DbClient,
  organizationId: string,
  authorId: string,
  filters: Pick<ListPostIdeasValues, "status" | "search">,
  pagination: { skip: number; take: number },
) {
  const where: Prisma.PostIdeaWhereInput = {
    organizationId,
    authorId,
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.search
      ? { text: { contains: filters.search, mode: "insensitive" } }
      : {}),
  };

  const [items, total] = await Promise.all([
    db.postIdea.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: POST_IDEA_SELECT,
      skip: pagination.skip,
      take: pagination.take,
    }),
    db.postIdea.count({ where }),
  ]);
  return { items, total };
}

export async function getPostIdea(
  db: DbClient,
  organizationId: string,
  authorId: string,
  id: string,
) {
  return db.postIdea.findFirst({
    where: { id, organizationId, authorId },
    select: POST_IDEA_SELECT,
  });
}

export async function createPostIdea(
  db: DbClient,
  organizationId: string,
  authorId: string,
  text: string,
) {
  return db.postIdea.create({
    data: { organizationId, authorId, text },
    select: POST_IDEA_SELECT,
  });
}

export async function updatePostIdeaText(
  db: DbClient,
  organizationId: string,
  authorId: string,
  id: string,
  text: string,
): Promise<{ count: number }> {
  return db.postIdea.updateMany({
    where: { id, organizationId, authorId },
    data: { text },
  });
}

/**
 * SOURCE OF TRUTH KEYWORDS: setPostIdeaStatus
 *
 * WHAT:  Marks an idea used or new.
 * WHY:   `usedAt` follows the status, so "used on" is always the latest time it
 *        was marked, and a reopened idea carries no stale date.
 */
export async function setPostIdeaStatus(
  db: DbClient,
  organizationId: string,
  authorId: string,
  id: string,
  status: PostIdeaStatus,
): Promise<{ count: number }> {
  return db.postIdea.updateMany({
    where: { id, organizationId, authorId },
    data: { status, usedAt: status === "used" ? new Date() : null },
  });
}

/**
 * SOURCE OF TRUTH KEYWORDS: deletePostIdea
 *
 * WHAT:  Removes an idea and returns how many rows went.
 * WHY:   The procedure factory reads `count` to refund the idea slot only when
 *        something was actually deleted, the DELETE NO-OP rule.
 */
export async function deletePostIdea(
  db: DbClient,
  organizationId: string,
  authorId: string,
  id: string,
): Promise<{ count: number }> {
  return db.postIdea.deleteMany({
    where: { id, organizationId, authorId },
  });
}

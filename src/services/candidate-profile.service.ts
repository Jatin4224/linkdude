/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "server-only";

/**
 * SOURCE OF TRUTH KEYWORDS: readCandidateProfile, saveCandidateProfile,
 *   CandidateProfile, About me, Job Assist profile
 *
 * WHAT:  The database half of a member's saved "About me" details.
 * WHY:   `server-only`, database access only, and `db` first so writes enlist in
 *        the procedure's transaction, the content-plan.service rule. The Json
 *        column is parsed on the way out, so nothing untyped reaches a router.
 * WHERE: The candidateProfile, jobEmails and jobEmailRewrites routers.
 */

import type { DbClient } from "@/lib/config/prisma";
import {
  candidateProfileSchema,
  type CandidateProfileValues,
} from "@/lib/types/job-email";

/**
 * SOURCE OF TRUTH KEYWORDS: readCandidateProfile
 *
 * WHAT:  This member's saved details in this organization, or null.
 * WHY:   Null rather than a throw when the stored shape no longer parses: a job
 *        email should still be written (with placeholders) instead of failing
 *        over a field that moved.
 */
export async function readCandidateProfile(
  db: DbClient,
  organizationId: string,
  authorId: string,
): Promise<CandidateProfileValues | null> {
  const row = await db.candidateProfile.findUnique({
    where: { organizationId_authorId: { organizationId, authorId } },
    select: { details: true },
  });
  if (!row) return null;
  const parsed = candidateProfileSchema.safeParse(row.details);
  return parsed.success ? parsed.data : null;
}

/**
 * SOURCE OF TRUTH KEYWORDS: saveCandidateProfile
 *
 * WHAT:  Creates or replaces this member's saved details.
 * WHY:   Whole-object writes, so clearing a field is expressible.
 */
export async function saveCandidateProfile(
  db: DbClient,
  organizationId: string,
  authorId: string,
  details: CandidateProfileValues,
): Promise<void> {
  await db.candidateProfile.upsert({
    where: { organizationId_authorId: { organizationId, authorId } },
    create: { organizationId, authorId, details },
    update: { details },
  });
}

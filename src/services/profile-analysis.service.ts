/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "server-only";

/**
 * SOURCE OF TRUTH KEYWORDS: recordAnalysis, listAnalyses, discardAnalysis,
 *   RecordAnalysisArgs, PROFILE_ANALYSIS_LIST_SELECT, toStoredAnalysis,
 *   ProfileAnalysis, StoredProfileAnalysis
 *
 * WHAT:  Every database touchpoint for saved profile analyses — write one,
 *        read a page of them back, forget one.
 * WHY:   `server-only` per the service-layer rule. The load-bearing work here is
 *        the READ: the critique lives in a Json column, so Prisma returns an
 *        untyped value, and this file is the single place it is parsed back
 *        through profileAnalysisSchema. Doing it here rather than at each call
 *        site means routers and components only ever see StoredProfileAnalysis,
 *        and a history entry is the same type as a fresh analysis.
 * WHERE: Called by src/trpc/routers/profile-analysis.ts with `import *`. DB
 *        access takes the caller's `db` so it joins the procedure transaction.
 */

import type { DbClient } from "@/lib/config/prisma";
import type { Prisma } from "@/generated/prisma";
import { profileAnalysisSchema } from "@/lib/types/profile-analysis";
import type {
  AnalyzeProfileValues,
  ProfileAnalysis,
  StoredProfileAnalysis,
} from "@/lib/types/profile-analysis";

export interface RecordAnalysisArgs extends AnalyzeProfileValues {
  organizationId: string;
  authorId: string;
  analysis: ProfileAnalysis;
}

/**
 * SOURCE OF TRUTH KEYWORDS: PROFILE_ANALYSIS_LIST_SELECT
 *
 * WHAT:  The field set every read of this table returns.
 * WHY:   Named so the write path and the read path cannot drift — both build a
 *        StoredProfileAnalysis from exactly these columns.
 * WHERE: Used by recordAnalysis and listAnalyses below.
 */
const PROFILE_ANALYSIS_LIST_SELECT = {
  id: true,
  score: true,
  summary: true,
  createdAt: true,
  result: true,
  /* The original input. Selected because a history row is re-runnable: the user
   * reloads it, edits a line, and analyzes again. Without these the columns
   * would be written on every analysis and never read. */
  headline: true,
  about: true,
  experience: true,
} as const satisfies Prisma.ProfileAnalysisSelect;

type ProfileAnalysisRow = Prisma.ProfileAnalysisGetPayload<{
  select: typeof PROFILE_ANALYSIS_LIST_SELECT;
}>;

/**
 * SOURCE OF TRUTH KEYWORDS: toStoredAnalysis
 *
 * WHAT:  Turns a raw row into StoredProfileAnalysis, or null if its stored
 *        critique no longer matches profileAnalysisSchema.
 * WHY:   The Json column is the one place a value can enter the app untyped, so
 *        it is validated rather than asserted. Returns null instead of throwing
 *        because the alternative is worse: a single row written before a schema
 *        change would take down the entire history list, hiding every valid
 *        analysis alongside it.
 */
function toStoredAnalysis(row: ProfileAnalysisRow): StoredProfileAnalysis | null {
  const parsed = profileAnalysisSchema.safeParse(row.result);
  if (!parsed.success) return null;
  return {
    id: row.id,
    score: row.score,
    summary: row.summary,
    createdAt: row.createdAt,
    result: parsed.data,
    input: toAnalyzeInput(row),
  };
}

/**
 * SOURCE OF TRUTH KEYWORDS: toAnalyzeInput
 *
 * WHAT:  Rebuilds the AnalyzeProfileValues a row was produced from.
 * WHY:   `experience` is nullable in the column and OPTIONAL in the schema, and
 *        `exactOptionalPropertyTypes` treats those as different things — an
 *        explicit `undefined` is not a legal value for an optional property. So
 *        the key is omitted entirely when the user skipped it, rather than set
 *        to undefined, which keeps the reloaded form identical to the original
 *        submission.
 */
function toAnalyzeInput(row: ProfileAnalysisRow): AnalyzeProfileValues {
  return {
    headline: row.headline,
    about: row.about,
    ...(row.experience === null ? {} : { experience: row.experience }),
  };
}

/**
 * SOURCE OF TRUTH KEYWORDS: recordAnalysis
 *
 * WHAT:  Saves a critique the model just produced.
 * WHY:   `score` and `summary` are denormalised out of the critique so the
 *        history list can render without parsing the payload of every row.
 *        Called INSIDE the procedure transaction, so if this write fails the
 *        usage increment rolls back with it and the org is not billed a
 *        quota unit for a result it never received.
 */
export async function recordAnalysis(
  db: DbClient,
  args: RecordAnalysisArgs,
): Promise<StoredProfileAnalysis> {
  const row = await db.profileAnalysis.create({
    data: {
      organizationId: args.organizationId,
      authorId: args.authorId,
      headline: args.headline,
      about: args.about,
      /* The form omits an empty Experience, so it arrives `undefined`; the
       * column is nullable, and under exactOptionalPropertyTypes those are not
       * interchangeable. Normalising here keeps "the user skipped it" as one
       * stored value instead of two. */
      experience: args.experience ?? null,
      score: args.analysis.score,
      summary: args.analysis.summary,
      result: args.analysis,
    },
    select: PROFILE_ANALYSIS_LIST_SELECT,
  });

  /* The payload was validated by generateObject on the way in and written in
   * the same statement, so a parse failure here is impossible without a code
   * change — falling back to the in-memory critique keeps the return type
   * honest without pretending to handle a state that cannot occur. */
  return (
    toStoredAnalysis(row) ?? {
      id: row.id,
      score: row.score,
      summary: row.summary,
      createdAt: row.createdAt,
      result: args.analysis,
      input: toAnalyzeInput(row),
    }
  );
}

/**
 * SOURCE OF TRUTH KEYWORDS: listAnalyses
 *
 * WHAT:  An organization's saved analyses, newest first.
 * WHY:   Org-scoped in the `where` rather than filtered afterwards, so a tenant
 *        can never read another's history.
 * WHERE: Backs the history strip on the profile-analysis page.
 */
export async function listAnalyses(
  db: DbClient,
  organizationId: string,
  limit: number,
): Promise<StoredProfileAnalysis[]> {
  const rows = await db.profileAnalysis.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: PROFILE_ANALYSIS_LIST_SELECT,
  });

  return rows
    .map(toStoredAnalysis)
    .filter((row): row is StoredProfileAnalysis => row !== null);
}

/**
 * SOURCE OF TRUTH KEYWORDS: discardAnalysis
 *
 * WHAT:  Forgets a saved analysis. Returns how many rows actually went.
 * WHY:   Scoped by organizationId as well as id so one tenant cannot delete
 *        another's row by guessing a cuid. The `count` is returned rather than
 *        swallowed so the caller can tell a real removal from a no-op.
 */
export async function discardAnalysis(
  db: DbClient,
  organizationId: string,
  analysisId: string,
): Promise<{ count: number }> {
  return db.profileAnalysis.deleteMany({
    where: { id: analysisId, organizationId },
  });
}

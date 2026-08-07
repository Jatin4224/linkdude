/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "server-only";

/**
 * SOURCE OF TRUTH KEYWORDS: readContentPlan, startContentPlan,
 *   saveContentPlanProgress, recordContentPlan, markContentPlanSaved,
 *   discardContentPlan, CONTENT_PLAN_SELECT, toStoredContentPlan,
 *   StartContentPlanArgs, RecordContentPlanArgs
 *
 * WHAT:  The database half of the guided content plan — read the one session a
 *        member has open, advance it, finish it, or throw it away.
 * WHY:   `server-only` per the service rule. Every function takes `db` first so
 *        it enlists in the caller's transaction rather than opening its own: the
 *        generation mutation writes the result and bumps the usage counter in one
 *        transaction, and a service that reached for the global client would put
 *        the write outside the rollback that protects it.
 *
 *        Every Json column is parsed back through its schema HERE, so nothing
 *        untyped crosses into the router. That is what lets the chat render a
 *        resumed session and a just-generated one with the same code.
 * WHERE: Called by src/trpc/routers/content-plan.ts with `import *`.
 */

/* Imported as a VALUE, not just a type: clearing a nullable Json column needs
 * `Prisma.DbNull`. A bare `null` there is a type error, because Prisma reserves
 * JS null for the JSON value `null` and needs the sentinel to mean SQL NULL. */
import { Prisma } from "@/generated/prisma";
import type { DbClient } from "@/lib/config/prisma";
import { fetchedProfileSchema } from "@/lib/types/profile-lookup";
import type { FetchedProfile } from "@/lib/types/profile-lookup";
import {
  contentPlanDraftAnswersSchema,
  contentPlanInsightsSchema,
  contentPlanResultSchema,
  contentPlanStatusSchema,
  type ContentPlanDraftAnswers,
  type ContentPlanInsights,
  type ContentPlanResult,
  type StoredContentPlan,
} from "@/lib/types/content-plan";

/**
 * SOURCE OF TRUTH KEYWORDS: CONTENT_PLAN_SELECT
 *
 * WHAT:  The columns every read of this table returns.
 * WHY:   Named rather than inlined so the read path and the row type cannot
 *        drift — `Prisma.ContentPlanGetPayload<{ select: typeof … }>` below
 *        derives from this exact object, so adding a column here types itself
 *        through automatically. `authorId` is deliberately absent: the caller
 *        already knows whose plan it asked for, and returning it would put a
 *        user id in a client payload for no reason.
 */
const CONTENT_PLAN_SELECT = {
  id: true,
  status: true,
  profileUrl: true,
  profile: true,
  insights: true,
  answers: true,
  result: true,
  createdAt: true,
  updatedAt: true,
} as const satisfies Prisma.ContentPlanSelect;

type ContentPlanRow = Prisma.ContentPlanGetPayload<{
  select: typeof CONTENT_PLAN_SELECT;
}>;

/**
 * SOURCE OF TRUTH KEYWORDS: toStoredContentPlan
 *
 * WHAT:  Turns a raw row into the typed shape the router returns.
 * WHY:   Four Json columns arrive from Prisma as untyped values, and each is
 *        parsed through its own schema here — once, in one place, rather than at
 *        each of the six procedures that return a plan.
 *
 *        Every parse is a `safeParse` that falls back rather than throwing. A row
 *        holding a payload written under an older shape must still open: the
 *        session is the user's work in progress, and failing the read would lose
 *        it outright to protect against a field that has merely moved. `answers`
 *        falls back to empty, which the chat reads as "start from the top" — the
 *        honest outcome, and recoverable, unlike an error page.
 */
function toStoredContentPlan(row: ContentPlanRow): StoredContentPlan {
  const answers = contentPlanDraftAnswersSchema.safeParse(row.answers);
  const profile = fetchedProfileSchema.safeParse(row.profile);
  const insights = contentPlanInsightsSchema.safeParse(row.insights);
  const result = contentPlanResultSchema.safeParse(row.result);
  const status = contentPlanStatusSchema.safeParse(row.status);

  return {
    id: row.id,
    /* An unrecognised status means a row this build does not understand;
     * treating it as still collecting is the one reading that cannot show the
     * user a strategy that isn't there. */
    status: status.success ? status.data : "collecting",
    profileUrl: row.profileUrl,
    profile: profile.success ? profile.data : null,
    insights: insights.success ? insights.data : null,
    answers: answers.success ? answers.data : {},
    result: result.success ? result.data : null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * SOURCE OF TRUTH KEYWORDS: readContentPlan
 *
 * WHAT:  The session this member has open in this organization, or null.
 * WHY:   `findUnique` on the composite key rather than "the most recent
 *        unfinished row" — there is exactly one session per member per org by
 *        construction, so resuming is a lookup rather than a guess that could
 *        pick the wrong row after a Start New.
 * WHERE: contentPlan.get, and every mutation that needs the current profile.
 */
export async function readContentPlan(
  db: DbClient,
  organizationId: string,
  authorId: string,
): Promise<StoredContentPlan | null> {
  const row = await db.contentPlan.findUnique({
    where: { organizationId_authorId: { organizationId, authorId } },
    select: CONTENT_PLAN_SELECT,
  });
  return row ? toStoredContentPlan(row) : null;
}

export interface StartContentPlanArgs {
  organizationId: string;
  authorId: string;
  profileUrl: string;
  profile: FetchedProfile;
  insights: ContentPlanInsights;
}

/**
 * SOURCE OF TRUTH KEYWORDS: startContentPlan
 *
 * WHAT:  Opens a session against a profile, replacing whatever came before.
 * WHY:   An upsert that RESETS on update, not a merge. Pasting a URL is the
 *        user starting over — keeping the previous answers would carry a
 *        strategy built for one person's profile onto another's, which is the
 *        one way this feature can produce confidently wrong output. `result` is
 *        cleared for the same reason: a strategy about the old profile must not
 *        survive under a new one.
 * WHERE: contentPlan.brief, after the profile is read and the brief generated.
 */
export async function startContentPlan(
  db: DbClient,
  args: StartContentPlanArgs,
): Promise<StoredContentPlan> {
  const seed = {
    status: "collecting",
    profileUrl: args.profileUrl,
    profile: args.profile,
    insights: args.insights,
    /* The URL is itself the first answer, so the questionnaire resumes at the
     * next step rather than re-asking for a profile already loaded. */
    answers: { profileUrl: args.profileUrl },
    /* DbNull, not null — SQL NULL, so a restarted session reads as "no strategy
     * yet" rather than as a stored JSON null that every safeParse would then
     * have to special-case. */
    result: Prisma.DbNull,
  };

  const row = await db.contentPlan.upsert({
    where: {
      organizationId_authorId: {
        organizationId: args.organizationId,
        authorId: args.authorId,
      },
    },
    create: {
      organizationId: args.organizationId,
      authorId: args.authorId,
      ...seed,
    },
    update: seed,
    select: CONTENT_PLAN_SELECT,
  });

  return toStoredContentPlan(row);
}

/**
 * SOURCE OF TRUTH KEYWORDS: saveContentPlanProgress
 *
 * WHAT:  Records the answers collected so far.
 * WHY:   Writes the whole draft rather than merging one key, so a save is
 *        idempotent and the Refine bar — which CHANGES an existing answer — uses
 *        the same call as answering a new question. A merge would make removing
 *        or clearing an answer impossible.
 *
 *        Updates only; a session must already exist. Progress before a profile
 *        has been loaded is not a thing this feature can act on, and creating a
 *        row here would produce a session with answers about nobody.
 * WHERE: contentPlan.saveProgress.
 */
export async function saveContentPlanProgress(
  db: DbClient,
  organizationId: string,
  authorId: string,
  answers: ContentPlanDraftAnswers,
): Promise<{ count: number }> {
  return db.contentPlan.updateMany({
    where: { organizationId, authorId },
    data: { answers },
  });
}

export interface RecordContentPlanArgs {
  organizationId: string;
  authorId: string;
  answers: ContentPlanDraftAnswers;
  result: ContentPlanResult;
}

/**
 * SOURCE OF TRUTH KEYWORDS: recordContentPlan
 *
 * WHAT:  Stores a generated strategy and marks the session ready.
 * WHY:   The answers are written alongside the result, not just the result: the
 *        strategy must stay paired with the inputs it was generated from, or a
 *        later Refine would show a plan next to answers that no longer produced
 *        it.
 *
 *        Persisted at all because the model call is METERED and irreversible —
 *        the counter increments the moment the model answers, so without this
 *        write a refresh would destroy something the org has already paid for.
 * WHERE: contentPlan.create, inside the procedure's transaction.
 */
export async function recordContentPlan(
  db: DbClient,
  args: RecordContentPlanArgs,
): Promise<StoredContentPlan> {
  const row = await db.contentPlan.update({
    where: {
      organizationId_authorId: {
        organizationId: args.organizationId,
        authorId: args.authorId,
      },
    },
    data: {
      status: "ready",
      answers: args.answers,
      result: args.result,
    },
    select: CONTENT_PLAN_SELECT,
  });

  return toStoredContentPlan(row);
}

/**
 * SOURCE OF TRUTH KEYWORDS: markContentPlanSaved
 *
 * WHAT:  Records that the user chose to keep this strategy.
 * WHY:   Scoped to rows that are already "ready" so Save cannot promote a session
 *        that has no strategy in it — the button is only rendered next to a
 *        result, and the query enforces what the UI already assumes.
 * WHERE: contentPlan.save.
 */
export async function markContentPlanSaved(
  db: DbClient,
  organizationId: string,
  authorId: string,
): Promise<{ count: number }> {
  return db.contentPlan.updateMany({
    where: { organizationId, authorId, status: "ready" },
    data: { status: "saved" },
  });
}

/**
 * SOURCE OF TRUTH KEYWORDS: discardContentPlan
 *
 * WHAT:  Forgets this member's session entirely.
 * WHY:   `deleteMany` rather than `delete` so a Start New on an already-empty
 *        session is a no-op returning 0 instead of a thrown RecordNotFound — the
 *        button is reachable in states where no row exists, and that is not an
 *        error.
 *
 *        Note the procedure that calls this is named `discard`, NOT `delete`.
 *        See the router for why that naming is load-bearing.
 * WHERE: contentPlan.discard.
 */
export async function discardContentPlan(
  db: DbClient,
  organizationId: string,
  authorId: string,
): Promise<{ count: number }> {
  return db.contentPlan.deleteMany({ where: { organizationId, authorId } });
}

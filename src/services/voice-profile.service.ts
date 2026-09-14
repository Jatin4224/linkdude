/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "server-only";

/**
 * SOURCE OF TRUTH KEYWORDS: readVoiceProfile, readResolvedVoice,
 *   recordVoiceExtraction, writeVoiceOverrides, setVoiceActive,
 *   revertVoiceProfile, discardVoiceProfile, VOICE_PROFILE_SELECT,
 *   toStoredVoiceProfile, resolveVoice, RecordVoiceExtractionArgs
 *
 * WHAT:  The database half of the voice profile: read a member's voice, record a
 *        new extraction, edit its overrides, switch it on or off, undo the last
 *        extraction, or throw it away. Also the one place a voice is RESOLVED into
 *        what the generators read.
 * WHY:   `server-only` per the service rule. Shaped exactly like
 *        content-plan.service.ts, because VoiceProfile has the same
 *        (organizationId, authorId) key: `db` comes first so every write enlists
 *        in the caller's transaction, and every Json column is parsed back through
 *        its schema here so nothing untyped reaches a router.
 * WHERE: src/trpc/routers/voice-profile.ts with `import *`; readResolvedVoice is
 *        also called by the aiGeneration, carousel and contentPlan routers.
 */

/* Imported as a VALUE, not just a type: clearing a nullable Json column needs
 * `Prisma.DbNull`, because Prisma reserves JS null for the JSON value `null`. */
import { Prisma } from "@/generated/prisma";
import type { DbClient } from "@/lib/config/prisma";
import { VOICE_EXTRACTOR_VERSION } from "@/lib/config/voice-profile";
import {
  DEFAULT_VOICE_OVERRIDES,
  VOICE_OVERRIDE_INHERIT,
  voiceExtractionSchema,
  voiceOverridesSchema,
  type ResolvedVoice,
  type StoredVoiceProfile,
  type VoiceExtraction,
  type VoiceOverrides,
} from "@/lib/types/voice-profile";

/**
 * SOURCE OF TRUTH KEYWORDS: VOICE_PROFILE_SELECT
 *
 * WHAT:  The columns every read of this table returns.
 * WHY:   Named so the row type derives from it and cannot drift. `authorId` is
 *        absent for the reason CONTENT_PLAN_SELECT gives: the caller already knows
 *        whose voice it asked for.
 */
const VOICE_PROFILE_SELECT = {
  id: true,
  current: true,
  previous: true,
  overrides: true,
  version: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const satisfies Prisma.VoiceProfileSelect;

type VoiceProfileRow = Prisma.VoiceProfileGetPayload<{
  select: typeof VOICE_PROFILE_SELECT;
}>;

/* The compound unique key every single-row operation addresses. */
function memberVoiceKey(
  organizationId: string,
  authorId: string,
): Prisma.VoiceProfileWhereUniqueInput {
  return { organizationId_authorId: { organizationId, authorId } };
}

/**
 * SOURCE OF TRUTH KEYWORDS: toStoredVoiceProfile
 *
 * WHAT:  Turns a raw row into the typed shape the router returns.
 * WHY:   Every parse is a `safeParse` with a fallback, never a throw. A voice
 *        written under an older shape must still open: the page shows it as
 *        needing a re-extraction, which is recoverable, instead of an error page
 *        over a paid result. The previous extraction is reduced to `canRevert`,
 *        and only counts if it still parses, because reverting to a voice this
 *        build cannot read would leave the member with no voice at all.
 */
function toStoredVoiceProfile(row: VoiceProfileRow): StoredVoiceProfile {
  const current = voiceExtractionSchema.safeParse(row.current);
  const overrides = voiceOverridesSchema.safeParse(row.overrides);
  const extraction = current.success ? current.data : null;

  return {
    id: row.id,
    current: extraction,
    sampleCount: extraction?.samples.length ?? 0,
    canRevert: voiceExtractionSchema.safeParse(row.previous).success,
    isOutdated:
      extraction !== null &&
      extraction.extractorVersion < VOICE_EXTRACTOR_VERSION,
    overrides: overrides.success ? overrides.data : DEFAULT_VOICE_OVERRIDES,
    version: row.version,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * SOURCE OF TRUTH KEYWORDS: resolveVoice
 *
 * WHAT:  Applies a member's overrides to an extracted descriptor.
 * WHY:   The ONLY place overrides are merged, so the three generators can never
 *        condition on different readings of the same voice. "inherit" keeps what
 *        the model concluded; anything else is the member's decision and wins.
 */
function resolveVoice(
  extraction: VoiceExtraction,
  overrides: VoiceOverrides,
  version: number,
): ResolvedVoice {
  const { descriptor } = extraction;

  return {
    version,
    descriptor: {
      ...descriptor,
      vocabulary: {
        ...descriptor.vocabulary,
        register:
          overrides.register === VOICE_OVERRIDE_INHERIT
            ? descriptor.vocabulary.register
            : overrides.register,
      },
      formatting: {
        ...descriptor.formatting,
        emojiUse:
          overrides.emojiUse === VOICE_OVERRIDE_INHERIT
            ? descriptor.formatting.emojiUse
            : overrides.emojiUse,
      },
    },
    bannedPhrases: overrides.bannedPhrases.map((entry) => entry.phrase),
    guidance: overrides.guidance,
  };
}

/**
 * SOURCE OF TRUTH KEYWORDS: readVoiceProfile
 *
 * WHAT:  This member's voice profile in this organization, or null.
 * WHERE: voiceProfile.get, and readResolvedVoice below.
 */
export async function readVoiceProfile(
  db: DbClient,
  organizationId: string,
  authorId: string,
): Promise<StoredVoiceProfile | null> {
  const row = await db.voiceProfile.findUnique({
    where: memberVoiceKey(organizationId, authorId),
    select: VOICE_PROFILE_SELECT,
  });
  return row ? toStoredVoiceProfile(row) : null;
}

/**
 * SOURCE OF TRUTH KEYWORDS: readResolvedVoice
 *
 * WHAT:  The voice a generator should write in for this member, or null.
 * WHY:   Null in every case where drafting in a voice would be wrong: no profile,
 *        switched off, or a stored extraction this build cannot read. Returning
 *        null rather than throwing means a broken voice degrades a draft to the
 *        default house style instead of failing a generation the member is paying
 *        for.
 * WHERE: aiGeneration.create, carousel.create and contentPlan.create, inside the
 *        procedure transaction.
 */
export async function readResolvedVoice(
  db: DbClient,
  organizationId: string,
  authorId: string,
): Promise<ResolvedVoice | null> {
  const stored = await readVoiceProfile(db, organizationId, authorId);
  if (!stored || !stored.isActive || !stored.current) return null;
  return resolveVoice(stored.current, stored.overrides, stored.version);
}

export interface RecordVoiceExtractionArgs {
  organizationId: string;
  authorId: string;
  extraction: VoiceExtraction;
}

/**
 * SOURCE OF TRUTH KEYWORDS: recordVoiceExtraction
 *
 * WHAT:  Stores a new extraction, keeping the one it replaces for undo.
 * WHY:   Persisted at all because the model call is METERED: the counter
 *        increments in the same transaction, so without this write a refresh
 *        would destroy something the org already paid for.
 *
 *        Read-then-write rather than an upsert, because the displaced extraction
 *        has to move into `previous`, and an upsert cannot reference the value it
 *        overwrites. Only a displaced extraction that still parses is kept, so
 *        undo never offers a voice this build cannot read.
 *
 *        Overrides are left alone on re-extraction: they are the member's
 *        decisions, not the model's. `isActive` is switched back on, because
 *        extracting a voice is an unambiguous request to use one.
 * WHERE: voiceProfile.create, inside the procedure transaction.
 */
export async function recordVoiceExtraction(
  db: DbClient,
  args: RecordVoiceExtractionArgs,
): Promise<StoredVoiceProfile> {
  const where = memberVoiceKey(args.organizationId, args.authorId);
  const existing = await db.voiceProfile.findUnique({
    where,
    select: { current: true },
  });

  if (!existing) {
    const created = await db.voiceProfile.create({
      data: {
        organizationId: args.organizationId,
        authorId: args.authorId,
        current: args.extraction,
        overrides: DEFAULT_VOICE_OVERRIDES,
      },
      select: VOICE_PROFILE_SELECT,
    });
    return toStoredVoiceProfile(created);
  }

  const displaced = voiceExtractionSchema.safeParse(existing.current);
  const updated = await db.voiceProfile.update({
    where,
    data: {
      current: args.extraction,
      previous: displaced.success ? displaced.data : Prisma.DbNull,
      version: { increment: 1 },
      isActive: true,
    },
    select: VOICE_PROFILE_SELECT,
  });
  return toStoredVoiceProfile(updated);
}

/**
 * SOURCE OF TRUTH KEYWORDS: writeVoiceOverrides
 *
 * WHAT:  Replaces the member's overrides wholesale.
 * WHY:   Whole-object writes rather than a merge, so removing a banned phrase or
 *        clearing guidance is expressible, the saveContentPlanProgress rule.
 *        `updateMany` so a missing profile returns 0 instead of throwing.
 * WHERE: voiceProfile.update with field "overrides".
 */
export async function writeVoiceOverrides(
  db: DbClient,
  organizationId: string,
  authorId: string,
  overrides: VoiceOverrides,
): Promise<{ count: number }> {
  return db.voiceProfile.updateMany({
    where: { organizationId, authorId },
    data: { overrides },
  });
}

/**
 * SOURCE OF TRUTH KEYWORDS: setVoiceActive
 *
 * WHAT:  Switches whether generators write in this voice.
 * WHERE: voiceProfile.update with field "active".
 */
export async function setVoiceActive(
  db: DbClient,
  organizationId: string,
  authorId: string,
  isActive: boolean,
): Promise<{ count: number }> {
  return db.voiceProfile.updateMany({
    where: { organizationId, authorId },
    data: { isActive },
  });
}

/**
 * SOURCE OF TRUTH KEYWORDS: revertVoiceProfile
 *
 * WHAT:  Swaps the current extraction with the previous one. Null when there is
 *        nothing readable to go back to.
 * WHY:   A swap rather than a pop, so reverting a revert restores the newer voice
 *        instead of losing it. `version` is bumped because what the generators
 *        read has changed.
 * WHERE: voiceProfile.revert.
 */
export async function revertVoiceProfile(
  db: DbClient,
  organizationId: string,
  authorId: string,
): Promise<StoredVoiceProfile | null> {
  const where = memberVoiceKey(organizationId, authorId);
  const row = await db.voiceProfile.findUnique({
    where,
    select: { current: true, previous: true },
  });
  if (!row) return null;

  const previous = voiceExtractionSchema.safeParse(row.previous);
  if (!previous.success) return null;

  const current = voiceExtractionSchema.safeParse(row.current);
  const updated = await db.voiceProfile.update({
    where,
    data: {
      current: previous.data,
      previous: current.success ? current.data : Prisma.DbNull,
      version: { increment: 1 },
    },
    select: VOICE_PROFILE_SELECT,
  });
  return toStoredVoiceProfile(updated);
}

/**
 * SOURCE OF TRUTH KEYWORDS: discardVoiceProfile
 *
 * WHAT:  Forgets this member's voice entirely.
 * WHY:   `deleteMany` so discarding when nothing exists is a no-op returning 0.
 *        The procedure calling this is `discard`, NOT `delete`: the voice counter
 *        measures model spend, and a refunding verb would make extraction free.
 * WHERE: voiceProfile.discard.
 */
export async function discardVoiceProfile(
  db: DbClient,
  organizationId: string,
  authorId: string,
): Promise<{ count: number }> {
  return db.voiceProfile.deleteMany({ where: { organizationId, authorId } });
}

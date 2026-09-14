/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: VoiceProfile, voice, writing style, tone,
 *   voiceSampleSchema, voiceSamplesSchema, VoiceSample, voiceDescriptorSchema,
 *   VoiceDescriptor, voiceExtractionSchema, VoiceExtraction,
 *   voiceOverridesSchema, VoiceOverrides, DEFAULT_VOICE_OVERRIDES,
 *   extractVoiceProfileSchema, updateVoiceProfileSchema, ResolvedVoice,
 *   StoredVoiceProfile, VOICE_REGISTERS, VOICE_EMOJI_USE, VOICE_OVERRIDE_INHERIT
 *
 * WHAT:  Input and output contracts for a member's writing voice: the posts it
 *        is learned from, the descriptor the model extracts, the edits the member
 *        layers on top, and the merged voice every generator reads.
 * WHY:   Tone used to be the only style control, re-picked on every generation
 *        and stored nowhere, so every draft sounded like the model rather than
 *        the member. These schemas make the voice persistent and typed.
 *
 *        voiceDescriptorSchema doubles as the `generateObject` contract and the
 *        storage boundary, the same arrangement as contentPlanResultSchema: its
 *        arrays are lenient for storage and re-required on the copy sent to the
 *        model. Overrides are a NAMED SUBSET rather than `.partial()` of the
 *        descriptor, so the form can only write fields a member can meaningfully
 *        control.
 * WHERE: Router inputs for voiceProfile; consumed by ai.service.ts,
 *        voice-profile.service.ts, the three generating routers, and the voice
 *        route components.
 */

import { z } from "zod";

/**
 * SOURCE OF TRUTH KEYWORDS: VOICE_SAMPLE_MIN_CHARS, VOICE_SAMPLE_MAX_CHARS,
 *   VOICE_SAMPLES_MIN, VOICE_SAMPLES_MAX, VOICE_TOTAL_CHARS_MIN
 *
 * WHAT:  How much writing an extraction needs, and the most it will read.
 * WHY:   Too little text and the model invents a voice from three sentences;
 *        too much and the prompt is spend, not signal. Named so the form's
 *        counters and the schema can never disagree.
 * WHERE: voiceSampleSchema, voiceSamplesSchema, the samples form.
 */
export const VOICE_SAMPLE_MIN_CHARS = 200;
export const VOICE_SAMPLE_MAX_CHARS = 3000;
export const VOICE_SAMPLES_MIN = 3;
export const VOICE_SAMPLES_MAX = 20;
export const VOICE_TOTAL_CHARS_MIN = 1200;

/**
 * SOURCE OF TRUTH KEYWORDS: VOICE_SUMMARY_MAX, VOICE_PHRASE_MAX,
 *   VOICE_SIGNATURE_PHRASES_MAX, VOICE_AVOIDED_WORDS_MAX, VOICE_PATTERNS_MAX,
 *   VOICE_BANNED_PHRASES_MAX, VOICE_GUIDANCE_MAX
 *
 * WHAT:  Ceilings on the extracted descriptor and on the member's edits.
 * WHY:   Every one of these strings is interpolated into later generation
 *        prompts, so an unbounded list is a permanent tax on every draft.
 */
export const VOICE_SUMMARY_MAX = 600;
export const VOICE_PHRASE_MAX = 80;
export const VOICE_SIGNATURE_PHRASES_MAX = 12;
export const VOICE_AVOIDED_WORDS_MAX = 20;
export const VOICE_PATTERNS_MAX = 6;
export const VOICE_BANNED_PHRASES_MAX = 30;
export const VOICE_GUIDANCE_MAX = 500;

/**
 * SOURCE OF TRUTH KEYWORDS: VOICE_SAMPLE_SOURCES, VoiceSampleSource,
 *   voiceSampleSourceSchema
 *
 * WHAT:  Where a sample came from: pasted by the member, or one of their posts
 *        published through the app.
 * WHY:   Posts published here were drafted by the model, so they are a weaker
 *        signal of the member's own voice. Recording the source keeps that
 *        visible rather than lost once the text is in the list.
 */
export const VOICE_SAMPLE_SOURCES = ["pasted", "linkedinPost"] as const;
export const voiceSampleSourceSchema = z.enum(VOICE_SAMPLE_SOURCES);
export type VoiceSampleSource = z.infer<typeof voiceSampleSourceSchema>;

/**
 * SOURCE OF TRUTH KEYWORDS: voiceSampleSchema, VoiceSample
 *
 * WHAT:  One post the voice is learned from.
 * WHERE: voiceSamplesSchema; the samples form's field array.
 */
export const voiceSampleSchema = z.object({
  text: z
    .string()
    .trim()
    .min(
      VOICE_SAMPLE_MIN_CHARS,
      `Each post needs at least ${VOICE_SAMPLE_MIN_CHARS} characters`,
    )
    .max(
      VOICE_SAMPLE_MAX_CHARS,
      `Keep each post under ${VOICE_SAMPLE_MAX_CHARS} characters`,
    ),
  source: voiceSampleSourceSchema,
});
export type VoiceSample = z.infer<typeof voiceSampleSchema>;

/**
 * SOURCE OF TRUTH KEYWORDS: voiceSamplesSchema
 *
 * WHAT:  A complete set of samples, valid to extract from.
 * WHY:   The total-length check is what stops three 200-character posts from
 *        passing: each is individually fine, but together they are not enough
 *        writing to describe a voice honestly.
 * WHERE: extractVoiceProfileSchema.
 */
export const voiceSamplesSchema = z
  .array(voiceSampleSchema)
  .min(VOICE_SAMPLES_MIN, `Add at least ${VOICE_SAMPLES_MIN} posts`)
  .max(VOICE_SAMPLES_MAX, `Use at most ${VOICE_SAMPLES_MAX} posts`)
  .refine(
    (samples) =>
      samples.reduce((total, sample) => total + sample.text.length, 0) >=
      VOICE_TOTAL_CHARS_MIN,
    `Add more writing: at least ${VOICE_TOTAL_CHARS_MIN} characters across all posts`,
  );

/**
 * SOURCE OF TRUTH KEYWORDS: VOICE_REGISTERS, VoiceRegister,
 *   VOICE_RHYTHM_VARIANCE, VoiceRhythmVariance, VOICE_JARGON_TOLERANCE,
 *   VoiceJargonTolerance, VOICE_EMOJI_USE, VoiceEmojiUse, VOICE_LIST_STYLES,
 *   VoiceListStyle
 *
 * WHAT:  The closed vocabularies a descriptor is expressed in.
 * WHY:   Closed sets rather than free text, so the model is forced to commit to
 *        a reading and the UI can label each value from one registry.
 * WHERE: voiceDescriptorSchema, voiceOverridesSchema, the label maps in
 *        src/lib/config/voice-profile.ts.
 */
export const VOICE_REGISTERS = [
  "casual",
  "conversational",
  "professional",
  "formal",
] as const;
export const voiceRegisterSchema = z.enum(VOICE_REGISTERS);
export type VoiceRegister = z.infer<typeof voiceRegisterSchema>;

export const VOICE_RHYTHM_VARIANCE = ["uniform", "mixed", "staccato"] as const;
export const voiceRhythmVarianceSchema = z.enum(VOICE_RHYTHM_VARIANCE);
export type VoiceRhythmVariance = z.infer<typeof voiceRhythmVarianceSchema>;

export const VOICE_JARGON_TOLERANCE = ["plain", "moderate", "technical"] as const;
export const voiceJargonToleranceSchema = z.enum(VOICE_JARGON_TOLERANCE);
export type VoiceJargonTolerance = z.infer<typeof voiceJargonToleranceSchema>;

export const VOICE_EMOJI_USE = ["none", "rare", "frequent"] as const;
export const voiceEmojiUseSchema = z.enum(VOICE_EMOJI_USE);
export type VoiceEmojiUse = z.infer<typeof voiceEmojiUseSchema>;

export const VOICE_LIST_STYLES = ["none", "numbered", "symbols"] as const;
export const voiceListStyleSchema = z.enum(VOICE_LIST_STYLES);
export type VoiceListStyle = z.infer<typeof voiceListStyleSchema>;

/**
 * SOURCE OF TRUTH KEYWORDS: voicePatternSchema, VoicePattern
 *
 * WHAT:  A recurring way the member opens or closes a post, with a real example.
 * WHY:   The example is what makes a pattern usable: "opens with a confession"
 *        is vague, the member's own first line is not.
 */
export const voicePatternSchema = z.object({
  pattern: z.string().min(1).max(160),
  example: z.string().min(1).max(280),
});
export type VoicePattern = z.infer<typeof voicePatternSchema>;

/**
 * SOURCE OF TRUTH KEYWORDS: voiceDescriptorSchema, VoiceDescriptor
 *
 * WHAT:  What the model concludes about how the member writes.
 * WHY:   Nested objects of primitives, enums and short bounded arrays only, so
 *        every provider can produce it as native structured output. Arrays are
 *        `.default([])` so a stored voice keeps parsing when a field is added;
 *        ai.service re-requires them on the copy it sends to the model.
 *
 *        `confidence` exists so the UI can tell a member that three short posts
 *        produced a thin reading, instead of presenting a guess as a finding.
 * WHERE: Returned by aiService.extractVoiceProfile; stored inside
 *        VoiceProfile.current; read by buildVoiceDirective.
 */
export const voiceDescriptorSchema = z.object({
  summary: z.string().min(1).max(VOICE_SUMMARY_MAX),
  confidence: z.number().min(0).max(1),
  sentenceRhythm: z.object({
    averageSentenceWords: z.number().int().min(1).max(80),
    variance: voiceRhythmVarianceSchema,
    usesFragments: z.boolean(),
    usesOneLineParagraphs: z.boolean(),
  }),
  vocabulary: z.object({
    register: voiceRegisterSchema,
    jargonTolerance: voiceJargonToleranceSchema,
    signaturePhrases: z
      .array(z.string().min(1).max(VOICE_PHRASE_MAX))
      .max(VOICE_SIGNATURE_PHRASES_MAX)
      .default([]),
    avoidedWords: z
      .array(z.string().min(1).max(VOICE_PHRASE_MAX))
      .max(VOICE_AVOIDED_WORDS_MAX)
      .default([]),
  }),
  openingPatterns: z
    .array(voicePatternSchema)
    .max(VOICE_PATTERNS_MAX)
    .default([]),
  closingPatterns: z
    .array(voicePatternSchema)
    .max(VOICE_PATTERNS_MAX)
    .default([]),
  formatting: z.object({
    paragraphMaxLines: z.number().int().min(1).max(12),
    usesLineBreaksForEmphasis: z.boolean(),
    listStyle: voiceListStyleSchema,
    emojiUse: voiceEmojiUseSchema,
    hashtagCount: z.number().int().min(0).max(5),
    usesQuestions: z.boolean(),
  }),
});
export type VoiceDescriptor = z.infer<typeof voiceDescriptorSchema>;

/**
 * SOURCE OF TRUTH KEYWORDS: voiceExtractionSchema, VoiceExtraction
 *
 * WHAT:  One extraction as stored: the posts the model read, what it concluded,
 *        which extractor produced it, and when.
 * WHY:   Samples and descriptor travel TOGETHER so reverting to the previous
 *        voice also restores the posts it came from. Stored separately, a revert
 *        would show a descriptor next to posts that never produced it.
 *
 *        `extractorVersion` is the PROFILE_MAPPER_VERSION stamp pattern: a voice
 *        read by an older extractor still parses perfectly, so only a version
 *        number can say it is worth re-extracting.
 * WHERE: VoiceProfile.current and VoiceProfile.previous.
 */
export const voiceExtractionSchema = z.object({
  samples: z.array(voiceSampleSchema).max(VOICE_SAMPLES_MAX),
  descriptor: voiceDescriptorSchema,
  extractorVersion: z.number().int().min(1),
  extractedAt: z.iso.datetime(),
});
export type VoiceExtraction = z.infer<typeof voiceExtractionSchema>;

/**
 * SOURCE OF TRUTH KEYWORDS: VOICE_OVERRIDE_INHERIT, VOICE_REGISTER_OVERRIDES,
 *   VOICE_EMOJI_USE_OVERRIDES
 *
 * WHAT:  Override choices, including "inherit" (keep what was extracted).
 * WHY:   A stored sentinel rather than an optional field: a select needs a real
 *        value for "no change", and `undefined` cannot round-trip through a form
 *        or a Json column without becoming ambiguous.
 */
export const VOICE_OVERRIDE_INHERIT = "inherit";
export const VOICE_REGISTER_OVERRIDES = [
  VOICE_OVERRIDE_INHERIT,
  ...VOICE_REGISTERS,
] as const;
export const VOICE_EMOJI_USE_OVERRIDES = [
  VOICE_OVERRIDE_INHERIT,
  ...VOICE_EMOJI_USE,
] as const;

/**
 * SOURCE OF TRUTH KEYWORDS: voicePhraseEntrySchema, VoicePhraseEntry
 *
 * WHAT:  One phrase the member never wants in a draft.
 * WHY:   An object rather than a bare string because react-hook-form's field
 *        arrays only track arrays of objects.
 */
export const voicePhraseEntrySchema = z.object({
  phrase: z
    .string()
    .trim()
    .min(1, "Enter a phrase")
    .max(VOICE_PHRASE_MAX, `Keep phrases under ${VOICE_PHRASE_MAX} characters`),
});
export type VoicePhraseEntry = z.infer<typeof voicePhraseEntrySchema>;

/**
 * SOURCE OF TRUTH KEYWORDS: voiceOverridesSchema, VoiceOverrides,
 *   DEFAULT_VOICE_OVERRIDES
 *
 * WHAT:  The corrections a member layers over the extracted voice.
 * WHY:   Kept apart from the descriptor so a re-extraction replaces what the
 *        model concluded without wiping what the member decided.
 * WHERE: VoiceProfile.overrides; voiceProfile.update; the overrides form.
 */
export const voiceOverridesSchema = z.object({
  register: z.enum(VOICE_REGISTER_OVERRIDES),
  emojiUse: z.enum(VOICE_EMOJI_USE_OVERRIDES),
  bannedPhrases: z
    .array(voicePhraseEntrySchema)
    .max(
      VOICE_BANNED_PHRASES_MAX,
      `Use at most ${VOICE_BANNED_PHRASES_MAX} phrases`,
    ),
  guidance: z
    .string()
    .trim()
    .max(
      VOICE_GUIDANCE_MAX,
      `Keep guidance under ${VOICE_GUIDANCE_MAX} characters`,
    ),
});
export type VoiceOverrides = z.infer<typeof voiceOverridesSchema>;

export const DEFAULT_VOICE_OVERRIDES: VoiceOverrides = {
  register: VOICE_OVERRIDE_INHERIT,
  emojiUse: VOICE_OVERRIDE_INHERIT,
  bannedPhrases: [],
  guidance: "",
};

/**
 * SOURCE OF TRUTH KEYWORDS: extractVoiceProfileSchema, ExtractVoiceProfileValues
 *
 * WHAT:  Input for the metered extraction: the posts to learn from.
 * WHY:   The samples come from the input, not a stored draft, so the voice is
 *        learned from exactly what the member is looking at when they press
 *        Extract. They are the member's own words, not paid data, so there is
 *        nothing to verify server-side the way contentPlan re-reads a profile.
 * WHERE: Router input for voiceProfile.create; resolver for the samples form.
 */
export const extractVoiceProfileSchema = z.object({
  samples: voiceSamplesSchema,
});
export type ExtractVoiceProfileValues = z.infer<
  typeof extractVoiceProfileSchema
>;

/**
 * SOURCE OF TRUTH KEYWORDS: updateVoiceProfileSchema, UpdateVoiceProfileValues,
 *   VOICE_PROFILE_UPDATE_FIELDS
 *
 * WHAT:  The free edits to a voice: its overrides, or whether it is switched on.
 * WHY:   One discriminated union because the `<resource>.<verb>` path is the
 *        permission, quota and audit key, so two edits that both buy nothing
 *        must share the `update` verb. `field` is interpolated into the audit
 *        line, so the log still says which edit happened.
 * WHERE: Router input for voiceProfile.update.
 */
export const updateVoiceProfileSchema = z.discriminatedUnion("field", [
  z.object({
    field: z.literal("overrides"),
    overrides: voiceOverridesSchema,
  }),
  z.object({
    field: z.literal("active"),
    isActive: z.boolean(),
  }),
]);
export type UpdateVoiceProfileValues = z.infer<typeof updateVoiceProfileSchema>;

/**
 * SOURCE OF TRUTH KEYWORDS: ResolvedVoice
 *
 * WHAT:  The single merged voice a generator conditions on: the descriptor with
 *        overrides applied, plus the member's banned phrases and guidance.
 * WHY:   Generators receive this, never the raw row, so the merge rule lives in
 *        exactly one function and two generators can never read different voices.
 * WHERE: Built by voiceProfileService.readResolvedVoice; consumed by
 *        aiService.buildVoiceDirective.
 */
export interface ResolvedVoice {
  version: number;
  descriptor: VoiceDescriptor;
  bannedPhrases: readonly string[];
  guidance: string;
}

/**
 * SOURCE OF TRUTH KEYWORDS: StoredVoiceProfile
 *
 * WHAT:  A member's voice profile as it leaves the server.
 * WHY:   The previous extraction is reduced to `canRevert`: the page only needs
 *        to know whether undo is possible, not the old descriptor itself.
 *        `current` is null when the stored shape no longer parses, which the page
 *        shows as "re-extract" rather than an error.
 * WHERE: Returned by voiceProfile.get, create and revert; rendered by the voice
 *        workspace and read by the composer's voice line.
 */
export interface StoredVoiceProfile {
  id: string;
  current: VoiceExtraction | null;
  sampleCount: number;
  canRevert: boolean;
  /** True when a newer extractor exists than the one that read this voice. */
  isOutdated: boolean;
  overrides: VoiceOverrides;
  version: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

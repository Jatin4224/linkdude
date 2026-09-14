/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: VOICE_EXTRACTOR_VERSION, VOICE_EXTRACTION_MAX_TOKENS,
 *   VOICE_EXTRACTION_TIMEOUT_MS, VOICE_SUGGESTED_SAMPLES_LIMIT,
 *   VOICE_LOW_CONFIDENCE_THRESHOLD,
 *   VOICE_REGISTER_LABELS, VOICE_RHYTHM_LABELS, VOICE_JARGON_LABELS,
 *   VOICE_EMOJI_USE_LABELS, VOICE_LIST_STYLE_LABELS, voice profile config
 *
 * WHAT:  Every literal the voice profile depends on: the extractor version stamp,
 *        the model budget for one extraction, how many published posts to offer
 *        as samples, and the human label for each vocabulary value.
 * WHY:   Stated once so the router, the prompt and the page cannot disagree. The
 *        token ceiling is voice-specific for the reason carousel.ts gives: the
 *        global AI_MAX_TOKENS truncates a nested structured object, which the SDK
 *        reports as a schema mismatch rather than a budget overrun.
 * WHERE: Consumed by src/services/ai.service.ts, voice-profile.service.ts, the
 *        voiceProfile router and the voice route components.
 */

import type {
  VoiceEmojiUse,
  VoiceJargonTolerance,
  VoiceListStyle,
  VoiceRegister,
  VoiceRhythmVariance,
} from "@/lib/types/voice-profile";

/**
 * SOURCE OF TRUTH KEYWORDS: VOICE_EXTRACTOR_VERSION
 *
 * WHAT:  Stamped onto every extraction. Bump it when the extraction prompt or
 *        descriptor schema changes what a voice captures.
 * WHY:   A voice read by an older extractor still parses perfectly, so schema
 *        validation cannot tell a member their voice is worth re-reading. This
 *        number can, and the page offers a re-extract when it is behind.
 *
 *        Version history:
 *          1 — rhythm, vocabulary, opening/closing patterns, formatting
 * WHERE: Written by voiceProfile.create; compared in toStoredVoiceProfile.
 */
export const VOICE_EXTRACTOR_VERSION = 1;

/* Twenty posts in, one nested object out. The output is small but reasoning
 * tokens on thinking providers draw on the same budget. */
export const VOICE_EXTRACTION_MAX_TOKENS = 8192;
/* Must stay under voiceProfile.create's txTimeout, which holds a Postgres
 * connection for the whole model call. */
export const VOICE_EXTRACTION_TIMEOUT_MS = 60_000;

/* How many recent published posts to consider when suggesting samples. Larger
 * than VOICE_SAMPLES_MAX because short posts are filtered out afterwards. */
export const VOICE_SUGGESTED_SAMPLES_LIMIT = 30;

/* Below this, the voice card tells the member the reading is thin and asks for
 * more posts, rather than presenting a guess as a finding. */
export const VOICE_LOW_CONFIDENCE_THRESHOLD = 0.5;

/**
 * SOURCE OF TRUTH KEYWORDS: VOICE_REGISTER_LABELS, VOICE_RHYTHM_LABELS,
 *   VOICE_JARGON_LABELS, VOICE_EMOJI_USE_LABELS, VOICE_LIST_STYLE_LABELS
 *
 * WHAT:  Human labels for each descriptor vocabulary value.
 * WHY:   `Record<…>` over the zod tuples, so adding a value in lib/types without a
 *        label here is a compile error instead of a raw enum string on screen.
 *        Shared by the descriptor card and the overrides form.
 */
export const VOICE_REGISTER_LABELS: Record<VoiceRegister, string> = {
  casual: "Casual",
  conversational: "Conversational",
  professional: "Professional",
  formal: "Formal",
};

export const VOICE_RHYTHM_LABELS: Record<VoiceRhythmVariance, string> = {
  uniform: "Even sentence lengths",
  mixed: "Mix of long and short sentences",
  staccato: "Short, punchy sentences",
};

export const VOICE_JARGON_LABELS: Record<VoiceJargonTolerance, string> = {
  plain: "Plain language",
  moderate: "Some field terms",
  technical: "Technical vocabulary",
};

export const VOICE_EMOJI_USE_LABELS: Record<VoiceEmojiUse, string> = {
  none: "No emoji",
  rare: "Occasional emoji",
  frequent: "Frequent emoji",
};

export const VOICE_LIST_STYLE_LABELS: Record<VoiceListStyle, string> = {
  none: "No lists",
  numbered: "Numbered lists",
  symbols: "Symbol-led lines",
};

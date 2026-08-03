/*
 * Copyright (c) 2026 Web Prodigies LLC
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: POST_TONES, PostTone, postToneSchema,
 *   POST_LENGTHS, PostLength, postLengthSchema, generatePostSchema,
 *   GeneratePostValues, GeneratedPost, generatedPostSchema, AI_PROVIDER_KEYS,
 *   AiProvider, aiProviderSchema, AiProviderDefinition, AiProviderOptions
 *
 * WHAT:  Input/output contracts for AI post generation — the tone and length
 *        vocabularies, the discriminated Topic-vs-Blog input union, and the
 *        shape the generator returns.
 * WHY:   The composer has two mutually exclusive modes (write about a topic, or
 *        repurpose a blog URL). Modelling that as a zod discriminated union
 *        makes the invalid states — a blog URL with no URL, a topic with no
 *        topic — unrepresentable at the type level instead of a runtime `if`.
 *        POST_TONES/POST_LENGTHS are exported as const tuples so the select
 *        inputs render straight from the schema and can never drift from it.
 * WHERE: Consumed by src/services/ai.service.ts, the aiGeneration router, and
 *        the composer form under
 *        src/app/(dashboard)/dashboard/post-generation/_components.
 */

import { z } from 'zod'
import type { generateText, LanguageModel, ToolSet } from 'ai'
import { LINKEDIN_MAX_COMMENTARY } from '@/lib/config/linkedin'

/**
 * SOURCE OF TRUTH KEYWORDS: AI_PROVIDER_KEYS, AiProvider, aiProviderSchema
 *
 * WHAT:  The model vendors the app can run on.
 * WHY:   Kept as a closed set so the active provider can be selected by the
 *        `AI_PROVIDER` env var and still be validated — a typo falls back to the
 *        default instead of reaching the network with a garbage provider name.
 *        Adding a vendor is a new key here plus one entry in AI_PROVIDERS.
 * WHERE: Drives the AI_PROVIDERS registry in src/lib/config/ai.ts.
 */
export const AI_PROVIDER_KEYS = ['google', 'anthropic'] as const
export const aiProviderSchema = z.enum(AI_PROVIDER_KEYS)
export type AiProvider = z.infer<typeof aiProviderSchema>

/**
 * SOURCE OF TRUTH KEYWORDS: AiProviderOptions
 *
 * WHAT:  The vendor-specific tuning block the AI SDK accepts per call.
 * WHY:   Derived from `generateText` rather than re-declared, because the AI SDK
 *        does not export the type by name and a hand-written copy would silently
 *        drift on the next SDK upgrade.
 */
export type AiProviderOptions = NonNullable<Parameters<typeof generateText>[0]['providerOptions']>

/**
 * SOURCE OF TRUTH KEYWORDS: AiProviderDefinition
 *
 * WHAT:  Everything the AI layer needs to talk to one vendor.
 * WHY:   Each provider differs in three ways only — which model, which tuning
 *        knobs, and how it fetches a URL. Capturing exactly those behind one
 *        shape means the service layer never branches on the vendor: it asks the
 *        registry and calls the SDK. `createModel` and `createWebFetchTools` are
 *        thunks so a missing API key surfaces at call time with an actionable
 *        message rather than crashing module import.
 * WHERE: Implemented by AI_PROVIDERS in src/lib/config/ai.ts; consumed by
 *        src/services/ai.service.ts.
 */
export interface AiProviderDefinition {
  /** Human-readable vendor name, used in operator-facing error copy. */
  readonly label: string
  /** Env var holding this vendor's key. The SDK reads it by this exact name. */
  readonly apiKeyEnvVar: string
  /** Pinned model id — one line to upgrade. */
  readonly modelId: string
  /** Where an operator goes to mint a key, surfaced in the "not configured" error. */
  readonly consoleUrl: string
  readonly createModel: () => LanguageModel
  readonly providerOptions: AiProviderOptions
  /** Vendor tool that lets the model read a URL already present in the prompt. */
  readonly createWebFetchTools: () => ToolSet
}

/**
 * SOURCE OF TRUTH KEYWORDS: POST_TONES, PostTone, postToneSchema
 *
 * WHAT:  The voices a post can be written in.
 * WHY:   Tone is the whole product in a personal-branding tool — kept as a
 *        closed set so the prompt can give the model a concrete instruction
 *        per value rather than passing free text straight through.
 */
export const POST_TONES = [
  'professional',
  'conversational',
  'storytelling',
  'contrarian',
  'educational',
] as const
export const postToneSchema = z.enum(POST_TONES)
export type PostTone = z.infer<typeof postToneSchema>

/**
 * SOURCE OF TRUTH KEYWORDS: POST_LENGTHS, PostLength, postLengthSchema
 *
 * WHAT:  Target post length buckets.
 * WHY:   Buckets rather than a raw word count: the model follows a described
 *        shape ("a short hook-driven post") far more reliably than a numeric
 *        target, and it keeps the UI to one select.
 */
export const POST_LENGTHS = ['short', 'medium', 'long'] as const
export const postLengthSchema = z.enum(POST_LENGTHS)
export type PostLength = z.infer<typeof postLengthSchema>

/**
 * SOURCE OF TRUTH KEYWORDS: generatePostSchema, GeneratePostValues
 *
 * WHAT:  Input contract for a generation request — the Topic and Blog tabs.
 * WHY:   Discriminated on `source` so each branch carries exactly the field it
 *        needs. The form, the router input, and the service argument all share
 *        this one schema, so a new mode is added in one place.
 * WHERE: Router input for aiGeneration.create; resolver for the composer form.
 */
export const generatePostSchema = z.discriminatedUnion('source', [
  z.object({
    source: z.literal('topic'),
    topic: z
      .string()
      .trim()
      .min(10, 'Describe your topic in at least 10 characters')
      .max(1000, 'Keep the topic under 1000 characters'),
    tone: postToneSchema,
    length: postLengthSchema,
  }),
  z.object({
    source: z.literal('blog'),
    blogUrl: z.url('Enter a valid blog URL'),
    tone: postToneSchema,
    length: postLengthSchema,
  }),
])
export type GeneratePostValues = z.infer<typeof generatePostSchema>

/**
 * SOURCE OF TRUTH KEYWORDS: generatedPostSchema, GeneratedPost
 *
 * WHAT:  What the generator hands back.
 * WHY:   Validated rather than trusted: the model's output is untrusted input
 *        like any other, and a post longer than LinkedIn's ceiling would be
 *        rejected at publish time with an opaque remote error. Catching it here
 *        keeps the failure local and explainable.
 * WHERE: Returned by src/services/ai.service.ts → aiGeneration.create.
 */
export const generatedPostSchema = z.object({
  commentary: z.string().trim().min(1).max(LINKEDIN_MAX_COMMENTARY),
})
export type GeneratedPost = z.infer<typeof generatedPostSchema>

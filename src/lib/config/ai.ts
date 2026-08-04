/*
 * Copyright (c) 2026 Web Prodigies LLC
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: AI_PROVIDERS, AI_PROVIDER, getAiProvider,
 *   getAiModel, isAiConfigured, AI_MODEL, AI_MAX_TOKENS, AiProvider,
 *   AiProviderDefinition, GOOGLE_GENERATIVE_AI_API_KEY, ANTHROPIC_API_KEY
 *
 * WHAT:  The registry of AI vendors the app can run on, plus the accessors that
 *        resolve the active one. Built on the Vercel AI SDK, so every vendor is
 *        reached through one call shape.
 * WHY:   The ONE seat of AI-provider configuration. Every AI feature (post
 *        generation today; profile analysis, comment drafting, agents later)
 *        resolves its model here, so swapping vendor is an `AI_PROVIDER` env
 *        change and adding one is a single registry entry — never a grep across
 *        services. Modelled on the PLANS registry in ./plans.ts. Fails soft
 *        exactly like ./stripe.ts and ./resend.ts: an unconfigured key surfaces
 *        an actionable error at the callsite, never a boot crash.
 * WHERE: Consumed by src/services/ai.service.ts and the aiGeneration router.
 *        Never import an AI SDK provider package directly anywhere else.
 */

import { anthropic } from '@ai-sdk/anthropic'
import { google } from '@ai-sdk/google'
import type { LanguageModel } from 'ai'

import {
  aiProviderSchema,
  type AiProvider,
  type AiProviderDefinition,
} from '@/lib/types/ai'

/* Model ids are pinned here so an upgrade is a one-line diff. Gemini Flash is
 * the default because it is the capable tier of Google's free API allowance —
 * the whole app can be exercised end to end before any card is on file. */
const GOOGLE_MODEL_ID = 'gemini-3.5-flash'
const ANTHROPIC_MODEL_ID = 'claude-opus-5'

/* A LinkedIn post caps at 3000 characters, so generation never needs a large
 * budget. Kept well under the streaming threshold so non-streaming calls stay
 * inside the SDK's HTTP timeout. */
export const AI_MAX_TOKENS = 4096

/**
 * SOURCE OF TRUTH KEYWORDS: AI_PROVIDERS
 *
 * WHAT:  Every vendor the app knows how to talk to.
 * WHY:   The three things that actually differ between vendors — model, tuning,
 *        URL-reading tool — are isolated here, so the service layer stays
 *        vendor-agnostic. Adding OpenAI later is one entry plus one key in
 *        AI_PROVIDER_KEYS; no other file changes.
 * WHERE: Read through getAiProvider().
 */
export const AI_PROVIDERS: Record<AiProvider, AiProviderDefinition> = {
  google: {
    label: 'Google Gemini',
    apiKeyEnvVar: 'GOOGLE_GENERATIVE_AI_API_KEY',
    modelId: GOOGLE_MODEL_ID,
    consoleUrl: 'https://aistudio.google.com/apikey',
    createModel: () => google(GOOGLE_MODEL_ID),
    /* Deliberately empty: Gemini's defaults (thinking budget, safety
     * thresholds) are correct for short post copy, and every knob set here is
     * one more thing to re-tune on a model upgrade. */
    providerOptions: {},
    /* url_context reads only URLs already present in the prompt, so the model
     * can fetch the article the user pasted and nothing else. */
    createWebFetchTools: () => ({ url_context: google.tools.urlContext({}) }),
  },
  anthropic: {
    label: 'Anthropic Claude',
    apiKeyEnvVar: 'ANTHROPIC_API_KEY',
    modelId: ANTHROPIC_MODEL_ID,
    consoleUrl: 'https://console.anthropic.com',
    createModel: () => anthropic(ANTHROPIC_MODEL_ID),
    /* Adaptive thinking lets the model calibrate reasoning to the task; effort
     * is capped at medium because post copy is short and well specified. Raise
     * per-call for genuinely harder work rather than globally. */
    providerOptions: {
      anthropic: { thinking: { type: 'adaptive' }, effort: 'medium' },
    },
    createWebFetchTools: () => ({
      web_fetch: anthropic.tools.webFetch_20260209({ maxUses: 3 }),
    }),
  },
}

/**
 * SOURCE OF TRUTH KEYWORDS: AI_PROVIDER
 *
 * WHAT:  The vendor this deployment runs on. Defaults to Google.
 * WHY:   Parsed with `.catch` so an unset or misspelled `AI_PROVIDER` falls back
 *        to the free-tier default instead of taking the process down — the same
 *        fail-soft contract the rest of this file keeps.
 */
export const AI_PROVIDER: AiProvider = aiProviderSchema
  .catch('google')
  .parse(process.env['AI_PROVIDER'])

/**
 * SOURCE OF TRUTH KEYWORDS: getAiProvider
 *
 * WHAT:  The active vendor's definition.
 * WHERE: Used by the AI service for tuning options and web-fetch tools, and by
 *        the AI router to name the missing key in its error message.
 */
export function getAiProvider(): AiProviderDefinition {
  return AI_PROVIDERS[AI_PROVIDER]
}

/**
 * SOURCE OF TRUTH KEYWORDS: AI_MODEL
 *
 * WHAT:  The active model id, for logging and operator-facing copy.
 */
export const AI_MODEL: string = AI_PROVIDERS[AI_PROVIDER].modelId

/**
 * SOURCE OF TRUTH KEYWORDS: isAiConfigured
 *
 * WHAT:  True when the active vendor's API key is set.
 * WHERE: Guard in the AI router before the quota is spent, so an unconfigured
 *        install returns a clean "AI is not configured" error.
 */
export function isAiConfigured(): boolean {
  return Boolean(process.env[getAiProvider().apiKeyEnvVar])
}

/**
 * SOURCE OF TRUTH KEYWORDS: getAiModel
 *
 * WHAT:  Returns the active vendor's model handle for the AI SDK.
 * WHY:   Checks the key first so a missing one reads as an actionable operator
 *        message instead of the SDK's generic LoadAPIKeyError. The SDK reads the
 *        key from the env var itself, which is why nothing is passed here.
 * WHERE: Called by src/services/ai.service.ts.
 */
export function getAiModel(): LanguageModel {
  const provider = getAiProvider()
  if (!process.env[provider.apiKeyEnvVar]) {
    throw new Error(
      `[ai] ${provider.apiKeyEnvVar} is not set. AI generation is unavailable until it is configured. Get a key at ${provider.consoleUrl}.`
    )
  }
  return provider.createModel()
}

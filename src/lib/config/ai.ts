/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: AI_PROVIDERS, AI_PROVIDER, getAiProvider,
 *   getAiModel, isAiConfigured, AI_MODEL, AI_MAX_TOKENS, AiProvider,
 *   AiProviderDefinition, GOOGLE_GENERATIVE_AI_API_KEY, ANTHROPIC_API_KEY,
 *   getAiImageModel, isAiImageConfigured, GOOGLE_IMAGE_MODEL_ID,
 *   AI_IMAGE_PROVIDER, getAiImageProvider
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

import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
import type { ImageModel, LanguageModel } from "ai";

import {
  aiProviderSchema,
  type AiProvider,
  type AiProviderDefinition,
} from "@/lib/types/ai";

/* Model ids are pinned here so an upgrade is a one-line diff. Gemini Flash is
 * the default because it is the capable tier of Google's free API allowance —
 * the whole app can be exercised end to end before any card is on file. */
/* An alias, not a pin, and deliberately so: the pinned `gemini-3.5-flash`
 * returned HTTP 503 "high demand" repeatedly on the free tier while
 * `gemini-flash-latest` answered in ~6s. An alias can shift under us on a
 * Google release, but a pin that is regularly unavailable is worse. Revisit and
 * pin a specific id once this runs on a paid tier with reserved capacity. */
const GOOGLE_MODEL_ID = "gemini-flash-latest";
/* Pinned, and newer than it looks: `claude-opus-5-5` supersedes `claude-opus-5`
 * at a LOWER price ($4/$20 per MTok against $5/$25), so there is no tier being
 * traded away here. Its default effort is `medium`, which is already what
 * providerOptions below asks for. Anthropic model ids carry no date suffix. */
const ANTHROPIC_MODEL_ID = "claude-opus-5-5";

/* Pinned, unlike GOOGLE_MODEL_ID above: the image aliases Google ships are all
 * `-preview` today, and a preview id that shifts under us changes what users'
 * pictures come back looking like. A stable id is worth more here than the
 * freshest one — an image edit is judged by eye, not by a benchmark. */
const GOOGLE_IMAGE_MODEL_ID = "gemini-2.5-flash-image";

/* A LinkedIn post caps at 3000 characters, so generation never needs a large
 * budget. Kept well under the streaming threshold so non-streaming calls stay
 * inside the SDK's HTTP timeout. */
export const AI_MAX_TOKENS = 4096;

/**
 * SOURCE OF TRUTH KEYWORDS: AI_MAX_RETRIES, AI_TIMEOUT_MS
 *
 * WHAT:  Hard ceiling on how long one model call may occupy the caller.
 * WHY:   Model calls run inside the tRPC factory's mutation TRANSACTION, so a
 *        slow call holds a Postgres connection for its whole duration. Free
 *        capacity tiers answer 503 "high demand", which the SDK marks retryable
 *        — at its default of 2 retries with exponential backoff, one overloaded
 *        request was measured hanging past 180s, well beyond the 60s txTimeout.
 *        The transaction then dies holding the connection, and the user waits
 *        three minutes to learn nothing worked. One retry plus an explicit
 *        timeout turns provider overload into a fast, legible failure.
 * WHERE: Applied to every call in src/services/ai.service.ts.
 */
export const AI_MAX_RETRIES = 1;
export const AI_TIMEOUT_MS = 45_000;

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
    label: "Google Gemini",
    apiKeyEnvVar: "GOOGLE_GENERATIVE_AI_API_KEY",
    modelId: GOOGLE_MODEL_ID,
    consoleUrl: "https://aistudio.google.com/apikey",
    createModel: () => google(GOOGLE_MODEL_ID),
    /* Deliberately empty: Gemini's defaults (thinking budget, safety
     * thresholds) are correct for short post copy, and every knob set here is
     * one more thing to re-tune on a model upgrade. */
    providerOptions: {},
    /* url_context reads only URLs already present in the prompt, so the model
     * can fetch the article the user pasted and nothing else. */
    createWebFetchTools: () => ({ url_context: google.tools.urlContext({}) }),
    createImageModel: () => google.image(GOOGLE_IMAGE_MODEL_ID),
  },
  anthropic: {
    label: "Anthropic Claude",
    apiKeyEnvVar: "ANTHROPIC_API_KEY",
    modelId: ANTHROPIC_MODEL_ID,
    consoleUrl: "https://console.anthropic.com",
    createModel: () => anthropic(ANTHROPIC_MODEL_ID),
    /* Adaptive thinking lets the model calibrate reasoning to the task; effort
     * is capped at medium because post copy is short and well specified. Raise
     * per-call for genuinely harder work rather than globally. */
    providerOptions: {
      anthropic: { thinking: { type: "adaptive" }, effort: "medium" },
    },
    createWebFetchTools: () => ({
      web_fetch: anthropic.tools.webFetch_20260209({ maxUses: 3 }),
    }),
    /* Claude produces text, never images. Null rather than a throwing stub so
     * the capability is answerable BEFORE a call is made — that is what lets the
     * UI hide the control instead of surfacing a vendor error on click. */
    createImageModel: null,
  },
};

/**
 * SOURCE OF TRUTH KEYWORDS: AI_PROVIDER
 *
 * WHAT:  The vendor this deployment runs on. Defaults to Google.
 * WHY:   Parsed with `.catch` so an unset or misspelled `AI_PROVIDER` falls back
 *        to the free-tier default instead of taking the process down — the same
 *        fail-soft contract the rest of this file keeps.
 */
export const AI_PROVIDER: AiProvider = aiProviderSchema
  .catch("google")
  .parse(process.env["AI_PROVIDER"]);

/**
 * SOURCE OF TRUTH KEYWORDS: AI_IMAGE_PROVIDER
 *
 * WHAT:  The vendor that serves IMAGE work, independent of the text vendor.
 * WHY:   Text and images are not the same capability and do not have the same
 *        vendor list — Claude has no image model at all. Tying them to one env
 *        var meant moving text off Google (for rate limits, or quality) silently
 *        took AI image edits and studio backdrops down with it. Splitting them
 *        lets a deployment run text on one vendor and keep images on another,
 *        which is the only way to have both without a second account on the
 *        vendor that lacks the capability.
 *        Defaults to AI_PROVIDER, so a deployment that never sets this behaves
 *        exactly as it did before — the split costs nothing to ignore.
 */
export const AI_IMAGE_PROVIDER: AiProvider = aiProviderSchema
  .catch(AI_PROVIDER)
  .parse(process.env["AI_IMAGE_PROVIDER"]);

/**
 * SOURCE OF TRUTH KEYWORDS: getAiProvider
 *
 * WHAT:  The active vendor's definition.
 * WHERE: Used by the AI service for tuning options and web-fetch tools, and by
 *        the AI router to name the missing key in its error message.
 */
export function getAiProvider(): AiProviderDefinition {
  return AI_PROVIDERS[AI_PROVIDER];
}

/**
 * SOURCE OF TRUTH KEYWORDS: getAiImageProvider
 *
 * WHAT:  The vendor definition behind image work.
 * WHY:   Every image path resolves its vendor through here rather than
 *        getAiProvider(), which is what keeps the text/image split honest — a
 *        caller cannot accidentally reach the text vendor for an image.
 * WHERE: isAiImageConfigured() and getAiImageModel() below.
 */
export function getAiImageProvider(): AiProviderDefinition {
  return AI_PROVIDERS[AI_IMAGE_PROVIDER];
}

/**
 * SOURCE OF TRUTH KEYWORDS: AI_MODEL
 *
 * WHAT:  The active model id, for logging and operator-facing copy.
 */
export const AI_MODEL: string = AI_PROVIDERS[AI_PROVIDER].modelId;

/**
 * SOURCE OF TRUTH KEYWORDS: isAiConfigured
 *
 * WHAT:  True when the active vendor's API key is set.
 * WHERE: Guard in the AI router before the quota is spent, so an unconfigured
 *        install returns a clean "AI is not configured" error.
 */
export function isAiConfigured(): boolean {
  return Boolean(process.env[getAiProvider().apiKeyEnvVar]);
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
  const provider = getAiProvider();
  if (!process.env[provider.apiKeyEnvVar]) {
    throw new Error(
      `[ai] ${provider.apiKeyEnvVar} is not set. AI generation is unavailable until it is configured. Get a key at ${provider.consoleUrl}.`,
    );
  }
  return provider.createModel();
}

/**
 * SOURCE OF TRUTH KEYWORDS: isAiImageConfigured
 *
 * WHAT:  True when the active vendor can edit images AND its key is set.
 * WHY:   TWO conditions, not one. A configured key is not enough — Anthropic has
 *        a key and no image model — so this is the only honest answer to "can
 *        this deployment do an AI image edit". Read in a server component and
 *        passed down, exactly like isImageKitConfigured, because a client-side
 *        env read would answer false on a correctly configured install.
 * WHERE: Guard in the AI image router, and the flag that decides whether the
 *        composer renders the AI edit control at all.
 */
export function isAiImageConfigured(): boolean {
  const provider = getAiImageProvider();
  return Boolean(
    provider.createImageModel && process.env[provider.apiKeyEnvVar],
  );
}

/**
 * SOURCE OF TRUTH KEYWORDS: getAiImageModel
 *
 * WHAT:  The active vendor's image-model handle.
 * WHY:   Names WHICH of the two failure modes happened — no image model on this
 *        vendor, or no key — because the fixes are completely different: one is
 *        an AI_PROVIDER change, the other is an env var.
 * WHERE: Called by src/services/ai.service.ts.
 */
export function getAiImageModel(): ImageModel {
  const provider = getAiImageProvider();
  if (!provider.createImageModel) {
    throw new Error(
      `[ai] ${provider.label} has no image model. Set AI_IMAGE_PROVIDER to a vendor that supports image generation to enable AI image edits — it is independent of AI_PROVIDER, so the text vendor can stay as it is.`,
    );
  }
  if (!process.env[provider.apiKeyEnvVar]) {
    throw new Error(
      `[ai] ${provider.apiKeyEnvVar} is not set. AI image editing is unavailable until it is configured. Get a key at ${provider.consoleUrl}.`,
    );
  }
  return provider.createImageModel();
}

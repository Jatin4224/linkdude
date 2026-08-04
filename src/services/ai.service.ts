/*
 * Copyright (c) 2026 Web Prodigies LLC
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import 'server-only'

/**
 * SOURCE OF TRUTH KEYWORDS: generateText, generateLinkedInPost,
 *   GenerateTextArgs, TONE_DIRECTIVES, LENGTH_DIRECTIVES,
 *   LINKEDIN_POST_SYSTEM_PROMPT
 *
 * WHAT:  The app's single seat of model invocation. `generateText` is the
 *        provider-facing primitive (system prompt in, text out);
 *        `generateLinkedInPost` is the one task built on it today.
 * WHY:   Every future AI feature — profile analysis, comment drafting, agents —
 *        calls `generateText` rather than constructing its own client, so
 *        retries, error mapping, provider tuning, and the empty-response guard
 *        exist once. Model output is treated as untrusted and validated against
 *        generatedPostSchema before it leaves this file, so an over-long or
 *        empty completion fails here instead of at LinkedIn's API.
 * WHERE: Called by src/trpc/routers/ai-generation.ts. Resolves its model and
 *        vendor tuning from src/lib/config/ai.ts; imported with `import *` per
 *        the service convention.
 */

import { generateText as generateWithModel } from 'ai'

import { getAiModel, getAiProvider, AI_MAX_TOKENS } from '@/lib/config/ai'
import {
  generatedPostSchema,
  type GeneratePostValues,
  type GeneratedPost,
  type PostTone,
  type PostLength,
} from '@/lib/types/ai'

export interface GenerateTextArgs {
  system: string
  prompt: string
  /** Lets the model fetch a URL itself — avoids a scraping dependency. */
  allowWebFetch?: boolean
}

/**
 * SOURCE OF TRUTH KEYWORDS: generateText
 *
 * WHAT:  Sends one prompt to the configured model and returns its text.
 * WHY:   Vendor tuning and the URL-reading tool come from the provider registry,
 *        so this function is identical whichever model is configured — switching
 *        vendors changes nothing here. A safety block or an empty completion is
 *        converted into a thrown Error so callers never inspect `finishReason`
 *        themselves.
 * WHERE: The only function in the app that talks to a model provider.
 */
export async function generateText({
  system,
  prompt,
  allowWebFetch = false,
}: GenerateTextArgs): Promise<string> {
  const provider = getAiProvider()

  const result = await generateWithModel({
    model: getAiModel(),
    maxOutputTokens: AI_MAX_TOKENS,
    providerOptions: provider.providerOptions,
    system,
    /* Enabled only for the blog-repurpose path. Every vendor's tool here reaches
     * URLs already present in the prompt and nothing else, so the model reads
     * the article the user pasted without a scraping dependency. */
    ...(allowWebFetch ? { tools: provider.createWebFetchTools() } : {}),
    prompt,
  })

  /* Safety classifiers decline by returning a normal response with no text, so
   * this is checked before the empty guard to give the more specific message. */
  if (result.finishReason === 'content-filter') {
    throw new Error(
      'The AI declined this request. Try rewording your topic without sensitive or restricted content.'
    )
  }

  const text = result.text.trim()

  if (!text) {
    throw new Error('The AI returned an empty response. Try again with a more specific topic.')
  }

  return text
}

/* Tone is the product in a personal-branding tool, so each value gets an
 * explicit directive rather than passing the bare enum name to the model —
 * "contrarian" alone is far too open to interpretation. */
const TONE_DIRECTIVES: Record<PostTone, string> = {
  professional:
    'Measured and credible. Plain expert language, no hype, no exclamation marks.',
  conversational:
    'Warm and direct, like explaining it to a smart colleague over coffee. Contractions are fine.',
  storytelling:
    'Open on a specific concrete moment, then draw the wider lesson out of it.',
  contrarian:
    'Lead with a widely-held belief and argue against it. Make the counter-case with reasoning, not provocation for its own sake.',
  educational:
    'Teach one idea clearly. Concrete, ordered, and useful enough to act on immediately.',
}

const LENGTH_DIRECTIVES: Record<PostLength, string> = {
  short: 'Roughly 50-80 words. One tight idea, nothing more.',
  medium: 'Roughly 120-180 words. A hook, two or three beats of substance, and a close.',
  long: 'Roughly 250-350 words. Room to develop the argument, still scannable.',
}

/**
 * SOURCE OF TRUTH KEYWORDS: LINKEDIN_POST_SYSTEM_PROMPT
 *
 * WHAT:  The persona and hard rules for post generation.
 * WHY:   Rules that exist to stop specific known failure modes: markdown that
 *        LinkedIn renders literally as asterisks, the em-dash-and-emoji house
 *        style that reads as machine-written, and meta-commentary wrapping the
 *        post ("Here's your post:") which the user would have to delete by hand.
 *        Output is bare post text so the composer can drop it straight into the
 *        editor.
 */
const LINKEDIN_POST_SYSTEM_PROMPT = `You write LinkedIn posts that sound like a real practitioner, not a brand account.

Hard rules:
- Return ONLY the post text. No preamble, no sign-off, no "Here's your post", no surrounding quotes.
- Never use markdown. LinkedIn renders **bold** and # headings as literal characters.
- Open with a hook that earns the second line. Never open with "In today's fast-paced world" or any variant.
- Short paragraphs, one to three lines each, separated by a blank line. This is how LinkedIn is read.
- No emoji unless the requested tone genuinely calls for one. Never use them as bullet points.
- Avoid em dashes, "delve", "leverage", "unlock", "game-changer", "supercharge", and rhetorical-question openers.
- Be specific. A concrete number, example, or detail beats an abstract claim every time.
- At most three hashtags, on their own final line. Omit them entirely if none genuinely fit.
- Write in first person. The reader should believe a person typed this.`

/**
 * SOURCE OF TRUTH KEYWORDS: generateLinkedInPost
 *
 * WHAT:  Turns a topic (or a blog URL to repurpose) into publish-ready copy.
 * WHY:   Both composer modes converge here so tone/length handling and the
 *        validation of model output live in one place. The blog path enables
 *        web_fetch so the model reads the article itself — no scraping
 *        dependency, and no HTML stripping to maintain.
 * WHERE: Called by aiGeneration.create.
 */
export async function generateLinkedInPost(input: GeneratePostValues): Promise<GeneratedPost> {
  const toneDirective = TONE_DIRECTIVES[input.tone]
  const lengthDirective = LENGTH_DIRECTIVES[input.length]

  const task =
    input.source === 'topic'
      ? `Write a LinkedIn post about the following.\n\nTopic:\n${input.topic}`
      : `Read the article at ${input.blogUrl} and rewrite its central insight as an original LinkedIn post. Do not summarize section by section — pick the single most useful idea and make the post about that. Do not include the URL in the post.`

  const commentary = await generateText({
    system: LINKEDIN_POST_SYSTEM_PROMPT,
    prompt: `${task}\n\nTone: ${toneDirective}\nLength: ${lengthDirective}`,
    allowWebFetch: input.source === 'blog',
  })

  /* Model output is untrusted input. Parsing here means an over-long post
   * surfaces as a local validation error rather than a remote
   * FIELD_LENGTH_TOO_LONG from LinkedIn after the user hits Publish. */
  return generatedPostSchema.parse({ commentary })
}

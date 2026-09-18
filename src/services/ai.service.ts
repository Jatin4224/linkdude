/*

 */

import "server-only";

/**
 * SOURCE OF TRUTH KEYWORDS: generateText, generateStructured,
 *   generateLinkedInPost, analyzeLinkedInProfile, GenerateTextArgs,
 *   GenerateStructuredArgs, TONE_DIRECTIVES, LENGTH_DIRECTIVES,
 *   LINKEDIN_POST_SYSTEM_PROMPT, PROFILE_ANALYSIS_SYSTEM_PROMPT,
 *   generateCarouselSlides, CAROUSEL_SYSTEM_PROMPT, extractVoiceProfile,
 *   buildVoiceDirective, VOICE_EXTRACTION_SYSTEM_PROMPT,
 *   LINKEDIN_LANGUAGE_RULES, LINKEDIN_HOOK_RULES, quotePhrases,
 *   fixLinkedInPost, LINKEDIN_POST_EDITOR_SYSTEM_PROMPT, describeLength,
 *   buildHookDirective, POST_GOAL_DIRECTIVES, alternative openings,
 *   expandPostIdea, IDEA_ANGLES_SYSTEM_PROMPT
 *
 * WHAT:  The app's single seat of model invocation. `generateText` and
 *        `generateStructured` are the provider-facing primitives (prose out and
 *        schema-validated data out respectively); `generateLinkedInPost` and
 *        `analyzeLinkedInProfile` are the tasks built on them.
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

import {
  generateText as generateWithModel,
  generateImage,
  generateObject,
} from "ai";
/* Value import, not `import type`: generateCarouselSlides builds the model-facing
 * wrapper object with z.object(). */
import { z } from "zod";

import {
  getAiModel,
  getAiImageModel,
  getAiProvider,
  AI_MAX_TOKENS,
  AI_MAX_RETRIES,
  AI_TIMEOUT_MS,
} from "@/lib/config/ai";
import { SANITIZED_ERROR_CODES, UserFacingError } from "@/lib/errors";
import type { LinkedInImageBinary } from "@/lib/types/linkedin";
import {
  generatedPostSchema,
  postWithOpeningsSchema,
  type FixPostValues,
  type GeneratedPost,
  type PostTone,
  type PostLength,
  type WritePostValues,
} from "@/lib/types/ai";
import {
  HOOK_FORMULA_KEYS,
  POST_ALTERNATIVE_OPENINGS,
  type PostGoal,
} from "@/lib/types/post-hooks";
import { HOOK_FORMULAS } from "@/lib/config/post-hooks";
import {
  IDEA_ANGLES_COUNT,
  ideaAnglesSchema,
  type IdeaAngles,
} from "@/lib/types/post-ideas";
import {
  profileAnalysisSchema,
  sectionInsightSchema,
  type AnalyzeProfileValues,
  type ProfileAnalysis,
} from "@/lib/types/profile-analysis";
import type { FetchedProfile } from "@/lib/types/profile-lookup";
import {
  carouselSlidesSchema,
  CAROUSEL_PAGE_PRESETS,
  type CarouselSlides,
  type GenerateCarouselValues,
} from "@/lib/types/carousel";
import {
  CAROUSEL_GENERATION_MAX_TOKENS,
  CAROUSEL_GENERATION_TIMEOUT_MS,
} from "@/lib/config/carousel";
import {
  contentPlanInsightsSchema,
  contentPlanResultSchema,
  type ContentPlanAnswers,
  type ContentPlanInsights,
  type ContentPlanResult,
} from "@/lib/types/content-plan";
import {
  DEEP_INSIGHT_SECTIONS,
  PROFILE_SECTIONS,
  PROFILE_SECTION_ENTRIES,
  serializeProfileSection,
} from "@/lib/config/profile-sections";
import { serializeContentPlanAnswers } from "@/lib/config/content-plan-sections";
import {
  voiceDescriptorSchema,
  type ResolvedVoice,
  type VoiceDescriptor,
  type VoiceSample,
} from "@/lib/types/voice-profile";
import {
  VOICE_EXTRACTION_MAX_TOKENS,
  VOICE_EXTRACTION_TIMEOUT_MS,
} from "@/lib/config/voice-profile";
import {
  AI_TELL_PHRASES,
  AI_TELL_WORDS,
  ANNOUNCEMENT_OPENERS,
  GENERIC_CLOSERS,
  HOOK_OPENER_TELLS,
  POST_CHECK_RULES,
  POST_HASHTAG_MAX,
  POST_HOOK_MOBILE_CHARS,
  POST_LENGTH_WORD_RANGES,
  REVEAL_BRIDGES,
  SINCERITY_OPENERS,
} from "@/lib/config/post-writing";

export interface GenerateTextArgs {
  system: string;
  prompt: string;
  /** Lets the model fetch a URL itself — avoids a scraping dependency. */
  allowWebFetch?: boolean;
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
  const provider = getAiProvider();

  const result = await generateWithModel({
    model: getAiModel(),
    maxOutputTokens: AI_MAX_TOKENS,
    providerOptions: provider.providerOptions,
    maxRetries: AI_MAX_RETRIES,
    timeout: AI_TIMEOUT_MS,
    system,
    /* Enabled only for the blog-repurpose path. Every vendor's tool here reaches
     * URLs already present in the prompt and nothing else, so the model reads
     * the article the user pasted without a scraping dependency. */
    ...(allowWebFetch ? { tools: provider.createWebFetchTools() } : {}),
    prompt,
  });

  /* Safety classifiers decline by returning a normal response with no text, so
   * this is checked before the empty guard to give the more specific message. */
  /* UserFacingError, not Error: these two strings were written here for the user
   * to read, and that class is the only thing that keeps them from being
   * replaced with generic copy at the tRPC boundary — where every UNAUTHORED
   * message (the provider's included) now is. */
  if (result.finishReason === "content-filter") {
    throw new UserFacingError(
      "The AI declined this request. Try rewording your topic without sensitive or restricted content.",
      { errorCode: SANITIZED_ERROR_CODES.AI_CONTENT_REJECTED },
    );
  }

  const text = result.text.trim();

  if (!text) {
    throw new UserFacingError(
      "The AI returned an empty response. Try again with a more specific topic.",
      { errorCode: SANITIZED_ERROR_CODES.AI_OUTPUT_UNUSABLE, retryable: true },
    );
  }

  return text;
}

export interface GenerateStructuredArgs<T> {
  system: string;
  prompt: string;
  /** Doubles as the model's output contract and the validation boundary. */
  schema: z.ZodType<T>;
  /**
   * Overrides AI_MAX_TOKENS for this call.
   *
   * The global is sized for a LinkedIn post and is far too small for a large
   * structured result: when the budget runs out mid-object the JSON is
   * TRUNCATED, and truncated JSON surfaces as "response did not match schema" —
   * a validation error that says nothing about the real cause. Any task asking
   * for more than a few fields should raise this deliberately rather than
   * discovering the ceiling as a schema failure.
   *
   * On providers with thinking enabled, reasoning tokens draw on this same
   * budget, so the headroom needs to cover both.
   */
  maxOutputTokens?: number | undefined;
  /** Overrides AI_TIMEOUT_MS. Must stay below the caller's txTimeout. */
  timeoutMs?: number | undefined;
}

/**
 * SOURCE OF TRUTH KEYWORDS: generateStructured
 *
 * WHAT:  Sends one prompt and returns a value already validated against `schema`.
 * WHY:   The counterpart to `generateText` for features that need shape, not
 *        prose. The provider is asked for structured output natively and the
 *        SDK validates it, so there is no JSON to locate in a prose reply, no
 *        parse to wrap in try/catch, and no drift between what the model was
 *        told to return and what the UI reads — one schema declares both.
 * WHERE: Used by analyzeLinkedInProfile; the primitive for any future feature
 *        whose result is data rather than copy.
 */
export async function generateStructured<T>({
  system,
  prompt,
  schema,
  maxOutputTokens = AI_MAX_TOKENS,
  timeoutMs = AI_TIMEOUT_MS,
}: GenerateStructuredArgs<T>): Promise<T> {
  const provider = getAiProvider();

  const { object } = await generateObject({
    model: getAiModel(),
    schema,
    maxOutputTokens,
    providerOptions: provider.providerOptions,
    maxRetries: AI_MAX_RETRIES,
    timeout: timeoutMs,
    system,
    prompt,
  });

  return object;
}

/**
 * SOURCE OF TRUTH KEYWORDS: AI_IMAGE_TIMEOUT_MS, editImage, EditedImage
 *
 * WHAT:  Rewrites an existing image from a text instruction and returns the new
 *        bytes.
 * WHY:   Image editing, not image generation: the source rides in the prompt, so
 *        the model alters what is already there instead of inventing a fresh
 *        picture from the description. AI SDK v7 takes both in one call, which
 *        is why there is no multimodal message plumbing here.
 *
 *        Returns BYTES rather than uploading them, so this file keeps its single
 *        responsibility — talking to models — and the caller decides where the
 *        result is stored.
 *
 *        Longer than AI_TIMEOUT_MS because an image round trip is slower than
 *        post copy, and expressed as an abort signal rather than a `timeout`
 *        option: generateImage takes no timeout, unlike generateText. The
 *        caller's txTimeout must exceed this.
 * WHERE: Called by the AI image-edit router, which uploads the result.
 */
const AI_IMAGE_TIMEOUT_MS = 90_000;

export interface EditedImage {
  /** Base64 payload, ready to hand to ImageKit without re-encoding. */
  base64: string;
  mediaType: string;
}

export async function editImage(
  source: LinkedInImageBinary,
  instruction: string,
): Promise<EditedImage> {
  const { image, warnings } = await generateImage({
    model: getAiImageModel(),
    /* The object form is what makes this an EDIT — a bare string prompt would
     * generate an unrelated picture from the words alone. */
    prompt: {
      images: [new Uint8Array(source.bytes)],
      text: instruction,
    },
    /* Zero, unlike every text call, which retries once. The dominant failure
     * here is a quota refusal, and quota does not clear between attempts — the
     * retry only makes the user wait through a second doomed round trip (the
     * vendor's own "retry in 24s" hint is what the SDK sleeps for) while the
     * caller's transaction stays open. */
    maxRetries: 0,
    abortSignal: AbortSignal.timeout(AI_IMAGE_TIMEOUT_MS),
  });

  /* Surfaced rather than swallowed: a provider that silently ignored the source
   * image would return a plausible-looking picture that is not an edit at all,
   * and the user would only notice by eye. */
  if (warnings.length > 0) {
    console.warn("[ai] image edit returned warnings", { warnings });
  }

  return { base64: image.base64, mediaType: image.mediaType };
}

/**
 * SOURCE OF TRUTH KEYWORDS: generateBackdrop, GeneratedBackdrop,
 *   BACKDROP_DIRECTIVE, studio backdrop
 *
 * WHAT:  Generates a background image for a studio design from a text brief.
 * WHY:   A bare STRING prompt, where editImage passes the object form — that is
 *        the whole difference between the two, and it is deliberate: there is no
 *        source image here, so the object form would have nothing to edit.
 *
 *        The brief is WRAPPED rather than passed through, and the wrapper is the
 *        point of this function. Image models cannot render legible text, so the
 *        one thing that must never appear in a generated backdrop is words — the
 *        renderer draws those itself, crisply, on top. Left unwrapped, a brief
 *        like "banner for a B2B founder" reliably comes back with garbled
 *        lettering baked into the pixels, which no amount of compositing removes.
 *
 *        The composition instructions are not decoration either: a LinkedIn
 *        banner has the member's avatar over its lower left, so a backdrop whose
 *        subject sits there is covered by their own face.
 *
 *        Returns BYTES rather than uploading them, the contract editImage keeps:
 *        this file talks to models, the caller decides where things land.
 * WHERE: Called by src/trpc/routers/studio-backdrop.ts, which uploads the result.
 */
const BACKDROP_DIRECTIVE = [
  "Abstract background texture for a wide banner image.",
  "ABSOLUTELY NO TEXT, NO LETTERS, NO WORDS, NO NUMBERS, NO LOGOS, NO WATERMARKS.",
  "No people, no faces, no hands.",
  "Wide panoramic composition. Keep the left third calm and uncluttered; let any",
  "visual interest sit on the right.",
  "Low contrast and subtle, so white or dark text stays readable over it.",
].join(" ");

export interface GeneratedBackdrop {
  /** Base64 payload, ready to hand to ImageKit without re-encoding. */
  base64: string;
  mediaType: string;
}

export async function generateBackdrop(brief: string): Promise<GeneratedBackdrop> {
  const { image, warnings } = await generateImage({
    model: getAiImageModel(),
    prompt: `${BACKDROP_DIRECTIVE} The subject matter: ${brief}`,
    /* Zero, for the reason editImage states: the dominant failure is a quota
     * refusal, and quota does not clear between attempts. */
    maxRetries: 0,
    abortSignal: AbortSignal.timeout(AI_IMAGE_TIMEOUT_MS),
  });

  if (warnings.length > 0) {
    console.warn("[ai] backdrop generation returned warnings", { warnings });
  }

  return { base64: image.base64, mediaType: image.mediaType };
}

/* Tone is the product in a personal-branding tool, so each value gets an
 * explicit directive rather than passing the bare enum name to the model —
 * "contrarian" alone is far too open to interpretation. */
const TONE_DIRECTIVES: Record<PostTone, string> = {
  professional:
    "Measured and credible. Plain expert language, no hype, no exclamation marks.",
  conversational:
    "Warm and direct, like explaining it to a smart colleague over coffee. Contractions are fine.",
  storytelling:
    "Open on a specific concrete moment, then draw the wider lesson out of it.",
  contrarian:
    "Lead with a widely-held belief and argue against it. Make the counter-case with reasoning, not provocation for its own sake.",
  educational:
    "Teach one idea clearly. Concrete, ordered, and useful enough to act on immediately.",
};

/* The word and character targets come from POST_LENGTH_WORD_RANGES, the same
 * numbers the post check measures a draft against, so "medium" means one thing
 * everywhere. */
const LENGTH_DIRECTIVES: Record<PostLength, string> = {
  short: describeLength("short", "One tight idea, nothing more."),
  medium: describeLength(
    "medium",
    "A hook, two or three beats of substance, and a close.",
  ),
  long: describeLength(
    "long",
    "Room to develop the argument, with a blank line every one or two sentences.",
  ),
};

function describeLength(length: PostLength, shape: string): string {
  const { minWords, maxWords, minChars, maxChars } =
    POST_LENGTH_WORD_RANGES[length];
  return `Roughly ${minWords}-${maxWords} words (about ${minChars.toLocaleString("en-US")}-${maxChars.toLocaleString("en-US")} characters). ${shape}`;
}

/* Renders a phrase list the way the prompts quote it: "a", "b", "c". */
function quotePhrases(phrases: readonly string[]): string {
  return phrases.map((phrase) => `"${phrase}"`).join(", ");
}

/**
 * SOURCE OF TRUTH KEYWORDS: LINKEDIN_LANGUAGE_RULES, LINKEDIN_HOOK_RULES,
 *   shared writing rules, AI tells, hook rules, quotePhrases
 *
 * WHAT:  The writing rules shared by every generator that writes LinkedIn copy:
 *        language (words, phrases, dashes, rhythm) and, for anything that opens
 *        a post, the hook.
 * WHY:   Posts, carousels and content-plan hooks each carried their own short
 *        copy of "avoid delve, leverage, em dashes", and the copies drifted. One
 *        block per concern, built from the lists in post-writing.ts, keeps every
 *        generator on the rules the post checker enforces. Rules only, never a
 *        persona: each system prompt still owns its own task.
 *
 *        Em dashes stay banned in generated copy (the source allows about one
 *        per 100 words). A generated draft never needs one, and it is the tell
 *        users recognise first.
 * WHERE: LINKEDIN_POST_SYSTEM_PROMPT, CAROUSEL_SYSTEM_PROMPT,
 *        CONTENT_PLAN_SYSTEM_PROMPT.
 */
const LINKEDIN_LANGUAGE_RULES = [
  "- No em dashes, en dashes or double hyphens. Use a comma, a colon or parentheses instead.",
  `- Avoid these words and their other forms: ${AI_TELL_WORDS.join(", ")}.`,
  `- Never use these phrases: ${quotePhrases(AI_TELL_PHRASES)}.`,
  `- Never announce sincerity (${quotePhrases(SINCERITY_OPENERS)}) or excitement (${quotePhrases(ANNOUNCEMENT_OPENERS)}). State the fact itself.`,
  `- No reveal bridges such as ${quotePhrases(REVEAL_BRIDGES)}. Write the reveal as a plain sentence.`,
  `- Never use the "It's not X, it's Y" frame or any variant of it, such as "not X, but Y" or "This isn't X. This is Y."`,
  `- No staccato runs ("Short. Punchy. Done.", "No X. No Y. Just Z.") and no one-word paragraphs.`,
  `- No hedging stacks ("perhaps", "it seems", "might", "could potentially").`,
].join("\n");

const LINKEDIN_HOOK_RULES = [
  "- The opening line is a statement or a specific number, never a question, and it makes sense on its own.",
  `- Never open with ${quotePhrases(HOOK_OPENER_TELLS)} or a "Stop X, start Y" line.`,
  "- Never write a line in all capitals.",
].join("\n");

/**
 * SOURCE OF TRUTH KEYWORDS: buildVoiceDirective, ResolvedVoice, voice
 *   precedence, writing voice prompt
 *
 * WHAT:  The prompt block asking a generator to write in the member's voice, or
 *        an empty string when they have none active.
 * WHY:   The first per-organization text in any prompt here, so the precedence
 *        between instruction sources is written down once, inside the block: the
 *        task's hard rules win (they stop known failures such as markdown rendered
 *        literally), a tone chosen for this piece wins over the standing voice,
 *        and banned phrases are absolute. It is appended to the PROMPT and never
 *        spliced into a system prompt, so those shared constants stay identical
 *        for every organization and keep their authority.
 *
 *        The member's sample posts are deliberately not replayed: the descriptor
 *        is the voice, and resending twenty posts on every draft is spend with no
 *        added signal.
 * WHERE: generateLinkedInPost, generateCarouselSlides, generateContentPlan.
 */
function buildVoiceDirective(voice: ResolvedVoice | null): string {
  if (!voice) return "";

  const { descriptor, bannedPhrases, guidance } = voice;
  const { sentenceRhythm, vocabulary, formatting } = descriptor;

  const lines: string[] = [
    "WRITE IN THIS PERSON'S VOICE.",
    "It was learned from their own posts. Follow it closely, except that every hard rule you were given still wins, and a tone requested for this piece wins over it.",
    "",
    `How they sound: ${descriptor.summary}`,
    `Register: ${vocabulary.register}. Vocabulary: ${vocabulary.jargonTolerance}.`,
    `Sentences: about ${sentenceRhythm.averageSentenceWords} words on average, rhythm ${sentenceRhythm.variance}${sentenceRhythm.usesFragments ? ", with deliberate fragments" : ""}.`,
    `Paragraphs: at most ${formatting.paragraphMaxLines} lines${sentenceRhythm.usesOneLineParagraphs ? ", often a single line" : ""}${formatting.usesLineBreaksForEmphasis ? ", with line breaks used for emphasis" : ""}.`,
    `Lists: ${formatting.listStyle}. Emoji: ${formatting.emojiUse}. Hashtags: at most ${formatting.hashtagCount}. ${formatting.usesQuestions ? "Asks the reader questions." : "Rarely asks the reader questions."}`,
  ];

  if (descriptor.openingPatterns.length > 0) {
    lines.push(
      "",
      "How they tend to open:",
      ...descriptor.openingPatterns.map(
        (entry) => `- ${entry.pattern} (e.g. "${entry.example}")`,
      ),
    );
  }
  if (descriptor.closingPatterns.length > 0) {
    lines.push(
      "",
      "How they tend to close:",
      ...descriptor.closingPatterns.map(
        (entry) => `- ${entry.pattern} (e.g. "${entry.example}")`,
      ),
    );
  }
  /* Examples are the member's real lines. Without this the model reuses them
   * verbatim, and every draft opens with the same sentence. */
  if (
    descriptor.openingPatterns.length > 0 ||
    descriptor.closingPatterns.length > 0
  ) {
    lines.push("Learn the pattern from each example. Never copy an example.");
  }

  if (vocabulary.signaturePhrases.length > 0) {
    lines.push(
      "",
      `Phrases that sound like them. Use one at most, and only where it fits: ${vocabulary.signaturePhrases.join("; ")}`,
    );
  }
  if (vocabulary.avoidedWords.length > 0) {
    lines.push(`Words they avoid: ${vocabulary.avoidedWords.join("; ")}`);
  }
  if (bannedPhrases.length > 0) {
    lines.push("", `Never use these phrases: ${bannedPhrases.join("; ")}`);
  }
  if (guidance) {
    lines.push("", `Their own notes on how they write: ${guidance}`);
  }

  return `\n\n${lines.join("\n")}`;
}

/**
 * SOURCE OF TRUTH KEYWORDS: LINKEDIN_POST_SYSTEM_PROMPT
 *
 * WHAT:  The persona and hard rules for post generation.
 * WHY:   Rules that exist to stop specific known failure modes: markdown that
 *        LinkedIn renders literally as asterisks, the machine-written tells in
 *        LINKEDIN_LANGUAGE_RULES, a hook that is cut off before "see more", and
 *        meta-commentary wrapping the post ("Here's your post:") which the user
 *        would have to delete by hand. Output is bare post text so the composer
 *        can drop it straight into the editor.
 *
 *        Structure, hook and close rules are adapted from the post writer in
 *        sergebulaev/linkedin-skills (see THIRD_PARTY_NOTICES.md). "Never invent
 *        numbers" replaces the old "a concrete number beats an abstract claim",
 *        which pushed the model to make figures up when the topic had none.
 */
const LINKEDIN_POST_SYSTEM_PROMPT = `You write LinkedIn posts that sound like a real practitioner, not a brand account.

Output:
- The post is ONLY the post text. No preamble, no sign-off, no "Here's your post", no surrounding quotes.
- Never use markdown. LinkedIn renders **bold** and # headings as literal characters.

Hook:
${LINKEDIN_HOOK_RULES}
- The opening line must land within the first ${POST_HOOK_MOBILE_CHARS} characters, where LinkedIn's mobile feed cuts to "see more". Leave a blank line after it.

Structure:
- Paragraphs of one or two sentences, separated by a blank line. This is how LinkedIn is read.
- At most one contrast and at most one list of three in the whole post. A list of three names concrete things, never three adjectives.
- At most two sentence fragments in the whole post.

Language:
${LINKEDIN_LANGUAGE_RULES}
- No emoji unless the requested tone genuinely calls for one. Never use them as bullet points.

Substance:
- Be specific. A concrete example or detail beats an abstract claim every time.
- Use only facts that are in the topic or the source. Never invent numbers, names, dates, clients or results.
- Write in first person. The reader should believe a person typed this.

Close:
- End with a specific question about this post's subject, or a clean final line. Never end with ${quotePhrases(GENERIC_CLOSERS)}, and never ask readers to comment a word to get something.
- Add a one-line P.S. only when there is a real follow-up to point to.
- Never put a link in the post. If one is needed, say it is in the first comment.
- At most ${POST_HASHTAG_MAX} hashtags, on their own final line. Omit them entirely if none genuinely fit.`;

/* What each goal asks of the post. Paired with the formulas that serve it. */
const POST_GOAL_DIRECTIVES: Record<PostGoal, string> = {
  any: "No preference. Aim for a post people would genuinely respond to.",
  comments:
    "Comments. Give readers something real to answer: an experience to compare, a comparison to test, or a position to disagree with, and close with a specific question.",
  reposts:
    "Reposts. Make one idea worth passing on: a quotable line, a sharp distinction, or credit to real people.",
  likes: "Likes. Tell a true, human story with real stakes and a clear turn.",
  saves:
    "Saves. Make it worth coming back to: a clear explanation, concrete steps, or real numbers.",
};

/**
 * SOURCE OF TRUTH KEYWORDS: buildHookDirective, POST_GOAL_DIRECTIVES, hook
 *   formula prompt
 *
 * WHAT:  The goal plus the hook formulas the model may shape the post with.
 * WHY:   Only the formulas that serve the goal are offered, so the prompt stays
 *        short and a "saves" post is never written as an emotional cold open.
 *        Formulas built on numbers, names or dates carry an explicit condition, so
 *        a formula is never a reason to invent a fact.
 * WHERE: generateLinkedInPost.
 */
function buildHookDirective(goal: PostGoal): string {
  const candidates = HOOK_FORMULA_KEYS.filter(
    (key) => goal === "any" || HOOK_FORMULAS[key].goals.includes(goal),
  );
  return [
    `Goal: ${POST_GOAL_DIRECTIVES[goal]}`,
    "Shape the post with exactly one of these hook formulas, whichever the topic's real facts fit best:",
    ...candidates.map((key) => {
      const formula = HOOK_FORMULAS[key];
      const condition = formula.needsSpecifics
        ? " Use it only if the topic gives the real specifics it needs."
        : "";
      return `- ${key} (${formula.label}): ${formula.shape}${condition}`;
    }),
  ].join("\n");
}

/**
 * SOURCE OF TRUTH KEYWORDS: generateLinkedInPost
 *
 * WHAT:  Turns a topic (or a blog URL to repurpose) into publish-ready copy,
 *        shaped by the member's goal, with alternative opening lines for topics.
 * WHY:   Both composer modes converge here so tone, length, goal and the
 *        validation of model output live in one place.
 *
 *        A topic post is one structured call that returns the formula used, the
 *        post and two alternative first lines, so hook options cost nothing
 *        extra. The blog path needs the vendor's web-fetch tool to read the
 *        article, and a tool call cannot share a request with structured output
 *        on every vendor, so a blog post is written as plain text and comes back
 *        without alternatives. The member's voice, when active, is appended last
 *        so tone still wins.
 * WHERE: Called by aiGeneration.create.
 */
export async function generateLinkedInPost(
  input: WritePostValues,
  voice: ResolvedVoice | null = null,
): Promise<GeneratedPost> {
  const brief = [
    `Tone: ${TONE_DIRECTIVES[input.tone]}`,
    `Length: ${LENGTH_DIRECTIVES[input.length]}`,
    "",
    buildHookDirective(input.goal),
  ].join("\n");

  if (input.source === "blog") {
    const commentary = await generateText({
      system: LINKEDIN_POST_SYSTEM_PROMPT,
      prompt: `Read the article at ${input.blogUrl} and rewrite its central insight as an original LinkedIn post. Do not summarize section by section: pick the single most useful idea and make the post about that. Do not include the URL in the post.\n\n${brief}${buildVoiceDirective(voice)}`,
      allowWebFetch: true,
    });

    /* Model output is untrusted input. Parsing here means an over-long post
     * surfaces as a local validation error rather than a remote
     * FIELD_LENGTH_TOO_LONG from LinkedIn after the user hits Publish. */
    return generatedPostSchema.parse({
      commentary,
      formula: null,
      alternativeOpenings: [],
    });
  }

  const result = await generateStructured({
    system: LINKEDIN_POST_SYSTEM_PROMPT,
    prompt: [
      "Write a LinkedIn post about the following.",
      "",
      "Topic:",
      input.topic,
      "",
      brief,
      "",
      "Return:",
      "- formula: the key of the formula the post uses.",
      "- commentary: the post.",
      `- alternativeOpenings: exactly ${POST_ALTERNATIVE_OPENINGS} other first lines for this same post, each written with a different formula from the list than the post uses. Each is a single line that follows the hook rules, could replace the post's first line, and uses only facts from the topic.`,
    ].join("\n") + buildVoiceDirective(voice),
    schema: postWithOpeningsSchema,
  });

  return generatedPostSchema.parse(result);
}

/**
 * SOURCE OF TRUTH KEYWORDS: LINKEDIN_POST_EDITOR_SYSTEM_PROMPT, fixLinkedInPost,
 *   Fix it, post check fix, over-correction guard
 *
 * WHAT:  Edits an existing post so the problems the post check found are gone.
 * WHY:   An editor, not a writer: the post may be the member's own words, so the
 *        rule that matters most is to change only what was flagged. The
 *        over-correction guard comes from the humanizer in linkedin-skills: a
 *        clean sentence is left alone, and nothing is ever added that the author
 *        did not write (no facts, hedges or confessions).
 *
 *        Only issue CODES arrive from the client. The wording of each problem
 *        comes from POST_CHECK_RULES on the server, so the instructions the model
 *        receives are always the app's own, and exactly what the member read.
 * WHERE: Called by aiGeneration.create when the source is "fix".
 */
const LINKEDIN_POST_EDITOR_SYSTEM_PROMPT = `You edit a LinkedIn post so it passes a pre-publish check, changing as little as possible.

Output:
- Return ONLY the edited post text. No preamble, no notes about what changed, no surrounding quotes.
- Never use markdown. LinkedIn renders **bold** and # headings as literal characters.

How to edit:
- Fix the listed problems and nothing else. Leave every sentence that has none of the listed problems exactly as it is.
- Keep the author's meaning, claims, opinions, names, numbers and voice, including quirks such as lowercase sentence starts.
- Never add facts, numbers, names, dates, hedges, confessions or announcements of honesty that are not already in the post. If a fix would need a fact the post does not contain, improve the wording without it.
- If you remove a link, keep one short line saying the link is in the first comment.
- Keep the layout: short paragraphs separated by a blank line.

Rules the edited post must follow:
${LINKEDIN_HOOK_RULES}
${LINKEDIN_LANGUAGE_RULES}
- At most ${POST_HASHTAG_MAX} hashtags, on their own final line.`;

export async function fixLinkedInPost(
  input: FixPostValues,
  voice: ResolvedVoice | null = null,
): Promise<GeneratedPost> {
  const codes = [...new Set(input.issues)];

  const prompt = [
    "PROBLEMS TO FIX:",
    ...codes.map(
      (code) => `- ${POST_CHECK_RULES[code].title}. ${POST_CHECK_RULES[code].fix}`,
    ),
    "",
    `Tone to keep: ${TONE_DIRECTIVES[input.tone]}`,
    /* A fix must not grow or shrink the post unless its length was the problem. */
    codes.includes("lengthOutOfRange")
      ? `Target length: ${LENGTH_DIRECTIVES[input.length]}`
      : "Keep roughly the same length.",
    "",
    "POST:",
    input.commentary,
  ].join("\n");

  const commentary = await generateText({
    system: LINKEDIN_POST_EDITOR_SYSTEM_PROMPT,
    prompt: `${prompt}${buildVoiceDirective(voice)}`,
  });

  /* A fix keeps the post's shape but may rewrite its opening, so it reports no
   * formula and offers no alternatives. */
  return generatedPostSchema.parse({
    commentary,
    formula: null,
    alternativeOpenings: [],
  });
}

/**
 * SOURCE OF TRUTH KEYWORDS: IDEA_ANGLES_SYSTEM_PROMPT, expandPostIdea, expand
 *   idea, idea angles
 *
 * WHAT:  Turns one rough saved idea into a few specific angles the member could
 *        write today.
 * WHY:   A vague idea ("docker cache") is the main reason ideas sit unused. Each
 *        angle carries a topic brief the post generator can write from directly,
 *        a sample first line, and the hook formula behind it, so an angle drops
 *        straight into the rest of the pipeline.
 *
 *        The one thing it may not do is fill in the member's facts. Anything an
 *        angle needs but the idea lacks goes in `needs` as a request ("add how
 *        long deploys took before"), the same never-invent rule every generator
 *        here follows. The hook and language rules are the shared blocks, so a
 *        sample first line obeys what the post check enforces.
 * WHERE: Called by ideaAngles.create.
 */
const IDEA_ANGLES_SYSTEM_PROMPT = `You help a LinkedIn creator turn a rough post idea into specific angles they could write today.

Rules:
- Return exactly ${IDEA_ANGLES_COUNT} angles. Each must be genuinely different: a different claim, story or audience, and a different hook formula.
- title: a short label for the angle, under 10 words.
- topic: one to three sentences describing the specific post to write, in the creator's first person. It is the brief a post will be written from.
- openingLine: a sample first line for that post.
- formula: the key of the hook formula the angle uses, from the list below.
- needs: the one concrete detail the creator should add to make the angle land (a number, a date, a name, what happened), or an empty string if the idea already has it.
- Use only facts that are in the idea. Never invent numbers, names, dates, clients or results. Ask for them in "needs" instead.

Rules for the opening line:
${LINKEDIN_HOOK_RULES}

Language rules:
${LINKEDIN_LANGUAGE_RULES}

Hook formulas:
${HOOK_FORMULA_KEYS.map((key) => `- ${key} (${HOOK_FORMULAS[key].label}): ${HOOK_FORMULAS[key].shape}`).join("\n")}`;

export async function expandPostIdea(
  text: string,
  voice: ResolvedVoice | null = null,
): Promise<IdeaAngles> {
  const result = await generateStructured({
    system: IDEA_ANGLES_SYSTEM_PROMPT,
    prompt: `IDEA:\n${text}${buildVoiceDirective(voice)}`,
    schema: ideaAnglesSchema,
  });

  return ideaAnglesSchema.parse(result);
}

/**
 * SOURCE OF TRUTH KEYWORDS: PROFILE_ANALYSIS_SYSTEM_PROMPT
 *
 * WHAT:  The persona and hard rules for profile critique.
 * WHY:   Generic profile advice ("add keywords", "tell your story") is the
 *        default failure mode here — it reads as insight while being useless,
 *        and the user cannot act on it. Every rule below exists to force output
 *        the user can paste: rewrites instead of descriptions of rewrites,
 *        quotes from their actual text instead of invented achievements, and a
 *        score with stated reasoning so it isn't an arbitrary number.
 */
const PROFILE_ANALYSIS_SYSTEM_PROMPT = `You are a LinkedIn positioning strategist reviewing a real person's profile.

Hard rules:
- Every "fix" must be text the person can paste directly into their profile. Never describe what they should write — write it for them.
- Never invent facts. If a claim needs a number, a client name, or a result you were not given, leave a clearly marked placeholder like [X%] or [company] for them to fill in.
- Quote their actual words when explaining a problem, so the critique is verifiably about THEIR profile and not a template.
- Ban generic advice: "add more keywords", "be more authentic", "tell your story", "engage with your network", "optimize for the algorithm". If a sentence would apply to any profile, delete it.
- The headline rewrite must fit LinkedIn's 220-character limit and lead with the outcome the person delivers, not their job title alone.
- The About rewrite opens with a first line that works as a standalone hook, because LinkedIn truncates the rest behind "see more".
- Write in the person's own register. If their profile is plain and technical, do not return marketing copy.
- Score honestly against what a strong profile in their field looks like. Most real profiles land between 30 and 60; reserve 80+ for genuinely exceptional positioning. A flattering score is useless feedback.
- Tag every finding with the area it belongs to and how much it matters. "critical" is reserved for something actively costing the person opportunities; "polish" is a refinement, not a problem.
- Headline alternatives must be genuinely different angles — a different audience, a different outcome, a different proof point — not the same sentence reworded.`;

/**
 * SOURCE OF TRUTH KEYWORDS: buildProfilePrompt
 *
 * WHAT:  Assembles the user-facing half of the analysis prompt.
 * WHY:   Sections are labelled so a finding can be attributed back to the field
 *        it belongs to, and an EMPTY section is stated as absent rather than
 *        sent as an empty block — otherwise the model spends a finding slot on
 *        "you should add projects", which the user already knows and did not ask
 *        about. Entries are numbered by serializeProfileSection so a per-entry
 *        rewrite can name the role it replaces.
 */
function buildProfilePrompt(input: AnalyzeProfileValues): string {
  const sections = PROFILE_SECTION_ENTRIES.map(({ key, label }) => {
    const items = input.sections[key];
    return items.length > 0
      ? `\n\n${label.toUpperCase()} (${items.length}):\n${serializeProfileSection(items)}`
      : `\n\n(No ${label.toLowerCase()} provided — do not fault the profile for a section it was not given.)`;
  }).join("");

  return `Analyze this LinkedIn profile.\n\nHEADLINE:\n${input.headline}\n\nABOUT:\n${input.about}${sections}`;
}

/**
 * SOURCE OF TRUTH KEYWORDS: analyzeLinkedInProfile, AnalyzeProfileOptions
 *
 * WHAT:  Turns a profile into a structured, actionable critique.
 * WHY:   `deepInsights` decides what is ASKED FOR, not what is displayed. When
 *        the org's plan does not include profileDeepInsights the per-section
 *        rewrites are omitted from the schema entirely, so the model never
 *        generates them — a locked analysis genuinely costs fewer output tokens
 *        rather than paying for text the UI then hides. The result is parsed
 *        back through the full profileAnalysisSchema either way, so both
 *        branches return the same total type and `sectionInsights` lands as an
 *        empty array rather than as a missing key.
 * WHERE: Called by profileAnalysis.create, which resolves the flag.
 */
export interface AnalyzeProfileOptions {
  /** True when the plan includes per-role and per-project rewrites. */
  deepInsights: boolean;
}

export async function analyzeLinkedInProfile(
  input: AnalyzeProfileValues,
  options: AnalyzeProfileOptions,
): Promise<ProfileAnalysis> {
  /* Only sections the user actually supplied are worth asking about — the model
   * cannot rewrite roles it was never given, and naming an empty section in the
   * instruction reliably produces invented entries. */
  const deepSections = options.deepInsights
    ? DEEP_INSIGHT_SECTIONS.filter((key) => input.sections[key].length > 0)
    : [];

  const prompt = buildProfilePrompt(input);

  if (deepSections.length === 0) {
    const base = await generateStructured({
      system: PROFILE_ANALYSIS_SYSTEM_PROMPT,
      prompt,
      schema: profileAnalysisSchema.omit({ sectionInsights: true }),
    });
    return profileAnalysisSchema.parse(base);
  }

  const sectionNames = deepSections
    .map((key) => PROFILE_SECTIONS[key].label)
    .join(" and ");

  /* `sectionInsights` is defaulted on the storage schema so old rows still
   * parse — which also makes it OPTIONAL in the JSON schema handed to the model,
   * and an optional array is one the model will happily omit. Overridden to
   * required here so the branch that paid for these sections actually receives
   * them, while the storage contract stays lenient. */
  const result = await generateStructured({
    system: PROFILE_ANALYSIS_SYSTEM_PROMPT,
    prompt: `${prompt}\n\nAlso critique ${sectionNames}. For each, return one verdict and a rewritten version of the entries worth rewriting — set "target" to the exact title of the entry you are replacing, copied from the list above. Only cover ${sectionNames}; leave every other section out.`,
    schema: profileAnalysisSchema.extend({
      sectionInsights: sectionInsightSchema
        .array()
        .min(1)
        .max(deepSections.length),
    }),
  });
  return profileAnalysisSchema.parse(result);
}

/**
 * SOURCE OF TRUTH KEYWORDS: serializeFetchedProfile
 *
 * WHAT:  A looked-up profile rendered as the prose the model reads.
 * WHY:   Shared by both content-plan tasks below so the brief and the strategy
 *        are demonstrably reading the same profile — a second serializer would
 *        eventually describe it differently and the two outputs would start
 *        disagreeing about the same person. Empty sections are stated as absent
 *        rather than sent as blank blocks, for the reason buildProfilePrompt
 *        documents: an empty labelled block reliably produces invented entries.
 * WHERE: buildProfileBriefPrompt and buildContentPlanPrompt.
 */
function serializeFetchedProfile(profile: FetchedProfile): string {
  const sections = PROFILE_SECTION_ENTRIES.map(({ key, label }) => {
    const items = profile.sections[key];
    return items.length > 0
      ? `\n\n${label.toUpperCase()} (${items.length}):\n${serializeProfileSection(items)}`
      : "";
  }).join("");

  const name = profile.name ? `NAME:\n${profile.name}\n\n` : "";
  return `${name}HEADLINE:\n${profile.headline}\n\nABOUT:\n${profile.about}${sections}`;
}

/**
 * SOURCE OF TRUTH KEYWORDS: PROFILE_BRIEF_SYSTEM_PROMPT
 *
 * WHAT:  The persona and hard rules for the read-back shown before the questions.
 * WHY:   This runs BEFORE the app knows the user's goal, niche or audience, so
 *        it must not pretend to give strategy — it has none of the inputs a
 *        strategy needs. Its only job is to prove the profile was actually read,
 *        which is what makes the questions that follow feel worth answering.
 *        The rules exist to stop it drifting into the full critique that profile
 *        analysis already sells: no scores, no rewrites, no fix lists.
 */
const PROFILE_BRIEF_SYSTEM_PROMPT = `You are reading a real person's LinkedIn profile and telling them what stands out, in a few lines, before asking them what they want to achieve.

Hard rules:
- Return 2 to 4 observations. Fewer, sharper points beat a list.
- Each observation must cite something specific from THIS profile — a role, a project, a phrase from their About, a pattern across their work. If a sentence would apply to any profile, delete it.
- Name the differentiator: the thing this person has that most people in their field do not. That is the most useful thing you can tell them here.
- You may name one weakness, but state it as an observation, not a fix. The strategy that follows is where fixes belong.
- Never invent facts. If the profile does not say it, you do not know it.
- No score, no rating, no rewritten headline, no numbered action list.
- Write to them directly as "you". Plain sentences, no markdown, no emoji.`;

/**
 * SOURCE OF TRUTH KEYWORDS: generateProfileBrief
 *
 * WHAT:  The short "Profile Insights" read-back that opens a content-plan session.
 * WHY:   Deliberately a separate, small call rather than a slice of the strategy
 *        generation: it has to render immediately after the URL is pasted, while
 *        the user still has three questions to answer, so it cannot wait on
 *        inputs that do not exist yet.
 * WHERE: Called by contentPlan.brief.
 */
export async function generateProfileBrief(
  profile: FetchedProfile,
): Promise<ContentPlanInsights> {
  /* `bullets` is defaulted on the storage schema so a stored brief always parses
   * — which also makes it optional in the JSON schema handed to the model, and
   * an optional array is one the model will happily omit. Required here so the
   * call that was made actually returns something, then parsed back through the
   * lenient schema so both paths produce the same type. Same arrangement as
   * `sectionInsights` above.
   *
   * `.min(1)`, not `.min(2)`: how MANY observations is prompt guidance, because
   * a run that comes back with one good one is still worth showing rather than
   * discarding. The `.max(4)` ceiling rides along through `.unwrap()`. */
  const result = await generateStructured({
    system: PROFILE_BRIEF_SYSTEM_PROMPT,
    prompt: `Read this LinkedIn profile and tell the person what stands out.\n\n${serializeFetchedProfile(profile)}`,
    schema: contentPlanInsightsSchema.extend({
      bullets: contentPlanInsightsSchema.shape.bullets.unwrap().min(1),
    }),
  });

  return contentPlanInsightsSchema.parse(result);
}

/**
 * SOURCE OF TRUTH KEYWORDS: CONTENT_PLAN_MAX_TOKENS, CONTENT_PLAN_TIMEOUT_MS
 *
 * WHAT:  The output budget and time ceiling for one content-plan generation.
 * WHY:   Local to this task rather than raised globally: AI_MAX_TOKENS is 4096
 *        because a LinkedIn post caps at 3000 characters, and lifting it for
 *        everything would quietly enlarge every other call's worst case.
 *
 *        16k covers the schema's maxima (~5.5k tokens of JSON at the ceiling)
 *        several times over, which matters because on providers with thinking
 *        enabled the reasoning draws on the same budget. Overshooting costs
 *        nothing — output is billed on tokens produced, not on the ceiling.
 * WHERE: generateContentPlan. Paired with txTimeout on contentPlan.create,
 *        which must exceed CONTENT_PLAN_TIMEOUT_MS.
 */
const CONTENT_PLAN_MAX_TOKENS = 16_000;
const CONTENT_PLAN_TIMEOUT_MS = 90_000;

/**
 * SOURCE OF TRUTH KEYWORDS: CONTENT_PLAN_SYSTEM_PROMPT
 *
 * WHAT:  The persona and hard rules for generating a posting strategy.
 * WHY:   The default failure mode here is a plan that could belong to anyone —
 *        "post consistently, share your journey, engage with your network" — which
 *        reads as a strategy while being unusable. Every rule below forces the
 *        output back onto THIS person's material: hooks about their actual
 *        projects, pillars drawn from their actual stack, a calendar that ships
 *        things they have already built.
 *
 *        The volume ceilings are not style preferences. Ten sections in one
 *        structured response is the largest generation in the app and it runs
 *        inside the procedure's transaction, so an unbounded calendar or idea
 *        bank is a timeout, not just a long read.
 */
const CONTENT_PLAN_SYSTEM_PROMPT = `You are a LinkedIn content strategist building a 30-day plan for one real person, using their actual profile and the goals they just told you.

Hard rules:
- Everything must be traceable to THIS profile. Name their real projects, employers, stack and skills. A plan that would work for any person in their field is a failed plan.
- Never invent facts, metrics, employers or results. Where a number would strengthen a post, leave a marked placeholder like [X%] or [company] for them to fill in.
- The positioning section must contain text they can paste: a rewritten headline inside LinkedIn's 220-character limit, and the shape of a rewritten About opening with a standalone hook. Write it for them; never describe what they should write.
- Audience entries describe people who can actually give them what they asked for (the hiring manager, the buyer, the peer), including where those people already are and what they care about. Not demographics.
- Content pillars are recurring themes they could post against every week for a month without running dry. Three to five. Each needs a title and a sentence on what belongs under it.
- The calendar covers four weeks. Each week gets one focus and the specific formats to ship. Weekly, not daily: a day-by-day plan is one they abandon by Thursday.
- Post ideas and hooks must be specific enough to draft from immediately. "Share a project" is not an idea; naming their project and the angle is.
- Hooks are opening lines only, and each must earn the second line without clickbait. Every hook follows these rules:
${LINKEDIN_HOOK_RULES}
- Return every section. Aim for: 2-4 audience entries, 3-5 formats, 3-5 pillars, exactly 4 calendar weeks, 5-6 post ideas, 5-6 hooks, 2-3 CTAs, 2-4 gaps.
- Posting strategy covers cadence, timing, and what they do around a post: engaging before and after, replying, what to pin. Concrete numbers, not "be consistent".
- Gap analysis names what is holding the CURRENT profile back, quoting their own words. Observations about this profile, never generic advice.
- No markdown anywhere. LinkedIn renders it literally, and these strings are shown and copied as plain text.
${LINKEDIN_LANGUAGE_RULES}`;

/**
 * SOURCE OF TRUTH KEYWORDS: buildContentPlanPrompt
 *
 * WHAT:  Assembles the user-facing half of the strategy prompt.
 * WHY:   The answers come first and the profile second, deliberately: the goal
 *        and audience are what the plan is FOR, and putting them ahead of a long
 *        profile dump keeps the model from writing a plan about the profile and
 *        bolting the goal on at the end. Answers are labelled from the step
 *        registry, so a reworded question reaches the model in the same words
 *        the user saw.
 */
function buildContentPlanPrompt(
  answers: ContentPlanAnswers,
  profile: FetchedProfile,
): string {
  return `Build a 30-day LinkedIn content plan for this person.

WHAT THEY TOLD YOU:
${serializeContentPlanAnswers(answers)}

THEIR PROFILE:
${serializeFetchedProfile(profile)}`;
}

/**
 * SOURCE OF TRUTH KEYWORDS: generateContentPlan
 *
 * WHAT:  Turns a profile plus the chat answers into the full posting strategy.
 * WHY:   Every array on contentPlanResultSchema is `.default([])` so that a saved
 *        plan keeps parsing when a section is added later — and that leniency is
 *        exactly wrong to send to the model, which reads an optional array as
 *        permission to skip the section. The schema handed over here re-requires
 *        each one with a realistic minimum, then the answer is parsed back
 *        through the lenient storage schema. One declaration still governs both;
 *        the strictness differs only in the direction it needs to.
 * WHERE: Called by contentPlan.create.
 */
export async function generateContentPlan(
  answers: ContentPlanAnswers,
  profile: FetchedProfile,
  voice: ResolvedVoice | null = null,
): Promise<ContentPlanResult> {
  const result = await generateStructured({
    system: CONTENT_PLAN_SYSTEM_PROMPT,
    /* The voice shapes how hooks, ideas and CTAs are WORDED, never what the
     * strategy recommends, so its scope is stated right after the block. */
    prompt: voice
      ? `${buildContentPlanPrompt(answers, profile)}${buildVoiceDirective(voice)}\nApply this voice only to the wording of hooks, post ideas and CTAs. It does not change what the strategy recommends.`
      : buildContentPlanPrompt(answers, profile),
    /* Ten sections at once. The 4096 global is sized for a single LinkedIn post
     * and truncates this mid-object, which the SDK reports as a schema mismatch
     * rather than as the budget overrun it is. Sized to clear the schema's own
     * maxima with room for reasoning tokens on providers that think. */
    maxOutputTokens: CONTENT_PLAN_MAX_TOKENS,
    /* Correspondingly slower than a post. Must stay under the router's
     * txTimeout, which holds a Postgres connection for the whole call. */
    timeoutMs: CONTENT_PLAN_TIMEOUT_MS,
    /* Every array is re-required so the model cannot skip a section — a
     * `.default([])` reads to it as an optional field. The COUNTS, though, stay
     * in the system prompt rather than being enforced here: a hard `.min(5)` on
     * hooks means a run that returns four is discarded whole, and the org has
     * already paid for it. Guidance the model usually follows beats validation
     * that throws away work when it doesn't. The maxima come through `.unwrap()`
     * unchanged, so anything that passes here also passes the storage parse. */
    schema: contentPlanResultSchema.extend({
      targetAudience: contentPlanResultSchema.shape.targetAudience
        .unwrap()
        .min(1),
      contentFormats: contentPlanResultSchema.shape.contentFormats
        .unwrap()
        .min(1),
      contentPillars: contentPlanResultSchema.shape.contentPillars
        .unwrap()
        .min(1),
      calendar: contentPlanResultSchema.shape.calendar.unwrap().min(1),
      postIdeas: contentPlanResultSchema.shape.postIdeas.unwrap().min(1),
      hooks: contentPlanResultSchema.shape.hooks.unwrap().min(1),
      ctas: contentPlanResultSchema.shape.ctas.unwrap().min(1),
      gaps: contentPlanResultSchema.shape.gaps.unwrap().min(1),
    }),
  });

  return contentPlanResultSchema.parse(result);
}

/**
 * SOURCE OF TRUTH KEYWORDS: CAROUSEL_SYSTEM_PROMPT
 *
 * WHAT:  The persona and hard rules for carousel slide copy.
 * WHY:   A carousel is not a post cut into pieces, and that is the failure mode
 *        every rule here exists to stop. Slides are read at a glance while
 *        swiping, so a heading that needs a second pass has already lost the
 *        reader. The character ceilings are not style advice — they are the point
 *        at which the renderer overflows the page, so they are stated in the
 *        prompt AND enforced by the schema.
 */
const CAROUSEL_SYSTEM_PROMPT = `You write LinkedIn carousels: swipeable decks where each slide must land in about two seconds.

Structure:
- The FIRST slide is kind "cover": one promise that makes someone stop scrolling. No counter, no preamble. Its heading follows the hook rules below.
- The LAST slide is kind "cta": one specific ask. "Follow for more" is a wasted slide, so ask for something concrete. Never ask readers to comment a word to get something.
- Every slide between them is kind "content": exactly one idea each. If a slide needs "and", it is two slides.

Hook rules for the cover heading:
${LINKEDIN_HOOK_RULES}

Hard rules:
- headings are HEADLINES, not sentences. No trailing period. Under 90 characters, and shorter is better.
- body is at most 260 characters and may be empty. A cover usually needs no body.
- Never use markdown. No **bold**, no #, no bullet characters: the renderer draws text literally.
- No emoji.
${LINKEDIN_LANGUAGE_RULES}
- Be concrete. A name or a specific example beats an abstract claim on every single slide. Never invent numbers, names or results that are not in the topic.
- The deck must make one argument from start to finish. Slide 4 should depend on slide 3.
- Write in first person as a practitioner sharing what they actually know.`;

/**
 * SOURCE OF TRUTH KEYWORDS: generateCarouselSlides
 *
 * WHAT:  Turns a topic into an ordered deck of slides.
 * WHY:   Copy only. The model never chooses the template, the page geometry or
 *        the slide count — those are the user's, and a model left to pick them
 *        drifts with the topic and makes two runs of the same brief incomparable.
 *
 *        The schema handed to the model is STRICTER than the storage one, the same
 *        split generateContentPlan uses: `.length(slideCount)` pins the deck to
 *        what was asked for, because a model given a range returns the shortest
 *        end of it. It is then parsed back through carouselSlidesSchema, so one
 *        declaration still governs both and the strictness differs only in the
 *        direction it needs to.
 * WHERE: Called by carousel.create.
 */
export async function generateCarouselSlides(
  input: GenerateCarouselValues,
  voice: ResolvedVoice | null = null,
): Promise<CarouselSlides> {
  const toneDirective = TONE_DIRECTIVES[input.tone];
  const preset = CAROUSEL_PAGE_PRESETS[input.page];

  const result = await generateStructured({
    system: CAROUSEL_SYSTEM_PROMPT,
    prompt: [
      `Write a ${input.slideCount}-slide LinkedIn carousel about the following.`,
      ``,
      `Topic:`,
      input.topic,
      ``,
      `Tone: ${toneDirective}`,
      /* The geometry is stated because it changes the writing, not just the
       * drawing: a square slide has materially less vertical room than a 4:5 one,
       * so the same heading that breathes on portrait crowds on square. */
      `Slide shape: ${preset.label}. Keep headings short enough to sit comfortably in that shape.`,
      `Return exactly ${input.slideCount} slides: one "cover", ${input.slideCount - 2} "content", one "cta", in that order.`,
    ].join("\n") + buildVoiceDirective(voice),
    /* A whole deck in one object. The 4096 global is sized for a single post and
     * truncates this mid-array, which the SDK reports as a schema mismatch rather
     * than as the budget overrun it actually is. */
    maxOutputTokens: CAROUSEL_GENERATION_MAX_TOKENS,
    /* Must stay under the router's txTimeout, which holds a Postgres connection
     * open for the whole call. */
    timeoutMs: CAROUSEL_GENERATION_TIMEOUT_MS,
    /* The exact count is asked for in the PROMPT, not enforced in the schema.
     *
     * An earlier version pinned this with `.length(slideCount)` and that was
     * wrong for the reason generateContentPlan already documents: a hard count
     * means a run returning six slides instead of seven is discarded whole, and
     * the org has already paid for the tokens. Guidance the model usually
     * follows beats validation that throws away work when it doesn't — and a
     * six-slide deck is a deck the user can fix in the editor in two seconds,
     * whereas a rejected generation gives them nothing at all.
     *
     * The storage bounds still apply, so anything passing here also passes the
     * parse below. */
    schema: z.object({ slides: carouselSlidesSchema }),
  });

  return carouselSlidesSchema.parse(result.slides);
}

/**
 * SOURCE OF TRUTH KEYWORDS: VOICE_EXTRACTION_SYSTEM_PROMPT
 *
 * WHAT:  The persona and hard rules for reading a voice out of someone's posts.
 * WHY:   The default failure here is flattery dressed as analysis: "authentic,
 *        engaging, professional" describes everyone and gives a generator nothing
 *        to imitate. Every rule forces an observation that is visible in the text
 *        and specific enough to copy, plus an honest confidence when the text is
 *        thin.
 */
const VOICE_EXTRACTION_SYSTEM_PROMPT = `You are a writing analyst. You read a person's real LinkedIn posts and describe HOW they write, precisely enough that another writer could imitate them.

Hard rules:
- Describe style, never subject matter. What they write about is irrelevant; how they write it is the whole job.
- Every observation must be visible in the posts. If you cannot point to it, leave it out.
- Ban empty labels such as "authentic", "engaging", "relatable", "thought-provoking" and "inspiring". If a sentence would describe anyone, delete it.
- Every opening and closing pattern needs an example copied exactly from the posts.
- Signature phrases are expressions this person actually repeats or clearly favours, copied word for word. Never invent one. An empty list is a correct answer.
- Avoided words are common LinkedIn buzzwords this person never uses. Only list words you are confident are deliberately absent.
- averageSentenceWords is your honest estimate across all the posts.
- hashtagCount is the number they typically use per post, 0 if they usually use none.
- confidence runs from 0 to 1 and reflects how much writing you had and how consistent it was. A few short or inconsistent posts must score low.
- The summary is two or three plain sentences the person would recognise as themselves. No markdown, no emoji.`;

/**
 * SOURCE OF TRUTH KEYWORDS: buildVoiceSamplesPrompt
 *
 * WHAT:  The member's posts rendered as the prose the extractor reads.
 * WHY:   Numbered and separated so a pattern can be attributed to the posts it
 *        recurs across, rather than blurred into one block the model reads as a
 *        single long post.
 * WHERE: extractVoiceProfile.
 */
function buildVoiceSamplesPrompt(samples: readonly VoiceSample[]): string {
  const posts = samples
    .map((sample, index) => `POST ${index + 1}:\n${sample.text}`)
    .join("\n\n---\n\n");
  return `Describe how this person writes, using these ${samples.length} posts.\n\n${posts}`;
}

/**
 * SOURCE OF TRUTH KEYWORDS: extractVoiceProfile
 *
 * WHAT:  Turns a member's posts into a structured voice descriptor.
 * WHY:   The strict-for-model, lenient-for-storage split generateContentPlan
 *        documents. The stored arrays are `.default([])`, which the model reads
 *        as optional and skips, so they are re-required on the copy sent here:
 *        opening patterns need at least one (every post opens somehow), while the
 *        other lists may legitimately be empty and are only made required. The
 *        result is then parsed back through the lenient schema, so both paths
 *        return the same type.
 * WHERE: Called by voiceProfile.create.
 */
export async function extractVoiceProfile(
  samples: readonly VoiceSample[],
): Promise<VoiceDescriptor> {
  const { vocabulary, openingPatterns, closingPatterns } =
    voiceDescriptorSchema.shape;

  const result = await generateStructured({
    system: VOICE_EXTRACTION_SYSTEM_PROMPT,
    prompt: buildVoiceSamplesPrompt(samples),
    /* A nested object after up to twenty posts of input. The 4096 global
     * truncates it mid-object on providers that think, which the SDK reports as
     * a schema mismatch rather than as the budget overrun it is. */
    maxOutputTokens: VOICE_EXTRACTION_MAX_TOKENS,
    /* Must stay under voiceProfile.create's txTimeout. */
    timeoutMs: VOICE_EXTRACTION_TIMEOUT_MS,
    schema: voiceDescriptorSchema.extend({
      vocabulary: vocabulary.extend({
        signaturePhrases: vocabulary.shape.signaturePhrases.unwrap(),
        avoidedWords: vocabulary.shape.avoidedWords.unwrap(),
      }),
      openingPatterns: openingPatterns.unwrap().min(1),
      closingPatterns: closingPatterns.unwrap(),
    }),
  });

  return voiceDescriptorSchema.parse(result);
}

/*

 */

import "server-only";

/**
 * SOURCE OF TRUTH KEYWORDS: generateText, generateStructured,
 *   generateLinkedInPost, analyzeLinkedInProfile, GenerateTextArgs,
 *   GenerateStructuredArgs, TONE_DIRECTIVES, LENGTH_DIRECTIVES,
 *   LINKEDIN_POST_SYSTEM_PROMPT, PROFILE_ANALYSIS_SYSTEM_PROMPT
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

import { generateText as generateWithModel, generateObject } from "ai";
import type { z } from "zod";

import {
  getAiModel,
  getAiProvider,
  AI_MAX_TOKENS,
  AI_MAX_RETRIES,
  AI_TIMEOUT_MS,
} from "@/lib/config/ai";
import {
  generatedPostSchema,
  type GeneratePostValues,
  type GeneratedPost,
  type PostTone,
  type PostLength,
} from "@/lib/types/ai";
import {
  profileAnalysisSchema,
  sectionInsightSchema,
  type AnalyzeProfileValues,
  type ProfileAnalysis,
} from "@/lib/types/profile-analysis";
import {
  DEEP_INSIGHT_SECTIONS,
  PROFILE_SECTIONS,
  PROFILE_SECTION_ENTRIES,
  serializeProfileSection,
} from "@/lib/config/profile-sections";

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
  if (result.finishReason === "content-filter") {
    throw new Error(
      "The AI declined this request. Try rewording your topic without sensitive or restricted content.",
    );
  }

  const text = result.text.trim();

  if (!text) {
    throw new Error(
      "The AI returned an empty response. Try again with a more specific topic.",
    );
  }

  return text;
}

export interface GenerateStructuredArgs<T> {
  system: string;
  prompt: string;
  /** Doubles as the model's output contract and the validation boundary. */
  schema: z.ZodType<T>;
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
}: GenerateStructuredArgs<T>): Promise<T> {
  const provider = getAiProvider();

  const { object } = await generateObject({
    model: getAiModel(),
    schema,
    maxOutputTokens: AI_MAX_TOKENS,
    providerOptions: provider.providerOptions,
    maxRetries: AI_MAX_RETRIES,
    timeout: AI_TIMEOUT_MS,
    system,
    prompt,
  });

  return object;
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

const LENGTH_DIRECTIVES: Record<PostLength, string> = {
  short: "Roughly 50-80 words. One tight idea, nothing more.",
  medium:
    "Roughly 120-180 words. A hook, two or three beats of substance, and a close.",
  long: "Roughly 250-350 words. Room to develop the argument, still scannable.",
};

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
- Write in first person. The reader should believe a person typed this.`;

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
export async function generateLinkedInPost(
  input: GeneratePostValues,
): Promise<GeneratedPost> {
  const toneDirective = TONE_DIRECTIVES[input.tone];
  const lengthDirective = LENGTH_DIRECTIVES[input.length];

  const task =
    input.source === "topic"
      ? `Write a LinkedIn post about the following.\n\nTopic:\n${input.topic}`
      : `Read the article at ${input.blogUrl} and rewrite its central insight as an original LinkedIn post. Do not summarize section by section — pick the single most useful idea and make the post about that. Do not include the URL in the post.`;

  const commentary = await generateText({
    system: LINKEDIN_POST_SYSTEM_PROMPT,
    prompt: `${task}\n\nTone: ${toneDirective}\nLength: ${lengthDirective}`,
    allowWebFetch: input.source === "blog",
  });

  /* Model output is untrusted input. Parsing here means an over-long post
   * surfaces as a local validation error rather than a remote
   * FIELD_LENGTH_TOO_LONG from LinkedIn after the user hits Publish. */
  return generatedPostSchema.parse({ commentary });
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

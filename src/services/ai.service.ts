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
import type { FetchedProfile } from "@/lib/types/profile-lookup";
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
- Audience entries describe people who can actually give them what they asked for — the hiring manager, the buyer, the peer — including where those people already are and what they care about. Not demographics.
- Content pillars are recurring themes they could post against every week for a month without running dry. Three to five. Each needs a title and a sentence on what belongs under it.
- The calendar covers four weeks. Each week gets one focus and the specific formats to ship. Weekly, not daily — a day-by-day plan is one they abandon by Thursday.
- Post ideas and hooks must be specific enough to draft from immediately. "Share a project" is not an idea; naming their project and the angle is.
- Hooks are opening lines only. They must earn the second line without clickbait or rhetorical-question openers.
- Return every section. Aim for: 2-4 audience entries, 3-5 formats, 3-5 pillars, exactly 4 calendar weeks, 5-6 post ideas, 5-6 hooks, 2-3 CTAs, 2-4 gaps.
- Posting strategy covers cadence, timing, and what they do around a post — engaging before and after, replying, what to pin. Concrete numbers, not "be consistent".
- Gap analysis names what is holding the CURRENT profile back, quoting their own words. Observations about this profile, never generic advice.
- No markdown anywhere. LinkedIn renders it literally, and these strings are shown and copied as plain text.
- Avoid "delve", "leverage", "unlock", "game-changer", "supercharge", and em dashes.`;

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
): Promise<ContentPlanResult> {
  const result = await generateStructured({
    system: CONTENT_PLAN_SYSTEM_PROMPT,
    prompt: buildContentPlanPrompt(answers, profile),
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

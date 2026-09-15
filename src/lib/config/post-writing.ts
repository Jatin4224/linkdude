/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: LinkedIn writing rules, AI tells, AI_TELL_WORDS,
 *   AI_TELL_PHRASES, REVEAL_BRIDGES, SINCERITY_OPENERS, ANNOUNCEMENT_OPENERS,
 *   HOOK_OPENER_TELLS, GENERIC_CLOSERS, POST_HASHTAG_MAX,
 *   POST_HOOK_MOBILE_CHARS, humanizer, post audit, linkedin-skills
 *
 * WHAT:  The vocabulary of LinkedIn copy that reads as machine-written or costs
 *        reach (words, phrases, openers, closers), plus the hashtag and hook
 *        limits every generated post is held to.
 * WHY:   One list, two readers. The generators' system prompts quote these lists
 *        so the model avoids them, and the post checker matches drafts against
 *        the same lists, so what the AI is told to avoid and what the checker
 *        flags can never disagree.
 *
 *        Adapted from sergebulaev/linkedin-skills (MIT, commit a472ef4,
 *        September 2026): the humanizer's audit-ai-tells.md and scrub-rules.md,
 *        and the post writer's hook rules. Condensed on purpose, because their
 *        full reference files run to tens of thousands of tokens, which would be
 *        paid on every generation. Their reach percentages are vendor data and
 *        are never shown to users as fact. See THIRD_PARTY_NOTICES.md.
 *
 *        Plain data with no server imports, so a browser-side checker can use it.
 * WHERE: ai.service.ts (post, carousel and content-plan prompts); the post
 *        checker.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: AI_TELL_WORDS
 *
 * WHAT:  Words models over-select at several times the human rate.
 * WHY:   Readers cite vocabulary first when they spot AI text. Each word is
 *        ordinary English, so a checker should score them by density (several in
 *        one paragraph), never flag a single use. The generators simply avoid
 *        them. Forms of a word ("leveraging", "fostered") count as the word.
 */
export const AI_TELL_WORDS = [
  /* The durable 2026 set. */
  "significant",
  "crucial",
  "notably",
  "particularly",
  "comprehensive",
  "insights",
  "robust",
  "leverage",
  "foster",
  "landscape",
  "nuanced",
  "multifaceted",
  "holistic",
  "streamline",
  "elevate",
  "empower",
  /* Older corporate verbs, still cited by readers. */
  "utilize",
  "facilitate",
  "harness",
  "unlock",
  "navigate",
  "seamless",
  "ecosystem",
  "supercharge",
  /* Filler adverbs. */
  "fundamentally",
  "essentially",
  "ultimately",
  "crucially",
  /* Words that became model idiom on LinkedIn. */
  "quietly",
  "compound",
  "load-bearing",
  /* The fading 2023-24 set. */
  "delve",
  "tapestry",
  "realm",
  "intricate",
  "paradigm",
  "journey",
] as const;

/**
 * SOURCE OF TRUTH KEYWORDS: AI_TELL_PHRASES
 *
 * WHAT:  Stock phrases that are a problem on a single use.
 */
export const AI_TELL_PHRASES = [
  "in today's fast-paced world",
  "in the age of AI",
  "game-changer",
  "deep dive",
  "at the end of the day",
  "move the needle",
  "needle-moving",
  "paradigm shift",
  "when it comes to",
  "the hard truth is",
  "doing the heavy lifting",
  "built different",
  "let that sink in",
  "that's the real story",
  "what nobody tells you",
  "what most people miss",
] as const;

/**
 * SOURCE OF TRUTH KEYWORDS: REVEAL_BRIDGES
 *
 * WHAT:  Lines that stage a reveal instead of stating it.
 * WHY:   Among the most-reported LinkedIn AI tells. The fix is always the same:
 *        delete the bridge and let the next sentence carry the point.
 */
export const REVEAL_BRIDGES = [
  "The result?",
  "The catch?",
  "The kicker?",
  "Plot twist:",
  "Here's what",
  "Here's how",
  "Here's why",
  "Here's the thing",
] as const;

/**
 * SOURCE OF TRUTH KEYWORDS: SINCERITY_OPENERS
 *
 * WHAT:  Announcements of candor.
 * WHY:   Performed sincerity reads as false vulnerability. A specific, dated fact
 *        stated flat carries the same weight without the frame.
 */
export const SINCERITY_OPENERS = [
  "Let me be honest",
  "I'll be real",
  "Honestly?",
  "To be direct",
  "Real talk",
  "Full transparency",
  "Unpopular opinion:",
  "Not gonna lie",
] as const;

/**
 * SOURCE OF TRUTH KEYWORDS: ANNOUNCEMENT_OPENERS
 *
 * WHAT:  Press-release openers.
 * WHY:   They read as PR rather than a person. The concrete moment that prompted
 *        the post is always the better first line.
 */
export const ANNOUNCEMENT_OPENERS = [
  "I'm excited to share",
  "I'm excited to announce",
  "I'm thrilled to share",
  "I'm thrilled to announce",
  "Honored to",
  "Delighted to",
] as const;

/**
 * SOURCE OF TRUTH KEYWORDS: HOOK_OPENER_TELLS
 *
 * WHAT:  First lines that lose the reader before "see more".
 */
export const HOOK_OPENER_TELLS = [
  "In today's",
  "Have you ever",
  "Most people don't realize",
  "Here's a hard truth",
] as const;

/**
 * SOURCE OF TRUTH KEYWORDS: GENERIC_CLOSERS
 *
 * WHAT:  Closing lines that ask for engagement without giving a reason to.
 * WHY:   A question that names the post's subject gets real replies; these get
 *        none and can read as engagement bait.
 */
export const GENERIC_CLOSERS = [
  "What do you think?",
  "Thoughts?",
  "Agree or disagree?",
  "Let me know in the comments",
  "Tag someone who needs this",
] as const;

/**
 * SOURCE OF TRUTH KEYWORDS: POST_HASHTAG_MAX, POST_HOOK_MOBILE_CHARS
 *
 * WHAT:  The most hashtags a post should carry, and how far into a post the
 *        mobile feed cuts to "see more".
 * WHY:   LinkedIn matches posts by meaning rather than by tag, so extra hashtags
 *        add nothing and five or more look like spam. The mobile cut (about 140
 *        characters, versus about 210 on desktop) is the stricter one, so the
 *        hook is written for it.
 */
export const POST_HASHTAG_MAX = 2;
export const POST_HOOK_MOBILE_CHARS = 140;

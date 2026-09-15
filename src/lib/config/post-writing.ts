/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: LinkedIn writing rules, AI tells, AI_TELL_WORDS,
 *   AI_TELL_PHRASES, REVEAL_BRIDGES, SINCERITY_OPENERS, ANNOUNCEMENT_OPENERS,
 *   HOOK_OPENER_TELLS, GENERIC_CLOSERS, POST_HASHTAG_MAX,
 *   POST_HOOK_MOBILE_CHARS, AI_TELL_EMOJI, POST_LENGTH_WORD_RANGES,
 *   POST_LENGTH_TOLERANCE, POST_CHECK_RULES, humanizer, post audit,
 *   linkedin-skills
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

import type { PostLength } from "@/lib/types/ai";
import type {
  PostCheckCode,
  PostCheckRule,
  PostWordRange,
} from "@/lib/types/post-check";
import { LINKEDIN_MAX_COMMENTARY } from "./linkedin";

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

/**
 * SOURCE OF TRUTH KEYWORDS: AI_TELL_EMOJI
 *
 * WHAT:  Emoji that show up several times more often in generated posts.
 * WHY:   One is fine and humans use them too. A cluster, or the same one
 *        repeated, is the pattern readers notice.
 */
export const AI_TELL_EMOJI = [
  "\u{1F4A1}",
  "\u{1F680}",
  "✨",
  "♻️",
  "\u{1F3AF}",
  "\u{1F4C8}",
  "\u{1F511}",
  "\u{1F4AA}",
  "\u{1F525}",
] as const;

/**
 * SOURCE OF TRUTH KEYWORDS: POST_LENGTH_WORD_RANGES, POST_LENGTH_TOLERANCE
 *
 * WHAT:  The word and character targets for each post length, and how far
 *        outside them the post check tolerates before it warns.
 * WHY:   The generator prompt and the post check read the same numbers. Medium
 *        matches the 900-1,300 character range LinkedIn posts perform best at.
 *        The tolerance exists because the targets are "roughly": a 230-word
 *        medium post is not worth a warning.
 */
export const POST_LENGTH_WORD_RANGES: Record<PostLength, PostWordRange> = {
  short: { minWords: 50, maxWords: 80, minChars: 300, maxChars: 500 },
  medium: { minWords: 150, maxWords: 220, minChars: 900, maxChars: 1300 },
  long: { minWords: 250, maxWords: 320, minChars: 1500, maxChars: 1900 },
};
export const POST_LENGTH_TOLERANCE = 0.2;

/**
 * SOURCE OF TRUTH KEYWORDS: POST_CHECK_RULES
 *
 * WHAT:  For every problem the post check can report: how serious it is, a short
 *        title, and how to fix it.
 * WHY:   One Record over POST_CHECK_CODES, so a new check without copy is a
 *        compile error. The same words are shown to the member AND sent to the
 *        model by Fix it, so what the member reads is exactly what gets fixed.
 *        Blockers are the single-use tells and algorithm problems; warnings are
 *        judgement calls.
 */
export const POST_CHECK_RULES: Record<PostCheckCode, PostCheckRule> = {
  tooLong: {
    severity: "blocker",
    title: "Over LinkedIn's limit",
    fix: `LinkedIn rejects posts over ${LINKEDIN_MAX_COMMENTARY.toLocaleString("en-US")} characters. Cut it down.`,
  },
  linkInBody: {
    severity: "blocker",
    title: "Link in the post",
    fix: "Posts with links are shown to fewer people. Put the link in the first comment and say so in the post.",
  },
  dashes: {
    severity: "blocker",
    title: "Too many dashes",
    fix: "Keep em dashes to about one per 100 words, and use a comma or colon instead of an en dash or double hyphen between clauses.",
  },
  questionOpener: {
    severity: "blocker",
    title: "Opens with a question",
    fix: "Question openers perform worst. Open with a statement or a specific number, and move the question to the end.",
  },
  weakOpener: {
    severity: "blocker",
    title: "Weak first line",
    fix: 'Openers like "In today\'s...", "Have you ever..." or "Stop X, start Y" lose readers before "see more". Open with the specific moment or number.',
  },
  announcementOpener: {
    severity: "blocker",
    title: "Reads like a press release",
    fix: 'Replace "I\'m excited to share" with the moment that prompted the post.',
  },
  sincerityMarker: {
    severity: "blocker",
    title: "Announces honesty",
    fix: 'Drop "Let me be honest" and similar lines. State the fact itself.',
  },
  allCapsLine: {
    severity: "blocker",
    title: "A line in all capitals",
    fix: "Carry the emphasis with word choice, not capital letters.",
  },
  revealBridge: {
    severity: "blocker",
    title: "Reveal line",
    fix: 'Delete lines like "The result?" or "Here\'s what" and let the next sentence make the point.',
  },
  negativeParallel: {
    severity: "blocker",
    title: '"It\'s not X, it\'s Y"',
    fix: "Say what it is directly, in plain sentences.",
  },
  genericCloser: {
    severity: "blocker",
    title: "Generic ending",
    fix: 'Endings like "What do you think?" get no replies. End with a specific question about this post\'s subject, or a clean final line.',
  },
  aiWordCluster: {
    severity: "blocker",
    title: "Paragraph full of AI-sounding words",
    fix: "One of these words is fine. Three in a paragraph reads machine-written, so rewrite that paragraph in plain words.",
  },
  hookTooLong: {
    severity: "warning",
    title: 'First line runs past "see more"',
    fix: `The mobile feed cuts off after about ${POST_HOOK_MOBILE_CHARS} characters. Get the point across before that.`,
  },
  lengthOutOfRange: {
    severity: "warning",
    title: "Length is off target",
    fix: "Bring it closer to the length you picked.",
  },
  tooManyHashtags: {
    severity: "warning",
    title: `More than ${POST_HASHTAG_MAX} hashtags`,
    fix: "LinkedIn matches posts by meaning, so extra hashtags add nothing. Keep the best one or two, at the end.",
  },
  aiPhrase: {
    severity: "warning",
    title: "Stock phrase",
    fix: 'Phrases like "game-changer" or "at the end of the day" read as filler. Say the specific thing instead.',
  },
  staccato: {
    severity: "warning",
    title: "Staccato fragments",
    fix: 'Join runs like "Short. Punchy. Done." and one-word paragraphs into full sentences.',
  },
  tooManyFragments: {
    severity: "warning",
    title: "Too many sentence fragments",
    fix: "Keep it to two short fragments at most, and turn the rest into full sentences.",
  },
  hedging: {
    severity: "warning",
    title: "Hedging",
    fix: 'Several "perhaps", "might" or "it seems" weaken the point. Commit to the claims you can back.',
  },
  emojiCluster: {
    severity: "warning",
    title: "AI-typical emoji",
    fix: "A cluster of emoji like these reads as generated. Keep one meaningful emoji, or none.",
  },
  commentGate: {
    severity: "warning",
    title: "Comment bait",
    fix: '"Comment X to get Y" is what LinkedIn now demotes. Ask a real question, or put the resource in the first comment.',
  },
  noSpecifics: {
    severity: "warning",
    title: "Nothing specific",
    fix: "Add a real detail: a number, a name, a date or a tool. Only what is true.",
  },
};

/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: checkPost, post check, Check my post, pre-publish
 *   audit, AI tells detector, hook check, PostCheckResult, PostCheckIssue
 *
 * WHAT:  Reads a LinkedIn draft and lists what would make it read as
 *        machine-written or lose readers: weak openers, reveal lines, clusters of
 *        AI-sounding words, links in the body, generic endings, and more.
 * WHY:   Deterministic and instant, so it runs in the browser as the member
 *        types, at no model cost. It matches against the same lists the
 *        generators are told to avoid (post-writing.ts), so a freshly generated
 *        post and the check agree.
 *
 *        Scoring follows the humanizer audit in linkedin-skills: ordinary
 *        AI-sounding words count only at density (three in one paragraph),
 *        because one "robust" is just English, while reveal lines and "It's not
 *        X, it's Y" are problems on a single use. It never estimates an
 *        AI-detector score.
 *
 *        Deliberately approximate: every check would rather miss an edge case
 *        than flag normal writing.
 * WHERE: PostCheckPanel. Its issue codes are sent to aiGeneration.create for
 *        Fix it.
 */

import { LINKEDIN_MAX_COMMENTARY } from "@/lib/config/linkedin";
import { POST_LENGTH_LABELS } from "@/lib/config/post-generation";
import {
  AI_TELL_EMOJI,
  AI_TELL_PHRASES,
  AI_TELL_WORDS,
  ANNOUNCEMENT_OPENERS,
  GENERIC_CLOSERS,
  HOOK_OPENER_TELLS,
  POST_CHECK_RULES,
  POST_HASHTAG_MAX,
  POST_HOOK_MOBILE_CHARS,
  POST_LENGTH_TOLERANCE,
  POST_LENGTH_WORD_RANGES,
  REVEAL_BRIDGES,
  SINCERITY_OPENERS,
} from "@/lib/config/post-writing";
import {
  POST_CHECK_CODES,
  type PostCheckCode,
  type PostCheckOptions,
  type PostCheckResult,
} from "@/lib/types/post-check";

/* Text pasted from other apps often carries a curly apostrophe. */
const APOSTROPHE = "['’]";

const HASHTAG_PATTERN = /(?:^|\s)#[\p{L}\p{N}_]+/gu;
const EMOJI_AND_SPACE_PATTERN = /[\p{Extended_Pictographic}️‍\s]/gu;
const LINK_PATTERN = /(?:https?:\/\/|www\.)\S+/i;
const SENTENCE_PATTERN = /[^.!?\n]+(?:[.!?]+|$)/gm;
const PS_PATTERN = /^p\.?\s?s\b/i;
const HEDGE_PATTERN = /\b(?:perhaps|it seems|might|could potentially|arguably)\b/gi;
const STOP_START_PATTERN = /^stop\b[^.\n]{0,60}\bstart\b/i;
const NOMINALISATION_PATTERN =
  /\bthe \w+(?:tion|sion|ment|ance|ence|ization|isation) of\b/gi;
const ING_OPENER_PATTERN = /(?:^|[.!?]\s+)[A-Z][a-z]+ing\b[^.!?\n]{0,60},/gm;
const ONE_WORD_PARAGRAPH_PATTERN = /^[\w'’]+[.!]$/;
const STACCATO_PATTERNS = [
  /* "Short. Punchy. Done." */
  /^(?:[\w'’]+[.!] ){2,}[\w'’]+[.!]$/m,
  /\bno \w+\. no \w+\. (?:just|only) \w+/i,
  /\ball (?:of )?the \w+\. none of the \w+/i,
];
const NEGATIVE_PARALLEL_PATTERNS = [
  new RegExp(
    `\\b(?:it${APOSTROPHE}?s|that${APOSTROPHE}?s|this is) not (?:just |about |only )?[^,.;\\n]{1,40}[,;] (?:it${APOSTROPHE}?s|but)\\b`,
    "i",
  ),
  new RegExp(
    `\\b(?:isn${APOSTROPHE}?t|aren${APOSTROPHE}?t|wasn${APOSTROPHE}?t) (?:just |about )?[^,.;\\n]{1,40}[,;] (?:it${APOSTROPHE}?s|they${APOSTROPHE}?re|but)\\b`,
    "i",
  ),
  new RegExp(`\\bthis isn${APOSTROPHE}?t [^.\\n]{1,40}\\. this is\\b`, "i"),
  /\bnot just [^,.;\n]{1,40}[,;] but\b/i,
];
const COMMENT_GATE_PATTERNS = [
  /* "Comment GUIDE" */
  /\bcomment\s+["'“‘]?[A-Z][A-Z0-9]+["'”’]?(?=[\s,.!]|$)/,
  /\b(?:comment|reply)\b[^.\n]{0,40}\b(?:and i'?ll|to get|for the)\b/i,
];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/* A phrase as a case-insensitive pattern that accepts either apostrophe and,
 * when it ends in a letter, does not match inside a longer word. */
function phraseRegExp(phrase: string, anchored: boolean): RegExp {
  const body = escapeRegExp(phrase).replace(/'/g, APOSTROPHE);
  const tail = /\w$/.test(phrase) ? "\\b" : "";
  return new RegExp(`${anchored ? "^" : "\\b"}${body}${tail}`, "i");
}

function findPhrase(
  text: string,
  phrases: readonly string[],
  anchored: boolean,
): string | null {
  return phrases.find((phrase) => phraseRegExp(phrase, anchored).test(text)) ?? null;
}

/* So "leveraging" and "insight" count as "leverage" and "insights". */
function wordStem(word: string): string {
  if (word.endsWith("ss")) return word;
  return word.endsWith("s") || word.endsWith("e") ? word.slice(0, -1) : word;
}

const AI_WORD_PATTERN = new RegExp(
  `\\b(?:${AI_TELL_WORDS.map((word) => escapeRegExp(wordStem(word))).join("|")})[\\w-]*`,
  "gi",
);

function countOccurrences(text: string, needle: string): number {
  return text.split(needle).length - 1;
}

/* A line of hashtags, even with emoji after them, holds no sentence. Without
 * this, "#ai #growth 🚀" would be read as the post's closing line and a generic
 * ending just above it would go unflagged. */
function isHashtagLine(line: string): boolean {
  return (
    /#[\p{L}\p{N}_]/u.test(line) &&
    line.replace(HASHTAG_PATTERN, "").replace(EMOJI_AND_SPACE_PATTERN, "") === ""
  );
}

function isAllCaps(line: string): boolean {
  if (isHashtagLine(line)) return false;
  const letters = line.replace(/[^A-Za-z]/g, "");
  return letters.length >= 10 && letters === letters.toUpperCase();
}

function firstMatch(patterns: readonly RegExp[], text: string): string | null {
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (match) return match[0];
  }
  return null;
}

/* A capitalised word that does not open its sentence, other than "I". */
function hasNamedEntity(sentences: readonly string[]): boolean {
  return sentences.some((sentence) =>
    sentence
      .split(/\s+/)
      .slice(1)
      .some((word) => {
        const bare = word.replace(/^["'“‘(]+/, "");
        return (
          /^[A-Z][\w'’-]*[a-z]/.test(bare) &&
          !/^I(?:['’]\w+)?$/.test(bare)
        );
      }),
  );
}

function summarise(
  found: ReadonlyMap<PostCheckCode, string>,
  wordCount: number,
): PostCheckResult {
  const issues = POST_CHECK_CODES.flatMap((code) => {
    const excerpt = found.get(code);
    return excerpt === undefined
      ? []
      : [{ code, severity: POST_CHECK_RULES[code].severity, excerpt }];
  }).sort(
    (a, b) =>
      Number(a.severity === "warning") - Number(b.severity === "warning"),
  );

  return {
    issues,
    blockerCount: issues.filter((issue) => issue.severity === "blocker").length,
    warningCount: issues.filter((issue) => issue.severity === "warning").length,
    wordCount,
  };
}

/**
 * SOURCE OF TRUTH KEYWORDS: checkPost
 *
 * WHAT:  Runs every check over a draft and returns the problems found, blockers
 *        first, each at most once.
 */
export function checkPost(
  text: string,
  options: PostCheckOptions = {},
): PostCheckResult {
  const found = new Map<PostCheckCode, string>();
  /* The first hit of each problem is the one shown. */
  const flag = (code: PostCheckCode, excerpt: string) => {
    if (!found.has(code)) found.set(code, excerpt.trim().slice(0, 120));
  };

  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return summarise(found, 0);

  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const bodyLines = lines.filter((line) => !isHashtagLine(line));
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  const sentences = (text.match(SENTENCE_PATTERN) ?? [])
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence && !isHashtagLine(sentence));
  const firstLine = bodyLines[0] ?? "";
  const closingLine =
    [...bodyLines].reverse().find((line) => !PS_PATTERN.test(line)) ?? "";

  /* ---- Blockers ---- */

  if (text.length > LINKEDIN_MAX_COMMENTARY) {
    flag("tooLong", `${text.length.toLocaleString("en-US")} characters`);
  }

  const link = LINK_PATTERN.exec(text);
  if (link) flag("linkInBody", link[0]);

  const emDashes = countOccurrences(text, "—");
  const emDashCap = Math.max(1, Math.min(2, Math.round(words.length / 100)));
  if (emDashes > emDashCap) {
    flag("dashes", `${emDashes} em dashes`);
  } else if (/\s–\s/.test(text)) {
    flag("dashes", "–");
  } else if (/\s--\s|\w--\w/.test(text)) {
    flag("dashes", "--");
  }

  /* A "?" before the first sentence ends. A question opener is already why the
   * first line is weak, so the same line is reported once, not twice. */
  if (/^[^.!\n]*\?/.test(firstLine)) {
    flag("questionOpener", firstLine);
  } else if (
    findPhrase(firstLine, HOOK_OPENER_TELLS, true) ||
    STOP_START_PATTERN.test(firstLine)
  ) {
    flag("weakOpener", firstLine);
  }

  for (const line of bodyLines.slice(0, 2)) {
    if (findPhrase(line, ANNOUNCEMENT_OPENERS, true)) {
      flag("announcementOpener", line);
    }
  }

  for (const line of bodyLines) {
    if (findPhrase(line, SINCERITY_OPENERS, true)) flag("sincerityMarker", line);
    if (findPhrase(line, REVEAL_BRIDGES, true)) flag("revealBridge", line);
    if (isAllCaps(line)) flag("allCapsLine", line);
  }

  const parallel = firstMatch(NEGATIVE_PARALLEL_PATTERNS, text);
  if (parallel) flag("negativeParallel", parallel);

  const closer = findPhrase(closingLine, GENERIC_CLOSERS, false);
  if (closer) {
    flag("genericCloser", closer);
  } else if (/\btag someone\b/i.test(text)) {
    flag("genericCloser", "Tag someone");
  }

  /* Density, never a single word: three markers in one paragraph. */
  for (const paragraph of paragraphs) {
    const markers = [
      ...(paragraph.match(AI_WORD_PATTERN) ?? []),
      ...(paragraph.match(NOMINALISATION_PATTERN) ?? []),
      ...(paragraph.match(ING_OPENER_PATTERN) ?? []).map(
        (opener) => opener.replace(/^[.!?\s]+/, "").split(" ")[0] ?? opener,
      ),
    ];
    if (markers.length >= 3) {
      flag("aiWordCluster", markers.slice(0, 4).join(", "));
      break;
    }
  }

  /* ---- Warnings ---- */

  if (firstLine.length > POST_HOOK_MOBILE_CHARS) {
    flag("hookTooLong", `${firstLine.length} characters`);
  }

  if (options.length) {
    const range = POST_LENGTH_WORD_RANGES[options.length];
    const floor = Math.round(range.minWords * (1 - POST_LENGTH_TOLERANCE));
    const ceiling = Math.round(range.maxWords * (1 + POST_LENGTH_TOLERANCE));
    if (words.length < floor || words.length > ceiling) {
      flag(
        "lengthOutOfRange",
        `${words.length} words. ${POST_LENGTH_LABELS[options.length]} aims for ${range.minWords}-${range.maxWords}.`,
      );
    }
  }

  const hashtags = text.match(HASHTAG_PATTERN) ?? [];
  if (hashtags.length > POST_HASHTAG_MAX) {
    flag("tooManyHashtags", hashtags.map((tag) => tag.trim()).join(" "));
  }

  const phrase = findPhrase(text, AI_TELL_PHRASES, false);
  if (phrase) flag("aiPhrase", phrase);

  const staccato = firstMatch(STACCATO_PATTERNS, text);
  const oneWordParagraph = paragraphs.find((paragraph) =>
    ONE_WORD_PARAGRAPH_PATTERN.test(paragraph),
  );
  if (staccato) {
    flag("staccato", staccato);
  } else if (oneWordParagraph) {
    flag("staccato", oneWordParagraph);
  }

  /* Under four words, ignoring a P.S. and abbreviation pieces such as "P." */
  const fragments = sentences.filter(
    (sentence) =>
      sentence.split(/\s+/).length < 4 &&
      !PS_PATTERN.test(sentence) &&
      sentence.replace(/[^\p{L}]/gu, "").length >= 3,
  );
  if (fragments.length > 2) {
    flag("tooManyFragments", fragments.slice(0, 3).join(" "));
  }

  const hedges = text.match(HEDGE_PATTERN) ?? [];
  if (hedges.length >= 3) flag("hedging", hedges.slice(0, 3).join(", "));

  const emoji = AI_TELL_EMOJI.map((symbol) => ({
    symbol,
    count: countOccurrences(text, symbol),
  })).filter((entry) => entry.count > 0);
  const emojiTotal = emoji.reduce((sum, entry) => sum + entry.count, 0);
  if (emojiTotal >= 3 || emoji.some((entry) => entry.count >= 2)) {
    flag("emojiCluster", emoji.map((entry) => entry.symbol).join(" "));
  }

  const gate = firstMatch(COMMENT_GATE_PATTERNS, text);
  if (gate) flag("commentGate", gate);

  /* Only worth saying on a post long enough to have room for one. */
  if (
    words.length >= 30 &&
    !/\d/.test(bodyLines.join(" ")) &&
    !hasNamedEntity(sentences)
  ) {
    flag("noSpecifics", "");
  }

  return summarise(found, words.length);
}

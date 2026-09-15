/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: HOOK_FORMULAS, hook formulas, readOpeningLine,
 *   replaceOpeningLine, opening line, first line swap, linkedin-skills
 *
 * WHAT:  How the app describes each hook formula (label, goals, shape), plus the
 *        two helpers that read and replace a post's opening line.
 * WHY:   The prompt describes a formula in the same words the composer labels
 *        it with, so the member sees "Controlled A/B" next to a line the model was
 *        told to write as a controlled A/B. Condensed from the 20 skeletons in
 *        sergebulaev/linkedin-skills (MIT, commit a472ef4) with the 2026 cautions
 *        folded in: no question openers, no reveal bridges, one contrast, and
 *        never an invented number. Their reach figures are not repeated here.
 *        See THIRD_PARTY_NOTICES.md.
 * WHERE: ai.service.ts (buildHookDirective); the composer's opening lines card.
 */

import type { HookFormula, HookFormulaKey } from "@/lib/types/post-hooks";

/**
 * SOURCE OF TRUTH KEYWORDS: HOOK_FORMULAS
 *
 * WHAT:  Every hook formula the generator can use.
 * WHY:   `goals` follows the engagement-goal split in linkedin-skills; a formula
 *        with no goals is used only when the member has no preference. Each
 *        shape is written as an instruction the model can follow directly.
 */
export const HOOK_FORMULAS: Record<HookFormulaKey, HookFormula> = {
  controlledAB: {
    label: "Controlled A/B",
    goals: ["comments"],
    shape:
      "Two situations that differ by exactly one variable, with opposite outcomes, in the first two lines. Then the one variable that changed, what it reveals, and an operational question.",
    needsSpecifics: false,
  },
  contrarianReceipts: {
    label: "Contrarian with receipts",
    goals: ["comments"],
    shape:
      "Name a widely held belief, show dated evidence against it, then say plainly what actually changed. This is the post's only contrast.",
    needsSpecifics: true,
  },
  timeAnchor: {
    label: "Time-anchor story",
    goals: ["comments"],
    shape:
      'First line: "{how long} ago I stopped {doing something}." Second line: the first concrete consequence. Then why the old way worked, what it cost, and what changed. No "let me be honest" framing.',
    needsSpecifics: true,
  },
  curiosityGap: {
    label: "Curiosity gap",
    goals: ["comments"],
    shape:
      'Lines one and two tease one specific thing that happened. Line three, still before "see more", reveals it concretely. Never "what nobody tells you".',
    needsSpecifics: false,
  },
  falseBinary: {
    label: "False binary",
    goals: ["comments", "reposts"],
    shape:
      "Name the two answers everyone reaches for and why each fails, then the third option, described concretely. This is the post's only contrast.",
    needsSpecifics: false,
  },
  namedGratitude: {
    label: "Named gratitude",
    goals: ["reposts"],
    shape:
      "Thank specific real people by name, one concrete thing each did, why it mattered, and a close that honours them rather than you.",
    needsSpecifics: true,
  },
  ripObituary: {
    label: "R.I.P. obituary",
    goals: ["reposts"],
    shape:
      'Declare a practice or category over in the first line ("R.I.P. {thing}."), give the specific cause with dated evidence, admit if you once defended it, then name what replaced it.',
    needsSpecifics: true,
  },
  paidVsFree: {
    label: "Paid vs free",
    goals: ["reposts", "saves"],
    shape:
      "First line: what you normally charge for this and that today it is free. Then a named framework with numbered, concrete steps.",
    needsSpecifics: true,
  },
  divergingCurves: {
    label: "Diverging curves",
    goals: ["reposts"],
    shape:
      'Two approaches that look alike today and diverge over time ("Month one, X. Month six, Y."), ending on a one-line maxim.',
    needsSpecifics: false,
  },
  emotionalColdOpen: {
    label: "Emotional cold open",
    goals: ["likes"],
    shape:
      "Start inside the peak moment of a true story with no setup, present tense and concrete. Then the turn, and a one-line meaning rather than a moral.",
    needsSpecifics: false,
  },
  baitAndSwitch: {
    label: "Bait and switch",
    goals: ["likes"],
    shape:
      "Open with what sounds like bad news or a cut, hold it for a line, then reveal it is an upgrade and why, as a plain sentence.",
    needsSpecifics: false,
  },
  statusStrip: {
    label: "Status strip",
    goals: ["likes"],
    shape:
      "Contrast the title people know you by with a specific humbling moment, then what that moment taught you. This is the post's only contrast.",
    needsSpecifics: false,
  },
  explainSimply: {
    label: "Explain it simply",
    goals: ["saves"],
    shape:
      '"{Term} explained simply." Then a scannable plain-language breakdown, one short line per part.',
    needsSpecifics: false,
  },
  oddPrecision: {
    label: "Exact number",
    goals: ["saves"],
    shape:
      "First line is one exact, unrounded number from the topic. Then what it covers, the breakdown behind it, and what surprised you.",
    needsSpecifics: true,
  },
  evidenceBridge: {
    label: "Story meets evidence",
    goals: ["comments", "saves"],
    shape:
      "A small first-person observation, then three pieces of real evidence, what the pattern is, and what you did about it.",
    needsSpecifics: true,
  },
  yearOverYear: {
    label: "Year over year",
    goals: [],
    shape:
      "Two lines: where you were last year and where you are now, with real numbers. Then the change behind it.",
    needsSpecifics: true,
  },
};

/**
 * SOURCE OF TRUTH KEYWORDS: readOpeningLine
 *
 * WHAT:  A post's first line, ignoring leading blank lines.
 */
export function readOpeningLine(text: string): string {
  return text.trimStart().split("\n")[0] ?? "";
}

/**
 * SOURCE OF TRUTH KEYWORDS: replaceOpeningLine
 *
 * WHAT:  The post with its first line swapped for another.
 * WHY:   Only the first line changes, so everything the member edited below it
 *        survives a swap, and choosing a new opening costs no generation.
 */
export function replaceOpeningLine(text: string, line: string): string {
  const body = text.trimStart();
  const breakAt = body.indexOf("\n");
  return breakAt === -1 ? line : `${line}${body.slice(breakAt)}`;
}

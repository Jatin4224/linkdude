/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: DESIGN_TEXT_SLOTS, DesignTextSlotDefinition,
 *   DESIGN_TEXT_SLOT_ENTRIES, designContentIssues, DesignContentIssue,
 *   studio text slots, slot labels, slot character limits
 *
 * WHAT:  The editorial half of the block language — what each text slot is
 *        called in the editor, what it suggests, and how long it may be.
 * WHY:   Split from lib/types/design-block on purpose. That file is STRUCTURAL:
 *        which slots exist and how a block points at one. This file is
 *        EDITORIAL: the words the user reads and the ceiling their copy has to
 *        fit. Changing a placeholder should not touch the schema, and adding a
 *        slot should be a compile error in exactly one place — the Record below
 *        is keyed by the tuple, so it is.
 *
 *        The same registry pattern as CONTENT_PLAN_STEPS and PROFILE_SECTIONS,
 *        and for the same payoff: the studio's editor renders one field per slot
 *        a template actually uses, so template twenty-one costs no UI code.
 *
 *        `maxChars` is a LAYOUT limit, not a storage limit — the same
 *        distinction CAROUSEL_HEADING_MAX draws. A headline of 200 characters
 *        would store fine and render as a grey smear at 72px on a 396px-tall
 *        banner. The numbers below are what the geometry can actually hold.
 * WHERE: The studio content form reads labels and counters from here; the router
 *        input schema in lib/types/studio enforces the ceilings, so the counter
 *        under the field and the error that blocks submit quote one number.
 */

import {
  DESIGN_TEXT_SLOT_KEYS,
  type DesignTextSlotKey,
} from "@/lib/types/design-block";

/**
 * SOURCE OF TRUTH KEYWORDS: DesignTextSlotDefinition
 *
 * WHAT:  Everything the editor needs to render one field.
 * WHY:   `multiline` decides Input versus Textarea. It is stored rather than
 *        inferred from `maxChars`, because the two are independent: a quote is
 *        short and still wants to wrap.
 */
export interface DesignTextSlotDefinition {
  readonly label: string;
  readonly placeholder: string;
  readonly maxChars: number;
  readonly multiline: boolean;
}

/**
 * SOURCE OF TRUTH KEYWORDS: DESIGN_TEXT_SLOTS
 *
 * WHAT:  One definition per slot in DESIGN_TEXT_SLOT_KEYS.
 * WHY:   Placeholders are written as REAL EXAMPLES rather than instructions
 *        ("Helping founders grow on LinkedIn", not "Enter your headline"). A
 *        member staring at an empty banner needs to see the shape of a good
 *        answer, and this is the cheapest place in the product to show one.
 */
export const DESIGN_TEXT_SLOTS: Record<
  DesignTextSlotKey,
  DesignTextSlotDefinition
> = {
  /* Sits above the headline at `meta` size — a category, not a sentence. */
  eyebrow: {
    label: "Eyebrow",
    placeholder: "FOR B2B FOUNDERS",
    maxChars: 40,
    multiline: false,
  },
  /* The one line that has to work. 64 rather than LinkedIn's own 220-character
   * headline ceiling, because this is drawn at display size across a 4:1 canvas
   * whose left third is covered by the avatar — roughly two lines of type. */
  headline: {
    label: "Headline",
    placeholder: "Helping founders grow on LinkedIn",
    maxChars: 64,
    multiline: true,
  },
  subheadline: {
    label: "Subheadline",
    placeholder: "Systems that turn posts into pipeline",
    maxChars: 80,
    multiline: true,
  },
  body: {
    label: "Supporting text",
    placeholder: "15 years in B2B sales. Now I teach it.",
    maxChars: 140,
    multiline: true,
  },
  /* A button label. Short enough that it never wraps inside its own pill. */
  ctaLabel: {
    label: "Button text",
    placeholder: "Book a free call",
    maxChars: 28,
    multiline: false,
  },
  /* Three proof chips. Same ceiling on each, because they sit in one row and an
   * uneven set reads as a mistake rather than a rhythm. */
  proofA: {
    label: "Proof 1",
    placeholder: "10k+ followers",
    maxChars: 24,
    multiline: false,
  },
  proofB: {
    label: "Proof 2",
    placeholder: "Top 1% creator",
    maxChars: 24,
    multiline: false,
  },
  proofC: {
    label: "Proof 3",
    placeholder: "500+ clients",
    maxChars: 24,
    multiline: false,
  },
  name: {
    label: "Name",
    placeholder: "Jatin Sharma",
    maxChars: 40,
    multiline: false,
  },
  role: {
    label: "Role",
    placeholder: "Founder, Acme",
    maxChars: 48,
    multiline: false,
  },
  /* A URL or an @handle drawn as text — never a live link, because this ends up
   * as pixels in a PNG. */
  handle: {
    label: "Website or handle",
    placeholder: "linkdude.io",
    maxChars: 48,
    multiline: false,
  },
  quote: {
    label: "Quote",
    placeholder: "“I got my first client in three weeks.”",
    maxChars: 120,
    multiline: true,
  },
  attribution: {
    label: "Quote attribution",
    placeholder: "Priya N., SaaS founder",
    maxChars: 48,
    multiline: false,
  },
  footnote: {
    label: "Footnote",
    placeholder: "Booking Q1 now",
    maxChars: 60,
    multiline: false,
  },
  logoText: {
    label: "Logo text",
    placeholder: "ACME",
    maxChars: 24,
    multiline: false,
  },
  /* Forty-four, not twenty-four. A list line sits alone across the banner's
   * right two-thirds at subheading size, so it has roughly twice the room a chip
   * does — and a capability line that has to fit in a chip ("AI products") loses
   * the specificity that made it worth writing. */
  pointA: {
    label: "Point 1",
    placeholder: "→ AI products, end to end",
    maxChars: 44,
    multiline: false,
  },
  pointB: {
    label: "Point 2",
    placeholder: "→ TypeScript · Next.js · Postgres",
    maxChars: 44,
    multiline: false,
  },
  pointC: {
    label: "Point 3",
    placeholder: "→ Open to work",
    maxChars: 44,
    multiline: false,
  },
  /* Carousel flow lists only. The ceiling is wider than pointA–C because these
   * hold a slide's list line, which has a full slide width to sit in rather than
   * a banner's right two-thirds — the same "a slot's ceiling belongs to the
   * visual role" rule that split these from proofA–C in the first place. */
  pointD: {
    label: "Point 4",
    placeholder: "→ Turn attention into trust",
    maxChars: 80,
    multiline: false,
  },
  pointE: {
    label: "Point 5",
    placeholder: "→ Turn trust into clients",
    maxChars: 80,
    multiline: false,
  },
};

/**
 * SOURCE OF TRUTH KEYWORDS: DESIGN_TEXT_SLOT_ENTRIES
 *
 * WHAT:  The slots as an ordered array.
 * WHY:   Object key order is not a contract; this is. The editor renders fields
 *        in this order, so a template's block order cannot reshuffle the form.
 */
export const DESIGN_TEXT_SLOT_ENTRIES = DESIGN_TEXT_SLOT_KEYS.map(
  (key) => [key, DESIGN_TEXT_SLOTS[key]] as const,
);

export interface DesignContentIssue {
  readonly slot: DesignTextSlotKey;
  readonly label: string;
  readonly maxChars: number;
  readonly length: number;
}

/**
 * SOURCE OF TRUTH KEYWORDS: designContentIssues
 *
 * WHAT:  Which of the user's answers are too long for the canvas.
 * WHY:   Returns the offenders rather than throwing, so one call serves three
 *        callers that need different things from the same check: the editor
 *        colours a counter, the router input schema turns each into a zod issue,
 *        and the create procedure can seed placeholders without tripping over
 *        its own defaults.
 *
 *        Deliberately NOT wired into `designDocSchema` itself. That schema parses
 *        STORED rows, and a document written when a slot allowed 80 characters
 *        must keep parsing after the ceiling drops to 64 — otherwise tightening a
 *        limit silently orphans saved designs. New input is held to the current
 *        limit; existing pixels are left alone.
 * WHERE: lib/types/studio's router inputs; the studio content form's counters.
 */
export function designContentIssues(
  content: Partial<Record<DesignTextSlotKey, string>>,
): readonly DesignContentIssue[] {
  const issues: DesignContentIssue[] = [];

  for (const key of DESIGN_TEXT_SLOT_KEYS) {
    const value = content[key];
    if (value === undefined) continue;

    const definition = DESIGN_TEXT_SLOTS[key];
    /* Trimmed length, matching what the renderer draws — trailing whitespace is
     * not a reason to tell someone their headline is too long. */
    const length = value.trim().length;
    if (length > definition.maxChars) {
      issues.push({
        slot: key,
        label: definition.label,
        maxChars: definition.maxChars,
        length,
      });
    }
  }

  return issues;
}

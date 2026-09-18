/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: STUDIO_TEMPLATES, STUDIO_TEMPLATE_KEYS,
 *   StudioTemplateKey, StudioTemplate, getStudioTemplate, isStudioTemplateKey,
 *   studio gallery, template registry
 *
 * WHAT:  The gallery — every style a member can start a profile from.
 * WHY:   A template is an ARCHETYPE plus a PALETTE plus facets, and nothing else.
 *        That product is what makes twenty entries affordable: five archetypes
 *        times four palettes fills a gallery while leaving five block lists to
 *        maintain. The same split CAROUSEL_TEMPLATES and CAROUSEL_PALETTES prove,
 *        applied before the count gets painful rather than after.
 *
 *        Adding a style is an entry here. It costs no renderer change, no UI
 *        change and no migration — if it ever does, the block language is missing
 *        a primitive and that is the thing to fix.
 *
 *        Names are GENERIC by rule — "Bold Founder", not a person. The source kit
 *        this research came from names fifteen of its designs after real
 *        creators; see research/feature.md §2 before adding more.
 * WHERE: The studio gallery and the create procedure; `templateId` on
 *        StudioProject is a bare String owned by this tuple.
 */

import type { StudioRole, StudioTone } from "@/lib/types/studio";

import type { DesignArchetypeKey } from "./design-archetypes";
import type { DesignPaletteKey } from "./design-theme";

/**
 * SOURCE OF TRUTH KEYWORDS: StudioTemplate
 *
 * WHAT:  One gallery card.
 * WHY:   `whyItWorks` is content, not decoration — the mockup's style detail
 *        panel leads with it, and a member choosing between twenty near-identical
 *        cards is choosing on this text rather than on a thumbnail. Kept to three
 *        or four short claims so the panel stays scannable.
 */
export interface StudioTemplate {
  readonly label: string;
  readonly archetype: DesignArchetypeKey;
  readonly palette: DesignPaletteKey;
  readonly tone: StudioTone;
  readonly roles: readonly StudioRole[];
  readonly whyItWorks: readonly string[];
  /** Seeded into the design on create, so a new project is never a blank canvas. */
  readonly sampleContent: Readonly<Record<string, string>>;
}

/* Shared seed copy. One object rather than repeated literals, because a template
 * varies by LOOK and the placeholder words are the same demonstration either
 * way — and because a member replaces all of it in the first minute. */
const FOUNDER_SAMPLE = {
  eyebrow: "For B2B founders",
  headline: "Helping founders grow on LinkedIn",
  subheadline: "Systems that turn posts into pipeline",
  ctaLabel: "Book a free call",
  proofA: "10k+ followers",
  proofB: "Top 1% creator",
  logoText: "ACME",
  handle: "linkdude.io",
} as const;

export const STUDIO_TEMPLATE_KEYS = [
  "boldFounder",
  "midnightFounder",
  "paperConsultant",
  "forestCoach",
] as const;
export type StudioTemplateKey = (typeof STUDIO_TEMPLATE_KEYS)[number];

/**
 * SOURCE OF TRUTH KEYWORDS: STUDIO_TEMPLATES
 *
 * WHAT:  Four entries, all on one archetype.
 * WHY:   Phase 1 of docs/20-studio.md ships ONE archetype, so these four differ
 *        only by palette and facets. That is not a placeholder — it is the point
 *        being demonstrated: four gallery cards, one block list. The remaining
 *        archetypes are phase 3 and each multiplies this table without touching
 *        anything else.
 */
export const STUDIO_TEMPLATES: Record<StudioTemplateKey, StudioTemplate> = {
  boldFounder: {
    label: "Bold Founder",
    archetype: "statementCta",
    palette: "boldBlue",
    tone: "bold",
    roles: ["founder", "coach"],
    whyItWorks: [
      "Outcome-first headline",
      "One clear call to action",
      "Proof sits beside the ask, not below it",
    ],
    sampleContent: FOUNDER_SAMPLE,
  },

  midnightFounder: {
    label: "Midnight Founder",
    archetype: "statementCta",
    palette: "midnight",
    tone: "minimal",
    roles: ["founder", "freelancer"],
    whyItWorks: [
      "Dark field keeps the headline the only bright thing",
      "Reads as considered rather than loud",
      "Safest backdrop for a photograph",
    ],
    sampleContent: FOUNDER_SAMPLE,
  },

  paperConsultant: {
    label: "Clean Consultant",
    archetype: "statementCta",
    palette: "paper",
    tone: "minimal",
    roles: ["freelancer", "jobSeeker"],
    whyItWorks: [
      "Light field reads as a document, not an ad",
      "Off-white keeps an edge against LinkedIn's own white page",
      "Accent used once, so it means something",
    ],
    sampleContent: FOUNDER_SAMPLE,
  },

  forestCoach: {
    label: "Warm Coach",
    archetype: "statementCta",
    palette: "forest",
    tone: "personal",
    roles: ["coach", "creator"],
    whyItWorks: [
      "Non-blue, so it does not read as LinkedIn's own chrome",
      "Softer contrast suits a personal brand",
      "Accent clears contrast at banner scale",
    ],
    sampleContent: FOUNDER_SAMPLE,
  },
};

export const STUDIO_TEMPLATE_ENTRIES = STUDIO_TEMPLATE_KEYS.map(
  (key) => [key, STUDIO_TEMPLATES[key]] as const,
);

export function isStudioTemplateKey(value: string): value is StudioTemplateKey {
  return Object.prototype.hasOwnProperty.call(STUDIO_TEMPLATES, value);
}

/**
 * SOURCE OF TRUTH KEYWORDS: getStudioTemplate
 *
 * WHAT:  Template lookup that always returns something.
 * WHY:   Same never-throw contract as the other studio getters, for the same
 *        reason: `templateId` is a bare String on StudioProject, so a row written
 *        before a template was renamed must still open rather than break the
 *        editor. Callers that need to REJECT an unknown id — the create
 *        procedure does — use isStudioTemplateKey instead.
 */
export function getStudioTemplate(templateId: string): StudioTemplate {
  return STUDIO_TEMPLATES[templateId as StudioTemplateKey] ?? STUDIO_TEMPLATES.boldFounder;
}

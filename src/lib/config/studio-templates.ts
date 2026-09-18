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

/* Engineers and job seekers are the largest group arriving from a shared post,
 * and the founder seed actively repels them: someone "open to work" reading
 * "Book a free call" concludes the tool is for coaches selling programmes. Same
 * archetype, different words. */
const ENGINEER_SAMPLE = {
  eyebrow: "Full-stack · AI products",
  headline: "I build and ship AI products",
  subheadline: "TypeScript, Next.js, Postgres. Open to work.",
  ctaLabel: "See my work",
  proofA: "Open source",
  proofB: "500+ commits",
  logoText: "JS",
  handle: "github.com/you",
} as const;

const COACH_SAMPLE = {
  eyebrow: "For ambitious operators",
  headline: "Get promoted without burning out",
  subheadline: "1:1 coaching for senior ICs and new managers",
  ctaLabel: "Book a session",
  proofA: "200+ clients",
  proofB: "Ex-FAANG",
  logoText: "ACME",
  handle: "linkdude.io",
} as const;

/* The stacked layout reads as a capability list, so its seed is three
 * capabilities rather than one claim. */
const STACKED_SAMPLE = {
  headline: "Full-stack engineer",
  proofA: "→ AI products, end to end",
  proofB: "→ TypeScript · Next.js · Postgres",
  proofC: "→ Open to work",
  handle: "github.com/you",
} as const;

/* An offer banner lives or dies on the guarantee line, so the seed shows one. */
const OFFER_SAMPLE = {
  eyebrow: "The LinkedIn system",
  headline: "Turn your profile into pipeline",
  body: "90 days. If it does not work, you do not pay.",
  ctaLabel: "Apply now",
} as const;

/* Conversational asks for a message rather than a booking. */
const DM_SAMPLE = {
  headline: "Struggling to get replies?",
  subheadline: "I fix LinkedIn profiles that recruiters scroll past.",
  ctaLabel: "Send me a message",
  handle: "linkdude.io",
} as const;

export const STUDIO_TEMPLATE_KEYS = [
  "boldFounder",
  "midnightFounder",
  "paperConsultant",
  "forestCoach",
  "midnightEngineer",
  "paperEngineer",
  "boldCoach",
  "forestCreator",
  "midnightProof",
  "boldOffer",
  "paperStacked",
  "forestConversational",
] as const;
export type StudioTemplateKey = (typeof STUDIO_TEMPLATE_KEYS)[number];

/**
 * SOURCE OF TRUTH KEYWORDS: STUDIO_TEMPLATES
 *
 * WHAT:  Twelve entries across five archetypes.
 * WHY:   Five archetypes times four palettes is the whole gallery, and this table
 *        is the only place the combination is spelled out. Adding the four
 *        non-default archetypes cost four entries here and zero renderer changes —
 *        which is the property the block language exists to buy.
 *
 *        Seed copy varies with the SHAPE, not the colour: a capability stack needs
 *        three capabilities and an offer banner needs a guarantee, so sharing one
 *        sample across every entry would leave half of them demonstrating nothing.
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

  midnightEngineer: {
    label: "Dark Engineer",
    archetype: "statementCta",
    palette: "midnight",
    tone: "minimal",
    roles: ["jobSeeker", "freelancer"],
    whyItWorks: [
      "Says what you build, not what you are called",
      "Stack in the subline, so a recruiter can scan it",
      "Proof is shipped work, not follower counts",
    ],
    sampleContent: ENGINEER_SAMPLE,
  },

  paperEngineer: {
    label: "Light Engineer",
    archetype: "statementCta",
    palette: "paper",
    tone: "minimal",
    roles: ["jobSeeker", "creator"],
    whyItWorks: [
      "Reads as a CV header rather than an ad",
      "High contrast survives a recruiter skimming on mobile",
      "One accent, used once",
    ],
    sampleContent: ENGINEER_SAMPLE,
  },

  boldCoach: {
    label: "Bold Coach",
    archetype: "statementCta",
    palette: "boldBlue",
    tone: "bold",
    roles: ["coach"],
    whyItWorks: [
      "Outcome in the headline, not a job title",
      "Credibility sits beside the ask",
      "Channel blue reads as native on LinkedIn",
    ],
    sampleContent: COACH_SAMPLE,
  },

  forestCreator: {
    label: "Green Creator",
    archetype: "statementCta",
    palette: "forest",
    tone: "personal",
    roles: ["creator", "freelancer"],
    whyItWorks: [
      "Non-blue, so it does not disappear into the feed",
      "Warmer contrast suits a personal brand",
      "Accent still clears contrast at banner scale",
    ],
    sampleContent: COACH_SAMPLE,
  },

  midnightProof: {
    label: "Proof First",
    archetype: "proofStrip",
    palette: "midnight",
    tone: "bold",
    roles: ["founder", "creator"],
    whyItWorks: [
      "Credibility above the claim and again below it",
      "Badges hide themselves when empty, so it never looks unfinished",
      "Suits a profile whose strongest asset is a track record",
    ],
    sampleContent: FOUNDER_SAMPLE,
  },

  boldOffer: {
    label: "The Offer",
    archetype: "offerGuarantee",
    palette: "boldBlue",
    tone: "bold",
    roles: ["coach", "freelancer"],
    whyItWorks: [
      "Names one specific thing you sell",
      "The guarantee line removes the risk of clicking",
      "One action, and it is the only bright element",
    ],
    sampleContent: OFFER_SAMPLE,
  },

  paperStacked: {
    label: "Capability Stack",
    archetype: "stackedKeywords",
    palette: "paper",
    tone: "minimal",
    roles: ["jobSeeker", "freelancer"],
    whyItWorks: [
      "Three short lines scan faster than one sentence",
      "Reads as a capability list, not a pitch",
      "Built for people whose value is a set of things",
    ],
    sampleContent: STACKED_SAMPLE,
  },

  forestConversational: {
    label: "Start a Conversation",
    archetype: "conversational",
    palette: "forest",
    tone: "personal",
    roles: ["coach", "creator"],
    whyItWorks: [
      "Opens with their problem, not your credentials",
      "Asks for a message — the lowest-effort next step there is",
      "Suits a funnel that runs on DMs rather than calendar links",
    ],
    sampleContent: DM_SAMPLE,
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

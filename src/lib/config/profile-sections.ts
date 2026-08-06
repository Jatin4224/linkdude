/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: PROFILE_SECTIONS, ProfileSectionDefinition,
 *   PROFILE_SECTION_ENTRIES, DEEP_INSIGHT_SECTIONS, EMPTY_PROFILE_SECTIONS,
 *   serializeProfileSection, splitLegacyExperience, countProfileSections
 *
 * WHAT:  What each structured profile section MEANS — its label, what its three
 *        item slots hold, and whether critiquing it is a paid tier.
 * WHY:   profileSectionItemSchema deliberately gives every section the same
 *        `{ label, meta, detail }` shape so there is one form component, one
 *        prompt serializer and one mapper. That uniformity only works if the
 *        per-section meaning lives somewhere — this is that place. Adding a
 *        fifth section (skills, publications, recommendations) is one entry
 *        here: the form, the stat tiles, the prompt and the result view all
 *        iterate this registry and pick it up with no further change.
 *
 *        Registry-driven for the same reason as PROFILE_SOURCES and
 *        AI_PROVIDERS: the alternative is the same four strings copied into a
 *        form, a prompt, a mapper and a renderer, drifting independently.
 * WHERE: Read by the profile form, the analysis prompt in ai.service.ts, the
 *        vendor mappers, and the result view's stat tiles.
 */

import {
  PROFILE_SECTION_KEYS,
  PROFILE_ITEM_DETAIL_MAX,
  PROFILE_ITEM_LABEL_MAX,
  PROFILE_ITEM_META_MAX,
  type ProfileSectionKey,
  type ProfileSectionItem,
  type ProfileSections,
} from "@/lib/types/profile-lookup";

/**
 * SOURCE OF TRUTH KEYWORDS: ProfileSectionDefinition
 *
 * WHAT:  Everything the app needs to render, prompt about, and gate one section.
 * WHERE: Implemented by PROFILE_SECTIONS below.
 */
export interface ProfileSectionDefinition {
  /** Plural heading — "Experience", "Certifications". */
  readonly label: string;
  /** Singular, for the add button: "Add role". */
  readonly addLabel: string;
  /** Field labels for the shared `{ label, meta, detail }` item shape. */
  readonly fields: {
    readonly label: { readonly label: string; readonly placeholder: string };
    readonly meta: { readonly label: string; readonly placeholder: string };
    readonly detail: {
      readonly label: string;
      readonly placeholder: string;
      /** Certifications and education have nothing worth writing prose about. */
      readonly enabled: boolean;
    };
  };
  /**
   * Whether the model is asked to critique this section at all.
   * `false` sections still count toward the stat tiles and still reach the
   * prompt as context — they are simply never given their own critique block.
   */
  readonly critiqued: boolean;
  /**
   * True when the critique for this section sits behind the
   * `profileDeepInsights` plan flag. Gating per-section here rather than in the
   * component keeps the server (which decides what to GENERATE) and the client
   * (which decides what to SHOW) reading the same declaration.
   */
  readonly premium: boolean;
}

/**
 * SOURCE OF TRUTH KEYWORDS: PROFILE_SECTIONS
 *
 * WHAT:  The four structured sections, keyed by ProfileSectionKey.
 * WHY:   `Record<ProfileSectionKey, …>` so adding a key to PROFILE_SECTION_KEYS
 *        without describing it here is a compile error rather than a section
 *        that renders as a blank card.
 */
export const PROFILE_SECTIONS: Record<
  ProfileSectionKey,
  ProfileSectionDefinition
> = {
  experience: {
    label: "Experience",
    addLabel: "Add role",
    fields: {
      label: { label: "Role", placeholder: "Senior Software Engineer" },
      meta: { label: "Company & dates", placeholder: "Acme · 2022 - Present" },
      detail: {
        label: "What you did",
        placeholder: "What you owned, and what changed because of it...",
        enabled: true,
      },
    },
    critiqued: true,
    premium: true,
  },
  projects: {
    label: "Projects",
    addLabel: "Add project",
    fields: {
      label: { label: "Project", placeholder: "Realtime collaboration engine" },
      meta: { label: "Link or stack", placeholder: "github.com/you/project" },
      detail: {
        label: "What it does",
        placeholder: "The problem it solves and what you built...",
        enabled: true,
      },
    },
    critiqued: true,
    premium: true,
  },
  certifications: {
    label: "Certifications",
    addLabel: "Add certification",
    fields: {
      label: { label: "Certification", placeholder: "AWS Solutions Architect" },
      meta: { label: "Issuer & year", placeholder: "Amazon Web Services · 2024" },
      detail: { label: "Notes", placeholder: "", enabled: false },
    },
    /* Not critiqued: a certification is a fact, not positioning. It informs the
     * headline and About advice as context, but "rewrite your certification" is
     * not something a user can act on. */
    critiqued: false,
    premium: false,
  },
  education: {
    label: "Education",
    addLabel: "Add education",
    fields: {
      label: { label: "School", placeholder: "University of Delhi" },
      meta: { label: "Degree & years", placeholder: "B.Tech, CSE · 2018 - 2022" },
      detail: { label: "Notes", placeholder: "", enabled: false },
    },
    critiqued: false,
    premium: false,
  },
};

/**
 * SOURCE OF TRUTH KEYWORDS: PROFILE_SECTION_ENTRIES
 *
 * WHAT:  The registry as an ordered array, for rendering.
 * WHY:   Object key order is not a contract; this is. The order here is the
 *        order the form fields and the stat tiles appear in.
 */
export const PROFILE_SECTION_ENTRIES = PROFILE_SECTION_KEYS.map((key) => ({
  key,
  ...PROFILE_SECTIONS[key],
}));

/**
 * SOURCE OF TRUTH KEYWORDS: DEEP_INSIGHT_SECTIONS
 *
 * WHAT:  The sections whose critique is gated behind the paid plan flag.
 * WHERE: The router asks for these only when the org's plan includes
 *        `profileDeepInsights`; the result view locks exactly these panels.
 */
export const DEEP_INSIGHT_SECTIONS = PROFILE_SECTION_KEYS.filter(
  (key) => PROFILE_SECTIONS[key].critiqued && PROFILE_SECTIONS[key].premium,
);

/**
 * SOURCE OF TRUTH KEYWORDS: EMPTY_PROFILE_SECTIONS
 *
 * WHAT:  A fully-populated ProfileSections with every section empty.
 * WHY:   Form default values and the vendor mappers both need a total value
 *        rather than a partial one, and building it inline in each place is how
 *        a fifth section gets forgotten in one of them.
 */
export function emptyProfileSections(): ProfileSections {
  return {
    experience: [],
    projects: [],
    certifications: [],
    education: [],
  };
}

/**
 * SOURCE OF TRUTH KEYWORDS: serializeProfileSection
 *
 * WHAT:  Renders one section's items as the prose the model reads.
 * WHY:   The model reads text, not JSON — feeding it raw objects wastes tokens
 *        on braces and quotes and reliably degrades output quality. Numbering
 *        the entries is what lets a critique say "role 2" and have the result
 *        view point back at the right card.
 * WHERE: Used by the analysis prompt, and by the router to fill the legacy
 *        ProfileAnalysis.experience column.
 */
export function serializeProfileSection(
  items: readonly ProfileSectionItem[],
): string {
  return items
    .map((item, index) => {
      const heading = [item.label, item.meta].filter(Boolean).join(" — ");
      return item.detail
        ? `${index + 1}. ${heading}\n${item.detail}`
        : `${index + 1}. ${heading}`;
    })
    .join("\n\n");
}

/**
 * SOURCE OF TRUTH KEYWORDS: splitLegacyExperience
 *
 * WHAT:  Turns the flat experience string of a pre-sections row into one item.
 * WHY:   History rows are re-runnable — the user reloads one, edits it, and
 *        analyzes again. Rows written before structured sections hold only a
 *        paragraph, and prose cannot be reliably split back into roles. Rather
 *        than guessing at boundaries or silently dropping text the user typed,
 *        it becomes a SINGLE honest entry: first line as the label, remainder as
 *        the detail. The user can split it themselves if they care.
 * WHERE: profile-analysis.service.ts, rebuilding AnalyzeProfileValues from a row.
 */
export function splitLegacyExperience(
  experience: string | null,
): ProfileSectionItem[] {
  const trimmed = experience?.trim();
  if (!trimmed) return [];

  const breakAt = trimmed.indexOf("\n");
  const label = (breakAt === -1 ? trimmed : trimmed.slice(0, breakAt)).trim();
  const detail = breakAt === -1 ? "" : trimmed.slice(breakAt + 1).trim();

  return [
    {
      label: label.slice(0, PROFILE_ITEM_LABEL_MAX),
      meta: "",
      detail: detail.slice(0, PROFILE_ITEM_DETAIL_MAX),
    },
  ];
}

/**
 * SOURCE OF TRUTH KEYWORDS: toProfileSectionItem
 *
 * WHAT:  Builds one item from raw vendor parts, truncated to the item ceilings.
 * WHY:   Every vendor mapper needs exactly this — join the parts it has, drop
 *        the empties, clamp to the schema maxima. Centralised so a scrape can
 *        never produce an item that fails validation after the lookup has
 *        already been paid for. Returns null when there is no label, because an
 *        entry with no title is not a countable thing.
 * WHERE: src/services/profile-source.service.ts, all vendor mappers.
 */
export function toProfileSectionItem(
  label: string | null | undefined,
  metaParts: ReadonlyArray<string | null | undefined>,
  detail?: string | null,
): ProfileSectionItem | null {
  const cleanLabel = (label ?? "").trim();
  if (!cleanLabel) return null;

  return {
    label: cleanLabel.slice(0, PROFILE_ITEM_LABEL_MAX),
    meta: metaParts
      .map((part) => part?.trim() ?? "")
      .filter(Boolean)
      .join(" · ")
      .slice(0, PROFILE_ITEM_META_MAX),
    detail: (detail ?? "").trim().slice(0, PROFILE_ITEM_DETAIL_MAX),
  };
}

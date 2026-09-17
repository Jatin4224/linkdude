/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: STUDIO_ASSET_KINDS, StudioAssetKind,
 *   studioAssetKindSchema, STUDIO_ASSET_KIND_CANVAS, STUDIO_STATUSES,
 *   StudioStatus, STUDIO_ROLES, STUDIO_TONES, createStudioProjectSchema,
 *   CreateStudioProjectValues, CreateStudioProjectInput,
 *   updateStudioAssetSchema, previewStudioDesignSchema,
 *   renderStudioAssetSchema, getStudioProjectSchema, listStudioProjectsSchema,
 *   discardStudioProjectSchema, STUDIO_PROJECT_NAME_MAX
 *
 * WHAT:  Input and output contracts for the studio — what the client may send,
 *        and the vocabulary its String columns are drawn from.
 * WHY:   The block language in ./design-block describes a DESIGN. This file
 *        describes the FEATURE around it: which assets a profile has, what a
 *        project may be called, and every router input.
 *
 *        Split deliberately, because design-block is what phase 5 shares with
 *        the carousel and this is not — a carousel has no headshot and no
 *        featured cover, and mixing the two would drag studio vocabulary into
 *        the shared renderer.
 * WHERE: Router input for studio.*; resolvers for the studio editor forms.
 */

import { z } from "zod";

import { designContentIssues } from "@/lib/config/design-slots";

import { designDocSchema, designTextSlotSchema, type DesignCanvasKey } from "./design-block";

/**
 * SOURCE OF TRUTH KEYWORDS: STUDIO_ASSET_KINDS, StudioAssetKind
 *
 * WHAT:  The images a profile kit is made of.
 * WHY:   A tuple owning StudioAsset.kind, never a Prisma enum — the contract
 *        Carousel.templateId follows, so adding an asset kind is a config change
 *        rather than a migration.
 *
 *        Phase 1 renders `banner` only. The rest are declared now because
 *        STUDIO_ASSET_KIND_CANVAS below has to be exhaustive over them, and a
 *        tuple that grows later would silently leave that map incomplete.
 */
export const STUDIO_ASSET_KINDS = [
  "banner",
  "headshot",
  "featuredCover",
  "companyBanner",
] as const;
export const studioAssetKindSchema = z.enum(STUDIO_ASSET_KINDS);
export type StudioAssetKind = (typeof STUDIO_ASSET_KINDS)[number];

/**
 * SOURCE OF TRUTH KEYWORDS: STUDIO_ASSET_KIND_CANVAS
 *
 * WHAT:  Which geometry each asset kind renders at.
 * WHY:   The asset kind is the PRODUCT concept ("my banner") and the canvas is
 *        the RENDER concept ("1584x396"). Keeping them separate means a future
 *        LinkedIn size change is one entry here, not a rename that ripples
 *        through stored rows.
 */
export const STUDIO_ASSET_KIND_CANVAS = {
  banner: "linkedinBanner",
  headshot: "headshot",
  featuredCover: "featuredCover",
  companyBanner: "companyBanner",
} as const satisfies Record<StudioAssetKind, DesignCanvasKey>;

export const STUDIO_ASSET_KIND_LABELS: Record<StudioAssetKind, string> = {
  banner: "Profile banner",
  headshot: "Headshot",
  featuredCover: "Featured cover",
  companyBanner: "Company banner",
};

/* Mirrors CAROUSEL_STATUSES exactly. An asset is draft until it has been
 * exported, ready once a Document is attached, failed when a render threw. */
export const STUDIO_STATUSES = ["draft", "rendering", "ready", "failed"] as const;
export const studioStatusSchema = z.enum(STUDIO_STATUSES);
export type StudioStatus = (typeof STUDIO_STATUSES)[number];

/* Gallery facets. They filter templates; they do not change how anything
 * renders, which is why they live on the project rather than in the design. */
export const STUDIO_ROLES = [
  "founder",
  "coach",
  "jobSeeker",
  "freelancer",
  "creator",
] as const;
export const studioRoleSchema = z.enum(STUDIO_ROLES);
export type StudioRole = (typeof STUDIO_ROLES)[number];

export const STUDIO_TONES = ["bold", "minimal", "personal"] as const;
export const studioToneSchema = z.enum(STUDIO_TONES);
export type StudioTone = (typeof STUDIO_TONES)[number];

export const STUDIO_PROJECT_NAME_MAX = 80;

const studioProjectNameSchema = z
  .string()
  .trim()
  .min(1, "Give this profile a name")
  .max(
    STUDIO_PROJECT_NAME_MAX,
    `Keep the name under ${String(STUDIO_PROJECT_NAME_MAX)} characters`,
  );

/**
 * SOURCE OF TRUTH KEYWORDS: studioContentSchema
 *
 * WHAT:  The user's words, held to the per-slot ceilings.
 * WHY:   The ceilings come from DESIGN_TEXT_SLOTS via designContentIssues rather
 *        than being restated here, so the counter under a field and the error
 *        that blocks submit can never disagree about the number.
 *
 *        Applied to INPUT only, never to designDocSchema itself. That schema
 *        parses stored rows, and a design saved when a slot allowed 80
 *        characters must keep parsing after the limit drops to 64 — otherwise
 *        tightening a limit silently orphans finished work.
 */
export const studioContentSchema = z
  .partialRecord(designTextSlotSchema, z.string())
  .superRefine((content, ctx) => {
    for (const issue of designContentIssues(content)) {
      ctx.addIssue({
        code: "custom",
        path: [issue.slot],
        message: `${issue.label} is ${String(issue.length)} characters — keep it under ${String(issue.maxChars)} so it fits the design`,
      });
    }
  });

/**
 * SOURCE OF TRUTH KEYWORDS: createStudioProjectSchema, CreateStudioProjectValues
 *
 * WHAT:  Starting a new profile from a gallery template.
 * WHY:   Takes a templateId, not a document. The server clones the archetype, so
 *        a client cannot hand it an arbitrary block list — which is what keeps
 *        "a template is data" from becoming "the client authors layouts".
 */
export const createStudioProjectSchema = z.object({
  name: studioProjectNameSchema.default("My LinkedIn profile"),
  templateId: z.string().min(1).max(60),
});
export type CreateStudioProjectValues = z.infer<typeof createStudioProjectSchema>;
/* The INPUT half, for react-hook-form's first type argument — `name` is
 * defaulted, so input and output differ under exactOptionalPropertyTypes. */
export type CreateStudioProjectInput = z.input<typeof createStudioProjectSchema>;

/**
 * SOURCE OF TRUTH KEYWORDS: updateStudioAssetSchema
 *
 * WHAT:  Saving an edited design.
 * WHY:   Sends the WHOLE document, never a patch — the same decision
 *        updateCarouselSchema makes. A partial update over a Json column needs
 *        merge semantics on the server, and a merge that disagrees with the
 *        client's optimistic state is a class of bug this avoids entirely.
 */
export const updateStudioAssetSchema = z.object({
  id: z.string().min(1),
  assetId: z.string().min(1),
  doc: designDocSchema,
  content: studioContentSchema,
});
export type UpdateStudioAssetValues = z.infer<typeof updateStudioAssetSchema>;

/**
 * SOURCE OF TRUTH KEYWORDS: previewStudioDesignSchema
 *
 * WHAT:  Drawing an unsaved design.
 * WHY:   Takes a document and nothing else — no id, because a preview is of what
 *        is on screen right now, which may never be saved. That also means it
 *        renders UNTRUSTED input, which is what DESIGN_MAX_BLOCKS and the
 *        per-slot ceilings are guarding.
 */
export const previewStudioDesignSchema = z.object({
  doc: designDocSchema,
});
export type PreviewStudioDesignValues = z.infer<typeof previewStudioDesignSchema>;

export const renderStudioAssetSchema = z.object({
  id: z.string().min(1),
  assetId: z.string().min(1),
});

export const getStudioProjectSchema = z.object({ id: z.string().min(1) });
export const discardStudioProjectSchema = z.object({ id: z.string().min(1) });

/* page/pageSize are optional with no defaults and no max — the procedure factory
 * owns those, and restating them here would let the two drift. */
export const listStudioProjectsSchema = z.object({
  page: z.number().int().positive().optional(),
  pageSize: z.number().int().positive().optional(),
});
export type ListStudioProjectsValues = z.infer<typeof listStudioProjectsSchema>;

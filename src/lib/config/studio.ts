/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: IMAGEKIT_STUDIO_FOLDER, STUDIO_PNG_MIME_TYPE,
 *   STUDIO_RENDER_TIMEOUT_MS, STUDIO_BACKDROP_TIMEOUT_MS,
 *   STUDIO_BACKDROP_BRIEF_MAX, studioBackdropFileName,
 *   STUDIO_PREVIEW_DEBOUNCE_MS, STUDIO_PREVIEW_PATH, studioAssetTitle,
 *   studioAssetFileName,
 *   STUDIO_DEFAULT_PROJECT_NAME
 *
 * WHAT:  The studio's operational constants — where its files live, what they
 *        are called, and how long a render may take.
 * WHY:   Separate from design-theme (how a design LOOKS) and design-slots (what
 *        the editor SAYS). This file is about the pipeline around the render,
 *        and it mirrors lib/config/carousel.ts one-for-one so the two features
 *        are legible as the same shape.
 * WHERE: src/trpc/routers/studio.ts and src/services/studio.service.ts.
 */

/* Its own folder, not /documents. Profile assets have a different lifecycle from
 * carousel PDFs — they are re-rendered often while a member iterates, and being
 * able to see one feature's uploads in the ImageKit console without the other's
 * is worth one string. */
export const IMAGEKIT_STUDIO_FOLDER = "/studio";

export const STUDIO_PNG_MIME_TYPE = "image/png";

/* A single 1584x396 frame is about 0.6 megapixels against a twelve-slide deck's
 * 17. The generous ceiling is not for the rasterisation — it is for the one-time
 * ~2s WASM and font initialisation a cold process pays on its first render. */
export const STUDIO_RENDER_TIMEOUT_MS = 30_000;

/* How long the editor waits after the last keystroke before asking the server to
 * draw. 300ms, not 600: at 600 the preview reads as a thing that happens TO you
 * a beat after you stop, rather than as a live view of what you are typing — the
 * single loudest complaint on the first build. 300 still coalesces a burst of
 * typing into one render, which is all the debounce is for.
 *
 * Cheap to lower now that preview is a route handler holding no database
 * connection; at 600 it was protecting a pool it no longer touches. */
export const STUDIO_PREVIEW_DEBOUNCE_MS = 300;

/* The preview endpoint, named here rather than typed as a literal in the client.
 * It is a ROUTE HANDLER and not a tRPC procedure on purpose — see the module
 * header of src/app/api/studio/preview/route.ts for the connection-pool reason. */
/* Must exceed AI_IMAGE_TIMEOUT_MS in ai.service, so a slow generation fails on
 * the model vendor's own terms with a legible message rather than the caller's
 * transaction expiring underneath it. */
export const STUDIO_BACKDROP_TIMEOUT_MS = 90_000;

export const STUDIO_BACKDROP_BRIEF_MAX = 200;

/**
 * SOURCE OF TRUTH KEYWORDS: studioBackdropFileName
 *
 * WHAT:  A filesystem-safe name for a generated backdrop, derived from its brief.
 * WHY:   The brief is the only human-meaningful thing about a generated texture,
 *        so it beats a bare id when someone is looking at the ImageKit console
 *        wondering what a file is. Slugged the same way studioAssetFileName is.
 */
export function studioBackdropFileName(brief: string): string {
  const slug = brief
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return `backdrop-${slug || "design"}.png`;
}

export const STUDIO_PREVIEW_PATH = "/api/studio/preview";

export const STUDIO_DEFAULT_PROJECT_NAME = "My LinkedIn profile";

/**
 * SOURCE OF TRUTH KEYWORDS: studioAssetTitle
 *
 * WHAT:  The human-readable name stored on the exported Document.
 * WHY:   Two names per artifact, the split carousel.ts already documents as a
 *        real bug class: `title` is prose a person reads in the documents
 *        library, `fileName` is filesystem- and header-safe. Conflating them
 *        produces either an unreadable library or a broken download.
 */
export function studioAssetTitle(projectName: string, assetLabel: string): string {
  const name = projectName.replace(/\s+/g, " ").trim();
  const label = assetLabel.replace(/\s+/g, " ").trim();
  return `${name || "Profile"} — ${label}`.slice(0, 200);
}

/**
 * SOURCE OF TRUTH KEYWORDS: studioAssetFileName
 *
 * WHAT:  The download filename, slugged.
 * WHY:   Same slug rules as carouselDocumentFileName — lowercase, non-alphanumeric
 *        collapsed to hyphens, trimmed, capped — so a member with an emoji in
 *        their project name still gets a file their OS will accept.
 */
export function studioAssetFileName(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${slug || "profile-asset"}.png`;
}

/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: IMAGEKIT_STUDIO_FOLDER, STUDIO_PNG_MIME_TYPE,
 *   STUDIO_RENDER_TIMEOUT_MS, STUDIO_PREVIEW_TIMEOUT_MS,
 *   STUDIO_PREVIEW_DEBOUNCE_MS, studioAssetTitle, studioAssetFileName,
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

/* Tighter than a render, deliberately. A preview that takes longer than this has
 * already lost its race with the user's next keystroke, so failing fast beats
 * holding a pooled connection open for a result nobody will see. */
export const STUDIO_PREVIEW_TIMEOUT_MS = 15_000;

/* The editor waits this long after the last keystroke before asking the server
 * to draw. Paired with the `preview` rate limit on RESOURCES.studio: at 600ms a
 * continuously-typing user tops out near 100 renders a minute, so the 30/min cap
 * is what actually bounds it — this value is about latency, that one is about
 * protecting the pipeline. */
export const STUDIO_PREVIEW_DEBOUNCE_MS = 600;

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

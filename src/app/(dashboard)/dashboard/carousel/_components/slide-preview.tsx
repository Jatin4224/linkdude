"use client";

/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: SlidePreview, SlidePreviewProps, CAROUSEL_PREVIEW_PATH,
 *   renderSlidePreview, carousel live preview, RenderPreview
 *
 * WHAT:  One slide, drawn by the server, beside the editor.
 * WHY:   Before this existed the deck's design was invisible until someone rendered
 *        the PDF and opened the download — every layout decision was made blind.
 *
 *        It draws the EDITING BUFFER, not the saved row, and is therefore the one
 *        surface here that is never gated on `isDirty`: showing unsaved work is its
 *        entire job. Render and Publish stay gated, because those produce files.
 *
 *        Posts to a ROUTE HANDLER rather than a tRPC procedure — every tRPC
 *        mutation opens a Prisma transaction, and a debounced render holding a
 *        pooled connection starves Better Auth of one. The full account is in
 *        src/app/api/carousel/preview/route.ts.
 * WHERE: The slide editor's preview column.
 */

import * as React from "react";

import {
  CAROUSEL_PAGE_PRESETS,
  type CarouselPagePreset,
  type CarouselSlide,
  type CarouselSlidePreviewValues,
  type CarouselTemplate,
} from "@/lib/types";
import {
  CAROUSEL_PREVIEW_DEBOUNCE_MS,
  CAROUSEL_PREVIEW_PATH,
  CAROUSEL_SLIDE_KIND_LABELS,
} from "@/lib/config";
import { RenderPreview } from "@/components/global/render-preview";

export interface SlidePreviewProps {
  slide: CarouselSlide;
  index: number;
  total: number;
  templateId: CarouselTemplate;
  page: CarouselPagePreset;
  className?: string;
}

/* Stable identity at MODULE scope, not merely memoized: RenderPreview's debounce
 * effect lists this in its deps, and a callback rebuilt per render would re-arm the
 * timer on every keystroke so it never fired — the preview would never draw. It
 * closes over nothing, so module scope says that outright. */
async function renderSlidePreview(
  payload: CarouselSlidePreviewValues,
  signal: AbortSignal,
): Promise<{ dataUrl: string }> {
  const response = await fetch(CAROUSEL_PREVIEW_PATH, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    /* Superseded renders are dropped at the network layer rather than resolved and
     * thrown away, so a burst of typing cannot queue work nobody will see. */
    signal,
  });

  if (!response.ok) {
    throw new Error(
      response.status === 401
        ? "Signed out — reload the page"
        : "That slide could not be drawn",
    );
  }

  /* An object URL, not a base64 data URI: the bytes arrive as a blob, and
   * re-encoding them would add a third again to something rebuilt on every
   * keystroke. RenderPreview owns revoking it. */
  const blob = await response.blob();
  return { dataUrl: URL.createObjectURL(blob) };
}

export function SlidePreview({
  slide,
  index,
  total,
  templateId,
  page,
  className,
}: SlidePreviewProps) {
  const preset = CAROUSEL_PAGE_PRESETS[page];

  const caption = (
    <>
      <span className="tech-label">{CAROUSEL_SLIDE_KIND_LABELS[slide.kind]}</span>
      <span className="font-mono text-[0.6875rem] text-foreground/80">
        {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
      </span>
      <span className="text-muted-foreground">{preset.label}</span>
    </>
  );

  /* A heading is required by carouselSlideSchema, so an empty one would make every
   * debounce tick a guaranteed 400 and paint the caption red while someone is still
   * typing the first word. Naming the gap is more useful than rendering a slide
   * that cannot exist — and it keeps the frame, so the column does not resize when
   * the heading lands. */
  if (slide.heading.trim().length === 0) {
    return (
      <div className={className}>
        <div className="tech-bracket relative">
          <div
            className="tech-panel flex w-full items-center justify-center overflow-hidden p-6"
            style={{
              aspectRatio: `${String(preset.width)} / ${String(preset.height)}`,
            }}
          >
            <p className="text-center text-sm text-muted-foreground">
              This slide needs a heading before it can be drawn.
            </p>
          </div>
        </div>
        <p className="tech-label mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 normal-case tracking-normal">
          {caption}
        </p>
      </div>
    );
  }

  return (
    <RenderPreview
      payload={{ slide, index, total, templateId, page }}
      onRender={renderSlidePreview}
      debounceMs={CAROUSEL_PREVIEW_DEBOUNCE_MS}
      aspect={{ width: preset.width, height: preset.height }}
      alt={`Slide ${String(index + 1)} preview`}
      caption={caption}
      {...(className ? { className } : {})}
    />
  );
}

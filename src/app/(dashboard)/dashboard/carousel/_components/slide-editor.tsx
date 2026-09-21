/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use client";

/**
 * SOURCE OF TRUTH KEYWORDS: SlideEditor, SlideEditorProps, SLIDE_KIND_LABELS
 *
 * WHAT:  The edit step between a generated draft and a rendered PDF — per-slide
 *        heading and body, reorder, delete, then Render and Download.
 * WHY:   Editing exists because the model drafts, it does not finish. Saving is
 *        explicit rather than per-keystroke: every save is a mutation inside a
 *        transaction, and autosaving a textarea would fire one per character.
 *
 *        Slides are held in local state and written as a whole array, matching
 *        updateCarouselSchema — reordering is a splice here and a single write
 *        there, rather than a patch protocol that would become a second source of
 *        truth about deck order.
 * WHERE: Rendered by carousel-workspace when a deck is selected.
 */

import * as React from "react";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  DownloadIcon,
  Loader2Icon,
  SendIcon,
  TrashIcon,
} from "lucide-react";

import {
  CAROUSEL_BODY_MAX,
  CAROUSEL_HEADING_MAX,
  CAROUSEL_MIN_SLIDES,
  type CarouselSlide,
  type CarouselSlideKind,
  type CarouselSlides,
} from "@/lib/types";
import { buildAttachmentUrl } from "@/lib/config";
import { Badge } from "@/components/ui/badge";
import { TechButton } from "@/components/global/tech";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const SLIDE_KIND_LABELS: Record<CarouselSlideKind, string> = {
  cover: "Cover",
  content: "Slide",
  cta: "Call to action",
};

export interface SlideEditorProps {
  slides: CarouselSlides;
  onChange: (slides: CarouselSlides) => void;
  onSave: () => void;
  onRender: () => void;
  isSaving: boolean;
  isRendering: boolean;
  isDirty: boolean;
  /** Present once a render has succeeded. */
  documentUrl?: string | undefined;
  documentFileName?: string | undefined;
  /** The Document row id — what publishing needs. Present with documentUrl. */
  documentId?: string | undefined;
  lastError?: string | null | undefined;
  onPublish?: (() => void) | undefined;
}

export function SlideEditor({
  slides,
  onChange,
  onSave,
  onRender,
  isSaving,
  isRendering,
  isDirty,
  documentUrl,
  documentFileName,
  documentId,
  lastError,
  onPublish,
}: SlideEditorProps) {
  function updateSlide(index: number, patch: Partial<CarouselSlide>) {
    onChange(
      slides.map((slide, i) => (i === index ? { ...slide, ...patch } : slide)),
    );
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= slides.length) return;
    const next = [...slides];
    const [moved] = next.splice(index, 1);
    if (!moved) return;
    next.splice(target, 0, moved);
    onChange(next);
  }

  function remove(index: number) {
    onChange(slides.filter((_, i) => i !== index));
  }

  /* The deck minimum is enforced by the schema on save; disabling delete at the
   * floor turns that into something the user can see rather than an error they
   * hit after committing to the action. */
  const canDelete = slides.length > CAROUSEL_MIN_SLIDES;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {slides.length} slides
          {isDirty ? " · unsaved changes" : null}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onSave}
            disabled={!isDirty || isSaving || isRendering}
          >
            {isSaving ? <Loader2Icon className="size-4 animate-spin" /> : null}
            Save changes
          </Button>
          <Button
            variant="brand"
            size="sm"
            onClick={onRender}
            /* Rendering unsaved slides would produce a PDF of the stored deck,
             * not the one on screen — the file would silently disagree with the
             * editor. Saving first is required, not merely advised. */
            disabled={isDirty || isRendering || isSaving}
          >
            {isRendering ? (
              <Loader2Icon className="size-4 animate-spin" />
            ) : null}
            {isRendering ? "Rendering…" : "Render PDF"}
          </Button>
          {documentUrl ? (
            /* buttonVariants rather than <Button asChild> — this Button is a
               base-ui primitive with no asChild slot, so a link that looks like a
               button borrows the classes. */
            <a
              href={buildAttachmentUrl(documentUrl)}
              aria-label={`Download ${documentFileName ?? "carousel PDF"}`}
              /* No `download` attribute: it is ignored on cross-origin links, so
               * the save is driven by ImageKit's Content-Disposition instead —
               * see buildAttachmentUrl. No target="_blank" either, because an
               * attachment response never navigates the page away. */
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              <DownloadIcon className="size-4" />
              Download
            </a>
          ) : null}
          {documentId && onPublish ? (
            <TechButton
              size="sm"
              onClick={onPublish}
              /* Gated on isDirty for the same reason Render is: publishing while
               * the buffer differs from the stored deck would post the PDF of the
               * OLD slides, which is the one mistake here that reaches an
               * audience and cannot be taken back. */
              disabled={isDirty || isRendering || isSaving}
            >
              <SendIcon className="size-4" />
              Publish
            </TechButton>
          ) : null}
        </div>
      </div>

      {lastError ? (
        <Card className="border-destructive/40">
          <CardContent className="py-3 text-sm text-destructive">
            {lastError}
          </CardContent>
        </Card>
      ) : null}

      <div className="flex flex-col gap-3">
        {slides.map((slide, index) => {
          const headingOver = slide.heading.length > CAROUSEL_HEADING_MAX;
          const bodyOver = slide.body.length > CAROUSEL_BODY_MAX;

          return (
            <Card key={index}>
              <CardContent className="flex flex-col gap-3 py-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">
                      {String(index + 1).padStart(2, "0")}
                    </Badge>
                    <Badge variant="outline">
                      {SLIDE_KIND_LABELS[slide.kind]}
                    </Badge>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => move(index, -1)}
                      disabled={index === 0}
                      aria-label="Move slide up"
                    >
                      <ArrowUpIcon className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => move(index, 1)}
                      disabled={index === slides.length - 1}
                      aria-label="Move slide down"
                    >
                      <ArrowDownIcon className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => remove(index)}
                      disabled={!canDelete}
                      aria-label="Delete slide"
                    >
                      <TrashIcon className="size-4" />
                    </Button>
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <Input
                    value={slide.heading}
                    onChange={(event) =>
                      updateSlide(index, { heading: event.target.value })
                    }
                    placeholder="Heading"
                    className={cn(headingOver && "border-destructive")}
                  />
                  <span
                    className={cn(
                      "text-xs text-muted-foreground",
                      headingOver && "text-destructive",
                    )}
                  >
                    {slide.heading.length} / {CAROUSEL_HEADING_MAX}
                  </span>
                </div>

                <div className="flex flex-col gap-1">
                  <Textarea
                    value={slide.body}
                    onChange={(event) =>
                      updateSlide(index, { body: event.target.value })
                    }
                    rows={3}
                    placeholder="Body (optional)"
                    className={cn(bodyOver && "border-destructive")}
                  />
                  <span
                    className={cn(
                      "text-xs text-muted-foreground",
                      bodyOver && "text-destructive",
                    )}
                  >
                    {slide.body.length} / {CAROUSEL_BODY_MAX}
                  </span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

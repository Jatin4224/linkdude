"use client";

/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: SlideImageExport, SlideImageExportProps, jszip,
 *   carouselSlideImageFileName, carouselImagesZipFileName, PNG slides, download
 *
 * WHAT:  Downloads the deck as a zip of one PNG per slide.
 * WHY:   A deck is useful in two shapes: the PDF LinkedIn accepts as a document
 *        post, and loose images for a deck that will be posted elsewhere, dropped
 *        into a another tool, or pasted one slide at a time.
 *
 *        BUILT IN THE BROWSER, from the preview route, rather than as a stored
 *        artifact. The alternative — a carousel.renderImages procedure — would need
 *        a new permission, a quota decision, an audit verb and a second ImageKit
 *        object that nothing in the Documents library knows how to lifecycle, all
 *        for bytes the client can already fetch. It would also run twelve
 *        rasterisations inside a Prisma transaction, which is the exact shape that
 *        caused the outage the preview route exists to avoid.
 *
 *        Labelled "Download PNGs", never "Export". In this app export means the
 *        STORED artifact: these bytes have no Document row and nothing records that
 *        they were made. Gated on a clean buffer for the same reason Render and
 *        Publish are — not because a dirty zip would be wrong, but because one rule
 *        for the whole toolbar ("save first") is what makes the toolbar legible.
 * WHERE: The slide editor's toolbar, beside Download.
 */

import * as React from "react";
import { ImagesIcon, Loader2Icon } from "lucide-react";
import { toast } from "sonner";

import {
  type CarouselPagePreset,
  type CarouselSlides,
  type CarouselTemplate,
} from "@/lib/types";
import {
  CAROUSEL_PREVIEW_PATH,
  carouselImagesZipFileName,
  carouselSlideImageFileName,
} from "@/lib/config";
import { Button } from "@/components/ui/button";

export interface SlideImageExportProps {
  slides: CarouselSlides;
  templateId: CarouselTemplate;
  page: CarouselPagePreset;
  /** Names the archive. The deck's public title, or its topic. */
  deckTitle: string;
  disabled?: boolean;
}

export function SlideImageExport({
  slides,
  templateId,
  page,
  deckTitle,
  disabled = false,
}: SlideImageExportProps) {
  /* One piece of state carrying both the fact and the progress: N round-trips is
   * the one place this can look hung, so the count is not optional. */
  const [renderedCount, setRenderedCount] = React.useState<number | null>(null);
  const isBuilding = renderedCount !== null;

  async function downloadSlides() {
    setRenderedCount(0);

    try {
      /* Imported on demand, not at module scope: jszip is the largest dependency
       * this route would pull, and nobody who never presses this button should pay
       * for it on first paint. */
      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();

      /* Sequential, not Promise.all — satori is CPU-bound on one thread, so twelve
       * parallel requests multiply the memory held at once for no wall-clock gain,
       * and they would land as a burst on a route with no rate limit. */
      for (const [index, slide] of slides.entries()) {
        const response = await fetch(CAROUSEL_PREVIEW_PATH, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            slide,
            index,
            total: slides.length,
            templateId,
            page,
          }),
        });

        if (!response.ok) {
          throw new Error(`Slide ${String(index + 1)} could not be drawn`);
        }

        zip.file(
          carouselSlideImageFileName(index, slides.length),
          await response.blob(),
        );
        setRenderedCount(index + 1);
      }

      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);

      const link = window.document.createElement("a");
      link.href = url;
      link.download = carouselImagesZipFileName(deckTitle);
      link.click();

      /* Released immediately: the click has already handed the blob to the browser's
       * download manager, and holding the URL only keeps the bytes in memory. */
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Those slide images could not be built",
      );
    } finally {
      setRenderedCount(null);
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={disabled || isBuilding}
      onClick={() => {
        void downloadSlides();
      }}
    >
      {isBuilding ? (
        <Loader2Icon className="size-4 animate-spin" />
      ) : (
        <ImagesIcon className="size-4" />
      )}
      {isBuilding
        ? `Building zip… (${String(renderedCount)}/${String(slides.length)})`
        : `Download PNGs (${String(slides.length)})`}
    </Button>
  );
}

"use client";

/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: DeckReview, DeckReviewProps, review deck, all slides,
 *   SlidePreview, flow
 *
 * WHAT:  Every slide of the deck, rendered, in order, in one dialog.
 * WHY:   A carousel is judged by its FLOW — whether slide three lands after slide
 *        two — and the editor shows one slide at a time behind a strip of numbers.
 *        There was no way to see the argument as a reader swipes it without
 *        rendering the PDF and opening the file.
 *
 *        ON DEMAND, and that is the whole reason this can exist. Live thumbnails
 *        were rejected because satori is single-threaded at roughly 50ms a slide,
 *        so a twelve-slide strip costs ~600ms of server CPU per debounce tick per
 *        editing member. Opening a dialog renders each slide once, at the one
 *        moment someone actually wants to compare them.
 *
 *        Each cell is the ordinary SlidePreview, so these are the same renders the
 *        editor and the exported PDF produce — not a second, cheaper approximation
 *        that could disagree with them.
 * WHERE: Opened from the slide editor's toolbar, beside Render.
 */

import {
  type CarouselBrandValues,
  type CarouselPagePreset,
  type CarouselSlides,
  type CarouselTemplate,
} from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SlidePreview } from "./slide-preview";

export interface DeckReviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slides: CarouselSlides;
  templateId: CarouselTemplate;
  page: CarouselPagePreset;
  brand: CarouselBrandValues;
}

export function DeckReview({
  open,
  onOpenChange,
  slides,
  templateId,
  page,
  brand,
}: DeckReviewProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Scoped at its own root: a dialog is PORTALED to the body, so it is not a
          descendant of the editor's surface and would otherwise open as a rounded
          panel over a square page. */}
      <DialogContent className="tech-scope max-h-[88vh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Review deck</DialogTitle>
          <DialogDescription>
            Every slide as it will render, in order. This draws the deck you are
            editing — including changes you have not saved.
          </DialogDescription>
        </DialogHeader>

        {/* Three across: wide enough that a heading is readable, narrow enough
            that a swipe's worth of slides is on screen together. */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {slides.map((slide, index) => (
            <div
              /* Index is a stable key HERE, unlike in the editor: this list is
                 read-only, so nothing reorders underneath it. */
              key={index}
              className="flex flex-col gap-2"
            >
              <SlidePreview
                slide={slide}
                index={index}
                total={slides.length}
                templateId={templateId}
                page={page}
                brand={brand}
              />
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

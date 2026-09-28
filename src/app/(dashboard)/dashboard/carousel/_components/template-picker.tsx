"use client";

/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: TemplatePicker, TemplatePickerProps,
 *   CAROUSEL_TEMPLATE_SAMPLE_SLIDE, renderSlidePreview, template thumbnail
 *
 * WHAT:  The template chooser in the new-carousel dialog — one real rendered
 *        sample slide per template, not a dropdown of names.
 * WHY:   Five templates, two of them illustrated, are indistinguishable as a list
 *        of labels. "Notebook — paper, marker headlines" describes a design nobody
 *        has seen, and the only way to find out used to be to spend a generation.
 *
 *        THE THUMBNAILS ARE REAL RENDERS, through the same route and the same
 *        engine that draws the deck. A mocked-up swatch would be a second
 *        description of the design that could drift from it — and drift silently,
 *        because nothing would ever compare the two.
 *
 *        Every thumbnail draws the SAME sample slide. Comparison only works with
 *        the words held constant; different copy per card would have people
 *        choosing on the sentence rather than on the design.
 *
 *        Each card owns its own request rather than the parent fetching five: the
 *        preview component already handles the in-flight, failed and last-good
 *        states, and centralising that here would mean reimplementing it.
 * WHERE: The template field of CarouselForm.
 */

import * as React from "react";

import {
  CAROUSEL_PAGE_PRESETS,
  CAROUSEL_TEMPLATES,
  type CarouselPagePreset,
  type CarouselTemplate,
} from "@/lib/types";
import {
  CAROUSEL_PREVIEW_DEBOUNCE_MS,
  CAROUSEL_TEMPLATE_LABELS,
  CAROUSEL_TEMPLATE_SAMPLE_SLIDE,
} from "@/lib/config";
import { RenderPreview } from "@/components/global/render-preview";
import { cn } from "@/lib/utils";
import { renderSlidePreview } from "./slide-preview";

export interface TemplatePickerProps {
  value: CarouselTemplate;
  onChange: (template: CarouselTemplate) => void;
  /** Thumbnails are drawn in the shape the deck will actually be. */
  page: CarouselPagePreset;
  disabled?: boolean;
}

export function TemplatePicker({
  value,
  onChange,
  page,
  disabled = false,
}: TemplatePickerProps) {
  const preset = CAROUSEL_PAGE_PRESETS[page];

  return (
    /* Two across at every width. The picker sits in a fixed-width column beside
       the brief, so a breakpoint-driven third column would only shrink each
       thumbnail below the size at which the templates are distinguishable —
       which is the entire reason these are renders rather than labels. */
    <div className="grid grid-cols-2 gap-3">
      {CAROUSEL_TEMPLATES.map((template) => {
        const isSelected = template === value;
        /* The label is split so the card can lead with the name and keep the
         * description as the quiet half — the config stores them as one string
         * because everywhere else quotes it whole. */
        const [name, description] = CAROUSEL_TEMPLATE_LABELS[template].split(
          " — ",
        );

        return (
          <button
            key={template}
            type="button"
            disabled={disabled}
            onClick={() => onChange(template)}
            aria-pressed={isSelected}
            className={cn(
              "flex flex-col gap-2 rounded-lg border p-2 text-left transition-colors",
              "hover:bg-accent/40 disabled:cursor-not-allowed disabled:opacity-60",
              isSelected ? "border-primary bg-accent/30" : "border-border",
            )}
          >
            <RenderPreview
              /* Static: the payload never changes for a given template and shape,
                 so this renders once and then sits on its last good frame. */
              payload={{
                slide: CAROUSEL_TEMPLATE_SAMPLE_SLIDE,
                index: 0,
                total: 3,
                templateId: template,
                page,
              }}
              onRender={renderSlidePreview}
              debounceMs={CAROUSEL_PREVIEW_DEBOUNCE_MS}
              aspect={{ width: preset.width, height: preset.height }}
              alt={`${name ?? template} sample slide`}
            />
            <span className="flex flex-col">
              <span className="text-xs font-medium">{name ?? template}</span>
              {description ? (
                <span className="text-[0.6875rem] leading-tight text-muted-foreground">
                  {description}
                </span>
              ) : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}

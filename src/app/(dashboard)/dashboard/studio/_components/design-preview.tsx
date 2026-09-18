"use client";

/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: DesignPreview, DesignPreviewProps, safe zone overlay,
 *   debounced server render, last good frame
 *
 * WHAT:  Shows what a design will actually export as, with LinkedIn's safe zones
 *        drawn over it.
 * WHY:   THE PREVIEW IS A REAL RENDER, debounced — not a DOM approximation of
 *        one. A hand-built twin would have to reproduce satori's flexbox subset
 *        and its font metrics, and the two would disagree the first time a
 *        headline wrapped at 59 characters in one and 61 in the other. That
 *        disagreement is invisible until someone downloads a file that does not
 *        match what they approved, which is the one failure a design tool cannot
 *        have.
 *
 *        THE LAST GOOD FRAME STAYS ON SCREEN. A render that is in flight, or that
 *        failed, never clears what is already drawn — the first build blanked the
 *        canvas and printed an error over it, so a single hiccup while typing
 *        made the whole editor look broken. A stale frame plus a quiet "updating"
 *        hint is a far more honest picture of the state than an empty box.
 *
 *        In-flight requests are ABORTED when superseded, which is what stops a
 *        burst of typing piling up renders the user will never see — and what
 *        removed the "Failed to fetch" noise those aborted-by-navigation requests
 *        produced.
 *
 *        The DOM layer draws GUIDES ONLY — the avatar circle and the mobile crop
 *        — positioned from the same normalised coordinates the renderer reads. It
 *        never tries to reproduce pixels.
 * WHERE: The studio editor, beside the content form.
 */

import * as React from "react";

import { DESIGN_CANVAS_PRESETS, type DesignDoc } from "@/lib/types";
import { STUDIO_PREVIEW_DEBOUNCE_MS } from "@/lib/config";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export interface DesignPreviewProps {
  doc: DesignDoc;
  /** Renders the doc server-side. `signal` lets a superseded render be dropped. */
  onRender: (doc: DesignDoc, signal: AbortSignal) => Promise<{ dataUrl: string }>;
  showSafeZones?: boolean;
  className?: string;
}

export function DesignPreview({
  doc,
  onRender,
  showSafeZones = true,
  className,
}: DesignPreviewProps) {
  const preset = DESIGN_CANVAS_PRESETS[doc.canvas];

  const [dataUrl, setDataUrl] = React.useState<string | null>(null);
  const [isRendering, setIsRendering] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  /* Serialised rather than watched by reference: the form hands us a new object
   * on every keystroke, so an identity check would redraw constantly and a deep
   * compare would cost more than the string. */
  const serialized = JSON.stringify(doc);

  React.useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    const timer = setTimeout(() => {
      setIsRendering(true);

      void (async () => {
        try {
          const result = await onRender(
            JSON.parse(serialized) as DesignDoc,
            controller.signal,
          );
          if (cancelled) {
            URL.revokeObjectURL(result.dataUrl);
            return;
          }
          setDataUrl((previous) => {
            /* Release the frame this one replaces, or a render per keystroke
             * leaks a blob per keystroke for as long as the editor is open. */
            if (previous) URL.revokeObjectURL(previous);
            return result.dataUrl;
          });
          setError(null);
        } catch (cause) {
          /* An abort is this component's own doing, not a failure — reporting it
           * would flash an error every time someone types a second character. */
          if (cancelled || controller.signal.aborted) return;
          setError(cause instanceof Error ? cause.message : "Preview failed");
        } finally {
          if (!cancelled) setIsRendering(false);
        }
      })();
    }, STUDIO_PREVIEW_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(timer);
    };
  }, [serialized, onRender]);

  /* Release the final frame when the editor closes. */
  React.useEffect(
    () => () => {
      setDataUrl((previous) => {
        if (previous) URL.revokeObjectURL(previous);
        return null;
      });
    },
    [],
  );

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div
        className="relative w-full overflow-hidden rounded-lg border bg-muted/40"
        /* Reserves the exact aspect before the first render lands, so the form
         * beside it does not jump when the image arrives. */
        style={{ aspectRatio: `${String(preset.width)} / ${String(preset.height)}` }}
      >
        {dataUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element -- an object URL
             from our own renderer; next/image would only re-encode it. */
          <img
            src={dataUrl}
            alt={`${preset.label} preview`}
            className={cn(
              "h-full w-full object-contain transition-opacity duration-150",
              /* Dimmed, never blanked, while the next frame renders. */
              isRendering && "opacity-60",
            )}
          />
        ) : (
          <Skeleton className="h-full w-full" />
        )}

        {showSafeZones
          ? preset.safeZones.map((zone) => (
              <div
                key={zone.id}
                aria-hidden
                title={zone.label}
                className={cn(
                  "pointer-events-none absolute border-2 border-dashed border-foreground/30",
                  zone.shape === "circle" ? "rounded-full" : "rounded-none",
                )}
                style={
                  zone.shape === "circle"
                    ? {
                        /* x/y are the CENTRE for a circle, and width/height are
                         * the same diameter expressed against each axis — the
                         * canvas is 4:1, so one number could not do both. */
                        left: `${String((zone.x - zone.width / 2) * 100)}%`,
                        top: `${String((zone.y - zone.height / 2) * 100)}%`,
                        width: `${String(zone.width * 100)}%`,
                        height: `${String(zone.height * 100)}%`,
                      }
                    : {
                        left: `${String(zone.x * 100)}%`,
                        top: `${String(zone.y * 100)}%`,
                        width: `${String(zone.width * 100)}%`,
                        height: `${String(zone.height * 100)}%`,
                      }
                }
              />
            ))
          : null}
      </div>

      <p className="text-xs text-muted-foreground">
        {preset.label} · {preset.width}×{preset.height}px
        {showSafeZones && preset.safeZones.length > 0
          ? " · dashed areas are covered on LinkedIn"
          : null}
        {isRendering ? <span className="ml-2 opacity-70">updating…</span> : null}
        {error && !isRendering ? (
          /* Shown BESIDE the caption rather than over the canvas, because the
           * last good frame is still the most useful thing on screen. */
          <span className="ml-2 text-destructive">{error}</span>
        ) : null}
      </p>
    </div>
  );
}

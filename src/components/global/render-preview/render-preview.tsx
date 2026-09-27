"use client";

/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: RenderPreview, RenderPreviewProps, debounced server
 *   render, last good frame, AbortController, revokeObjectURL, aspect reservation
 *
 * WHAT:  Shows what a server-rendered document will actually export as: posts the
 *        payload on a debounce, draws the returned image, and keeps the last good
 *        frame on screen while the next one renders.
 * WHY:   THE PREVIEW IS A REAL RENDER, debounced — never a DOM approximation. A
 *        hand-built twin would have to reproduce satori's flexbox subset and its
 *        font metrics, and the two would disagree the first time a headline wrapped
 *        at 59 characters in one and 61 in the other. That disagreement is
 *        invisible until someone downloads a file that does not match what they
 *        approved, which is the one failure a design tool cannot have.
 *
 *        THE LAST GOOD FRAME STAYS ON SCREEN. A render that is in flight, or that
 *        failed, never clears what is already drawn — blanking the canvas and
 *        printing an error over it made a single hiccup while typing look like a
 *        broken editor. A stale frame plus a quiet "updating" hint is a far more
 *        honest picture of the state than an empty box.
 *
 *        In-flight requests are ABORTED when superseded, which is what stops a
 *        burst of typing piling up renders nobody will see — and what removes the
 *        "Failed to fetch" noise those aborted requests produce.
 *
 *        GLOBAL, and generic over the payload, because this component owns
 *        RESOURCE LIFETIMES: three revokeObjectURL sites, an abort that must not be
 *        reported as an error, and a debounce that silently stops firing if its
 *        callback is not referentially stable. A second copy of that would not look
 *        broken — it would leak one blob per keystroke and flash errors while
 *        typing, and whoever fixed one copy would never learn the other existed.
 *        That is a different class of duplication from table scaffolding, which is
 *        why this globalised at its second consumer rather than its fourth.
 *
 *        It draws the frame and the caption; it draws NO guides. Overlays are the
 *        caller's, positioned in the caller's own coordinate space.
 * WHERE: Composed by DesignPreview (studio, which adds safe-zone guides) and by the
 *        carousel's SlidePreview. Both pass their own debounce budget from config.
 */

import * as React from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export interface RenderPreviewProps<TPayload> {
  /** Serialised to decide when a redraw is due, so a fresh object per keystroke
   *  does not mean a render per keystroke. */
  payload: TPayload;
  /** Renders the payload server-side. `signal` lets a superseded render be dropped. */
  onRender: (
    payload: TPayload,
    signal: AbortSignal,
  ) => Promise<{ dataUrl: string }>;
  /** How long to wait after a change. Per-feature, from lib/config. */
  debounceMs: number;
  /** Reserves the exact frame before the first render lands, so nothing jumps. */
  aspect: { width: number; height: number };
  alt: string;
  /** Caption content. The rendering hint and any error are appended to this line. */
  caption?: React.ReactNode;
  /** Guides drawn over the frame, in the caller's coordinates. */
  overlay?: React.ReactNode;
  className?: string;
}

export function RenderPreview<TPayload>({
  payload,
  onRender,
  debounceMs,
  aspect,
  alt,
  caption,
  overlay,
  className,
}: RenderPreviewProps<TPayload>) {
  const [dataUrl, setDataUrl] = React.useState<string | null>(null);
  const [isRendering, setIsRendering] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  /* Serialised rather than watched by reference: the caller hands us a new object
   * on every keystroke, so an identity check would redraw constantly and a deep
   * compare would cost more than the string. */
  const serialized = JSON.stringify(payload);

  React.useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    const timer = setTimeout(() => {
      setIsRendering(true);

      void (async () => {
        try {
          /* The payload closed over here belongs to the render that armed this
           * timer, which is the same render `serialized` was computed from — so it
           * is already the right snapshot, with no re-parse and no cast. */
          const result = await onRender(payload, controller.signal);
          if (cancelled) {
            URL.revokeObjectURL(result.dataUrl);
            return;
          }
          setDataUrl((previous) => {
            /* Release the frame this one replaces, or a render per keystroke leaks
             * a blob per keystroke for as long as the editor is open. */
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
    }, debounceMs);

    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(timer);
    };
    /* `serialized` stands in for `payload` deliberately — see the note above it.
     * Listing the object itself would re-arm this timer on every parent render,
     * and with a parent that re-renders per keystroke the timeout would never fire
     * at all, so the preview would never draw. */
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [serialized, onRender, debounceMs]);

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
      {/* The marks live on a wrapper rather than on the canvas: the canvas has to
          clip the rendered image to its frame, and a clipping box would also clip
          an overlay the moment it travels outward on hover. */}
      <div className="tech-bracket relative">
        <div
          className="tech-panel relative w-full overflow-hidden"
          style={{
            aspectRatio: `${String(aspect.width)} / ${String(aspect.height)}`,
          }}
        >
          {dataUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element -- an object URL
               from our own renderer; next/image would only re-encode it. */
            <img
              src={dataUrl}
              alt={alt}
              className={cn(
                "h-full w-full object-contain transition-opacity duration-150",
                /* Dimmed, never blanked, while the next frame renders. */
                isRendering && "opacity-60",
              )}
            />
          ) : (
            <Skeleton className="h-full w-full" />
          )}

          {overlay}
        </div>
      </div>

      <p className="tech-label flex flex-wrap items-center gap-x-4 gap-y-1 normal-case tracking-normal">
        {caption}
        {isRendering ? (
          <span className="ml-2 inline-flex items-center gap-1 align-middle">
            {/* A stroke redrawing itself rather than a ring spinning — the preview
                is being DRAWN, and the indicator should say so. */}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
              <circle
                cx="12"
                cy="12"
                r="9"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
            <span className="tech-label">Rendering</span>
          </span>
        ) : null}
        {error && !isRendering ? (
          /* Shown BESIDE the caption rather than over the canvas, because the last
           * good frame is still the most useful thing on screen. */
          <span className="ml-2 text-destructive">{error}</span>
        ) : null}
      </p>
    </div>
  );
}

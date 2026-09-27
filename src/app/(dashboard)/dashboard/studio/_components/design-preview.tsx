"use client";

/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: DesignPreview, DesignPreviewProps, safe zone overlay,
 *   SafeZoneDoodle, RenderPreview
 *
 * WHAT:  A design's live preview with LinkedIn's safe zones drawn over it.
 * WHY:   The debounce, the abort, the last-good-frame rule and the blob lifetimes
 *        all moved to the global RenderPreview when the carousel editor needed the
 *        same machinery — the reasoning for each of those choices now lives in that
 *        component's header. This file kept the part that is genuinely about
 *        DESIGNS: which regions LinkedIn obscures, and saying so on the canvas.
 *
 *        Its props did not change, so the studio workspace calls it exactly as
 *        before.
 *
 *        The DOM layer draws GUIDES ONLY — the avatar circle and the mobile crop —
 *        positioned from the same normalised coordinates the renderer reads. It
 *        never tries to reproduce pixels.
 * WHERE: The studio editor, beside the content form.
 */

import * as React from "react";

import {
  DESIGN_CANVAS_PRESETS,
  type DesignDoc,
  type DesignSafeZone,
} from "@/lib/types";
import { STUDIO_PREVIEW_DEBOUNCE_MS } from "@/lib/config";
import { RenderPreview } from "@/components/global/render-preview";
import { cn } from "@/lib/utils";

export interface DesignPreviewProps {
  doc: DesignDoc;
  /** Renders the doc server-side. `signal` lets a superseded render be dropped. */
  onRender: (doc: DesignDoc, signal: AbortSignal) => Promise<{ dataUrl: string }>;
  showSafeZones?: boolean;
  className?: string;
}

/**
 * SOURCE OF TRUTH KEYWORDS: SafeZoneDoodle
 *
 * WHAT:  A drawn note pointing at the avatar's footprint.
 * WHY:   The dashed circle alone says "something is here" without saying what or
 *        why. The single most expensive mistake on a LinkedIn banner is putting the
 *        thing you care about where your own face lands, and a label is the
 *        cheapest possible fix for it.
 *
 *        `currentColor` throughout, so it inherits whatever the caller sets and
 *        stays inside the no-hardcoded-colour rule.
 */
function SafeZoneDoodle({ zone }: { zone: DesignSafeZone }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute flex flex-col items-center text-muted-foreground"
      style={{
        /* Anchored just above and right of the circle, where a banner's content
         * never sits anyway. */
        left: `${String((zone.x + zone.width / 2) * 100)}%`,
        top: `${String(Math.max(zone.y - zone.height / 2, 0) * 100)}%`,
      }}
    >
      <span className="tech-label whitespace-nowrap">Profile photo</span>
    </div>
  );
}

export function DesignPreview({
  doc,
  onRender,
  showSafeZones = true,
  className,
}: DesignPreviewProps) {
  const preset = DESIGN_CANVAS_PRESETS[doc.canvas];

  return (
    <RenderPreview
      payload={doc}
      onRender={onRender}
      debounceMs={STUDIO_PREVIEW_DEBOUNCE_MS}
      aspect={{ width: preset.width, height: preset.height }}
      alt={`${preset.label} preview`}
      {...(className ? { className } : {})}
      caption={
        <>
          <span className="tech-label">{preset.label}</span>
          <span className="font-mono text-[0.6875rem] text-foreground/80">
            {preset.width}×{preset.height}
          </span>
          {showSafeZones && preset.safeZones.length > 0 ? (
            <span className="text-muted-foreground">
              Dashed regions are obscured on LinkedIn
            </span>
          ) : null}
        </>
      }
      overlay={
        showSafeZones ? (
          <>
            {preset.safeZones.map((zone) => (
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
                        /* x/y are the CENTRE for a circle, and width/height are the
                         * same diameter expressed against each axis — the canvas is
                         * 4:1, so one number could not do both. */
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
            ))}

            {/* Only for the avatar. A note on every guide would be noise. */}
            {preset.safeZones
              .filter((zone) => zone.id === "avatar")
              .map((zone) => (
                <SafeZoneDoodle key={`note-${zone.id}`} zone={zone} />
              ))}
          </>
        ) : null
      }
    />
  );
}

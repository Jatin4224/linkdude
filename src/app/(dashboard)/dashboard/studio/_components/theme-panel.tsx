"use client";

/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: ThemePanel, ThemePanelProps, palette picker,
 *   background pattern, studio theme tab
 *
 * WHAT:  The whole-design controls — which palette it draws with, per-slot colour
 *        overrides, and what the background is.
 * WHY:   Palette before colour, deliberately. Offering five raw colour pickers
 *        first is how a design tool produces designs that clash; offering four
 *        curated ramps first means the common path is a good result in one click,
 *        and the pickers underneath are the escape hatch rather than the entry
 *        point.
 *
 *        Background patterns are DRAWN, not generated — a gradient in the render
 *        tree. They cost no quota and no model call, stay crisp at any size, and
 *        cannot fight the text the way a generated image can. The AI backdrop
 *        control sits separately for exactly that reason: one is free and safe,
 *        the other is paid and needs judgement.
 * WHERE: The Theme tab of the studio editor.
 */

import * as React from "react";

import { DESIGN_PALETTES, DESIGN_PALETTE_KEYS, getDesignPalette } from "@/lib/config";
import {
  DESIGN_COLOR_SLOTS,
  DESIGN_PATTERNS,
  type DesignColorSlot,
  type DesignDoc,
  type DesignPattern,
} from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface ThemePanelProps {
  doc: DesignDoc;
  onChange: (doc: DesignDoc) => void;
  disabled?: boolean;
}

/* Three, not five. The set is bounded by what satori renders to PNG rather than
 * by what looks good in a picker — see the note on DESIGN_PATTERNS. */
const PATTERN_LABELS: Record<DesignPattern, string> = {
  grid: "Grid",
  glow: "Glow",
  fade: "Fade",
};

export function ThemePanel({ doc, onChange, disabled = false }: ThemePanelProps) {
  const resolved = getDesignPalette(doc.paletteId);
  const activePattern =
    doc.background.kind === "pattern" ? doc.background.pattern : null;

  function setPattern(pattern: DesignPattern | null) {
    onChange({
      ...doc,
      background:
        pattern === null
          ? { kind: "solid", color: { slot: "background", opacity: 1 } }
          : {
              kind: "pattern",
              pattern,
              color: { slot: "background", opacity: 1 },
              /* The pattern's ink is the BORDER slot at low opacity — that is
               * what makes it read as texture rather than as content. A pattern
               * drawn in the accent colour competes with the CTA. */
              ink: { slot: "border", opacity: 0.9 },
            },
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label>Palette</Label>
        <div className="grid grid-cols-2 gap-2">
          {DESIGN_PALETTE_KEYS.map((key) => {
            const palette = DESIGN_PALETTES[key];
            const isActive = doc.paletteId === key;
            return (
              <button
                key={key}
                type="button"
                aria-pressed={isActive}
                disabled={disabled}
                onClick={() => {
                  /* Switching palette CLEARS overrides. Carrying them across
                   * would silently keep an accent from the old ramp and produce
                   * a combination nobody chose. */
                  onChange({ ...doc, paletteId: key, paletteOverrides: {} });
                }}
                className={cn(
                  "tech-chip flex items-center gap-2 p-2",
                )}
              >
                <span className="flex gap-0.5">
                  {DESIGN_COLOR_SLOTS.map((slot) => (
                    <span
                      key={slot}
                      className="size-4 border border-border/50"
                      /* One of the only places a raw colour belongs in the DOM:
                       * these ARE the values, not theme tokens describing them. */
                      style={{ backgroundColor: palette[slot] }}
                    />
                  ))}
                </span>
                <span className="text-xs capitalize">{key.replace(/([A-Z])/g, " $1")}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Custom colours</Label>
        <div className="flex flex-col gap-2">
          {DESIGN_COLOR_SLOTS.map((slot: DesignColorSlot) => (
            <div key={slot} className="flex items-center gap-2">
              <input
                type="color"
                aria-label={`${slot} colour`}
                disabled={disabled}
                value={doc.paletteOverrides[slot] ?? resolved[slot]}
                onChange={(event) => {
                  onChange({
                    ...doc,
                    paletteOverrides: {
                      ...doc.paletteOverrides,
                      /* Uppercased to match designHexSchema, which accepts either
                       * case but stores one — a stored value that round-trips
                       * differently than it was written is a diff nobody made. */
                      [slot]: event.target.value.toUpperCase(),
                    },
                  });
                }}
                className="h-7 w-10 cursor-pointer rounded border bg-transparent"
              />
              <span className="text-xs capitalize text-muted-foreground">{slot}</span>
            </div>
          ))}
        </div>
        {Object.keys(doc.paletteOverrides).length > 0 ? (
          <Button
            variant="ghost"
            size="sm"
            className="self-start px-0 text-xs"
            disabled={disabled}
            onClick={() => {
              onChange({ ...doc, paletteOverrides: {} });
            }}
          >
            Reset colours
          </Button>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Background</Label>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            aria-pressed={doc.background.kind === "solid"}
            disabled={disabled}
            onClick={() => {
              setPattern(null);
            }}
            className={cn(
              "tech-chip",
              doc.background.kind === "solid"
                ? "border-brand-border bg-brand-soft text-brand-soft-foreground"
                : "bg-muted/40 hover:bg-muted",
            )}
          >
            Plain
          </button>

          {DESIGN_PATTERNS.map((pattern) => (
            <button
              key={pattern}
              type="button"
              aria-pressed={activePattern === pattern}
              disabled={disabled}
              onClick={() => {
                setPattern(pattern);
              }}
              className={cn(
                "tech-chip",
              )}
            >
              {PATTERN_LABELS[pattern]}
            </button>
          ))}
        </div>
        {doc.background.kind === "image" ? (
          <p className="text-xs text-muted-foreground">
            A generated backdrop is in use. Choosing a pattern replaces it.
          </p>
        ) : null}
      </div>
    </div>
  );
}

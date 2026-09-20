"use client";

/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: BlockStylePanel, BlockStylePanelProps,
 *   block selection, typography controls, studio style tab
 *
 * WHAT:  Pick a layer, then change how it looks — size, weight, alignment,
 *        tracking, line height and which palette slot it draws with.
 * WHY:   Selection by LIST rather than by dragging on the canvas. The preview is
 *        a rendered PNG, so there is nothing in the DOM to click; a layer list is
 *        also what every reference editor actually ships, because free positioning
 *        is how people make ugly things.
 *
 *        Four of these controls edit fields the schema ALREADY stored and simply
 *        never exposed — align, weight, letterSpacing and the colour slot have
 *        been on every text block since the block language landed. That is the
 *        payoff of templates-as-data: a richer editor is UI work, not a schema
 *        migration.
 *
 *        Font size and line height are shown as "Auto" until touched, because
 *        unset genuinely means something different from a number: it means "let
 *        this geometry decide", which is what keeps one archetype legible on both
 *        a 396px banner and a 1350px slide.
 * WHERE: The Style tab of the studio editor.
 */

import * as React from "react";

import { DESIGN_TEXT_SLOTS, getDesignTypeScale } from "@/lib/config";
import {
  DESIGN_COLOR_SLOTS,
  type DesignBlock,
  type DesignColorSlot,
  type DesignDoc,
} from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

export interface BlockStylePanelProps {
  doc: DesignDoc;
  onChange: (doc: DesignDoc) => void;
  disabled?: boolean;
}

/* The Slider reports either a scalar or a tuple depending on how many thumbs it
 * has. Normalised once here so neither call site has to know or guess. */
function firstValue(value: number | readonly number[]): number | undefined {
  return typeof value === "number" ? value : value[0];
}

/* Only these carry typography. A spacer has nothing to style, and offering an
 * empty panel for one is worse than leaving it out of the list. */
const STYLEABLE = new Set(["text", "logoText", "buttonPill", "badgeRow"]);

function blockLabel(block: DesignBlock): string {
  if (block.type === "text" && block.text.source === "slot") {
    return DESIGN_TEXT_SLOTS[block.text.slot].label;
  }
  if (block.type === "buttonPill") return "Button";
  if (block.type === "badgeRow") return "Proof chips";
  if (block.type === "logoText") return "Logo";
  return block.id;
}

export function BlockStylePanel({
  doc,
  onChange,
  disabled = false,
}: BlockStylePanelProps) {
  /* Flattened so a child of a group is selectable too — the CTA and the proof
   * chips both live inside one, and they are the two people most want to change. */
  const layers = React.useMemo(() => {
    const out: { path: readonly number[]; block: DesignBlock }[] = [];
    doc.blocks.forEach((block, index) => {
      if (STYLEABLE.has(block.type)) out.push({ path: [index], block });
      if (block.type === "group") {
        block.children.forEach((child, childIndex) => {
          if (STYLEABLE.has(child.type)) out.push({ path: [index, childIndex], block: child });
        });
      }
    });
    return out;
  }, [doc.blocks]);

  const [selectedKey, setSelectedKey] = React.useState<string | null>(null);
  const selected =
    layers.find((layer) => layer.path.join("-") === selectedKey) ?? layers[0];

  /* Writes a patch back into the right slot of a one-level-deep tree. Written
   * once here rather than at each control, so a new control cannot get the
   * nesting wrong. */
  function patchSelected(patch: Record<string, unknown>) {
    if (!selected) return;
    const [index, childIndex] = selected.path;
    if (index === undefined) return;

    const blocks = doc.blocks.map((block, blockIndex) => {
      if (blockIndex !== index) return block;
      if (childIndex === undefined) return { ...block, ...patch };
      if (block.type !== "group") return block;
      return {
        ...block,
        children: block.children.map((child, i) =>
          i === childIndex ? { ...child, ...patch } : child,
        ),
      };
    });

    onChange({ ...doc, blocks });
  }

  /* Any layer carrying a manual size or line height. Derived rather than
   * tracked, so it cannot disagree with the document it describes. */
  const hasOverrides = layers.some(
    (layer) =>
      layer.block.type === "text" &&
      (layer.block.fontSize !== undefined || layer.block.lineHeight !== undefined),
  );

  function clearAllOverrides() {
    function strip(block: DesignBlock) {
      return block.type === "text"
        ? { ...block, fontSize: undefined, lineHeight: undefined }
        : block;
    }

    onChange({
      ...doc,
      blocks: doc.blocks.map((block) =>
        block.type === "group"
          ? {
              ...block,
              children: block.children.map((child) =>
                child.type === "text"
                  ? { ...child, fontSize: undefined, lineHeight: undefined }
                  : child,
              ),
            }
          : strip(block),
      ),
    });
  }

  if (!selected) {
    return (
      <p className="text-sm text-muted-foreground">
        This design has nothing to style.
      </p>
    );
  }

  const block = selected.block;
  const isText = block.type === "text";

  /* What this layer renders at today, whether or not it has been overridden.
   *
   * The slider previously defaulted to a magic 48 whenever fontSize was unset,
   * which meant merely TOUCHING it threw an eyebrow from 16px to 48 and a
   * headline from 52 down to it — the control silently destroyed the type scale
   * it was supposed to adjust. A slider whose resting position is not the
   * current value is a trap, not a default. */
  const scale = getDesignTypeScale(doc.canvas);
  const effectiveSize = isText ? (block.fontSize ?? scale[block.role]) : 0;

  return (
    <div className="flex flex-col gap-4">
      {/* An escape hatch, not a nicety. Per-layer overrides are easy to apply and
          tedious to unpick one at a time, and a member who has made a mess needs
          a way back that is not "delete the profile and start again" — which on
          a free plan of one project means losing everything. */}
      {hasOverrides ? (
        <Button
          variant="outline"
          size="sm"
          className="self-start"
          disabled={disabled}
          onClick={clearAllOverrides}
        >
          Reset all styling
        </Button>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <Label>Layer</Label>
        <div className="flex flex-wrap gap-1.5">
          {layers.map((layer) => {
            const key = layer.path.join("-");
            const isActive = key === (selectedKey ?? layers[0]?.path.join("-"));
            return (
              <button
                key={key}
                type="button"
                aria-pressed={isActive}
                disabled={disabled}
                onClick={() => {
                  setSelectedKey(key);
                }}
                className={cn(
                  "tech-chip",
                )}
              >
                {blockLabel(layer.block)}
              </button>
            );
          })}
        </div>
      </div>

      {isText ? (
        <>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label>Size</Label>
              <span className="text-xs text-muted-foreground">
                {block.fontSize === undefined
                  ? `Auto · ${String(effectiveSize)}px`
                  : `${String(block.fontSize)}px`}
              </span>
            </div>
            <Slider
              min={12}
              max={140}
              step={1}
              disabled={disabled}
              value={[effectiveSize]}
              onValueChange={(next) => {
                patchSelected({ fontSize: firstValue(next) });
              }}
            />
            {block.fontSize === undefined ? null : (
              <Button
                variant="ghost"
                size="sm"
                className="self-start px-0 text-xs"
                disabled={disabled}
                onClick={() => {
                  /* Back to "let the geometry decide", which is not the same as
                   * any particular number. */
                  patchSelected({ fontSize: undefined });
                }}
              >
                Reset to auto
              </Button>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Weight</Label>
            <div className="flex gap-1.5">
              {([400, 700] as const).map((weight) => (
                <button
                  key={weight}
                  type="button"
                  aria-pressed={block.weight === weight}
                  disabled={disabled}
                  onClick={() => {
                    patchSelected({ weight });
                  }}
                  className={cn(
                    "tech-chip",
                  )}
                >
                  {weight === 700 ? "Bold" : "Regular"}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Alignment</Label>
            <div className="flex gap-1.5">
              {(["left", "center", "right"] as const).map((align) => (
                <button
                  key={align}
                  type="button"
                  aria-pressed={block.align === align}
                  disabled={disabled}
                  onClick={() => {
                    patchSelected({ align });
                  }}
                  className={cn(
                    "tech-chip capitalize",
                  )}
                >
                  {align}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label>Letter spacing</Label>
              <span className="text-xs text-muted-foreground">
                {block.letterSpacing}
              </span>
            </div>
            <Slider
              min={-4}
              max={12}
              step={1}
              disabled={disabled}
              value={[block.letterSpacing]}
              onValueChange={(next) => {
                patchSelected({ letterSpacing: firstValue(next) ?? 0 });
              }}
            />
          </div>
        </>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <Label>Colour</Label>
        <div className="flex flex-wrap gap-1.5">
          {DESIGN_COLOR_SLOTS.map((slot) => {
            /* Which field holds the colour differs by block type, so the control
             * writes to the one this block actually reads. */
            const key =
              block.type === "buttonPill"
                ? "fill"
                : block.type === "badgeRow"
                  ? "label"
                  : "color";
            const current = (block as unknown as Record<string, { slot?: DesignColorSlot }>)[
              key
            ]?.slot;

            return (
              <button
                key={slot}
                type="button"
                aria-pressed={current === slot}
                disabled={disabled}
                onClick={() => {
                  patchSelected({ [key]: { slot, opacity: 1 } });
                }}
                className={cn(
                  "tech-chip capitalize",
                )}
              >
                {slot}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

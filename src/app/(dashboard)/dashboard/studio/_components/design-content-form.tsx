"use client";

/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: DesignContentForm, DesignContentFormProps,
 *   slotsUsedBy, DESIGN_TEXT_SLOTS, generated slot fields
 *
 * WHAT:  The words half of the editor — one field per text slot the chosen
 *        template actually uses.
 * WHY:   GENERATED, not hand-written per template. `slotsUsedBy` reads the block
 *        list and `DESIGN_TEXT_SLOTS` supplies the label, placeholder, input kind
 *        and ceiling, so a new archetype gets a correct form with no UI change at
 *        all. That is the second half of "a template is data" — the first half is
 *        that it renders without a renderer branch.
 *
 *        Every ceiling quoted under a field comes from the same registry the
 *        router validates against, so the counter and the error that blocks
 *        submit can never disagree about the number.
 * WHERE: The studio editor, beside DesignPreview.
 */

import * as React from "react";

import { DESIGN_TEXT_SLOTS } from "@/lib/config";
import { slotsUsedBy, type DesignBlock, type DesignTextSlotKey } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export interface DesignContentFormProps {
  blocks: readonly DesignBlock[];
  content: Partial<Record<DesignTextSlotKey, string>>;
  onChange: (content: Partial<Record<DesignTextSlotKey, string>>) => void;
  disabled?: boolean;
}

export function DesignContentForm({
  blocks,
  content,
  onChange,
  disabled = false,
}: DesignContentFormProps) {
  /* Recomputed only when the layout changes, not on every keystroke — the block
   * list is stable while someone types. */
  const slots = React.useMemo(() => slotsUsedBy(blocks), [blocks]);

  return (
    <div className="flex flex-col gap-4">
      {slots.map((slot) => {
        const definition = DESIGN_TEXT_SLOTS[slot];
        const value = content[slot] ?? "";
        const length = value.trim().length;
        const over = length > definition.maxChars;
        const fieldId = `slot-${slot}`;

        return (
          <div key={slot} className="flex flex-col gap-1.5">
            <Label htmlFor={fieldId}>{definition.label}</Label>

            {definition.multiline ? (
              <Textarea
                id={fieldId}
                rows={2}
                value={value}
                placeholder={definition.placeholder}
                disabled={disabled}
                onChange={(event) => {
                  onChange({ ...content, [slot]: event.target.value });
                }}
                className={cn(over && "border-destructive")}
              />
            ) : (
              <Input
                id={fieldId}
                value={value}
                placeholder={definition.placeholder}
                disabled={disabled}
                onChange={(event) => {
                  onChange({ ...content, [slot]: event.target.value });
                }}
                className={cn(over && "border-destructive")}
              />
            )}

            <span
              className={cn(
                "text-xs text-muted-foreground",
                over && "text-destructive",
              )}
            >
              {length} / {definition.maxChars}
            </span>
          </div>
        );
      })}

      {slots.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          This design has no editable text.
        </p>
      ) : null}
    </div>
  );
}

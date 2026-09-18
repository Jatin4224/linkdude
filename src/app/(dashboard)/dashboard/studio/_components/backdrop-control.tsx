"use client";

/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: BackdropControl, BackdropControlProps, AI backdrop,
 *   generate backdrop, background image
 *
 * WHAT:  Generates a background image for the open design from a text brief, and
 *        lets the member drop it again.
 * WHY:   This is the division of labour the studio is built around, made visible:
 *        the MODEL draws the texture, the RENDERER draws the words. Image models
 *        cannot render legible type, so asking one for a finished banner returns
 *        garbled lettering baked into pixels that cannot be edited afterwards.
 *        Generating only the backdrop and compositing crisp text over it is the
 *        thing neither a design tool nor an image model does alone.
 *
 *        The copy says "background" and never "banner" for the same reason the
 *        brief is capped at 200 characters — a member who believes they are
 *        describing a finished banner will put their headline in the prompt and
 *        be disappointed by what comes back.
 *
 *        The result is applied to the DRAFT, not saved. A generation the member
 *        dislikes costs them a quota slot but never touches their stored design
 *        until they press Save.
 * WHERE: The studio editor, under the content form.
 */

import * as React from "react";

import { STUDIO_BACKDROP_BRIEF_MAX } from "@/lib/config";
import type { DesignDoc } from "@/lib/types";
import { FeatureGate } from "@/components/feature-gate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export interface BackdropControlProps {
  doc: DesignDoc;
  onChange: (doc: DesignDoc) => void;
  /** Generates and stores the image, returning its ImageKit reference. */
  onGenerate: (brief: string) => Promise<{ fileId: string; url: string }>;
  disabled?: boolean;
}

export function BackdropControl({
  doc,
  onChange,
  onGenerate,
  disabled = false,
}: BackdropControlProps) {
  const [brief, setBrief] = React.useState("");
  const [isGenerating, setIsGenerating] = React.useState(false);

  const hasBackdrop = doc.background.kind === "image";
  const over = brief.trim().length > STUDIO_BACKDROP_BRIEF_MAX;

  async function generate() {
    if (brief.trim().length < 3 || over) return;
    setIsGenerating(true);
    try {
      const image = await onGenerate(brief.trim());
      onChange({
        ...doc,
        /* Both halves in one update: the slot holds the file, and the background
         * has to be switched to `image` or the renderer keeps drawing the solid
         * field and the member sees nothing happen. */
        images: { ...doc.images, backdrop: image },
        background: { kind: "image", slot: "backdrop" },
      });
    } finally {
      setIsGenerating(false);
    }
  }

  function removeBackdrop() {
    /* Falls back to the palette's own field rather than to nothing — a design
     * with no background is not a usable export. */
    onChange({
      ...doc,
      background: { kind: "solid", color: { slot: "background", opacity: 1 } },
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <Separator />

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="backdrop-brief">Background image</Label>
        <p className="text-xs text-muted-foreground">
          Describe a texture or mood — not your headline. The text is drawn on top,
          sharp, by us.
        </p>
      </div>

      <Input
        id="backdrop-brief"
        value={brief}
        placeholder="Soft navy gradient with faint grid lines"
        disabled={disabled || isGenerating}
        onChange={(event) => {
          setBrief(event.target.value);
        }}
        className={cn(over && "border-destructive")}
      />

      <span className={cn("text-xs text-muted-foreground", over && "text-destructive")}>
        {brief.trim().length} / {STUDIO_BACKDROP_BRIEF_MAX}
      </span>

      <div className="flex flex-wrap gap-2">
        {/* Gated at the BUTTON, per the FeatureGate rule — a generation is
            metered separately from the profile itself. */}
        <FeatureGate resource="studioBackdrop">
          <Button
            size="sm"
            variant="secondary"
            disabled={disabled || isGenerating || brief.trim().length < 3 || over}
            onClick={() => {
              void generate();
            }}
          >
            {isGenerating ? "Generating…" : hasBackdrop ? "Regenerate" : "Generate"}
          </Button>
        </FeatureGate>

        {hasBackdrop ? (
          <Button
            size="sm"
            variant="ghost"
            disabled={disabled || isGenerating}
            onClick={removeBackdrop}
          >
            Remove
          </Button>
        ) : null}
      </div>
    </div>
  );
}

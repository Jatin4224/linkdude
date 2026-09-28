"use client";

/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: SlideIllustration, SlideIllustrationProps,
 *   carouselIllustration.create, generateSlideIllustration, FeatureGate
 *
 * WHAT:  The illustrate control on one slide — a brief, a generate button, and the
 *        image once there is one.
 * WHY:   Its own component so the mutation, its pending state and the quota gate
 *        stay out of slide-editor, which already carries the deck's structure. The
 *        same separation ExportPanel keeps from the studio editor.
 *
 *        THE GENERATION IS NOT SAVED. It returns a stored reference which is
 *        written into the editing DRAFT, exactly like every other slide edit — so
 *        an illustration the member dislikes is discarded by navigating away, and
 *        Save is what commits it. That is the contract studioBackdrop established,
 *        and it is why this component never calls carousel.update itself.
 *
 *        A generation is SPEND, and the quota slot is taken the moment the
 *        procedure runs. So the button says what it costs, and removing an image
 *        warns that regenerating is not free — a member who assumes remove-and-redo
 *        is reversible would otherwise burn their allowance discovering it is not.
 * WHERE: Inside the Extras disclosure on each slide card.
 */

import * as React from "react";
import { ImageIcon, Loader2Icon, SparklesIcon, XIcon } from "lucide-react";
import { toast } from "sonner";

import { getErrorMessage } from "@/lib/errors";
import { trpc } from "@/trpc/react-provider";
import { useActiveOrganizationId } from "@/hooks/use-active-organization";
import type { PostImageValues } from "@/lib/types";
import { buildTransformedUrl } from "@/lib/config";
import { FeatureGate } from "@/components/feature-gate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface SlideIllustrationProps {
  /** The slide's current illustration, if it has one. */
  value: PostImageValues | undefined;
  onChange: (illustration: PostImageValues | undefined) => void;
  /** Seeds the brief, so the common case needs no typing. */
  suggestedBrief: string;
  fieldId: string;
  disabled?: boolean;
}

export function SlideIllustration({
  value,
  onChange,
  suggestedBrief,
  fieldId,
  disabled = false,
}: SlideIllustrationProps) {
  const organizationId = useActiveOrganizationId();
  const [brief, setBrief] = React.useState("");

  const createMutation = trpc.carouselIllustration.create.useMutation({
    onSuccess: (illustration) => {
      onChange(illustration);
      toast.success("Illustration added. Save to keep it.");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  /* The heading is the obvious subject, so it is the default — but it stays
   * editable, because the best illustration brief is often a concrete object the
   * heading only implies. */
  const effectiveBrief = brief.trim() || suggestedBrief.trim();
  const canGenerate =
    organizationId !== undefined &&
    effectiveBrief.length >= 3 &&
    !createMutation.isPending &&
    !disabled;

  if (value) {
    return (
      <div className="flex flex-col gap-1.5">
        <Label>Illustration</Label>
        <div className="flex items-center gap-3 rounded-md border p-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- an ImageKit
              delivery URL; next/image would re-encode an image we already sized. */}
          <img
            src={buildTransformedUrl(value.url, "w-160")}
            alt="Slide illustration"
            className="size-16 rounded object-contain"
          />
          <p className="flex-1 text-xs text-muted-foreground">
            Drawn by the model, typeset by the renderer.
          </p>
          <Button
            variant="ghost"
            size="icon"
            disabled={disabled}
            onClick={() => onChange(undefined)}
            /* Named rather than iconographic: this is the one control here whose
             * consequence costs money to undo. */
            aria-label="Remove illustration — generating another one costs a slot"
            title="Remove. Generating another costs an illustration."
          >
            <XIcon className="size-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={fieldId}>Illustration</Label>
      <div className="flex gap-2">
        <Input
          id={fieldId}
          value={brief}
          onChange={(event) => setBrief(event.target.value)}
          placeholder={suggestedBrief || "What should it show?"}
          disabled={disabled || createMutation.isPending}
        />
        <FeatureGate resource="carouselIllustration">
          <Button
            variant="ai"
            disabled={!canGenerate}
            onClick={() => {
              if (organizationId === undefined) return;
              createMutation.mutate({
                organizationId,
                brief: effectiveBrief,
              });
            }}
          >
            {createMutation.isPending ? (
              <Loader2Icon className="size-4 animate-spin" />
            ) : (
              <SparklesIcon className="size-4" />
            )}
            {createMutation.isPending ? "Drawing…" : "Illustrate"}
          </Button>
        </FeatureGate>
      </div>
      <p className="flex items-center gap-1 text-xs text-muted-foreground">
        <ImageIcon className="size-3" />
        Uses one illustration from your plan. No text — the renderer draws the
        words.
      </p>
    </div>
  );
}

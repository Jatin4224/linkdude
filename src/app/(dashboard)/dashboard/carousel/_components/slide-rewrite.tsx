"use client";

/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: SlideRewrite, SlideRewriteProps,
 *   carouselSlideRewrite.create, reroll, per-slide regenerate, FeatureGate
 *
 * WHAT:  The rewrite control on one slide — an optional instruction and a button
 *        that asks the model for another take.
 * WHY:   Its own component so the mutation and the quota gate stay out of
 *        slide-editor, the same separation SlideIllustration and ExportPanel keep.
 *
 *        It sends the EDITOR'S slides, not just the deck id, so the rewrite reads
 *        the neighbours as they currently stand. Rerolling slide four against the
 *        saved copy of slide three — after slide three was just rewritten — is how
 *        a deck quietly loses its thread.
 *
 *        THE RESULT IS NOT SAVED. It lands in the draft like any other edit, so a
 *        take the member dislikes is discarded by navigating away and Save is what
 *        commits it. The quota slot is spent either way, because the model call
 *        already happened — which is why the button says what it costs.
 * WHERE: Inside the Extras disclosure on each slide card, beside the illustration.
 */

import * as React from "react";
import { Loader2Icon, WandSparklesIcon } from "lucide-react";
import { toast } from "sonner";

import { getErrorMessage } from "@/lib/errors";
import { trpc } from "@/trpc/react-provider";
import { useActiveOrganizationId } from "@/hooks/use-active-organization";
import type { CarouselSlide, CarouselSlides } from "@/lib/types";
import { FeatureGate } from "@/components/feature-gate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface SlideRewriteProps {
  carouselId: string;
  index: number;
  /** The editor's current buffer, so the rewrite sees unsaved neighbours. */
  slides: CarouselSlides;
  onRewritten: (slide: CarouselSlide) => void;
  fieldId: string;
  disabled?: boolean;
}

export function SlideRewrite({
  carouselId,
  index,
  slides,
  onRewritten,
  fieldId,
  disabled = false,
}: SlideRewriteProps) {
  const organizationId = useActiveOrganizationId();
  const [instruction, setInstruction] = React.useState("");

  const rewriteMutation = trpc.carouselSlideRewrite.create.useMutation({
    onSuccess: (slide) => {
      onRewritten(slide);
      setInstruction("");
      toast.success("Slide rewritten. Save to keep it.");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const canRewrite =
    organizationId !== undefined && !rewriteMutation.isPending && !disabled;

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={fieldId}>Rewrite this slide</Label>
      <div className="flex gap-2">
        <Input
          id={fieldId}
          value={instruction}
          onChange={(event) => setInstruction(event.target.value)}
          /* Optional on purpose: the common case is "this one is not landing,
             try again", which needs no words. */
          placeholder="Optional — what to change"
          disabled={disabled || rewriteMutation.isPending}
        />
        <FeatureGate resource="carouselSlideRewrite">
          <Button
            variant="ai"
            disabled={!canRewrite}
            onClick={() => {
              if (organizationId === undefined) return;
              rewriteMutation.mutate({
                organizationId,
                id: carouselId,
                index,
                slides,
                ...(instruction.trim()
                  ? { instruction: instruction.trim() }
                  : {}),
              });
            }}
          >
            {rewriteMutation.isPending ? (
              <Loader2Icon className="size-4 animate-spin" />
            ) : (
              <WandSparklesIcon className="size-4" />
            )}
            {rewriteMutation.isPending ? "Writing…" : "Rewrite"}
          </Button>
        </FeatureGate>
      </div>
      <p className="text-xs text-muted-foreground">
        Uses one rewrite from your plan. Keeps this slide&rsquo;s role and its
        illustration.
      </p>
    </div>
  );
}

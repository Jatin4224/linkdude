/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use client";

/**
 * SOURCE OF TRUTH KEYWORDS: IdeaAnglesDialog, IdeaAnglesDialogProps, expand
 *   idea, idea angles, use this angle, save angle as idea
 *
 * WHAT:  Shows the angles an expansion returned for one idea, with "Use this
 *        angle" (replace the idea's text) and "Save as new idea".
 * WHY:   The expansion itself is started by the inbox from the click, never from
 *        an effect here: an effect runs twice in development and would spend two
 *        expansions for one click. This dialog only renders the result and owns
 *        the two free follow-ups.
 * WHERE: ideas-inbox.tsx.
 */

import { LightbulbIcon, Loader2Icon } from "lucide-react";
import { toast } from "sonner";

import { HOOK_FORMULAS } from "@/lib/config";
import { getErrorMessage } from "@/lib/errors";
import type { IdeaAngle } from "@/lib/types";
import { trpc } from "@/trpc/react-provider";
import { useActiveOrganizationId } from "@/hooks/use-active-organization";
import { FeatureGate } from "@/components/feature-gate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { PostIdeaRow } from "./idea-types";

export interface IdeaAnglesDialogProps {
  idea: PostIdeaRow;
  angles: readonly IdeaAngle[] | undefined;
  isLoading: boolean;
  errorMessage: string | undefined;
  onRetry: () => void;
  onOpenChange: (open: boolean) => void;
}

export function IdeaAnglesDialog({
  idea,
  angles,
  isLoading,
  errorMessage,
  onRetry,
  onOpenChange,
}: IdeaAnglesDialogProps) {
  const organizationId = useActiveOrganizationId();
  const utils = trpc.useUtils();

  const applyAngle = trpc.postIdeas.update.useMutation({
    onSuccess: async () => {
      await utils.postIdeas.list.invalidate();
      toast.success("Idea updated with that angle.");
      onOpenChange(false);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const saveAngle = trpc.postIdeas.create.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.postIdeas.list.invalidate(),
        utils.usage.invalidate(),
      ]);
      toast.success("Saved as a new idea.");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const busy = applyAngle.isPending || saveAngle.isPending;

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Angles for this idea</DialogTitle>
          <DialogDescription className="line-clamp-2">{idea.text}</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2Icon className="size-4 animate-spin" />
            Finding specific angles...
          </div>
        ) : errorMessage ? (
          <div className="flex flex-col items-start gap-3 py-4">
            <p className="text-sm text-destructive">{errorMessage}</p>
            <FeatureGate resource="ideaAngles">
              <Button variant="outline" size="sm" onClick={onRetry}>
                Try again
              </Button>
            </FeatureGate>
          </div>
        ) : angles ? (
          <ul className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto">
            {angles.map((angle, index) => (
              <li
                key={`${index}-${angle.formula}`}
                className="flex flex-col gap-2 rounded-lg border p-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{angle.title}</p>
                  <Badge variant="outline">
                    {HOOK_FORMULAS[angle.formula].label}
                  </Badge>
                </div>
                <p className="text-sm">{angle.topic}</p>
                <p className="text-sm text-muted-foreground">
                  First line: &ldquo;{angle.openingLine}&rdquo;
                </p>
                {angle.needs ? (
                  <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                    <LightbulbIcon className="mt-0.5 size-3.5 shrink-0" />
                    Add: {angle.needs}
                  </p>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="brand"
                    disabled={busy || !organizationId}
                    onClick={() => {
                      if (!organizationId) return;
                      applyAngle.mutate({
                        organizationId,
                        field: "text",
                        id: idea.id,
                        text: angle.topic,
                      });
                    }}
                  >
                    Use this angle
                  </Button>
                  <FeatureGate resource="postIdeas">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy || !organizationId}
                      onClick={() => {
                        if (!organizationId) return;
                        saveAngle.mutate({ organizationId, text: angle.topic });
                      }}
                    >
                      Save as new idea
                    </Button>
                  </FeatureGate>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

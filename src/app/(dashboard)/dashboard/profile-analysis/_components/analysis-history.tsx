/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use client";

/**
 * SOURCE OF TRUTH KEYWORDS: AnalysisHistory, AnalysisHistoryProps,
 *   StoredProfileAnalysis, profileAnalysis.list, profileAnalysis.discard
 *
 * WHAT:  The organization's saved analyses — pick one to reopen it, or discard
 *        it.
 * WHY:   Analyses are metered and irreversible, so the list exists to stop a
 *        refresh destroying something the org paid for. Selection is delegated
 *        upward rather than rendered here: the parent already owns which
 *        critique the result pane shows, and a second owner would let the two
 *        panes disagree.
 *
 *        Discard is confirmed because it is not reversible and does NOT refund
 *        the quota — the copy says so plainly, since a user who assumes a refund
 *        would otherwise clear their history expecting to get analyses back.
 * WHERE: Rendered in the left column of profile-analyzer.tsx.
 */

import * as React from "react";
import { Loader2Icon, RotateCcwIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import { getErrorMessage } from "@/lib/errors";

import { trpc } from "@/trpc/react-provider";
import { useActiveOrganization } from "@/hooks/use-active-organization";
import { permissions } from "@/lib/better-auth/permissions";
import { cn } from "@/lib/utils";
import type { StoredProfileAnalysis } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { bandFor } from "./analysis-result";

export interface AnalysisHistoryProps {
  organizationId: string;
  /** Highlighted row — the analysis currently open in the result pane. */
  selectedId: string | null;
  onSelect: (analysis: StoredProfileAnalysis) => void;
  /** Loads a past run's input back into the form so it can be edited and re-run. */
  onReuse: (analysis: StoredProfileAnalysis) => void;
  /** Lets the parent clear the result pane when the open analysis is discarded. */
  onDiscarded: (analysisId: string) => void;
}

/* Enough to recognise a past run without turning the strip into a second
 * reading surface — the full critique is one click away in the result pane. */
const HISTORY_LIMIT = 10;

export function AnalysisHistory({
  organizationId,
  selectedId,
  onSelect,
  onReuse,
  onDiscarded,
}: AnalysisHistoryProps) {
  const { hasPermission } = useActiveOrganization();
  const utils = trpc.useUtils();

  const canDiscard = hasPermission(permissions.PROFILE_ANALYSIS_DISCARD);
  const [discardTarget, setDiscardTarget] =
    React.useState<StoredProfileAnalysis | null>(null);

  const history = trpc.profileAnalysis.list.useQuery({
    organizationId,
    limit: HISTORY_LIMIT,
  });

  const discard = trpc.profileAnalysis.discard.useMutation({
    onSuccess: async (result) => {
      toast.success("Analysis discarded.");
      setDiscardTarget(null);
      onDiscarded(result.id);
      await utils.profileAnalysis.list.invalidate();
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
      setDiscardTarget(null);
      /* A NOT_FOUND means this row is stale — refetch so the list stops
       * offering something that is already gone. */
      void utils.profileAnalysis.list.invalidate();
    },
  });

  /* Matches the meter above the form rather than popping in late — the card
   * changes the height of this column, so reserving the space avoids shifting
   * the form under a cursor that is already moving toward it. */
  if (history.isLoading) {
    return (
      <Card className="h-fit">
        <CardHeader>
          <CardTitle className="text-base">Past analyses</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </CardContent>
      </Card>
    );
  }

  /* An empty history is the normal first-run state, and a card explaining that
   * nothing is saved yet says less than the result pane already does. */
  if (!history.data || history.data.length === 0) return null;

  return (
    <>
      <Card className="h-fit">
        <CardHeader>
          <CardTitle className="text-base">Past analyses</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {history.data.map((analysis, index) => {
            const band = bandFor(analysis.score);
            const isSelected = analysis.id === selectedId;

            return (
              <React.Fragment key={analysis.id}>
                {index > 0 ? <Separator /> : null}
                <div className="flex items-start gap-2">
                  {/* The row is the control, so the whole card area is
                      clickable rather than just a small "open" affordance. */}
                  <button
                    type="button"
                    onClick={() => onSelect(analysis)}
                    aria-current={isSelected}
                    className={cn(
                      "flex flex-1 flex-col gap-1.5 p-2 text-left transition-colors hover:bg-muted/60",
                      isSelected && "bg-muted",
                    )}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold tabular-nums">
                        {analysis.score}
                      </span>
                      <Badge variant="outline" className={band.className}>
                        {band.label}
                      </Badge>
                    </div>
                    <p className="line-clamp-1 text-sm text-muted-foreground">
                      {analysis.input.headline}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {analysis.createdAt.toLocaleString()}
                    </p>
                  </button>

                  <div className="flex shrink-0 items-center">
                    {/* Reuse, not re-run: it refills the form and stops there.
                        Analyzing straight from here would spend quota on a
                        click whose only stated intent was "show me this one". */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-foreground"
                      onClick={() => onReuse(analysis)}
                      aria-label="Load this profile back into the form"
                    >
                      <RotateCcwIcon className="size-4" />
                    </Button>

                    {canDiscard ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => setDiscardTarget(analysis)}
                        disabled={discard.isPending}
                        aria-label="Discard this analysis"
                      >
                        <Trash2Icon className="size-4" />
                      </Button>
                    ) : null}
                  </div>
                </div>
              </React.Fragment>
            );
          })}
        </CardContent>
      </Card>

      <AlertDialog
        open={discardTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDiscardTarget(null);
        }}
      >
        {/* Scoped at its own root — an alert dialog is portaled out. */}
        <AlertDialogContent className="tech-scope">
          <AlertDialogHeader>
            <AlertDialogTitle>Discard this analysis?</AlertDialogTitle>
            <AlertDialogDescription>
              The critique and its rewrites are removed permanently. This does
              not return the analysis to your monthly allowance — the model call
              has already been paid for.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={discard.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={discard.isPending}
              onClick={(event) => {
                /* Keep the dialog mounted through the request so the pending
                   state is visible; it closes in the mutation callbacks. */
                event.preventDefault();
                if (!discardTarget) return;
                discard.mutate({
                  organizationId,
                  analysisId: discardTarget.id,
                });
              }}
            >
              {discard.isPending ? (
                <Loader2Icon className="size-4 animate-spin" />
              ) : null}
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

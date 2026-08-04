/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use client";

/**
 * SOURCE OF TRUTH KEYWORDS: ProfileAnalyzer, StoredProfileAnalysis
 *
 * WHAT:  The Profile Analysis screen — paste form and saved-analysis history on
 *        the left, critique on the right.
 * WHY:   Two panes rather than a wizard so the user can edit an input and
 *        re-run without losing sight of the previous verdict. The Analyze button
 *        is gated on `profileAnalysis:create` client-side as well as on the
 *        server, so a member without the permission sees a disabled control and
 *        an explanation instead of clicking into a FORBIDDEN toast.
 *
 *        A fresh analysis and a history entry are the SAME type
 *        (StoredProfileAnalysis), so one piece of state drives the result pane
 *        and AnalysisResult never branches on where the critique came from.
 * WHERE: Rendered by the profile-analysis page. Calls profileAnalysis.create.
 */

import * as React from "react";
import { toast } from "sonner";

import { trpc } from "@/trpc/react-provider";
import {
  useActiveOrganization,
  useActiveOrganizationId,
} from "@/hooks/use-active-organization";
import { permissions } from "@/lib/better-auth/permissions";
import type {
  AnalyzeProfileValues,
  FetchProfileValues,
  FetchedProfile,
  StoredProfileAnalysis,
} from "@/lib/types";
import { ContentLayout } from "@/components/global/page-header";
import { UsageMeter } from "@/components/global/usage-meter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProfileForm } from "./profile-form";
import { AnalysisResult } from "./analysis-result";
import { AnalysisHistory } from "./analysis-history";

export function ProfileAnalyzer() {
  const organizationId = useActiveOrganizationId();
  const { hasPermission } = useActiveOrganization();
  const utils = trpc.useUtils();

  const [selected, setSelected] = React.useState<StoredProfileAnalysis | null>(
    null,
  );
  const [fetched, setFetched] = React.useState<FetchedProfile | null>(null);

  const enabled = organizationId !== undefined;
  const orgId = organizationId ?? "";
  const canAnalyze = hasPermission(permissions.PROFILE_ANALYSIS_CREATE);
  const canReadHistory = hasPermission(permissions.PROFILE_ANALYSIS_READ);

  /* Whether a vendor key is configured is a server fact, so it is read from the
   * server rather than guessed client-side — the URL tab is hidden entirely on
   * installs without one, instead of offering a button that always errors. */
  const fetchStatus = trpc.profileAnalysis.fetchStatus.useQuery(
    { organizationId: orgId },
    { enabled, staleTime: 5 * 60 * 1000 },
  );

  const analyze = trpc.profileAnalysis.create.useMutation({
    onSuccess: async (result) => {
      setSelected(result);
      toast.success("Profile analyzed.");
      /* The new row belongs at the top of the history, and the analysis quota
         just moved — both are read from the server, so both are refetched. */
      await Promise.all([
        utils.profileAnalysis.list.invalidate(),
        utils.usage.invalidate(),
      ]);
    },
    onError: (error) => toast.error(error.message),
  });

  const fetchProfile = trpc.profileAnalysis.fetch.useMutation({
    onSuccess: (result) => {
      setFetched(result);
      toast.success(result.name ? `Loaded ${result.name}.` : "Profile loaded.");
    },
    onError: (error) => toast.error(error.message),
  });

  function handleAnalyze(values: AnalyzeProfileValues) {
    if (!enabled || !canAnalyze) return;
    analyze.mutate({ ...values, organizationId: orgId });
  }

  function handleFetch(values: FetchProfileValues) {
    if (!enabled || !canAnalyze) return;
    fetchProfile.mutate({ ...values, organizationId: orgId });
  }

  /* Only clears the pane when the discarded row is the one on screen —
     discarding an older entry should not disturb what the user is reading. */
  function handleDiscarded(analysisId: string) {
    setSelected((current) => (current?.id === analysisId ? null : current));
  }

  /* Refills the form from a past run so it can be edited and analyzed again.
     Routed through the same `fetched` prop a vendor lookup uses because the job
     is identical — put these values in the fields — and a second prefill path
     would be a second way for the form to get out of sync. `name: null` keeps
     the "Loaded <name>" confirmation line off; it belongs to the URL flow. */
  function handleReuse(analysis: StoredProfileAnalysis) {
    setSelected(analysis);
    setFetched({
      headline: analysis.input.headline,
      about: analysis.input.about,
      experience: analysis.input.experience ?? "",
      name: null,
    });
    toast.success("Loaded into the form — edit and analyze again.");
  }

  return (
    <ContentLayout title="Profile Analysis">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-base">Paste your profile</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {/* LinkedIn exposes neither the headline nor the About text to this
                app, so the paste step is a constraint, not an oversight — saying
                so prevents it reading as a missing "connect and import". */}
            <p className="text-sm text-muted-foreground">
              LinkedIn doesn&apos;t let apps read profile text, so paste yours
              in below.
            </p>
            {/* Above the form, not below it: an analysis is billed the moment it
                runs, so the remaining count has to be visible while the user is
                still deciding whether to spend one. */}
            <UsageMeter resource="profileAnalysis" />
            <ProfileForm
              onAnalyze={handleAnalyze}
              onFetch={handleFetch}
              isAnalyzing={analyze.isPending}
              isFetching={fetchProfile.isPending}
              fetched={fetched}
              canFetchByUrl={Boolean(fetchStatus.data?.canFetchByUrl)}
              disabled={!enabled || !canAnalyze}
            />
            {!canAnalyze ? (
              <p className="text-sm text-muted-foreground">
                You don&apos;t have permission to run profile analyses. Ask an
                organization owner for access.
              </p>
            ) : null}
          </CardContent>
        </Card>

        {selected ? (
          <AnalysisResult analysis={selected.result} />
        ) : (
          <Card className="h-fit">
            <CardContent className="p-8 text-center">
              <p className="text-sm text-muted-foreground">
                {analyze.isPending
                  ? "Reading your profile and writing the critique..."
                  : "Your analysis will appear here — a score, rewritten headline and About, and the fixes worth making first."}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Spans the form column only, so history sits under the input it came
            from rather than pushing the critique down the page. */}
        {enabled && canReadHistory ? (
          <div className="lg:col-start-1">
            <AnalysisHistory
              organizationId={orgId}
              selectedId={selected?.id ?? null}
              onSelect={setSelected}
              onReuse={handleReuse}
              onDiscarded={handleDiscarded}
            />
          </div>
        ) : null}
      </div>
    </ContentLayout>
  );
}

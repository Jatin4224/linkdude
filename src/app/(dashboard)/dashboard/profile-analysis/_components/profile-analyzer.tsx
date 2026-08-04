/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use client";

/**
 * SOURCE OF TRUTH KEYWORDS: ProfileAnalyzer
 *
 * WHAT:  The Profile Analysis screen — paste form on the left, critique on the
 *        right.
 * WHY:   Two panes rather than a wizard so the user can edit an input and
 *        re-run without losing sight of the previous verdict. The Analyze button
 *        is gated on `profileAnalysis:create` client-side as well as on the
 *        server, so a member without the permission sees a disabled control and
 *        an explanation instead of clicking into a FORBIDDEN toast.
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
  ProfileAnalysis,
} from "@/lib/types";
import { ContentLayout } from "@/components/global/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProfileForm } from "./profile-form";
import { AnalysisResult } from "./analysis-result";

export function ProfileAnalyzer() {
  const organizationId = useActiveOrganizationId();
  const { hasPermission } = useActiveOrganization();

  const [analysis, setAnalysis] = React.useState<ProfileAnalysis | null>(null);
  const [fetched, setFetched] = React.useState<FetchedProfile | null>(null);

  const enabled = organizationId !== undefined;
  const orgId = organizationId ?? "";
  const canAnalyze = hasPermission(permissions.PROFILE_ANALYSIS_CREATE);

  /* Whether a vendor key is configured is a server fact, so it is read from the
   * server rather than guessed client-side — the URL tab is hidden entirely on
   * installs without one, instead of offering a button that always errors. */
  const fetchStatus = trpc.profileAnalysis.fetchStatus.useQuery(
    { organizationId: orgId },
    { enabled, staleTime: 5 * 60 * 1000 },
  );

  const analyze = trpc.profileAnalysis.create.useMutation({
    onSuccess: (result) => {
      setAnalysis(result);
      toast.success("Profile analyzed.");
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

        {analysis ? (
          <AnalysisResult analysis={analysis} />
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
      </div>
    </ContentLayout>
  );
}

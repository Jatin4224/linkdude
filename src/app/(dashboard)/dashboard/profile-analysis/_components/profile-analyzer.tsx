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
import { Loader2Icon, UserSearchIcon } from "lucide-react";
import { toast } from "sonner";

import { getErrorMessage } from "@/lib/errors";

import { playSound } from "@/lib/sound";

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
import { PROFILE_SECTION_ENTRIES } from "@/lib/config/profile-sections";
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
  /* A lookup is now its own metered resource, so it carries its own permission.
     A member may be allowed to analyze pasted text without being allowed to
     spend the org's vendor budget. */
  const canLookUp = hasPermission(permissions.PROFILE_LOOKUP_CREATE);

  /* Whether a vendor key is configured is a server fact, so it is read from the
   * server rather than guessed client-side — the URL tab is hidden entirely on
   * installs without one, instead of offering a button that always errors.
   * Served by the shared profileLookup router, not this feature. */
  const fetchStatus = trpc.profileLookup.status.useQuery(
    { organizationId: orgId },
    { enabled, staleTime: 5 * 60 * 1000 },
  );

  const analyze = trpc.profileAnalysis.create.useMutation({
    onSuccess: async (result) => {
      setSelected(result);
      toast.success("Profile analyzed.");
      /* Silent unless the user opted in. An analysis is a multi-second model
         call, which is exactly the wait a cue is worth spending on. */
      playSound("jobComplete");
      /* The new row belongs at the top of the history, and the analysis quota
         just moved — both are read from the server, so both are refetched. */
      await Promise.all([
        utils.profileAnalysis.list.invalidate(),
        utils.usage.invalidate(),
      ]);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const fetchProfile = trpc.profileLookup.create.useMutation({
    onSuccess: async (result) => {
      setFetched(result);

      /* A scrape that fills only the headline used to report the same cheerful
         success as one that filled everything, and the user found out when the
         About field failed its 50-character minimum on submit. Naming the
         sections that came back empty says which fields still need them, and
         makes a thin vendor result visible instead of looking like the app
         forgot to fill them in. */
      const missing = PROFILE_SECTION_ENTRIES.filter(
        ({ key }) => result.sections[key].length === 0,
      ).map(({ label }) => label.toLowerCase());
      const loaded = result.name ? `Loaded ${result.name}.` : "Profile loaded.";

      if (missing.length === PROFILE_SECTION_ENTRIES.length) {
        toast.warning(
          `${loaded} No ${missing.join(", ")} came back — LinkedIn blocks most automated reads, so add those yourself.`,
        );
      } else if (missing.length > 0) {
        toast.warning(`${loaded} No ${missing.join(" or ")} came back.`);
      } else {
        toast.success(loaded);
      }

      /* A lookup is metered on its own quota, so the meter beside the URL field
         has to move even though nothing about the analysis changed. */
      await utils.usage.invalidate();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  function handleAnalyze(values: AnalyzeProfileValues) {
    if (!enabled || !canAnalyze) return;
    analyze.mutate({ ...values, organizationId: orgId });
  }

  function handleFetch(values: FetchProfileValues) {
    if (!enabled || !canLookUp) return;
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
      /* Rows written before structured sections existed come back with the
         legacy prose rebuilt as a single entry, so reusing one never silently
         drops the experience the user originally pasted. */
      sections: analysis.input.sections,
      name: null,
    });
    toast.success("Loaded into the form — edit and analyze again.");
  }

  return (
    <ContentLayout
      title="Profile Analysis"
      description="Score your profile and get paste-ready rewrites"
      icon={<UserSearchIcon className="size-4" />}
    >
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        <Card className="surface-raised h-fit">
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
              canFetchByUrl={
                Boolean(fetchStatus.data?.canFetchByUrl) && canLookUp
              }
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
          /* The whole stored row, not just the critique: the count tiles and the
             headline line describe the INPUT that was analyzed. */
          <AnalysisResult analysis={selected} />
        ) : (
          /* A titled empty state rather than one grey sentence in a box: this
             pane is half the screen and it is the first thing a new user sees,
             so it should say what is coming rather than look like something
             failed to load. */
          <Card className="surface-raised h-fit">
            <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
              <span className="flex size-12 items-center justify-center rounded-xl bg-brand-soft text-brand-soft-foreground">
                {analyze.isPending ? (
                  <Loader2Icon className="size-5 animate-spin" />
                ) : (
                  <UserSearchIcon className="size-5" />
                )}
              </span>
              <p className="font-medium">
                {analyze.isPending
                  ? "Reading your profile…"
                  : "Your critique appears here"}
              </p>
              <p className="max-w-sm text-sm text-muted-foreground">
                {analyze.isPending
                  ? "Scoring the profile and writing the rewrites. This takes a few seconds."
                  : "A score out of 100, a rewritten headline and About you can paste straight back in, and the fixes worth making first."}
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

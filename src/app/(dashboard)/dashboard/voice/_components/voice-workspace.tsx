/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use client";

/**
 * SOURCE OF TRUTH KEYWORDS: VoiceWorkspace, voice page, voiceProfile.get,
 *   voiceProfile.create, voiceProfile.update, voiceProfile.revert,
 *   voiceProfile.discard, voiceProfile.suggestSamples
 *
 * WHAT:  The /dashboard/voice surface: the posts a voice is learned from on one
 *        side, the extracted voice and the member's corrections on the other.
 * WHY:   One screen, because re-extracting is a reaction to what the voice card
 *        shows: a member reads the voice, disagrees, adds posts and extracts
 *        again without navigating. This component owns every voiceProfile query
 *        and mutation, so the three panels stay presentational and invalidation
 *        lives in one place.
 *
 *        Every action is offered only when the member holds the permission the
 *        server enforces for it, so a restricted role sees fewer controls rather
 *        than FORBIDDEN toasts.
 * WHERE: Rendered by the voice page. RESOURCES.voiceProfile.nav.href.
 */

import * as React from "react";
import { AudioLinesIcon } from "lucide-react";
import { toast } from "sonner";

import { getErrorMessage } from "@/lib/errors";
import { permissions } from "@/lib/better-auth/permissions";
import { trpc } from "@/trpc/react-provider";
import {
  useActiveOrganization,
  useActiveOrganizationId,
} from "@/hooks/use-active-organization";
import type { VoiceSample } from "@/lib/types";
import { ContentLayout } from "@/components/global/page-header";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { VoiceDescriptorCard } from "./voice-descriptor-card";
import { VoiceOverridesForm } from "./voice-overrides-form";
import { VoiceSamplesForm } from "./voice-samples-form";

export function VoiceWorkspace() {
  const organizationId = useActiveOrganizationId();
  const { hasPermission } = useActiveOrganization();
  const utils = trpc.useUtils();

  const enabled = organizationId !== undefined;
  const orgId = organizationId ?? "";

  const canRead = hasPermission(permissions.VOICE_PROFILE_READ);
  const canExtract = hasPermission(permissions.VOICE_PROFILE_CREATE);
  const canUpdate = hasPermission(permissions.VOICE_PROFILE_UPDATE);
  const canRevert = hasPermission(permissions.VOICE_PROFILE_REVERT);
  const canDiscard = hasPermission(permissions.VOICE_PROFILE_DISCARD);

  const profileQuery = trpc.voiceProfile.get.useQuery(
    { organizationId: orgId },
    { enabled: enabled && canRead, retry: false },
  );

  /* Awaited by every mutation, so its pending state lasts until the refreshed
   * profile has landed and no control flickers back to the old voice. */
  async function invalidateProfile() {
    await utils.voiceProfile.get.invalidate();
  }

  const extract = trpc.voiceProfile.create.useMutation({
    onSuccess: async () => {
      /* Usage too: an extraction spends a unit from the plan. */
      await Promise.all([invalidateProfile(), utils.usage.invalidate()]);
      toast.success("Voice extracted. New drafts will use it.");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const update = trpc.voiceProfile.update.useMutation({
    onSuccess: async (_result, variables) => {
      await invalidateProfile();
      if (variables.field === "active") {
        toast.success(
          variables.isActive
            ? "Drafts will use your voice."
            : "Drafts will use the default style.",
        );
      } else {
        toast.success("Voice corrections saved.");
      }
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const revert = trpc.voiceProfile.revert.useMutation({
    onSuccess: async () => {
      await invalidateProfile();
      toast.success("Switched to your previous voice.");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const discard = trpc.voiceProfile.discard.useMutation({
    onSuccess: async () => {
      await invalidateProfile();
      toast.success("Voice discarded. Drafts use the default style again.");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  /* staleTime 0: a post published a minute ago should be offered, and the
   * app-wide 30s cache would otherwise hand back the previous answer. */
  async function suggestSamples(): Promise<VoiceSample[]> {
    try {
      const suggestions = await utils.voiceProfile.suggestSamples.fetch(
        { organizationId: orgId },
        { staleTime: 0 },
      );
      if (suggestions.length === 0) {
        toast.info("None of your published posts are long enough to use yet.");
      }
      return suggestions;
    } catch (error) {
      toast.error(getErrorMessage(error));
      return [];
    }
  }

  if (!organizationId) return null;

  const layoutProps = {
    title: "Voice",
    description: "Teach the app how you write, so drafts sound like you",
    icon: <AudioLinesIcon className="size-4" />,
  };

  if (!canRead) {
    return (
      <ContentLayout {...layoutProps}>
        <Card className="surface-raised">
          <CardHeader>
            <CardTitle className="text-base">No access</CardTitle>
            <CardDescription>
              Your role in this workspace can&rsquo;t view voice profiles. Ask
              an owner to grant it.
            </CardDescription>
          </CardHeader>
        </Card>
      </ContentLayout>
    );
  }

  if (profileQuery.isLoading) {
    return (
      <ContentLayout {...layoutProps}>
        <div className="grid items-start gap-6 lg:grid-cols-2">
          <Skeleton className="h-96 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </ContentLayout>
    );
  }

  const profile = profileQuery.data ?? null;
  const current = profile?.current ?? null;

  return (
    <ContentLayout {...layoutProps}>
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <VoiceSamplesForm
          /* Re-seeded whenever the stored voice changes (extract or revert), so
           * the posts shown are always the ones the displayed voice came from. */
          key={profile ? `${profile.id}-${profile.version}` : "empty"}
          defaultSamples={current?.samples ?? []}
          hasVoice={current !== null}
          onExtract={(values) =>
            extract.mutate({ ...values, organizationId: orgId })
          }
          onSuggest={suggestSamples}
          isExtracting={extract.isPending}
          disabled={!canExtract}
        />

        <div className="flex flex-col gap-6">
          <VoiceDescriptorCard
            profile={profile}
            onToggleActive={(isActive) =>
              update.mutate({
                organizationId: orgId,
                field: "active",
                isActive,
              })
            }
            onRevert={() => revert.mutate({ organizationId: orgId })}
            onDiscard={async () => {
              await discard.mutateAsync({ organizationId: orgId });
            }}
            isUpdating={update.isPending}
            isReverting={revert.isPending}
            isDiscarding={discard.isPending}
            canUpdate={canUpdate}
            canRevert={canRevert}
            canDiscard={canDiscard}
          />

          {profile && current ? (
            <VoiceOverridesForm
              /* Keyed on the row, not its version: toggling the voice or
               * re-extracting must not wipe corrections the member is typing. */
              key={profile.id}
              defaultValues={profile.overrides}
              onSave={(overrides) =>
                update.mutate({
                  organizationId: orgId,
                  field: "overrides",
                  overrides,
                })
              }
              isSaving={update.isPending}
              disabled={!canUpdate}
            />
          ) : null}
        </div>
      </div>
    </ContentLayout>
  );
}

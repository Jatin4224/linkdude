/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use client";

/**
 * SOURCE OF TRUTH KEYWORDS: TeamClient
 *
 * WHAT:  Team page client shell — resolves the active org + permission and
 *        renders MemberManager inside ContentLayout with the Invite button as
 *        the header action. Gated on member:read.
 * WHERE: Rendered by the team page.
 */

import { useActiveOrganization } from "@/hooks/use-active-organization";
import { permissions } from "@/lib/better-auth/permissions";
import { ContentLayout } from "@/components/global/page-header";
import { TechSurface } from "@/components/global/tech";
import { Skeleton } from "@/components/ui/skeleton";
import { MemberManager } from "./member-manager";
import { InviteMemberButton } from "./invite-member-button";

export function TeamClient() {
  const { activeOrganization, isLoading, hasPermission } =
    useActiveOrganization();
  const organizationId = activeOrganization?.id;
  const hasAccess = hasPermission(permissions.MEMBER_READ);

  if (isLoading && !activeOrganization) {
    return (
      <ContentLayout title="Team" actions={<InviteMemberButton />}>
        <TechSurface className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="space-y-4 md:col-span-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
          <Skeleton className="h-16 w-full md:col-span-1" />
        </TechSurface>
      </ContentLayout>
    );
  }

  if (!organizationId) {
    return (
      <ContentLayout title="Team">
        <TechSurface className="flex items-center justify-center p-12">
          <p className="text-sm text-muted-foreground">
            No active organization found.
          </p>
        </TechSurface>
      </ContentLayout>
    );
  }

  if (!hasAccess) {
    return (
      <ContentLayout title="Team">
        <TechSurface className="flex h-full items-center justify-center p-6">
          <div className="max-w-md space-y-2 text-center">
            <p className="text-sm font-medium text-destructive">
              You don&apos;t have permission to view team members
            </p>
            <p className="text-xs text-muted-foreground">
              Contact your organization owner to grant you the{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">
                member:read
              </code>{" "}
              permission.
            </p>
          </div>
        </TechSurface>
      </ContentLayout>
    );
  }

  return (
    <ContentLayout title="Team" actions={<InviteMemberButton />}>
      {/* Every branch of this route is scoped, not just the happy one — a
          permission wall that still looks like the old app reads as a
          different screen. */}
      <TechSurface>
        <MemberManager organizationId={organizationId} />
      </TechSurface>
    </ContentLayout>
  );
}

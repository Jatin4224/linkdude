/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use client";

/**
 * SOURCE OF TRUTH KEYWORDS: TeamSwitcher
 *
 * WHAT:  Sidebar-header organization switcher — shows the active org and a
 *        dropdown of the user's other orgs; switching calls Better Auth's
 *        setActive and reloads.
 * WHY:   A hard reload after setActive is the simplest correct way to refresh
 *        every server-resolved org-scoped query (the active org is read from
 *        the session in the tRPC context). "Create organization" routes to
 *        onboarding so the same create flow is reused.
 * WHERE: Rendered by AppSidebar. Reads trpc.organization.getUserOrganizations
 *        + useActiveOrganization; mutates via authClient.organization.setActive.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { ChevronsUpDown, Plus, Check } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { trpc } from "@/trpc/react-provider";
import { authClient } from "@/lib/better-auth/auth-client";
import { useActiveOrganization } from "@/hooks/use-active-organization";
import { ROUTES } from "@/lib/config";
import { initialsOf } from "@/lib/utils";

export function TeamSwitcher() {
  const router = useRouter();
  const { isMobile } = useSidebar();
  const { activeOrganization } = useActiveOrganization();
  const { data: organizations } =
    trpc.organization.getUserOrganizations.useQuery(undefined, {
      staleTime: 5 * 60 * 1000,
    });
  const [switchingId, setSwitchingId] = React.useState<string | null>(null);

  async function handleSwitch(org: { id: string; slug: string }) {
    if (org.id === activeOrganization?.id || switchingId) return;
    setSwitchingId(org.id);
    await authClient.organization.setActive({
      organizationId: org.id,
      organizationSlug: org.slug,
    });
    /* Hard reload so every org-scoped server query re-resolves the new active
     * org from the refreshed session. */
    window.location.reload();
  }

  const label = activeOrganization?.name ?? "Select organization";

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                className="data-[popup-open]:bg-sidebar-accent data-[popup-open]:text-sidebar-accent-foreground"
              />
            }
          >
            {/* Org INITIALS, not the app mascot. BrandMark is the product's
                logo — using it here made every organization in the switcher
                look identical, which defeats the one job a switcher has. The
                square (vs the round avatar in NavUser below) is the signal that
                this row picks a workspace and that one picks an account. */}
            <span
              aria-hidden="true"
              className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-xs font-semibold text-brand-soft-foreground"
            >
              {initialsOf(activeOrganization?.name)}
            </span>
            <div className="grid flex-1 text-left text-sm leading-tight">
              {/* The eyebrow was already a label in everything but its face;
                  `tech-label` is that face. The org name stays sans — it is a
                  name someone reads, not a marker. */}
              <span className="tech-label truncate text-[10px]">Workspace</span>
              <span className="truncate font-medium">{label}</span>
            </div>
            <ChevronsUpDown className="ml-auto" />
          </DropdownMenuTrigger>
          {/* The menu is PORTALED, so it is not a descendant of the rail's
              scope and would otherwise open as the one rounded object left on
              screen. Scoping it at its own root is the fix; `rounded-lg` then
              resolves through the scope's own radius token to 0. */}
          <DropdownMenuContent
            className="tech-scope w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            align="start"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="tech-label text-xs">
                Organizations
              </DropdownMenuLabel>
              {(organizations ?? []).map((org) => {
                const isActive = org.id === activeOrganization?.id;
                return (
                  <DropdownMenuItem
                    key={org.id}
                    onClick={() => handleSwitch(org)}
                    className="gap-2 p-2"
                  >
                    <span
                      aria-hidden="true"
                      className="flex size-6 shrink-0 items-center justify-center rounded-md bg-brand-soft text-[10px] font-semibold text-brand-soft-foreground"
                    >
                      {initialsOf(org.name)}
                    </span>
                    <span className="truncate">{org.name}</span>
                    {/* The role moved here from the trigger, where the eyebrow
                        now names the row. It reads better beside the org it
                        applies to anyway — it is your role IN this workspace,
                        not a property of you. */}
                    {isActive && activeOrganization?.role ? (
                      <span className="ml-auto shrink-0 text-xs capitalize text-muted-foreground">
                        {activeOrganization.role}
                      </span>
                    ) : null}
                    {isActive ? <Check className="size-4 shrink-0" /> : null}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="gap-2 p-2"
              onClick={() => router.push(ROUTES.onboarding)}
            >
              <div className="flex size-6 items-center justify-center rounded-md border bg-transparent">
                <Plus className="size-4" />
              </div>
              <span className="text-muted-foreground font-medium">
                Create organization
              </span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

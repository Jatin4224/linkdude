/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: QuickActions, DASHBOARD_ACTIONS, DashboardAction,
 *   getResourceDefinition, getNavIcon, RESOURCES, ResourceKey, entry points
 *
 * WHAT:  The four things a user comes here to start, as cards linking into each
 *        product surface.
 * WHY:   The label, href and icon are all read from the resource's own `nav`
 *        entry, so these tiles cannot point at a route the sidebar has moved or
 *        show an icon the sidebar has changed — only the one-line prompt is
 *        written here, because "what this button is for" is copy and everything
 *        else is registry.
 *
 *        A plain server component: these are static links, so there is nothing
 *        to hydrate on the most-visited route in the app.
 * WHERE: src/app/(dashboard)/dashboard/page.tsx.
 */

import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";

import { getResourceDefinition, type ResourceKey } from "@/lib/resources";
import { getNavIcon } from "@/components/global/sidebar/nav-icons";
import { Card, CardContent } from "@/components/ui/card";

interface DashboardAction {
  resource: ResourceKey;
  /** Imperative label — the tile is a verb, not a destination. */
  action: string;
  prompt: string;
}

const DASHBOARD_ACTIONS: readonly DashboardAction[] = [
  {
    resource: "linkedinPosts",
    action: "Write a post",
    prompt: "Turn a topic into a draft you can publish or schedule.",
  },
  {
    resource: "contentPlan",
    action: "Plan 30 days",
    prompt: "Answer a few questions, get a month of posting strategy.",
  },
  {
    resource: "profileAnalysis",
    action: "Analyse a profile",
    prompt: "Score a profile and get paste-ready rewrites.",
  },
  {
    resource: "contentCalendar",
    action: "Open the calendar",
    prompt: "See what's scheduled and where the gaps are.",
  },
];

export function QuickActions() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {DASHBOARD_ACTIONS.map(({ resource, action, prompt }) => {
        const definition = getResourceDefinition(resource);
        const href = definition.nav?.href;
        /* A surface with no nav entry has nowhere to send anyone — skip the tile
           rather than render a dead link. */
        if (!href) return null;
        const Icon = getNavIcon(definition.nav?.icon ?? "");

        return (
          <Card
            key={resource}
            className="surface-raised group transition-colors hover:border-brand-border"
          >
            <CardContent className="p-5">
              <Link href={href} className="flex flex-col gap-3 outline-none">
                <span className="flex size-9 items-center justify-center rounded-lg bg-brand-soft text-brand-soft-foreground">
                  <Icon className="size-4.5" />
                </span>
                <span className="flex items-center gap-1.5 font-medium">
                  {action}
                  {/* Nudges on hover to say the tile goes somewhere; a transform
                      the user asked for by pointing at it, not ambient motion. */}
                  <ArrowRightIcon className="size-3.5 text-muted-foreground transition-transform duration-200 ease-out group-hover:translate-x-0.5" />
                </span>
                <span className="text-sm text-muted-foreground">{prompt}</span>
              </Link>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

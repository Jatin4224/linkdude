/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use client";

/**
 * SOURCE OF TRUTH KEYWORDS: IdeaInboxCard, dashboard idea capture, save an idea
 *
 * WHAT:  A card on the dashboard home for saving an idea without leaving the
 *        page, with a link to the full inbox.
 * WHY:   The dashboard is where a member lands several times a day, so it is the
 *        cheapest place to catch a thought before it is gone. Hidden without the
 *        create permission, so a restricted role sees no dead card.
 * WHERE: src/app/(dashboard)/dashboard/page.tsx.
 */

import Link from "next/link";
import { ArrowRightIcon, LightbulbIcon } from "lucide-react";

import { permissions } from "@/lib/better-auth/permissions";
import { RESOURCES } from "@/lib/resources";
import { useActiveOrganization } from "@/hooks/use-active-organization";
import { IdeaQuickAdd } from "@/components/global/idea-quick-add";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function IdeaInboxCard() {
  const { hasPermission } = useActiveOrganization();
  if (!hasPermission(permissions.POST_IDEAS_CREATE)) return null;

  return (
    <Card className="surface-raised">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="flex size-7 items-center justify-center rounded-md bg-brand-soft text-brand-soft-foreground">
            <LightbulbIcon className="size-4" />
          </span>
          Got an idea?
        </CardTitle>
        <CardDescription>
          Save it now and turn it into a post when you&rsquo;re ready.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <IdeaQuickAdd />
        <Link
          href={RESOURCES.postIdeas.nav.href}
          className="flex w-fit items-center gap-1.5 text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          See all ideas
          <ArrowRightIcon className="size-3.5" />
        </Link>
      </CardContent>
    </Card>
  );
}

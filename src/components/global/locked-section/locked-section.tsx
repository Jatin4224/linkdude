/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use client";

/**
 * SOURCE OF TRUTH KEYWORDS: LockedSection, LockedSectionProps
 *
 * WHAT:  A panel that renders its content when the plan includes a feature, and
 *        an upgrade teaser when it does not.
 * WHY:   FeatureGate solves the other half of this problem — it wraps a TRIGGER
 *        and intercepts the click. There was nothing for gated CONTENT, so the
 *        alternative was per-feature conditional markup wherever a paid panel
 *        appears, each with its own teaser copy and its own upgrade wiring.
 *        Reads the same `usage.getFeatureGates` snapshot as FeatureGate, so a
 *        locked panel and a locked button can never disagree about the plan.
 *
 *        Deliberately does NOT blur real content. A locked panel is rendered
 *        because the server never generated the content in the first place —
 *        gating at generation is what makes a locked analysis genuinely cheaper
 *        rather than merely less visible, and a blur over placeholder text would
 *        imply data exists behind it.
 * WHERE: Any paid-tier panel. Currently the Experience and Projects critiques on
 *        the profile-analysis result view.
 */

import * as React from "react";
import { LockIcon, SparklesIcon } from "lucide-react";

import { useFeatureGate } from "@/components/feature-gate";
import { UpgradeModal } from "@/components/upgrade-modal";
import { useActiveOrganizationId } from "@/hooks/use-active-organization";
import type { ResourceKey } from "@/lib/resources";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export interface LockedSectionProps {
  /** A RESOURCES entry carrying a `flag` or a `limit`. */
  resource: ResourceKey;
  title: string;
  /** Small qualifier beside the title — "Professional", "Portfolio". */
  badge?: string;
  /** Icon for the heading, so a locked panel looks like its unlocked self. */
  icon?: React.ReactNode;
  /** One line saying what is behind the lock. Keep it specific. */
  teaser?: string;
  /** Rendered only when the plan includes the feature. */
  children: React.ReactNode;
}

export function LockedSection({
  resource,
  title,
  badge,
  icon,
  teaser = "Unlock tailored recommendations for your profile.",
  children,
}: LockedSectionProps) {
  const [showUpgradeModal, setShowUpgradeModal] = React.useState(false);
  const organizationId = useActiveOrganizationId();
  const gate = useFeatureGate(resource);

  const header = (
    <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
      <CardTitle className="flex items-center gap-2 text-base">
        {icon}
        {title}
      </CardTitle>
      {badge ? (
        <Badge variant="outline" className="font-normal">
          {badge}
        </Badge>
      ) : null}
    </CardHeader>
  );

  /* Neither state until the gate resolves: flashing the teaser and then
     replacing it with real content reads as a bug, and flashing content that
     then locks is worse. */
  if (gate === null) {
    return (
      <Card>
        {header}
        <CardContent className="flex flex-col gap-2">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
        </CardContent>
      </Card>
    );
  }

  if (!gate.atLimit) {
    return (
      <Card>
        {header}
        <CardContent>{children}</CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="border-dashed">
        {header}
        <CardContent className="flex flex-col items-start gap-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <SparklesIcon className="size-4 text-brand-soft-foreground" />
            Insights ready
          </div>
          <p className="text-sm text-muted-foreground">{teaser}</p>
          {/* States the cost of the "never generate what is locked" choice
              rather than hiding it — the user would otherwise upgrade and find
              the panel still empty. */}
          <p className="text-xs text-muted-foreground">
            Included from the next plan up. Re-run the analysis after upgrading
            to generate this section.
          </p>
          <Button
            type="button"
            variant="brand"
            size="sm"
            onClick={() => setShowUpgradeModal(true)}
          >
            <LockIcon className="size-4" />
            Unlock
          </Button>
        </CardContent>
      </Card>
      {organizationId ? (
        <UpgradeModal
          open={showUpgradeModal}
          onOpenChange={setShowUpgradeModal}
          organizationId={organizationId}
          resource={resource}
        />
      ) : null}
    </>
  );
}

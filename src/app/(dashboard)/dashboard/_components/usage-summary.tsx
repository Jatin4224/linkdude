/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use client";

/**
 * SOURCE OF TRUTH KEYWORDS: UsageSummary, DASHBOARD_USAGE_RESOURCES, UsageMeter,
 *   RESOURCES, LimitResourceKey, getResourceDefinition, plan usage, quota panel
 *
 * WHAT:  The metered quotas for this workspace, one meter per resource that
 *        costs money to use.
 * WHY:   Every one of these spends an AI call or a publish slot, and the whole
 *        point of the existing UsageMeter is that a cap should be visible BEFORE
 *        the action, not discovered as a rejection. The home page is where
 *        someone decides what to do today, so the counts belong here too.
 *        Composes UsageMeter rather than re-reading the gate: the meter already
 *        owns the unlimited case, the loading skeleton and the near-limit tone,
 *        and a second implementation would drift from it.
 * WHERE: src/app/(dashboard)/dashboard/page.tsx.
 */

import {
  getResourceDefinition,
  type LimitResourceKey,
} from "@/lib/resources";
import { UsageMeter } from "@/components/global/usage-meter";
import { TechLabel, TechPanel } from "@/components/global/tech";

/* The quotas a user actually spends day to day. Deliberately not every limit
 * resource — seats and storage are workspace admin concerns and live in
 * settings, not on the screen someone opens to decide what to write.
 * `satisfies` refuses any key that has no quota to meter. */
const DASHBOARD_USAGE_RESOURCES = [
  "linkedinPosts",
  "aiGeneration",
  "profileAnalysis",
  "contentPlan",
] as const satisfies readonly LimitResourceKey[];

export function UsageSummary() {
  return (
    /* ONE module, not four. Each quota is a reading off the same instrument —
       this plan, this period — and giving each its own bracketed panel would
       spend the page's whole budget of marks on a single band. The resource
       names are labels above numbers, which is exactly what mono is for. */
    <TechPanel className="grid gap-6 p-6 sm:grid-cols-2 lg:grid-cols-4">
      {DASHBOARD_USAGE_RESOURCES.map((resource) => (
        <div key={resource} className="flex flex-col gap-2">
          <TechLabel>{getResourceDefinition(resource).name}</TechLabel>
          <UsageMeter resource={resource} />
        </div>
      ))}
    </TechPanel>
  );
}

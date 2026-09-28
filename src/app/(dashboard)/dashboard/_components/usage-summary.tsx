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
  /* A deck is a day-to-day decision like a post is, so its cap belongs on the
   * screen where someone decides what to make today.
   *
   * Its two AI sub-quotas — illustrations and rewrites — deliberately stay OFF
   * this panel. They are spent inside the editor, on a slide, and a member
   * standing on the home page is not choosing between them; showing every
   * sub-meter here would turn a glance into an audit. They are surfaced in the
   * editor instead, beside the controls that spend them. */
  "carousel",
] as const satisfies readonly LimitResourceKey[];

export function UsageSummary() {
  return (
    /* ONE module, not four. Each quota is a reading off the same instrument —
       this plan, this period — and giving each its own bracketed panel would
       spend the page's whole budget of marks on a single band. The resource
       names are labels above numbers, which is exactly what mono is for. */
    /* Five columns at lg, not four: the list gained carousel, and four columns
       would strand the fifth meter alone on a second row. The count here tracks
       DASHBOARD_USAGE_RESOURCES — if that list grows again, this moves with it. */
    <TechPanel className="grid gap-6 p-6 sm:grid-cols-2 lg:grid-cols-5">
      {DASHBOARD_USAGE_RESOURCES.map((resource) => (
        <div key={resource} className="flex flex-col gap-2">
          <TechLabel>{getResourceDefinition(resource).name}</TechLabel>
          <UsageMeter resource={resource} />
        </div>
      ))}
    </TechPanel>
  );
}

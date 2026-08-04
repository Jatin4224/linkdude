/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use client";

/**
 * SOURCE OF TRUTH KEYWORDS: UsageMeter, UsageMeterProps, NEAR_LIMIT_PERCENT,
 *   useFeatureGate, FeatureGateData, LimitResourceKey, RESOURCES
 *
 * WHAT:  "3 of 5 analyses used" plus a bar, for any resource that declares a
 *        plan limit.
 * WHY:   Metered actions here spend real money the moment they run — a profile
 *        analysis bills an AI call, and the free tier gets five. Showing the cap
 *        only when it is hit means the user learns about it from a rejection,
 *        after the decision was already made. This puts the count next to the
 *        button instead.
 *
 *        Takes only a resource key and reads the gate itself, so no caller can
 *        pass counts that disagree with the server, and the label is derived
 *        from RESOURCES rather than accepted as a prop — the registry already
 *        owns what a resource is called and what its unit is.
 * WHERE: Rendered beside any limited action. Currently the profile-analysis
 *        page; post generation and publishing have the same shape.
 */

import { useFeatureGate } from "@/components/feature-gate";
import { RESOURCES, type LimitResourceKey } from "@/lib/resources";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export interface UsageMeterProps {
  /* LimitResourceKey, not ResourceKey: flag-only resources also appear in the
   * gate map with `limit: null`, and a meter for them would render nothing.
   * Narrowing here makes that a compile error instead of an empty box. */
  resource: LimitResourceKey;
  className?: string;
}

/* The point at which the bar switches to a warning tone. Early enough to still
 * be actionable — at 100% the only remaining action is to upgrade. */
const NEAR_LIMIT_PERCENT = 80;

export function UsageMeter({ resource, className }: UsageMeterProps) {
  const gate = useFeatureGate(resource);

  /* A skeleton rather than null: the meter sits directly above the action, and
   * appearing late would shift the button under a cursor already moving to it. */
  if (!gate) return <Skeleton className={cn("h-9 w-full", className)} />;

  /* `limit: null` means unlimited (enterprise, portal). A cap nobody can reach
   * is not information — render nothing rather than "12 of ∞". */
  if (gate.isUnlimited || gate.limit === null) return null;

  const { usage, limit, atLimit } = gate;
  /* Guard limit === 0 (a plan that disallows the feature outright) so the bar
   * shows full rather than dividing by zero. */
  const percent = limit === 0 ? 100 : Math.min(100, (usage / limit) * 100);
  const nearLimit = percent >= NEAR_LIMIT_PERCENT;
  const unit = RESOURCES[resource].limit.unit ?? "used";

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          <span
            className={cn(
              "font-medium tabular-nums",
              atLimit ? "text-destructive" : "text-foreground",
            )}
          >
            {usage} of {limit}
          </span>{" "}
          {unit} used
        </p>
        {atLimit ? (
          <p className="text-xs font-medium text-destructive">Limit reached</p>
        ) : null}
      </div>

      {/* Presentational only — the numbers above are the accessible copy, so the
          bar is hidden from screen readers rather than duplicating them. */}
      <div
        aria-hidden="true"
        className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
      >
        <div
          className={cn(
            "h-full rounded-full transition-all",
            atLimit || nearLimit ? "bg-destructive" : "bg-brand",
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

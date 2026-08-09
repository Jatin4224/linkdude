/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use client";

/**
 * SOURCE OF TRUTH KEYWORDS: RevenuePanel, RevenuePanelProps, PlanBreakdownRow,
 *   conversionRate, cancelingAtPeriodEnd, subscription mix, isStripeConfigured
 *
 * WHAT:  Subscriptions broken down by plan and status, plus conversion and
 *        already-booked churn.
 * WHY:   Counts, never a currency total. Plan prices live in env as DISPLAY
 *        values synced to Stripe by hand, so an MRR figure derived from them
 *        would look authoritative while being able to silently disagree with
 *        what Stripe actually charged.
 *
 *        When no subscription rows exist the panel says Stripe isn't connected
 *        rather than rendering a wall of zeros — zeros read as "nobody is
 *        buying", which is a very different and much more alarming message than
 *        "billing was never switched on".
 * WHERE: The /portal analytics dashboard.
 */

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { RevenueMetrics } from "@/lib/types";

export interface RevenuePanelProps {
  data: RevenueMetrics | undefined;
  loading?: boolean | undefined;
}

export function RevenuePanel({ data, loading }: RevenuePanelProps) {
  const hasSubscriptions =
    data !== undefined && data.byPlan.some((row) => row.plan.length > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Subscriptions</CardTitle>
        <CardDescription>
          {data?.conversionRate === null || data?.conversionRate === undefined
            ? "Paid plan mix across all workspaces"
            : `${data.conversionRate.toFixed(1)}% of workspaces are on a paid plan`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading || !data ? (
          <Skeleton className="h-32 w-full" />
        ) : !hasSubscriptions ? (
          <div className="text-muted-foreground space-y-1 text-sm">
            <p className="text-foreground font-medium">
              No subscriptions to report
            </p>
            <p>
              Billing is not connected yet, so every workspace is on the free
              plan. Add your Stripe keys and price IDs to start tracking
              conversion here.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-4">
              <Summary label="Active" value={data.totalActive} />
              <Summary label="Trialing" value={data.totalTrialing} />
              <Summary
                label="Canceling"
                value={data.cancelingAtPeriodEnd}
                muted
              />
            </div>

            <div className="flex flex-col divide-y">
              {data.byPlan.map((row) => (
                <div
                  key={row.plan}
                  className="flex items-center justify-between gap-3 py-2.5"
                >
                  <span className="text-sm font-medium capitalize">
                    {row.plan}
                  </span>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {row.active > 0 ? (
                      <Badge variant="secondary">{row.active} active</Badge>
                    ) : null}
                    {row.trialing > 0 ? (
                      <Badge variant="outline">{row.trialing} trial</Badge>
                    ) : null}
                    {row.canceled > 0 ? (
                      <Badge variant="outline" className="text-muted-foreground">
                        {row.canceled} inactive
                      </Badge>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Summary({
  label,
  value,
  muted,
}: {
  label: string;
  value: number;
  muted?: boolean;
}) {
  return (
    <div>
      <p className="text-muted-foreground text-xs">{label}</p>
      <p
        className={
          muted
            ? "text-muted-foreground text-2xl font-semibold tabular-nums"
            : "text-2xl font-semibold tabular-nums"
        }
      >
        {value.toLocaleString()}
      </p>
    </div>
  );
}

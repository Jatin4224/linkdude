/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use client";

/**
 * SOURCE OF TRUTH KEYWORDS: PortalOverview, analytics dashboard, MetricTile,
 *   RangeSelector, GrowthChart, EngagementChart, RevenuePanel, getMetrics,
 *   platform analytics
 *
 * WHAT:  The platform analytics dashboard — range picker, four KPI tiles with
 *        previous-period deltas, growth and engagement charts, retention, and
 *        the subscription mix.
 * WHY:   One `days` state drives every query so the whole page describes the
 *        same window; a per-panel range would let two charts disagree about
 *        what "now" means. Each panel subscribes to its OWN query rather than
 *        one combined payload, so the KPI tiles paint as soon as their counts
 *        land instead of waiting on the slowest rollup.
 * WHERE: Rendered by the /portal page, inside the portal-admin layout gate.
 */

import * as React from "react";
import { ExternalLinkIcon } from "lucide-react";

import { trpc } from "@/trpc/react-provider";
import type { AnalyticsRangeDays } from "@/lib/types";
import { MetricTile } from "@/components/global/metric-tile";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { RangeSelector } from "./range-selector";
import { GrowthChart } from "./growth-chart";
import { EngagementChart } from "./engagement-chart";
import { RevenuePanel } from "./revenue-panel";

const DEFAULT_RANGE: AnalyticsRangeDays = 30;

export function PortalOverview() {
  const [days, setDays] = React.useState<AnalyticsRangeDays>(DEFAULT_RANGE);
  const range = { days };

  const metrics = trpc.portal.getMetrics.useQuery(range);
  const growth = trpc.portal.getGrowthSeries.useQuery(range);
  const engagement = trpc.portal.getEngagementSeries.useQuery(range);
  const retention = trpc.portal.getRetention.useQuery(range);
  const revenue = trpc.portal.getRevenue.useQuery();

  const m = metrics.data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">
          Everything below covers the last {days} days, compared against the{" "}
          {days} days before that.
        </p>
        <RangeSelector value={days} onChange={setDays} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricTile
          label="Signups"
          value={m?.signups.current}
          percentChange={m?.signups.percentChange}
          previous={m?.signups.previous}
          loading={metrics.isLoading}
        />
        <MetricTile
          label="New workspaces"
          value={m?.workspaces.current}
          percentChange={m?.workspaces.percentChange}
          previous={m?.workspaces.previous}
          loading={metrics.isLoading}
        />
        <MetricTile
          label="Posts created"
          value={m?.postsCreated.current}
          percentChange={m?.postsCreated.percentChange}
          previous={m?.postsCreated.previous}
          loading={metrics.isLoading}
        />
        <MetricTile
          label="Sign-ins"
          value={m?.logins.current}
          percentChange={m?.logins.percentChange}
          previous={m?.logins.previous}
          loading={metrics.isLoading}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <GrowthChart data={growth.data} loading={growth.isLoading} />
        <EngagementChart
          data={engagement.data}
          loading={engagement.isLoading}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Retention</CardTitle>
            <CardDescription>
              Who is coming back, versus who just arrived
            </CardDescription>
          </CardHeader>
          <CardContent>
            {retention.isLoading || !retention.data ? (
              <Skeleton className="h-24 w-full" />
            ) : (
              <div className="grid grid-cols-3 gap-4">
                <Stat
                  label="Returning"
                  value={retention.data.returningUsers}
                  hint="signed in, joined earlier"
                />
                <Stat
                  label="New"
                  value={retention.data.newUsers}
                  hint="joined in this window"
                />
                <Stat
                  label="Live sessions"
                  value={retention.data.activeSessions}
                  hint="not yet expired"
                />
              </div>
            )}
          </CardContent>
        </Card>

        <RevenuePanel data={revenue.data} loading={revenue.isLoading} />
      </div>

      {/* Web traffic lives in Vercel Analytics, not this database — anonymous
          visitors never touch a table here. The link keeps /portal the single
          place the operator starts from. */}
      <Card>
        <CardHeader>
          <CardTitle>Web traffic</CardTitle>
          <CardDescription>
            Visitors, page views and referrers — including people who never sign
            up — are tracked by Vercel Analytics.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <a
            href="https://vercel.com/dashboard/analytics"
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
          >
            Open Vercel Analytics
            <ExternalLinkIcon aria-hidden="true" className="size-3.5" />
          </a>
        </CardContent>
      </Card>

      <p className="text-muted-foreground text-xs">
        Totals to date: {m?.totalUsers?.toLocaleString() ?? "—"} users across{" "}
        {m?.totalOrganizations?.toLocaleString() ?? "—"} workspaces. Your own
        admin workspace is excluded from every count.
      </p>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint: string;
}) {
  return (
    <div>
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="text-2xl font-semibold tabular-nums">
        {value.toLocaleString()}
      </p>
      <p className="text-muted-foreground text-xs">{hint}</p>
    </div>
  );
}

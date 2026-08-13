/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use client";

/**
 * SOURCE OF TRUTH KEYWORDS: GrowthChart, GrowthChartProps, AreaChart,
 *   ChartContainer, ChartConfig, signups chart, new workspaces
 *
 * WHAT:  New users and new workspaces per day, as two stacked area series.
 * WHY:   Both lines together answer a question neither answers alone — signups
 *        far above workspaces means people register and never start a
 *        workspace, which is a different problem from nobody signing up.
 *
 *        Colours come from ChartConfig as --chart-* theme tokens, never literal
 *        hex, so the chart follows light/dark like everything else.
 * WHERE: The /portal analytics dashboard.
 */

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { GrowthPoint } from "@/lib/types";
import { formatChartDay, formatChartDayLabel } from "./chart-format";

export interface GrowthChartProps {
  data: GrowthPoint[] | undefined;
  loading?: boolean | undefined;
}

const CHART_CONFIG = {
  users: { label: "Signups", color: "var(--chart-2)" },
  organizations: { label: "Workspaces", color: "var(--chart-1)" },
} satisfies ChartConfig;

export function GrowthChart({ data, loading }: GrowthChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Growth</CardTitle>
        <CardDescription>New signups and workspaces per day</CardDescription>
      </CardHeader>
      <CardContent>
        {loading || !data ? (
          <Skeleton className="h-60 w-full" />
        ) : (
          <ChartContainer config={CHART_CONFIG} className="h-60 w-full">
            <AreaChart data={data} margin={{ left: -20, right: 8, top: 8 }}>
              <defs>
                {/* Fading the fill downward keeps two overlapping series
                    readable where a flat 30% opacity would muddy them. */}
                {Object.keys(CHART_CONFIG).map((key) => (
                  <linearGradient
                    key={key}
                    id={`fill-${key}`}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="5%"
                      stopColor={`var(--color-${key})`}
                      stopOpacity={0.35}
                    />
                    <stop
                      offset="95%"
                      stopColor={`var(--color-${key})`}
                      stopOpacity={0.02}
                    />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="day"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={24}
                tickFormatter={formatChartDay}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={48}
                allowDecimals={false}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent labelFormatter={formatChartDayLabel} />
                }
              />
              <ChartLegend content={<ChartLegendContent />} />
              <Area
                dataKey="organizations"
                type="monotone"
                stroke="var(--color-organizations)"
                fill="url(#fill-organizations)"
                strokeWidth={2}
                stackId="a"
              />
              <Area
                dataKey="users"
                type="monotone"
                stroke="var(--color-users)"
                fill="url(#fill-users)"
                strokeWidth={2}
                stackId="b"
              />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

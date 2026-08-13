/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use client";

/**
 * SOURCE OF TRUTH KEYWORDS: EngagementChart, EngagementChartProps, BarChart,
 *   posts created, posts published, aiGenerations, activity chart
 *
 * WHAT:  Posts created, posts actually published, and AI generations per day.
 * WHY:   Bars, not areas — these are discrete counts of things that happened on
 *        a day, and an area chart implies a continuous quantity between points.
 *
 *        Created and published are drawn side by side because the GAP is the
 *        signal: a tall created bar over a short published one means posts are
 *        being written and then not going out, which is a scheduling or
 *        connection failure rather than a demand problem.
 * WHERE: The /portal analytics dashboard.
 */

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

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
import type { EngagementPoint } from "@/lib/types";
import { formatChartDay, formatChartDayLabel } from "./chart-format";

export interface EngagementChartProps {
  data: EngagementPoint[] | undefined;
  loading?: boolean | undefined;
}

const CHART_CONFIG = {
  postsCreated: { label: "Created", color: "var(--chart-1)" },
  postsPublished: { label: "Published", color: "var(--chart-2)" },
  aiGenerations: { label: "AI generations", color: "var(--chart-3)" },
} satisfies ChartConfig;

export function EngagementChart({ data, loading }: EngagementChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Engagement</CardTitle>
        <CardDescription>
          What people actually do in the product, per day
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading || !data ? (
          <Skeleton className="h-60 w-full" />
        ) : (
          <ChartContainer config={CHART_CONFIG} className="h-60 w-full">
            <BarChart data={data} margin={{ left: -20, right: 8, top: 8 }}>
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
              <Bar
                dataKey="postsCreated"
                fill="var(--color-postsCreated)"
                radius={[3, 3, 0, 0]}
              />
              <Bar
                dataKey="postsPublished"
                fill="var(--color-postsPublished)"
                radius={[3, 3, 0, 0]}
              />
              <Bar
                dataKey="aiGenerations"
                fill="var(--color-aiGenerations)"
                radius={[3, 3, 0, 0]}
              />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

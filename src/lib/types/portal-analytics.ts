/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: ANALYTICS_RANGE_DAYS, AnalyticsRangeDays,
 *   analyticsRangeSchema, AnalyticsRangeValues, MetricDelta, PlatformMetrics,
 *   GrowthPoint, EngagementPoint, RetentionMetrics, RevenueMetrics,
 *   PlanBreakdownRow, portal analytics, admin dashboard
 *
 * WHAT:  Input contract and return shapes for the /portal analytics dashboard —
 *        the range selector, the KPI tiles, and the three chart series.
 * WHY:   These are the ONLY place the raw-SQL rollups in
 *        portal-analytics.service.ts get a type. `prisma.$queryRaw` is
 *        generic-typed by the caller, so an untyped call silently returns
 *        `unknown[]` and every downstream `.map` becomes an implicit any —
 *        exactly the bypass CLAUDE.md forbids. Declaring the row shapes here
 *        makes the SELECT list and the TypeScript contract one thing.
 *
 *        The range is a closed union rather than a number so a caller cannot
 *        ask for 3650 days and table-scan the platform.
 * WHERE: src/services/portal-analytics.service.ts (return types),
 *        src/trpc/routers/portal.ts (procedure inputs), and the portal
 *        overview components.
 */

import { z } from "zod";

/**
 * SOURCE OF TRUTH KEYWORDS: ANALYTICS_RANGE_DAYS, AnalyticsRangeDays,
 *   analyticsRangeSchema, AnalyticsRangeValues
 *
 * WHAT:  The windows the dashboard can ask for, in days.
 * WHY:   A closed set, not `z.number()`. Every rollup below runs twice — once
 *        for the window and once for the window before it, to produce a delta —
 *        so an unbounded range doubles an already unbounded scan. Three fixed
 *        options also keep the series small enough to render without
 *        downsampling.
 */
export const ANALYTICS_RANGE_DAYS = [7, 30, 90] as const;
export type AnalyticsRangeDays = (typeof ANALYTICS_RANGE_DAYS)[number];

export const analyticsRangeSchema = z.object({
  days: z
    .union([z.literal(7), z.literal(30), z.literal(90)])
    .default(30)
    .describe("Trailing window the dashboard is showing."),
});
export type AnalyticsRangeValues = z.infer<typeof analyticsRangeSchema>;

/**
 * SOURCE OF TRUTH KEYWORDS: MetricDelta
 *
 * WHAT:  One KPI: the current window's value, the previous window's value, and
 *        the percentage change between them.
 * WHY:   `percentChange` is computed server-side rather than in the tile so the
 *        divide-by-zero case is decided once. Going from 0 to anything has no
 *        meaningful percentage, so it is `null` and the UI renders "new"
 *        instead of a fake +100%.
 */
export interface MetricDelta {
  current: number;
  previous: number;
  percentChange: number | null;
}

/**
 * SOURCE OF TRUTH KEYWORDS: PlatformMetrics
 *
 * WHAT:  The four headline KPIs, each with its previous-period comparison.
 * WHY:   One procedure rather than four so the tiles can never disagree about
 *        which window they are describing.
 */
export interface PlatformMetrics {
  signups: MetricDelta;
  workspaces: MetricDelta;
  postsCreated: MetricDelta;
  logins: MetricDelta;
  /* Point-in-time totals — not windowed, so they carry no delta. */
  totalUsers: number;
  totalOrganizations: number;
  activeSessions: number;
  activeSubscriptions: number;
}

/**
 * SOURCE OF TRUTH KEYWORDS: GrowthPoint
 *
 * WHAT:  One day on the growth chart.
 * WHY:   `day` is an ISO date string (YYYY-MM-DD), not a Date. The series
 *        crosses the tRPC boundary to a chart axis that wants a label, and a
 *        pre-formatted UTC day avoids the client re-deriving one in local time
 *        and shifting every bucket by its timezone offset.
 */
export interface GrowthPoint {
  day: string;
  users: number;
  organizations: number;
}

/**
 * SOURCE OF TRUTH KEYWORDS: EngagementPoint
 *
 * WHAT:  One day of product activity.
 * WHY:   `postsPublished` counts rows that actually reached LinkedIn, which is
 *        the number that says the product delivered value — `postsCreated`
 *        includes scheduled and failed rows that never went out.
 */
export interface EngagementPoint {
  day: string;
  postsCreated: number;
  postsPublished: number;
  aiGenerations: number;
}

/**
 * SOURCE OF TRUTH KEYWORDS: RetentionPoint, RetentionMetrics
 *
 * WHAT:  Sign-in activity over the window plus live-session counts.
 * WHY:   Sessions are the only sign-in record in the schema — Better Auth
 *        writes no audit rows — so `logins` is literally "Session rows created
 *        that day". `returningUsers` is the count of users with a session in
 *        this window who also existed before it, i.e. people who came back
 *        rather than signed up.
 */
export interface RetentionPoint {
  day: string;
  logins: number;
}

export interface RetentionMetrics {
  series: RetentionPoint[];
  activeSessions: number;
  returningUsers: number;
  newUsers: number;
}

/**
 * SOURCE OF TRUTH KEYWORDS: PlanBreakdownRow, RevenueMetrics
 *
 * WHAT:  Subscriptions grouped by plan, plus trial and churn counts.
 * WHY:   No currency amount is computed here. Prices live in env
 *        (NEXT_PUBLIC_*_MONTHLY_AMOUNT) as DISPLAY values that are kept in sync
 *        with Stripe by hand, so multiplying them by a seat count would produce
 *        a confident revenue number that can silently drift from what Stripe
 *        actually charged. Counts are honest; MRR belongs in Stripe's dashboard.
 */
export interface PlanBreakdownRow {
  plan: string;
  active: number;
  trialing: number;
  canceled: number;
}

export interface RevenueMetrics {
  byPlan: PlanBreakdownRow[];
  totalActive: number;
  totalTrialing: number;
  /* Active subscriptions flagged to stop at period end — churn already booked. */
  cancelingAtPeriodEnd: number;
  /* Paying (non-trial) organizations as a share of all organizations. */
  conversionRate: number | null;
}

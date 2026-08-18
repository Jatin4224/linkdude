/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: getPlatformMetrics, getGrowthSeries,
 *   getEngagementSeries, getRetentionMetrics, getRevenueMetrics,
 *   portal analytics, admin dashboard, date_trunc, rangeStart, dailySeries
 *
 * WHAT:  Cross-tenant analytics rollups for the /portal dashboard — signups,
 *        workspaces, posts, sign-ins, and subscription mix, bucketed by day and
 *        compared against the preceding window.
 * WHY:   Separate from portal.service.ts on purpose. That file resolves WHO the
 *        operator is and lists rows; this one only aggregates. Keeping the
 *        security-critical resolution (resolvePortalAdmin,
 *        ensurePortalOwnerOrganization) away from query-shaped code means a
 *        change to a chart can never accidentally edit the admin gate.
 *
 *        Day buckets are built with Postgres `date_trunc` via $queryRaw rather
 *        than Prisma groupBy, which cannot group by a derived expression — the
 *        alternative is fetching every row and bucketing in JS, which is the
 *        thing an analytics query must not do. Precedent for raw SQL here is
 *        the scheduled-post worker's claim query in linkedin.service.ts.
 *
 *        Every COUNT is cast `::int`. Postgres returns bigint for COUNT(*),
 *        which arrives as a JS BigInt and does not survive JSON serialization
 *        cleanly — the cast keeps the row types plain `number`.
 * WHERE: Called only by the portal-admin-gated procedures in
 *        src/trpc/routers/portal.ts.
 */

import "server-only";

import { prisma } from "@/lib/config/prisma";
import type {
  AnalyticsRangeDays,
  EngagementPoint,
  GrowthPoint,
  MetricDelta,
  PlanBreakdownRow,
  PlatformMetrics,
  RetentionMetrics,
  RetentionPoint,
  RevenueMetrics,
} from "@/lib/types";

/* The operator's own workspace is flagged isPortalOrganization and would
 * otherwise show up as a customer in every count. getPortalOverview already
 * excludes it; these rollups must agree with that number or the dashboard
 * contradicts itself. */
const EXCLUDE_PORTAL_ORG = { isPortalOrganization: false } as const;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * SOURCE OF TRUTH KEYWORDS: rangeStart, rangeBounds
 *
 * WHAT:  The [start, previousStart] pair for a trailing window of `days`.
 * WHY:   Every KPI is "this window vs the one before it", so both boundaries
 *        come from one helper — computing them at each call site is how the
 *        two windows drift out of alignment.
 */
function rangeBounds(days: AnalyticsRangeDays): {
  start: Date;
  previousStart: Date;
} {
  const now = Date.now();
  return {
    start: new Date(now - days * DAY_MS),
    previousStart: new Date(now - 2 * days * DAY_MS),
  };
}

/**
 * SOURCE OF TRUTH KEYWORDS: toDelta, MetricDelta
 *
 * WHAT:  Packages a current/previous pair with its percentage change.
 * WHY:   Growth from zero has no percentage — `null` lets the tile say "new"
 *        rather than render a meaningless +100%, and keeps the divide-by-zero
 *        decision in one place instead of in every component.
 */
function toDelta(current: number, previous: number): MetricDelta {
  const percentChange =
    previous === 0 ? null : ((current - previous) / previous) * 100;
  return { current, previous, percentChange };
}

/* Raw-row shapes. Each mirrors the SELECT list of the query directly below it;
 * $queryRaw is typed by the caller, so these are the only thing standing
 * between the SQL and an implicit any. */
interface DayCountRow {
  day: Date;
  count: number;
}

interface EngagementRow {
  day: Date;
  postsCreated: number;
  postsPublished: number;
}

interface PlanRow {
  plan: string;
  status: string;
  count: number;
}

/* Postgres hands back a Date for date_trunc; the chart wants a stable UTC day
 * label. Slicing the ISO string avoids toLocaleDateString, which would bucket
 * by the SERVER's timezone and shift every point for anyone not on UTC. */
function toDayKey(day: Date): string {
  return day.toISOString().slice(0, 10);
}

/**
 * SOURCE OF TRUTH KEYWORDS: buildDayIndex, dailySeries
 *
 * WHAT:  Turns sparse day-count rows into a lookup keyed by YYYY-MM-DD.
 * WHY:   SQL returns no row for a day with zero events. A chart that renders
 *        only the returned rows draws a continuous line across the gap and
 *        implies activity that did not happen — so the series is rebuilt over
 *        every day in the window and missing days resolve to 0.
 */
function buildDayIndex(rows: DayCountRow[]): Map<string, number> {
  return new Map(rows.map((row) => [toDayKey(row.day), row.count]));
}

/* Every day in the window, oldest first, as YYYY-MM-DD. */
function eachDay(days: AnalyticsRangeDays): string[] {
  const today = Date.now();
  const result: string[] = [];
  for (let offset = days - 1; offset >= 0; offset--) {
    result.push(new Date(today - offset * DAY_MS).toISOString().slice(0, 10));
  }
  return result;
}

/**
 * SOURCE OF TRUTH KEYWORDS: getPlatformMetrics, PlatformMetrics
 *
 * WHAT:  The four headline KPIs with previous-period comparisons, plus
 *        point-in-time totals.
 * WHY:   One round of parallel counts rather than four procedures, so the tiles
 *        cannot disagree about which window they describe. Sign-ins come from
 *        Session rows because Better Auth writes no audit entries — ActivityLog
 *        requires a non-null organizationId and therefore structurally cannot
 *        hold a pre-organization event like a sign-up or a sign-in.
 * WHERE: portal.getMetrics.
 */
export async function getPlatformMetrics(
  days: AnalyticsRangeDays,
): Promise<PlatformMetrics> {
  const { start, previousStart } = rangeBounds(days);
  const now = new Date();

  const [
    signupsCurrent,
    signupsPrevious,
    workspacesCurrent,
    workspacesPrevious,
    postsCurrent,
    postsPrevious,
    loginsCurrent,
    loginsPrevious,
    totalUsers,
    totalOrganizations,
    activeSessions,
    activeSubscriptions,
  ] = await Promise.all([
    prisma.user.count({ where: { createdAt: { gte: start } } }),
    prisma.user.count({
      where: { createdAt: { gte: previousStart, lt: start } },
    }),
    prisma.organization.count({
      where: { ...EXCLUDE_PORTAL_ORG, createdAt: { gte: start } },
    }),
    prisma.organization.count({
      where: {
        ...EXCLUDE_PORTAL_ORG,
        createdAt: { gte: previousStart, lt: start },
      },
    }),
    /* `not: draft` on both halves: a draft spends no post slot and may never be
     * published, so counting it would inflate platform activity — and inflate
     * only the CURRENT window, making the trend arrow lie. */
    prisma.linkedInPost.count({
      where: { createdAt: { gte: start }, status: { not: "draft" } },
    }),
    prisma.linkedInPost.count({
      where: {
        createdAt: { gte: previousStart, lt: start },
        status: { not: "draft" },
      },
    }),
    /* impersonatedBy filters out admin impersonation sessions — without it the
     * operator's own support visits inflate the login count. */
    prisma.session.count({
      where: { createdAt: { gte: start }, impersonatedBy: null },
    }),
    prisma.session.count({
      where: {
        createdAt: { gte: previousStart, lt: start },
        impersonatedBy: null,
      },
    }),
    prisma.user.count(),
    prisma.organization.count({ where: EXCLUDE_PORTAL_ORG }),
    prisma.session.count({
      where: { expiresAt: { gt: now }, impersonatedBy: null },
    }),
    prisma.subscription.count({
      where: { status: { in: ["active", "trialing"] } },
    }),
  ]);

  return {
    signups: toDelta(signupsCurrent, signupsPrevious),
    workspaces: toDelta(workspacesCurrent, workspacesPrevious),
    postsCreated: toDelta(postsCurrent, postsPrevious),
    logins: toDelta(loginsCurrent, loginsPrevious),
    totalUsers,
    totalOrganizations,
    activeSessions,
    activeSubscriptions,
  };
}

/**
 * SOURCE OF TRUTH KEYWORDS: getGrowthSeries, GrowthPoint
 *
 * WHAT:  New users and new workspaces per day across the window.
 * WHY:   Two separate queries rather than a join — users and organizations have
 *        no relation that survives a FULL OUTER JOIN on a truncated date, and
 *        merging two small indexed rollups in JS is cheaper than teaching SQL
 *        to do it.
 * WHERE: portal.getGrowthSeries.
 */
export async function getGrowthSeries(
  days: AnalyticsRangeDays,
): Promise<GrowthPoint[]> {
  const { start } = rangeBounds(days);

  const [userRows, orgRows] = await Promise.all([
    prisma.$queryRaw<DayCountRow[]>`
      SELECT date_trunc('day', "createdAt") AS day, COUNT(*)::int AS count
        FROM "user"
       WHERE "createdAt" >= ${start}
       GROUP BY day
       ORDER BY day`,
    prisma.$queryRaw<DayCountRow[]>`
      SELECT date_trunc('day', "createdAt") AS day, COUNT(*)::int AS count
        FROM "organization"
       WHERE "createdAt" >= ${start}
         AND "isPortalOrganization" = false
       GROUP BY day
       ORDER BY day`,
  ]);

  const users = buildDayIndex(userRows);
  const organizations = buildDayIndex(orgRows);

  return eachDay(days).map((day) => ({
    day,
    users: users.get(day) ?? 0,
    organizations: organizations.get(day) ?? 0,
  }));
}

/**
 * SOURCE OF TRUTH KEYWORDS: getEngagementSeries, EngagementPoint
 *
 * WHAT:  Posts created, posts actually published, and AI generations per day.
 * WHY:   created vs published is the interesting gap: a scheduled post that
 *        never went out counts as intent, not delivery, so plotting only one of
 *        them hides either the demand or the failure. AI generations come from
 *        ActivityLog because generation writes no domain row of its own.
 *
 *        DRAFTS ARE EXCLUDED from "created". A draft is unspent intent — it costs
 *        no post slot and may never leave the composer — so counting one would
 *        inflate platform activity with rows that represent nothing delivered,
 *        and make the created-vs-published gap unreadable.
 * WHERE: portal.getEngagementSeries.
 */
export async function getEngagementSeries(
  days: AnalyticsRangeDays,
): Promise<EngagementPoint[]> {
  const { start } = rangeBounds(days);

  const [postRows, aiRows] = await Promise.all([
    /* One pass over linkedin_post: FILTER counts published rows within the same
     * scan rather than issuing a second query against the same index. */
    prisma.$queryRaw<EngagementRow[]>`
      SELECT date_trunc('day', "createdAt") AS day,
             COUNT(*)::int AS "postsCreated",
             COUNT(*) FILTER (WHERE "status" = 'published')::int AS "postsPublished"
        FROM "linkedin_post"
       WHERE "createdAt" >= ${start}
         AND "status" <> 'draft'
       GROUP BY day
       ORDER BY day`,
    prisma.$queryRaw<DayCountRow[]>`
      SELECT date_trunc('day', "createdAt") AS day, COUNT(*)::int AS count
        FROM "activity_log"
       WHERE "createdAt" >= ${start}
         AND "entity" = 'aiGeneration'
       GROUP BY day
       ORDER BY day`,
  ]);

  const created = new Map(
    postRows.map((row) => [toDayKey(row.day), row.postsCreated]),
  );
  const published = new Map(
    postRows.map((row) => [toDayKey(row.day), row.postsPublished]),
  );
  const generations = buildDayIndex(aiRows);

  return eachDay(days).map((day) => ({
    day,
    postsCreated: created.get(day) ?? 0,
    postsPublished: published.get(day) ?? 0,
    aiGenerations: generations.get(day) ?? 0,
  }));
}

/**
 * SOURCE OF TRUTH KEYWORDS: getRetentionMetrics, RetentionMetrics
 *
 * WHAT:  Sign-ins per day, live sessions, and a returning-vs-new split.
 * WHY:   "Returning" is deliberately defined as a user who signed in during the
 *        window but was created BEFORE it. That is the honest read of whether
 *        anyone comes back, and it is derivable from data that already exists —
 *        there is no lastActive column, and Session.updatedAt only refreshes on
 *        Better Auth's ~1-day updateAge, so it is not a usable heartbeat.
 * WHERE: portal.getRetention.
 */
export async function getRetentionMetrics(
  days: AnalyticsRangeDays,
): Promise<RetentionMetrics> {
  const { start } = rangeBounds(days);
  const now = new Date();

  const [loginRows, activeSessions, returningUsers, newUsers] =
    await Promise.all([
      prisma.$queryRaw<DayCountRow[]>`
        SELECT date_trunc('day', "createdAt") AS day, COUNT(*)::int AS count
          FROM "session"
         WHERE "createdAt" >= ${start}
           AND "impersonatedBy" IS NULL
         GROUP BY day
         ORDER BY day`,
      prisma.session.count({
        where: { expiresAt: { gt: now }, impersonatedBy: null },
      }),
      prisma.user.count({
        where: {
          createdAt: { lt: start },
          sessions: { some: { createdAt: { gte: start } } },
        },
      }),
      prisma.user.count({ where: { createdAt: { gte: start } } }),
    ]);

  const logins = buildDayIndex(loginRows);
  const series: RetentionPoint[] = eachDay(days).map((day) => ({
    day,
    logins: logins.get(day) ?? 0,
  }));

  return { series, activeSessions, returningUsers, newUsers };
}

/**
 * SOURCE OF TRUTH KEYWORDS: getRevenueMetrics, RevenueMetrics, PlanBreakdownRow
 *
 * WHAT:  Subscription counts by plan and status, plus conversion and booked
 *        churn.
 * WHY:   Counts only — no currency. Plan prices live in env as DISPLAY values
 *        kept in sync with Stripe by hand, so deriving MRR from them would
 *        produce a number that looks authoritative and can silently disagree
 *        with what was actually charged. Stripe's own dashboard owns revenue.
 * WHERE: portal.getRevenue.
 */
export async function getRevenueMetrics(): Promise<RevenueMetrics> {
  const [rows, totalOrganizations] = await Promise.all([
    prisma.$queryRaw<PlanRow[]>`
      SELECT "plan", "status", COUNT(*)::int AS count
        FROM "subscription"
       GROUP BY "plan", "status"
       ORDER BY "plan"`,
    prisma.organization.count({ where: EXCLUDE_PORTAL_ORG }),
  ]);

  const byPlanMap = new Map<string, PlanBreakdownRow>();
  let totalActive = 0;
  let totalTrialing = 0;

  for (const row of rows) {
    const entry = byPlanMap.get(row.plan) ?? {
      plan: row.plan,
      active: 0,
      trialing: 0,
      canceled: 0,
    };
    if (row.status === "active") {
      entry.active += row.count;
      totalActive += row.count;
    } else if (row.status === "trialing") {
      entry.trialing += row.count;
      totalTrialing += row.count;
    } else {
      /* Everything else — canceled, past_due, incomplete, unpaid — is "not
       * currently earning", and splitting it further says more about Stripe's
       * state machine than about the business. */
      entry.canceled += row.count;
    }
    byPlanMap.set(row.plan, entry);
  }

  const cancelingAtPeriodEnd = await prisma.subscription.count({
    where: { cancelAtPeriodEnd: true, status: "active" },
  });

  return {
    byPlan: [...byPlanMap.values()],
    totalActive,
    totalTrialing,
    cancelingAtPeriodEnd,
    conversionRate:
      totalOrganizations === 0
        ? null
        : (totalActive / totalOrganizations) * 100,
  };
}

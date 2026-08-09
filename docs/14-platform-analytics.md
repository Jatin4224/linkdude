# Building the Platform Analytics Dashboard — a complete walkthrough

The fifth feature, and the first one where **most of the work was already done and switched off**.

The ask was "an `/admin-panel` only I can see, showing signups, posts, and whether my SaaS is getting attention." The answer turned out to be: don't build `/admin-panel` — `/portal` already had the entire access-control half, it just had nothing worth looking at.

## Table of contents

1. [The 10-second version](#the-10-second-version)
2. [Words you need to know](#words-you-need-to-know)
3. [The search that came before the code](#the-search-that-came-before-the-code)
4. [Four decisions made before any code](#four-decisions-made-before-any-code)
5. [Step 1 — Indexes](#step-1--indexes)
6. [Step 2 — The chart library](#step-2--the-chart-library)
7. [Step 3 — Types](#step-3--types)
8. [Step 4 — The analytics service](#step-4--the-analytics-service)
9. [Step 5 — The router](#step-5--the-router)
10. [Step 6 — The UI](#step-6--the-ui)
11. [Step 7 — Web traffic](#step-7--web-traffic)
12. [Turning it on](#turning-it-on)
13. [Mistakes that are easy to make](#mistakes-that-are-easy-to-make)
14. [What we deliberately did NOT build](#what-we-deliberately-did-not-build)
15. [File map](#file-map)

---

## The 10-second version

**9 new files, 6 edited.** Same layer order as every feature before it:

```
schema  →  types  →  services  →  router  →  UI
```

No new resource key. No new route. No new access control. The `/portal` overview page went from three bare `COUNT(*)` numbers to a dashboard with a range selector, four KPI tiles with previous-period deltas, two charts, a retention panel, and a subscription breakdown.

---

## Words you need to know

| Term | Meaning here |
|---|---|
| **Window** | The trailing range being shown — 7, 30, or 90 days. |
| **Previous period** | The window of equal length immediately before the current one. Every delta compares these two. |
| **Delta** | `{ current, previous, percentChange }`. `percentChange` is `null` when the previous period was zero. |
| **Rollup** | A `GROUP BY date_trunc('day', ...)` query returning one row per day that had activity. |
| **Gap-filling** | Rebuilding a rollup over *every* day in the window so days with no activity render as 0 instead of vanishing. |
| **Portal org** | The operator's own workspace, flagged `isPortalOrganization`. Excluded from every count. |

---

## The search that came before the code

Before writing anything, the question was: *does this already exist?* It mostly did.

| Already built | Where |
|---|---|
| "Only I can see it" gate | `isPortalEnabled` + `isPortalOwnerEmail` + `resolvePortalAdmin` |
| Auto-provisioning the owner | `ensurePortalOwnerOrganization` — no seed script |
| Cross-tenant procedure | `portalProcedure` in `src/trpc/routers/portal.ts` |
| Hidden unlimited tier | `PLANS.portal` + `isPortalOrganization` short-circuit in `getOrganizationTier` |
| Route gate + 404 when disabled | `src/app/(portal)/portal/layout.tsx` |
| Sidebar, entry point | `portal-sidebar.tsx`, "Platform admin" item in `nav-user.tsx` |
| Org / user / audit-log lists | `portal.listOrganizations`, `listUsers`, `listActivity` |

| Genuinely missing | Consequence |
|---|---|
| Any date filtering or grouping | `getPortalOverview()` was three unfiltered counts |
| Any chart library | Nothing in `package.json`, no `ui/chart.tsx` |
| Any web-traffic tracking | Anonymous visitors invisible, **and unbackfillable** |
| Indexes on the analytics timestamps | Every rollup would seq-scan |

> **The lesson worth keeping.** Building `/admin-panel` would have duplicated a security boundary — two places deciding who the operator is, which is exactly the kind of thing that drifts and lets the wrong person in. The registry-and-reuse rule in `.claude/CLAUDE.md` is usually about saving effort; here it was about not having two answers to "who is the admin".

---

## Four decisions made before any code

### Decision 1 — Extend `/portal`, don't create `/admin-panel`

Covered above. `PORTAL_PATH_PREFIX` exists if you want the URL to read `/admin-panel`, but note it is a **partial** abstraction: the App Router directory is hardcoded at `src/app/(portal)/portal/`, so changing the prefix without moving the folder breaks the routes.

### Decision 2 — No `RESOURCES` entry

Tempting, because almost everything else in this app starts with one. Wrong here, for two reasons:

1. **The registry describes tenant features.** Permissions, plan limits, sidebar entries, quota counters — all of it is scoped to an organization. Platform analytics is not a thing a customer has; it is a thing the operator has.
2. **The guardrail doesn't apply anyway.** The `<resource>.<verb>` check in `protectedProcedure` governs **mutations only**. Every analytics endpoint is a query.

So these procedures carry no permission string, no quota, no audit row.

### Decision 3 — Counts, never currency

The revenue panel reports how many subscriptions are active, trialing, or inactive. It does **not** compute MRR.

Plan prices live in env as `NEXT_PUBLIC_*_MONTHLY_AMOUNT` — and `.env.example` says plainly that these are **display only**, kept in sync with the Stripe Price IDs *by hand*. Multiplying a hand-synced display number by a subscription count produces a revenue figure that looks authoritative and can silently disagree with what Stripe actually charged.

Counts are things this database knows. Revenue is something Stripe knows. Don't let a dashboard imply otherwise.

### Decision 4 — Third-party for web traffic

"Is my SaaS getting attention" is mostly a question about people who have **not** signed up. Those people touch no table in this database — there is nothing to query, and no amount of schema work creates history that was never recorded.

`@vercel/analytics` handles it: page views, referrers, top pages, bot filtering. The portal links out rather than trying to re-host the data.

---

## Step 1 — Indexes

Every timestamp the dashboard buckets on was unindexed. Thirteen indexes added to `prisma/schema.prisma`:

| Model | Added | Why |
|---|---|---|
| `User` | `createdAt` | signups per day |
| `Organization` | `createdAt` | new workspaces per day |
| `Session` | `createdAt`, `userId`, `expiresAt` | logins per day, live sessions |
| `LinkedInPost` | `createdAt` | posts per day — the existing composites are all **org-scoped**, useless for a cross-tenant rollup |
| `Subscription` | `referenceId`, `status`, `createdAt` | revenue panel |
| `ActivityLog` | `[entity, createdAt]` | "events of type X per day" |
| `Member` | `organizationId`, `userId` | — |

Two of these fix problems that predate analytics. **`Member` had no indexes at all**, despite being read on every org-scoped request by the membership check in `protectedProcedure`. And `Subscription.referenceId` — the billing router's primary lookup — was unindexed.

### Applying them

**Never `prisma migrate dev`.** This repo has no `prisma/migrations/` directory, so `migrate dev` reads the entire database as drift and offers to drop it — see [doc 10, "Two incidents"](./10-profile-analyzer.md#two-incidents-and-what-they-taught-us-about-the-database).

Preview first (read-only, changes nothing):

```bash
npx prisma migrate diff \
  --from-schema-datasource prisma/schema.prisma \
  --to-schema-datamodel   prisma/schema.prisma \
  --script
```

It should print only `CREATE INDEX` lines. Then:

```bash
npx prisma db push
```

---

## Step 2 — The chart library

```bash
npx shadcn add chart
```

Creates `src/components/ui/chart.tsx` and installs recharts. The `--chart-1` … `--chart-5` tokens already existed in `globals.css` for both themes and were already mapped in the `@theme` block, so no CSS work was needed.

### The trap: the CLI rewrites files you didn't ask it to

It also overwrote `src/components/ui/card.tsx` and **silently stripped `font-heading` from `CardTitle`** — the app's branded heading font, used by every card in the product.

This is precisely what `.claude/CLAUDE.md` warns about: *"when you import shadcn ui components or blocks, sometimes they will have outdated copy that doesn't follow the branding of this app."*

> **Always `git diff` after running the shadcn CLI.** It reports which files it created; it is much quieter about which it *updated*.

The generated `chart.tsx` also shipped two `as string` assertions that its own surrounding `typeof x === "string"` guards already narrow — lint errors under `@typescript-eslint/no-unnecessary-type-assertion`. Removed rather than suppressed.

---

## Step 3 — Types

`src/lib/types/portal-analytics.ts` (new), re-exported from the barrel.

### The range is a closed union, not a number

```ts
export const ANALYTICS_RANGE_DAYS = [7, 30, 90] as const;

export const analyticsRangeSchema = z.object({
  days: z.union([z.literal(7), z.literal(30), z.literal(90)]).default(30),
});
```

Not `z.number()`. Every rollup runs **twice** — once for the window, once for the window before it — so an unbounded range doubles an already unbounded scan. The UI maps its buttons from the same const, so the control can never offer a window the schema rejects.

### Why the row shapes live here

`prisma.$queryRaw` is generic-typed **by the caller**. An untyped call returns `unknown[]`, and every `.map()` downstream becomes an implicit any — the exact bypass CLAUDE.md forbids. Declaring `DayCountRow`, `EngagementRow`, `PlanRow` next to the SELECT lists makes the SQL and the TypeScript one thing.

### `percentChange: number | null`

`null` means the previous period was zero. The tile renders "First activity in this window" rather than `+100%`.

Growth from nothing has no percentage. Inventing one makes an empty dashboard look like a rocket ship, which is the single easiest way for an analytics page to lie to its owner.

---

## Step 4 — The analytics service

`src/services/portal-analytics.service.ts` (new), `import "server-only"` at the top.

### Why a new file instead of growing `portal.service.ts`

That file resolves **who the operator is** — `resolvePortalAdmin`, `ensurePortalOwnerOrganization`. This one only aggregates. Keeping security-critical resolution away from query-shaped code means a change to a chart can never accidentally edit the admin gate.

### Why raw SQL

Prisma's `groupBy` cannot group by a derived expression, and `date_trunc('day', "createdAt")` is a derived expression. The alternative is fetching every row and bucketing in JS — which is the one thing an analytics query must never do.

Precedent for raw SQL in this codebase is the scheduled-post worker's claim query (`linkedin.service.ts`). Use tagged templates; never interpolate strings.

### Trap 1 — `COUNT(*)` returns bigint

```sql
SELECT date_trunc('day', "createdAt") AS day, COUNT(*)::int AS count
```

Without `::int`, Postgres returns `bigint`, which arrives as a JS `BigInt` and does not survive JSON serialization cleanly. Cast in SQL and the row type is plain `number` all the way to the chart.

### Trap 2 — SQL returns no row for a day with zero activity

A rollup over 30 days where only 4 had signups returns **4 rows**. Feed that straight to a chart and it draws a continuous line across the gaps, implying activity that never happened.

So every series is rebuilt over the full window:

```ts
function buildDayIndex(rows: DayCountRow[]): Map<string, number> { ... }
function eachDay(days: AnalyticsRangeDays): string[] { ... }

return eachDay(days).map((day) => ({
  day,
  users: users.get(day) ?? 0,
  organizations: organizations.get(day) ?? 0,
}));
```

### Trap 3 — the timezone bug that shifts every bucket

Day keys are produced with `toISOString().slice(0, 10)`, **not** `toLocaleDateString()`.

`toLocaleDateString` formats in the *server's* timezone. On any deployment not running UTC, every bucket silently shifts by the offset and days near midnight land in the wrong bar. A UTC ISO day is the same string everywhere.

### Two exclusions that keep the numbers honest

```ts
const EXCLUDE_PORTAL_ORG = { isPortalOrganization: false } as const;
```

The operator's own workspace would otherwise appear as a customer. `getPortalOverview` already excluded it, and these rollups must agree or the dashboard contradicts itself.

```ts
prisma.session.count({ where: { ..., impersonatedBy: null } })
```

Admin impersonation sessions are excluded from every login and active-session count. Without this, your own support visits inflate retention — you'd be measuring yourself.

### Why growth can't come from `ActivityLog`

`ActivityLog` is otherwise a near-complete event stream: `protectedProcedure` auto-writes a row inside every mutation's transaction, and there is a hard guardrail against unaudited mutations.

But **`ActivityLog.organizationId` is non-nullable**, and Better Auth writes no audit rows at all. Sign-up and sign-in happen before there is an organization to attribute them to, so they are *structurally* absent.

Growth therefore reads `User.createdAt` and retention reads `Session.createdAt` directly. Changing that would mean making `organizationId` nullable or adding a separate events table — neither justified for four numbers.

### Why "returning users" is defined the way it is

```ts
prisma.user.count({
  where: {
    createdAt: { lt: start },
    sessions: { some: { createdAt: { gte: start } } },
  },
})
```

A user who signed in **during** the window but was created **before** it. That is the honest read of "did anyone come back", and it uses only data that already exists.

The tempting alternative — a `lastActive` column — doesn't exist, and `Session.updatedAt` is not a substitute: `auth.ts` sets no `session.updateAge`, so Better Auth's default means the row refreshes roughly **once a day**. DAU derived from it would be wrong in a way that looks plausible.

---

## Step 5 — The router

Five queries appended to the existing `portalRouter`:

```ts
getMetrics           // KPI tiles + deltas
getGrowthSeries      // signups + workspaces per day
getEngagementSeries  // posts created/published, AI generations per day
getRetention         // logins per day, returning vs new, live sessions
getRevenue           // subscription mix — no range input
```

All on `portalProcedure`, which is `authProcedure` + the platform-admin gate — **not** `protectedProcedure`. That matters: `protectedProcedure` requires an `organizationId` on every input and scopes everything to one tenant, which is the opposite of what a cross-tenant read needs. The global `apiLimiter` from `baseProcedure` still applies.

`getRevenue` takes no range because subscription mix is a point-in-time snapshot — "how many people pay me right now" — not a windowed series.

### Why five procedures instead of one

A single `getDashboard` would make the fastest panel wait for the slowest. Split, the KPI tiles paint as soon as their counts land while the charts are still resolving.

---

## Step 6 — The UI

The `/portal` overview page was rewritten in place. **No sidebar change** — `PORTAL_NAV` is a hardcoded list in `portal-sidebar.tsx`, and this enhanced an existing route rather than adding one.

### One `days` state drives everything

```tsx
const [days, setDays] = React.useState<AnalyticsRangeDays>(30);
const range = { days };

const metrics = trpc.portal.getMetrics.useQuery(range);
const growth = trpc.portal.getGrowthSeries.useQuery(range);
// ...
```

Per-panel ranges would let two charts disagree about what "now" means.

### `MetricTile` is global, the charts are route-local

`src/components/global/metric-tile/` takes its numbers entirely through props and knows nothing about the portal — the tenant dashboard's usage summary could adopt it unchanged. That is the test for `global/` in this codebase.

The charts read portal-shaped types and live in `_components`.

It reuses `CountUp` (`components/global/count-up/`) rather than rendering a raw number — that component already handles reduced-motion and server-renders the final value.

### Colours are tokens, never hex

```ts
const CHART_CONFIG = {
  users: { label: "Signups", color: "var(--chart-2)" },
  organizations: { label: "Workspaces", color: "var(--chart-1)" },
} satisfies ChartConfig;
```

shadcn's `ChartContainer` turns each entry into a `--color-<key>` CSS variable, referenced as `fill="url(#fill-users)"` / `stroke="var(--color-users)"`. Light and dark follow the app theme for free.

### The recharts typing trap

`tickFormatter` receives the raw `string` dataKey value. `labelFormatter` is typed against `ReactNode` — it can receive a rendered node, not just the key. Passing the same `(day: string) => string` to both is a type error.

Both live in `_components/chart-format.ts`, shared so two charts can't drift into different date formats:

```ts
export function formatChartDay(day: string): string           // axis: "Aug 9"
export function formatChartDayLabel(label: ReactNode): ReactNode  // tooltip: "Sat, Aug 9"
```

The label variant narrows with `typeof label === "string"` — no cast, no `any`.

### Empty states say why, not zero

When no subscriptions exist the revenue panel says *"Billing is not connected yet"*, not a grid of zeros. Zeros read as "nobody is buying". "Billing was never switched on" is a completely different and far less alarming message, and it is the true one.

---

## Step 7 — Web traffic

```tsx
import { Analytics } from "@vercel/analytics/next";
// ...
<Analytics />
```

Mounted in `src/app/layout.tsx`, deliberately **outside** the setup-checklist branch. Marketing pages are the traffic worth measuring, and they render even while the app itself is unconfigured. It no-ops in development and off Vercel, so it needs no env guard.

The portal shows a link-out card rather than trying to re-host the data.

---

## Turning it on

```
PORTAL_ENABLED="true"
PORTAL_INITIAL_OWNER_EMAIL="you@example.com"
```

Both together — `required-env.ts` makes the email conditionally required via a `when` predicate, so enabling without it surfaces on the setup checklist instead of dead-ending.

`PORTAL_INITIAL_OWNER_EMAIL` is **not** `NEXT_PUBLIC_`. It is server-only and never reaches a client bundle; the browser only ever learns a boolean from `portal.getAccess`.

Then: sign in → user menu → **Platform admin**. `ensurePortalOwnerOrganization` provisions your admin workspace on first visit.

### Verifying the gate

The security check that actually matters:

1. Sign in as a **non-owner** → `/portal` must redirect to `/dashboard`, and `portal.getMetrics` must throw `FORBIDDEN`.
2. Set `PORTAL_ENABLED="false"` → `/portal` must return a genuine **404**, not a redirect. A redirect would confirm the route exists.

---

## Mistakes that are easy to make

**Adding a `RESOURCES` entry for this.** It would create a permission string, a plan limit column on the pricing table, and a sidebar item — for a feature no customer has.

**Forgetting `::int` on a COUNT.** Works until the value crosses the wire.

**Charting only the rows SQL returned.** Silent, and it makes quiet weeks look busy.

**Using `toLocaleDateString` for day keys.** Correct on a UTC laptop, wrong in production.

**Counting your own admin workspace.** One org and a handful of posts is a large percentage error when the real numbers are small — which is exactly when you're watching them most closely.

**Deriving MRR from the display prices.** See Decision 3.

**Trusting `Session.updatedAt` as a heartbeat.** ~1-day granularity by default.

**Running the shadcn CLI without diffing afterwards.** It updates files it doesn't loudly mention.

---

## What we deliberately did NOT build

- **MRR / revenue totals** — Stripe owns that number.
- **Per-org or per-user drill-down pages** — the org and user lists still don't link anywhere.
- **Any portal mutation** — no ban, impersonate, delete, or plan change. The portal remains strictly read-only.
- **Search / filter / sort on the existing lists** — `getOrganizationAuditLogs` already supports `action`, `entity`, `userId`, `fromDate`, `toDate`, and `search`; the platform-side reader just doesn't expose them. Cheap to add later.
- **Historical usage snapshots** — `UsageMetrics` is a live counter with no history and nothing resets `lastResetAt`, so usage-over-time comes from `ActivityLog` instead.
- **Self-hosted page-view tracking** — a `PageView` table plus a `proxy.ts` hook would add a database write to every request, which is what starved the connection pool in [doc 10](./10-profile-analyzer.md#two-incidents-and-what-they-taught-us-about-the-database).

---

## File map

### New

| File | Role |
|---|---|
| `src/lib/types/portal-analytics.ts` | Range schema + every return/row shape |
| `src/services/portal-analytics.service.ts` | The five rollups. `server-only` |
| `src/components/global/metric-tile/` | KPI tile with previous-period delta |
| `src/app/(portal)/portal/_components/range-selector.tsx` | 7/30/90 picker |
| `src/app/(portal)/portal/_components/growth-chart.tsx` | Signups + workspaces area chart |
| `src/app/(portal)/portal/_components/engagement-chart.tsx` | Posts + AI generations bar chart |
| `src/app/(portal)/portal/_components/revenue-panel.tsx` | Subscription mix |
| `src/app/(portal)/portal/_components/chart-format.ts` | The two date formatters |
| `src/app/(portal)/portal/_components/index.ts` | Barrel |
| `src/components/ui/chart.tsx` | shadcn chart primitive (generated, then lint-fixed) |

### Edited

| File | Change |
|---|---|
| `prisma/schema.prisma` | 13 indexes |
| `src/lib/types/index.ts` | Barrel re-export |
| `src/trpc/routers/portal.ts` | Five analytics procedures |
| `src/app/(portal)/portal/_components/portal-overview.tsx` | Rewritten as the dashboard |
| `src/app/(portal)/portal/page.tsx` | Imports via the barrel |
| `src/app/layout.tsx` | `<Analytics />` |

## Where to go next

- [`04-auth-and-tenancy.md`](./04-auth-and-tenancy.md) — organizations, roles, and where the portal tier fits
- [`05-feature-gates.md`](./05-feature-gates.md) — why `getOrganizationTier` short-circuits a portal org
- [`13-redis-implementation.md`](./13-redis-implementation.md) — the rate limiting these queries still inherit

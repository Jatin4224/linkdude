# Start here

These docs explain how this boilerplate is shaped and why. The README tells you what to do. These docs tell you how things fit together.

## Read order

1. `01-architecture.md` — the big picture in one page
2. `02-the-registry.md` — the one file that drives almost everything
3. `03-procedures-and-routers.md` — where your code goes
4. `04-auth-and-tenancy.md` — Better Auth, organizations, roles
5. `05-feature-gates.md` — plan limits and flags
6. `06-audit-and-rate-limit.md` — automatic audit logs and abuse protection
7. `07-adding-a-feature.md` — a full end-to-end walkthrough
8. `08-types-and-grep.md` — type rules and how to navigate the code
9. `09-linkedin-post-generation.md` — a real feature built start to finish (AI + OAuth + publishing)
10. `10-profile-analyzer.md` — a second feature: structured AI output, a paid vendor, and a cache
11. `11-personalized-content-plan.md` — a third: a scripted chat, a derived transcript, and a large AI response
12. `12-calendar-and-scheduled-posts.md` — a fourth: the first background job, a storage provider, and the quota trap that comes with both
13. `13-redis-implementation.md` — Redis from zero: what it is, why rate limiting needs it, and how it's wired here
14. `14-platform-analytics.md` — a fifth feature: the operator's own dashboard, and what it means to find the work already half-done

## If you only have five minutes

Read `01-architecture.md` for the mental model, then jump to `07-adding-a-feature.md`. Come back for the rest later.

## What this is

Every multi-tenant SaaS needs the same plumbing: auth, organizations, roles, plan tiers, audit logs, rate limiting. This boilerplate gives you that, and nothing else. Forms, payments adapters, file storage, landing pages — those belong in your app, not here.

## A note on `.claude/CLAUDE.md`

That file is the pattern rulebook for AI agents. It is intentionally terse — "when you see X, do Y" with no explanation. These docs explain the why behind those rules.

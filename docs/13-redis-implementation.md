# Redis in this app — from zero

This doc assumes you have **never used Redis**. It starts with what Redis is, builds up the handful of concepts you actually need, and only then explains where this codebase uses it and why.

If you already know Redis, skip to [Part 4](#part-4--the-implementation-in-this-codebase).

`06-audit-and-rate-limit.md` describes rate limiting from the *architecture* side — which limiter guards what. This doc is the *infrastructure* side: what Redis is, why it's the right tool, and exactly what happens on the wire. The two overlap deliberately at one table; everything else is complementary.

## Table of contents

1. [Part 1 — What Redis actually is](#part-1--what-redis-actually-is)
2. [Part 2 — Why this app needs it](#part-2--why-this-app-needs-it)
3. [Part 3 — Rate-limiting algorithms](#part-3--rate-limiting-algorithms)
4. [Part 4 — The implementation in this codebase](#part-4--the-implementation-in-this-codebase)
5. [Part 5 — A request, traced end to end](#part-5--a-request-traced-end-to-end)
6. [Part 6 — Operating it](#part-6--operating-it)
7. [Part 7 — Things that will bite you](#part-7--things-that-will-bite-you)
8. [File map](#file-map)

---

## Part 1 — What Redis actually is

### The one-sentence version

Redis is a **dictionary that lives on a server, keeps everything in RAM, and can make entries expire by themselves.**

That's it. If you understand a JavaScript `Map`, you understand the shape of Redis. The differences are that it lives in another process (so many servers can share it) and that keys can be given a lifespan.

### In-memory is the whole point

Postgres writes to disk. That's what makes your data survive a restart, and it's why a write costs milliseconds — there's a physical (or virtual) disk at the end of it, plus a write-ahead log, plus fsync.

Redis keeps everything in RAM. A read or write is typically **sub-millisecond**, often tens of microseconds server-side. The trade-off is honest: RAM is volatile and expensive. Redis can persist to disk (snapshots, or an append-only log), but persistence is a safety net, not its purpose.

The mental rule:

> **Postgres is where your truth lives. Redis is where your *fast, disposable* state lives.**

If losing a piece of data would be a bug you'd have to explain to a customer, it does not belong only in Redis.

### Keys and values

Every entry has a **key** — a string, e.g. `rl:auth:203.0.113.7`. Keys are just bytes; the colons are pure convention, a way humans namespace things. Redis has no folders, no tables, no schema.

Values come in a few **types**:

| Type | What it is | Typical use |
|---|---|---|
| **String** | Bytes. Also used for numbers. | Counters, cached JSON, session blobs |
| **Hash** | A map of field → value under one key | An object: `user:42 { name: "Ada", plan: "pro" }` |
| **List** | Ordered sequence, push/pop at both ends | Queues, recent-items feeds |
| **Set** | Unordered, no duplicates | Tags, "who's online", uniqueness checks |
| **Sorted set** (zset) | A set where each member has a numeric **score**, kept in score order | Leaderboards, and — importantly here — **anything ordered by timestamp** |

This app only ever touches strings and sorted sets, and it does so through a library, so you will never type a Redis command yourself. But knowing sorted sets exist is what makes the rate-limiting section make sense.

### Expiry (TTL) — the feature that matters most here

Any key can be given a **time to live**. After it elapses, Redis deletes the key itself. No cron job, no cleanup query, no `DELETE FROM ... WHERE created_at <`.

```
SET mykey "hello"
EXPIRE mykey 60      → this key deletes itself in 60 seconds
TTL mykey            → 60, then 59, then ... then the key is gone
```

Sit with why that's a big deal for rate limiting. "Allow 10 sign-in attempts per minute" means you need a counter that **forgets on its own**. In Postgres you'd write rows and then need a scheduled job to sweep old ones, forever. In Redis, forgetting is free and automatic.

### Atomicity — why counters are safe

Redis executes commands **one at a time**. Even though thousands of clients are connected, command execution is effectively single-threaded, so a command either fully happened or didn't — there is no half-state and no interleaving.

This is why `INCR` is safe:

```
INCR requests:user:42    → 1
INCR requests:user:42    → 2
```

If two servers issue `INCR` at the same instant, one gets `1` and the other gets `2`. Never `1` and `1`. In application code you'd need a lock or a transaction to get that guarantee; in Redis it's the default.

Redis also runs **Lua scripts atomically** — a whole script executes as one indivisible unit. That matters here because the rate-limiting library ships its logic as a Lua script, so "read the counter, decide, write the counter" happens without another server sneaking in between.

### What Redis is *not*

- **Not a replacement for Postgres.** No joins, no foreign keys, no transactions across entities in the way you'd want for business data.
- **Not automatically durable.** Treat anything in Redis as losable.
- **Not a queue system by itself** (though it can back one).
- **Not free storage.** You're paying for RAM.

---

## Part 2 — Why this app needs it

The app uses Redis for **exactly one thing: rate limiting.** Not caching, not sessions, not queues. `src/lib/rate-limit.ts` says so explicitly, and the `.env.example` repeats it:

> Powers rate limiting ONLY (NOT a query cache).

That restraint is deliberate. Adding a cache layer means adding invalidation bugs, and this app's data is already fast to read from Postgres.

### The actual problem

You want to say: *"any single IP may attempt sign-in at most 10 times per minute."*

To enforce that you need a counter that is:

1. **Shared across every server instance** — otherwise each instance allows 10 and the real limit is 10 × instances.
2. **Very fast** — it runs on *every* request, before any useful work.
3. **Self-expiring** — a per-minute counter must reset itself.
4. **Safe under concurrency** — two simultaneous requests must not both read "9".

Redis gives you all four. Now look at what happens if you try the alternatives.

### Why not a plain JavaScript variable?

The tempting version:

```ts
const attempts = new Map<string, number>();   // ❌
```

This is the single most common rate-limiting mistake, and it fails for a structural reason: **serverless platforms run many instances of your code.** Vercel spins up a new function instance per concurrent request burst, scales to zero, and recycles instances constantly.

So:

- Instance A has `{ "1.2.3.4": 9 }`.
- The next request lands on instance B, which has `{}` — it starts counting from zero.
- The instance holding the count gets recycled; the count vanishes.
- An attacker with any concurrency at all sails straight through.

An in-process Map is a rate limiter that works perfectly on your laptop and does nothing in production. Shared state has to live *outside* the process. That's the whole reason Redis is in this project.

### Why not Postgres?

You *could* make a `rate_limit` table. It would technically work, and it would be a bad idea here for three specific reasons:

1. **Write amplification.** Every request — including ones you're about to reject — becomes a database write. Rate limiting exists to *survive* traffic spikes; making the spike hammer your primary database inverts the goal.
2. **Latency.** Every request pays a database round trip plus transaction overhead before any real work begins.
3. **The connection pool.** This is the sharp one, and this codebase has already been burned by it. `docs/10-profile-analyzer.md` documents an incident where logins failed with *"Timed out fetching a new connection from the connection pool"* — because mutations here hold a connection across 60–90 second AI calls. Postgres connections are scarce (each one is an OS process on the database server). Spending them on rate-limit bookkeeping, of all things, is exactly backwards.

Redis connections are cheap, the operation is sub-millisecond, and the counters clean themselves up. Right tool.

### Why Upstash, and why REST

The client here is `@upstash/redis`, which talks to Redis over **HTTP/REST** rather than Redis's native TCP protocol. That looks odd until you think about serverless.

A traditional Redis client opens a long-lived TCP connection and reuses it. Serverless functions are short-lived and massively parallel — thousands of instances each opening a socket would exhaust the server's connection limit, and an instance that freezes mid-invocation leaves a socket dangling.

HTTP sidesteps all of it: stateless, one request/response, works from edge runtimes, no pooling to manage. Slightly more per-call overhead than raw TCP, and completely worth it in this deployment model.

This is why the env vars are `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` — a URL and a bearer token, not a `redis://` connection string. If you ever see a `redis://...` string in Upstash's dashboard, that's the TCP endpoint and it is **not** what this app wants.

---

## Part 3 — Rate-limiting algorithms

You don't need to implement these, but you need to know which one you're running and why it behaves the way it does.

### Fixed window

Divide time into fixed buckets — 12:00:00–12:00:59, 12:01:00–12:01:59 — and count per bucket.

Dead simple, one counter per bucket, and it has a well-known flaw: the **boundary burst**. With a 10-per-minute limit, a client can fire 10 requests at 12:00:59 and 10 more at 12:01:00. Twenty requests in two seconds, both windows technically satisfied.

### Sliding window ← what this app uses

Instead of resetting at fixed instants, always look back over the *trailing* N seconds.

The precise implementation stores every request's timestamp in a **sorted set** (score = timestamp), drops entries older than the window, and counts what remains. Exact, but memory grows with request volume.

Upstash's `slidingWindow` uses a cheaper approximation: it keeps fixed-window counters and **weights the previous window by how much of it still overlaps** the trailing period. If you're 30% into the current minute, the previous minute contributes 70% of its count. Constant memory, no per-request timestamps, and it closes the boundary-burst hole. The exact mechanics live in `@upstash/ratelimit`; you just pick the algorithm.

### Token bucket

A bucket refills at a steady rate; each request spends a token. Allows controlled bursts. Not used here — mentioned so you recognise it in the library's API.

### The choice in code

```ts
limiter: Ratelimit.slidingWindow(count, window),
```

One line in `buildLimiter()`, applied identically to every limiter in the app.

---

## Part 4 — The implementation in this codebase

### Where the code lives

Everything Redis-related is in **one file**: `src/lib/rate-limit.ts` (~220 lines). Nothing else imports `@upstash/redis`. If you want to change how rate limiting works, that's the only file that owns the connection.

### Step 1 — Resolving the client, once

```ts
const GLOBAL_REDIS_KEY = Symbol.for("app.upstash.redis");

function resolveRedisClient(): Redis | null {
  const globalWithRedis = globalThis as GlobalWithRedis;
  if (GLOBAL_REDIS_KEY in globalWithRedis) {
    return globalWithRedis[GLOBAL_REDIS_KEY] ?? null;
  }
  const url = process.env["UPSTASH_REDIS_REST_URL"];
  const token = process.env["UPSTASH_REDIS_REST_TOKEN"];
  if (!url || !token) {
    globalWithRedis[GLOBAL_REDIS_KEY] = null;
    return null;
  }
  globalWithRedis[GLOBAL_REDIS_KEY] = new Redis({ url, token });
  return globalWithRedis[GLOBAL_REDIS_KEY];
}
```

Two things worth understanding:

**The `globalThis` + `Symbol.for` cache.** In development, Next.js hot-reloads modules on every file save. Without this, each reload would construct a new client and you'd leak them until the process restarts. Stashing it on `globalThis` under a global symbol survives module reloads. This is the same trick `src/lib/config/prisma.ts` uses for the Prisma client — a repo-wide pattern, not a one-off.

**Missing config caches `null` too.** Note `if (GLOBAL_REDIS_KEY in globalWithRedis)` checks *key presence*, not truthiness. So "we already looked and there's no config" is remembered, and the env vars aren't re-read on every call.

### Step 2 — Building limiters

```ts
function buildLimiter(prefix, count, window): Ratelimit | null {
  if (!redis) return null;                    // ← no config, no limiter
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(count, window),
    prefix,
    analytics: false,
  });
}
```

`prefix` is the key namespace, so the different limiters can't collide in Redis. `analytics: false` disables Upstash's per-request dashboard tracking — it would cost extra commands against your quota for data this app doesn't read.

### Step 3 — The four layers

| # | Where | Limit | Identifier (the Redis key suffix) | Redis prefix |
|---|---|---|---|---|
| 1 | `src/app/api/trpc/[trpc]/route.ts` | 100 / 10s | client IP, else `"trpc:anonymous"` | `rl:api` |
| 2 | `src/app/api/auth/[...all]/route.ts` | 10 / 60s | client IP, else `"auth:anonymous"` | `rl:auth` |
| 3 | `baseProcedure`, `src/trpc/procedures/protected.ts` | 100 / 10s | `user.id`, else `ip:<ip>` | `rl:api` |
| 4 | per-resource, same file, step [8] | per registry | `userId:orgId:ip` | `rl:res:<resource>.<action>` |

**Layer 1** is the pre-auth ceiling on all tRPC HTTP traffic. It runs before anything is parsed or authenticated — cheapest possible rejection.

**Layer 2** wraps **POST only**, which covers every credential-bearing flow: sign-in, sign-up, password reset, 2FA, OAuth start. `GET` passes through unwrapped (`export const GET = handlers.GET`), which is fine — those aren't credential-bearing.

**Layer 3** reuses the same `apiLimiter` object but keys it differently. A signed-in user therefore consumes **two counters per request**: their IP bucket at layer 1, their user-id bucket at layer 3. Same `rl:api` prefix, different identifiers, independent counters. That's intentional — one shared office IP shouldn't let one user starve their colleagues, and one user shouldn't dodge the cap by changing IPs.

**Layer 4** is the per-resource cap, declared in the registry and keyed most tightly (`userId:orgId:ip`). It **stacks on top of** layer 3 rather than replacing it. Current declarations, all in `src/lib/resources.ts`:

| Procedure | Cap | Why (from the registry comments) |
|---|---|---|
| `aiGeneration.create` | 10 / min | "a stuck client can't drain the AI budget" |
| `profileAnalysis.create` | 5 / min | "larger prompt than post generation, so a tighter burst cap" |
| `profileLookup.create` | 5 / min | "should not be able to spend a month's lookups in a minute" |
| `contentPlan.create` | 3 / min | "the heaviest prompt in the app" |
| `linkedinPosts.create` | 5 / min | "LinkedIn throttles member posting; staying under it turns a remote 429 into a local, explainable error" |

Note what these are *for*. Plan quotas (see `05-feature-gates.md`) are the monthly ceiling. Rate limits are the **burst** cap on top — they stop a runaway client or a retry loop from spending a month's quota in sixty seconds. Different jobs; you need both.

Adding one is a registry edit, nothing more:

```ts
rateLimit: {
  create: { count: 5, window: "1 m" },
},
```

### Step 4 — Failing open

```ts
export async function checkRateLimit(limiter, identifier): Promise<RateLimitResult> {
  if (!limiter) {
    return { allowed: true, limit: 0, remaining: 0, resetAt: 0 };
  }
  try {
    const result = await limiter.limit(identifier);
    return { allowed: result.success, /* ... */ };
  } catch (error) {
    console.error("[rate-limit] Redis check failed, failing open:", error);
    return { allowed: true, limit: 0, remaining: 0, resetAt: 0 };
  }
}
```

Two paths return "allowed" without consulting Redis: **no limiter configured**, and **Redis threw**.

This is the single most important design decision in the file, and it's a genuine trade-off:

- **Fail open** (this app): Redis outage → everyone gets through, unlimited. Your app stays up; abuse protection is temporarily gone.
- **Fail closed**: Redis outage → nobody gets through. Your abuse protection holds; your app is down.

The reasoning is in the file header — *"rate limiting is a guardrail, not the only line of defense, and refusing all traffic on a Redis outage is almost always worse than letting more requests through."*

That's right for a rate limiter and **wrong for a permission check**. Notice that `src/components/feature-gate.tsx` fails *closed*. Know which kind of check you're writing.

The practical consequence: **with the env vars unset, every limiter is `null` and rate limiting does nothing.** The code all runs; every check passes. That's fine locally. In production it means you have no brute-force protection, silently.

### Step 5 — Telling the client

```ts
export function buildRateLimitHeaders(result: RateLimitResult) {
  return {
    "RateLimit-Limit": String(result.limit),
    "RateLimit-Remaining": String(result.remaining),
    "RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
    ...(result.allowed ? {} : { "Retry-After": /* seconds */ }),
  };
}
```

These follow the IETF `RateLimit-*` header draft, so a well-behaved client can back off on its own instead of hammering. `Retry-After` is only sent on rejection — sending it on success would be meaningless.

### Step 6 — Identifying the caller

`getClientIp()` reads headers in a deliberate precedence order:

1. `x-vercel-forwarded-for`
2. `cf-connecting-ip` (Cloudflare)
3. `x-real-ip`
4. `x-forwarded-for` — **last** entry, not first

The first three are set by the platform edge, which *overwrites* whatever the client sent. Trustworthy.

`x-forwarded-for` is a client-appendable chain. Anyone can send `X-Forwarded-For: 1.1.1.1` and, if you read the *first* entry, you've just let them forge their identity and dodge the limiter. Reading the **last** entry gets the value your own edge appended. Hence the loop running backwards, and hence the comment: *"treat as a hint, never for auth decisions."*

---

## Part 5 — A request, traced end to end

A signed-in user at IP `203.0.113.7`, user id `usr_abc`, org `org_xyz`, calls `aiGeneration.create`.

**1. Layer 1 — HTTP ingress.** Key `rl:api:203.0.113.7`. Under 100 in the last 10s → allowed.

**2. Layer 3 — `baseProcedure`.** Key `rl:api:usr_abc`. Under 100 → allowed.

**3. Layer 4 — per-resource.** Registry says `aiGeneration.create` is 10/min. Key `rl:res:aiGeneration.create:usr_abc:org_xyz:203.0.113.7`. Under 10 → allowed.

**4.** Plan-limit gate, then the handler runs.

Three limiter checks, three distinct Redis keys, each one round trip. Every key carries a TTL, so all three vanish on their own once their window passes.

If step 3 had failed, the user gets:

```
TRPCError: TOO_MANY_REQUESTS
"Too many create requests for aiGeneration. Try again in 43s."
cause: { errorCode: RATE_LIMITED, limit: 10, remaining: 0, resetAt: ..., retryAfter: 43 }
```

The structured `cause` is what lets the UI render a real countdown rather than a generic failure.

---

## Part 6 — Operating it

### Turning it on

1. **console.upstash.com** → sign up (free tier, no card).
2. **Redis → Create Database.** Pick the region closest to where you deploy — this is a per-request round trip, so physical distance is latency you pay on every call.
3. Find the **REST API** section. Copy the URL and token — *not* the `redis://` TCP string.
4. ```
   UPSTASH_REDIS_REST_URL="https://....upstash.io"
   UPSTASH_REDIS_REST_TOKEN="..."
   ```

No code change. `resolveRedisClient()` picks them up and every limiter constructs itself.

### Verifying it works

Hit any auth POST endpoint 11 times inside a minute. The 11th should return **HTTP 429** with `Retry-After`. If all 11 succeed, your env vars aren't loading — the failure mode is silent by design, so this manual check is the only signal.

### Command budget

The free tier caps daily commands (10,000 at time of writing — check current limits). Each limiter check is one round trip, and a metered mutation crosses three layers, so **one such mutation ≈ 3 commands**. Reads that only cross layers 1 and 3 cost ~2.

That's comfortable for early traffic and not invisible. `analytics: false` is already saving you a meaningful share of it.

### What you'd add later

If you outgrow the free tier or want visibility, in rough order: turn `analytics` on for a dashboard, raise the caps in `resources.ts`, or move the layer-1 check to the platform edge (Vercel Firewall / Cloudflare) so rejected traffic never reaches your function.

---

## Part 7 — Things that will bite you

**Silence when unconfigured.** Nothing warns you that rate limiting is off. Both the code and the docs treat this as intended (local dev shouldn't need a Redis account), but it means production can ship wide open. Make the env vars part of your deploy checklist.

**Fail-open hides outages.** If Upstash has an incident, your app keeps serving and only `console.error("[rate-limit] Redis check failed, failing open:")` records it. Alert on that log line if you care.

**Layer 1 and layer 3 double-count.** By design, but it surprises people reading the numbers. A logged-in user isn't getting 100/10s — they're getting 100/10s per IP *and* 100/10s per user id, whichever binds first.

**The anonymous IP bucket is shared.** When `getClientIp()` returns `null`, every such request keys to the literal string `"trpc:anonymous"` or `"auth:anonymous"` — one counter for all of them. On Vercel or Cloudflare the platform headers are always present, so this only appears behind unusual proxy setups. If you ever see spurious 429s with no obvious source, check this first.

**Rate limits are not quotas.** A cap of 5/min does not mean 5 per month. Plan enforcement is a completely separate mechanism (`05-feature-gates.md`), backed by Postgres, not Redis.

**Don't reach for Redis as a cache here.** This app deliberately uses it for one thing. Request-scoped caching is already handled by React's `cache()` (see `getCachedSession`, `getUserMemberships`), and query caching is TanStack Query's job on the client. Adding a Redis cache layer means owning invalidation.

---

## A correction to the older docs

`06-audit-and-rate-limit.md` says the global and auth limiters run "at `src/proxy.ts` ingress", and the header comment in `src/lib/rate-limit.ts` repeats it. **Both are stale.**

`src/proxy.ts` imports neither limiter — it only does static-asset bypass, the closed-registration redirect, and request-header forwarding. The limiters actually run in the two route handlers (`src/app/api/trpc/[trpc]/route.ts` and `src/app/api/auth/[...all]/route.ts`).

Behaviour is correct and unchanged; only the pointers are wrong. This doc reflects the code as it is.

---

## File map

| File | Role |
|---|---|
| `src/lib/rate-limit.ts` | **The only file that touches Redis.** Client resolution, limiter factories, `checkRateLimit`, headers, `getClientIp`. |
| `src/app/api/trpc/[trpc]/route.ts` | Layer 1 — IP-keyed ceiling on all tRPC HTTP traffic. |
| `src/app/api/auth/[...all]/route.ts` | Layer 2 — tight IP-keyed cap on auth POSTs. |
| `src/trpc/procedures/protected.ts` | Layer 3 (`baseProcedure`) and layer 4 (step [8], per-resource). |
| `src/lib/resources.ts` | Where per-resource caps are declared. |
| `src/lib/errors/index.ts` | `ERROR_CODES.RATE_LIMITED` and the structured cause shape. |
| `.env.example` | The two env vars and what happens without them. |

## Where to go next

- `06-audit-and-rate-limit.md` — the architectural view, plus audit logging
- `05-feature-gates.md` — plan quotas, the other half of abuse control
- `03-procedures-and-routers.md` — the full 16-step procedure pipeline this sits inside

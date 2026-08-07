# Building the Content Calendar & Scheduled Posts — a complete walkthrough

This is the full build log for the feature that lets a user **write a post today and have it publish on Tuesday at 9am**, and see everything planned or already published on a month calendar.

It is written so someone who has never touched this codebase can follow along and build the same thing. Every step says *what* we did and *why* we did it that way. If you already know the codebase, skip to [The 10-second version](#the-10-second-version) or [The life of one scheduled post](#the-life-of-one-scheduled-post).

This feature also forced two things the app had avoided until now: **a background job**, and **a file storage provider**. Both decisions are explained before any code, because they shaped everything after.

---

## Table of contents

1. [The 10-second version](#the-10-second-version)
2. [Words you need to know](#words-you-need-to-know)
3. [Three decisions made before any code](#three-decisions-made-before-any-code)
4. [Step 1 — The database model](#step-1--the-database-model)
5. [Step 2 — Config layer](#step-2--config-layer)
6. [Step 3 — Types](#step-3--types)
7. [Step 4 — The ImageKit service](#step-4--the-imagekit-service)
8. [Step 5 — The worker](#step-5--the-worker)
9. [Step 6 — The router](#step-6--the-router)
10. [Step 7 — The trigger route](#step-7--the-trigger-route)
11. [Step 8 — The registry](#step-8--the-registry)
12. [Step 9 — The UI](#step-9--the-ui)
13. [The life of one scheduled post](#the-life-of-one-scheduled-post)
14. [Wiring an actual scheduler](#wiring-an-actual-scheduler)
15. [Testing it](#testing-it)
16. [Mistakes that are easy to make](#mistakes-that-are-easy-to-make)
17. [What we deliberately did NOT build](#what-we-deliberately-did-not-build)
18. [File map](#file-map)

---

## The 10-second version

We added **9 new files** and edited **11 existing ones**. Same layer order as every other feature:

```
registry  →  database  →  config  →  types  →  services  →  routers  →  routes  →  UI
```

Three ideas explain almost every decision below:

1. **The database is the source of truth for what is due. The scheduler only says "wake up."** Nothing about *which* posts are due lives in the queue. That is what makes the scheduler vendor swappable in one env var.

2. **Scheduling is `linkedinPosts.create` with a date attached — not its own endpoint.** This sounds like a small naming choice. It is the single most important decision in the feature, and getting it wrong doubles every customer's plan limit. [Full explanation below.](#decision-2--no-new-resource-key-the-expensive-trap)

3. **A post that publishes on Tuesday cannot carry its image in a request payload.** Scheduling forced durable image storage, which is why ImageKit appears in a feature that looks like it is only about dates.

---

## Words you need to know

New vocabulary this feature introduces. The [09 doc](09-linkedin-post-generation.md#words-you-need-to-know) covers tRPC, Zod, Prisma, services, and URNs.

| Term | What it actually means |
|---|---|
| **Background job / worker** | Code that runs when *nobody is making a request*. A normal endpoint runs because a user clicked something. A worker runs because a clock said so. That difference causes most of the complexity here — there is no logged-in user, no session, and no organization to scope to. |
| **Cron** | A schedule expressed as "run this every minute / every hour / at 3am". The name comes from a Unix program from 1975. Vercel Cron, QStash schedules, and a Linux `crontab` all do the same job. |
| **Idempotent** | Running it twice has the same effect as running it once. Our trigger endpoint is idempotent, which is why it is safe to call every minute and safe to call twice by accident. |
| **Claim** | Marking a row as "I am working on this" *before* doing the work, so no other worker picks it up. The claim is the whole reason a post can't publish twice. |
| **`FOR UPDATE SKIP LOCKED`** | Postgres for: "lock these rows for me, and if another transaction already locked one, don't wait — just skip it." Without `SKIP LOCKED`, two workers queue up behind each other. With it, they take different work. |
| **Reaper** | A cleanup pass that finds work abandoned by a crashed worker and makes it available again. Ours is `reclaimStalePublishingPosts`. |
| **Terminal vs retryable** | A *retryable* failure might succeed next time (LinkedIn returned 503). A *terminal* failure never will (the account was disconnected). Retrying a terminal failure just burns attempts. |
| **Connection pooler** | A middleman that reuses database connections. Neon's `-pooler` host is one. Great for serverless queries, **fatal for schema migrations** — see [P1017](#the-p1017-trap). |
| **DDL** | "Data Definition Language" — SQL that changes the *shape* of the database (`ALTER TABLE`, `CREATE INDEX`) rather than the data in it. |
| **ImageKit transform** | An image edit expressed as a URL parameter. `?tr=w-1200,h-627` returns that image resized, rendered on demand. No re-upload, and the original is never modified. |
| **Direct upload** | The browser sends the file straight to the storage provider, never through our server. Our server only mints a signed permission slip. |

---

## Three decisions made before any code

### Decision 1 — Yes to a background job, no to Inngest

Something has to wake up at 9am and call LinkedIn. That is not optional; it is the feature.

The obvious pick was [Inngest](https://www.inngest.com/) — durable step functions, automatic retries with backoff, a dashboard. It is genuinely good software. We didn't use it, for three reasons:

1. **Upstash was already installed.** `@upstash/ratelimit` and `@upstash/redis` are already dependencies (see [src/lib/rate-limit.ts](../src/lib/rate-limit.ts)). A QStash schedule adds no new vendor account.
2. **The volume is tiny.** The free plan allows 10 posts a month; pro allows 500. Inngest's main draws — retry orchestration and observability — are about 30 lines of `attemptCount` + `lastError` at that scale.
3. **It would have been the app's second architecture.** This codebase has exactly one pattern: procedure → router → service. Inngest layers an event-driven model on top of that, and every future developer would need to learn both.

The decision that made this safe to get wrong:

> **Scheduled rows in the database are the source of truth for what is due. The provider's only job is to POST one idempotent URL on an interval.**

Because of that, switching to Inngest later is a ~15-line adapter that calls the exact same `publishDueScheduledPosts(prisma, new Date())`. We did not lock ourselves in; we declined to pay upfront.

### Decision 2 — No new resource key (the expensive trap)

This is the part to read twice.

The quota rule we wanted: **spend a post slot when the user commits to the post, refund it if they cancel before it fires.**

The obvious implementation is a new `scheduledPosts` key in [src/lib/resources.ts](../src/lib/resources.ts) with its own `limit`. That implementation is **broken**, and it fails silently in the customer's favour:

```
Pro plan = 500 posts/month

With a separate scheduledPosts limit:
  schedule 500 posts   → spends 500 scheduledPosts slots
  worker publishes them → spends 0 linkedinPosts slots  ← nothing increments here
  publish 500 more now  → spends 500 linkedinPosts slots
  ─────────────────────────────────────────────────────
  1000 posts on a 500-post plan
```

The reason is mechanical: `protectedProcedure` increments the usage counter on `<resource>.create` and nothing else. The worker is not a procedure, so it increments nothing. Two resources means two independent budgets for one real-world thing.

The fix is to write *less* code, not more:

> **Scheduling is `linkedinPosts.create` with an optional `scheduledFor` field.**

One resource, one quota, counted once — at the moment the user commits, whether the post goes out now or on Tuesday. Everything else falls out for free:

| Behaviour | Where it comes from |
|---|---|
| Plan limit checked at schedule time | `.create` auto-gate |
| Counter incremented once | `.create` auto-increment |
| Refund on cancel | `.delete` auto-decrement |
| Permission, rate limit, audit row | Already wired to `linkedinPosts` |
| Worker touches the counter | **Never** — the slot was already spent |

And the guardrail at [src/trpc/procedures/protected.ts](../src/trpc/procedures/protected.ts) never fires, because we added no new mutation path.

### Decision 3 — ImageKit, because scheduling broke images

Before this feature, an attached image travelled as base64 **inside the tRPC request** and was streamed straight to LinkedIn during that same request. Nothing was ever stored.

That works fine when publishing is immediate. It cannot work when the post publishes on Tuesday — the request is long gone, and with it the image.

So scheduling forced a storage provider. We chose ImageKit for a reason beyond storage: **its transformations are URL parameters.**

```
https://ik.imagekit.io/your_id/photo.jpg?tr=w-1200,h-627,cm-pad_resize
                                          └──────────────────────────┘
                                          rendered on demand, no re-upload
```

That means the image editor planned for later is not an image-processing backend. It is a feature that writes one string to one column. This is why `imageTransform` is stored **separately** from `imageUrl` — edits stay non-destructive and infinitely re-editable, because the original is never touched.

**A side effect worth knowing:** the old code capped attachments at 3 MB, and the comment explained why —

> base64 inflates ~33%, so 3 MB of pixels becomes ~4 MB of JSON. Vercel rejects request bodies over 4.5 MB. *Raising this REQUIRES moving the upload off the JSON payload first.*

Direct browser→ImageKit upload **is** that move. The cap is now 25 MB (ImageKit's own limit) and no image byte passes through our server on the way in.

---

## Step 1 — The database model

We extended `LinkedInPost` rather than creating a `ScheduledPost` table. The schema itself had asked for this:

> *"Scheduling extends this model with a `status` column rather than a parallel table."*

**Why one table?** A scheduled post and a published post are the same thing at different moments. Two tables would mean copying a row from one to the other at publish time, and every read — the calendar, the recent-posts list, the quota count — would have to query both and merge. One row with a lifecycle is simpler and cannot get out of sync with itself.

### The new columns

```prisma
model LinkedInPost {
  // ... existing: id, organizationId, accountId, authorId, commentary, imageUrn

  // scheduled | publishing | published | failed | canceled
  status String @default("published")

  scheduledFor DateTime?      // null for immediate publishes

  postUrn     String?  @unique // was NOT NULL — LinkedIn hasn't accepted it yet
  publishedAt DateTime?        // was @default(now()) — it hasn't published yet

  attemptCount Int     @default(0)
  lastError    String? @db.Text
  claimedAt    DateTime?

  imageFileId    String?   // ImageKit's handle — needed to DELETE the asset
  imageUrl       String?   // the untransformed original
  imageTransform String?   // the `tr:` string; the image editor writes this

  createdAt DateTime @default(now())
  updatedAt DateTime @default(now()) @updatedAt

  @@index([status, scheduledFor])          // the worker's claim query
  @@index([organizationId, scheduledFor])  // the calendar's month query
}
```

### Four details that matter

**`status` is a bare `String`, not an enum.** This schema has *no* Prisma enums anywhere — every status field is a String with a comment listing legal values. We matched that. The enforcement lives in the Zod tuple `LINKEDIN_POST_STATUSES`, which means adding a state is a code change, not a migration.

**`@default("published")` is doing migration work.** Every row that existed before this feature was, by definition, published. The default backfills them correctly with no data script.

**Two columns became nullable, and that is a real change.**
- `postUrn String @unique` → `String? @unique`. A nullable unique column is safe in Postgres because `NULL` never equals `NULL` — a thousand scheduled posts can all have `postUrn = NULL` without colliding.
- `publishedAt DateTime @default(now())` → `DateTime?`. The default had to go. Without that change, a scheduled row would claim to have been published the instant it was created.

Every existing read of those two fields needed a null check afterwards. That is the cost of the change, and it is worth knowing before you make it.

**`claimedAt` exists only for crash recovery.** It records *when* a worker took the row, so the reaper can tell "in progress" from "abandoned."

### The P1017 trap

Applying this schema to Neon fails with:

```
Error: P1017 — Server has closed the connection.
```

This is **not** a network problem, and retrying does not reliably fix it. `DATABASE_URL` points at Neon's *pooled* endpoint (the `-pooler` hostname). That pooler is PgBouncer in transaction mode, and it closes the session partway through a long DDL batch.

The fix is to give the Prisma CLI a **direct** (non-pooled) connection:

```bash
# .env
DATABASE_URL="postgresql://...@ep-xxxx-pooler.region.aws.neon.tech/db"   # app runtime
DIRECT_URL="postgresql://...@ep-xxxx.region.aws.neon.tech/db"            # CLI only
#                                    ↑ same string, "-pooler" removed
```

[prisma.config.ts](../prisma.config.ts) prefers `DIRECT_URL` and falls back to `DATABASE_URL` when it is unset, so a local Postgres install needs no extra variable.

**The split is the point: pooled for queries, direct for DDL.** Serverless functions open and close connections constantly, which is exactly what a pooler is for — you want it at runtime. You just can't run schema changes through it.

---

## Step 2 — Config layer

Two new modules, both following the fail-soft `isXConfigured()` / `getXCredentials()` shape from [src/lib/config/linkedin.ts](../src/lib/config/linkedin.ts).

**Fail-soft means:** with no keys set, the app still boots, and the feature quietly disappears from the UI instead of appearing and then erroring on click.

### `src/lib/config/imagekit.ts`

| Export | Value | Why |
|---|---|---|
| `IMAGEKIT_MAX_IMAGE_BYTES` | 25 MB | ImageKit's own ceiling — the only real limit left once base64 is gone |
| `IMAGEKIT_POST_FOLDER` | `/linkedin-posts` | Namespaced so post media can be lifecycled independently |
| `IMAGEKIT_AUTH_EXPIRY_SECONDS` | 15 min | Long enough to pick a file and upload; short enough that a leaked token is worthless |
| `LINKEDIN_IMAGE_TRANSFORM` | `w-1200,h-627,cm-pad_resize` | LinkedIn's recommended aspect. `pad_resize` letterboxes instead of cropping, so a portrait photo is never silently beheaded |

### `src/lib/config/scheduler.ts`

| Export | Value | Why |
|---|---|---|
| `MAX_PUBLISH_ATTEMPTS` | 3 | Then the row goes terminal and stops being claimed |
| `PUBLISH_BATCH_SIZE` | 25 | Sized so a full batch finishes inside the route's 60s budget |
| `PUBLISHING_STALE_MS` | 10 min | A row still `publishing` after this belongs to a dead worker |
| `MIN_SCHEDULE_LEAD_MS` | 5 min | A post scheduled 10 seconds out would race a poll already in flight |
| `SCHEDULER_SECRET` | env | One shared bearer token — see below |

**Why one shared secret instead of per-vendor signature verification?** Because Vercel Cron, QStash, and `curl` from a crontab all send `Authorization: Bearer …`. One secret keeps all three adapters byte-identical, which is what makes swapping them an env-var change. Signature verification is a worthwhile hardening step later; it is not worth three code paths now.

---

## Step 3 — Types

### `src/lib/types/imagekit.ts` (new)

The old `postImageSchema` carried bytes. The new one carries a reference:

```ts
export const postImageSchema = z.object({
  fileId: z.string().min(1),   // needed to DELETE the asset on cancel
  url: z.url(),
  transform: imageTransformSchema.optional(),
});
```

**Why keep `fileId` when we have the URL?** Because cancelling a scheduled post should delete the image, and ImageKit's delete API takes an id. A URL alone would strand the file forever.

**Why is `transform` validated with a regex?** It gets spliced into a delivery URL. Restricting the charset stops a crafted value from breaking out of the transform segment and rewriting the path. It is user-influenced input reaching a URL — that always deserves a whitelist.

### `src/lib/types/linkedin.ts` (edited)

```ts
export const LINKEDIN_POST_STATUSES = [
  "scheduled", "publishing", "published", "failed", "canceled",
] as const;

export const CANCELABLE_POST_STATUSES = ["scheduled", "failed"] as const;
```

**`publishing` is deliberately excluded from cancelable.** The worker has already claimed that row and may be mid-call to LinkedIn. Cancelling would either strand a live post with no local record, or race the worker's own write.

And the one-line change that carries the whole feature:

```ts
export const publishPostSchema = z.object({
  commentary: z.string().trim().min(1).max(LINKEDIN_MAX_COMMENTARY),
  image: postImageSchema.optional(),
  scheduledFor: scheduledForSchema.optional(),   // ← absent = publish now
});
```

That optional field is the entire difference between publishing and scheduling, and it is why the quota only counts once.

---

## Step 4 — The ImageKit service

`src/services/imagekit.service.ts` — `import "server-only"` at the top, because this file holds the **private key**.

Four functions:

**`getUploadAuthParams()`** mints the signed permission slip. The signature is HMAC-SHA1 over `(token + expire)` with the private key, so holding it permits *one upload* but never reveals the key.

It returns `publicKey`, `urlEndpoint`, and `folder` alongside the signature. That is deliberate: the browser needs no ImageKit env vars of its own. Copying them into `NEXT_PUBLIC_*` variables would create a second source of truth that silently drifts when you switch accounts.

**`buildTransformedUrl(url, transform)`** uses the **query form** (`?tr=`) rather than the path form (`/tr:.../`):

```ts
const url = new URL(imageUrl);
url.searchParams.set("tr", transform);
```

The path form requires knowing where the endpoint ends and the file path begins, which breaks on custom domains and sub-folders. The query form is position-independent and therefore cannot be spliced wrong.

**`fetchImageBinary(url)`** downloads the rendered image. **This is the only moment image bytes exist inside the app** — LinkedIn will not fetch from a third-party URL, so the transformed image must make exactly one hop through the server on its way out.

It reads the MIME type from the *response header*, not from what was uploaded, because a transform can change the format (`f-auto`).

**`deleteImage(fileId)`** — and note the signature promise: **it never throws.**

```ts
try {
  await getImageKitClient().files.delete(fileId);
} catch (error) {
  console.error("[imagekit] failed to delete asset", { fileId, error });
}
```

An orphaned ImageKit file costs a few kilobytes. A thrown error here would fail the user's cancel and leave a post that still publishes. **Absorb the cheap failure.**

---

## Step 5 — The worker

This lives in [src/services/linkedin.service.ts](../src/services/linkedin.service.ts), alongside everything else that touches LinkedIn.

### Why the worker is allowed to exist here

A worker cannot use `protectedProcedure` — there is no session, no request, and no `organizationId` in a tRPC input. The escape hatch was designed in from the start ([docs/03](03-procedures-and-routers.md)):

> The `db` parameter is the seam. The router passes `ctx.db` so the call commits inside the transaction. **A background job passes the singleton.**

Every service function in this codebase takes `db: DbClient` first. That one convention is what makes a legal worker possible without inventing a second architecture.

### Four small helpers that carry a lot of weight

Before the worker itself, four things at the top of the file. They look like boilerplate; each one is closing a specific hole.

**`STATUS` — a checked map instead of bare strings**

```ts
const STATUS = {
  scheduled: "scheduled",
  publishing: "publishing",
  published: "published",
  failed: "failed",
  canceled: "canceled",
} as const satisfies Record<LinkedInPostStatus, LinkedInPostStatus>;
```

The column is a bare `String` in Postgres, so `status: "publised"` would compile, write, and then simply never match a query again — a typo that silently orphans rows. The `satisfies` clause makes the map exhaustive against `LinkedInPostStatus`: **miss a status and it fails to compile; misspell one and it fails to compile.** Every write in the service goes through `STATUS.x`, never a literal.

**`POST_SAFE_SELECT` — the client-visible columns**

```ts
const POST_SAFE_SELECT = {
  id: true, commentary: true, status: true,
  postUrn: true, imageUrn: true, imageUrl: true, imageTransform: true,
  scheduledFor: true, publishedAt: true, createdAt: true,
} as const satisfies Prisma.LinkedInPostSelect;
```

Deliberately narrow. The row also carries `lastError`, `claimedAt`, and `attemptCount` — **worker bookkeeping, not user content.** `lastError` in particular holds raw vendor error text, which can include internal hostnames and stack fragments; shipping it to a browser leaks implementation detail for no benefit.

This mirrors `LINKEDIN_ACCOUNT_SAFE_SELECT` in the same file, which exists so access tokens can never be widened into a response by an accidental `select`. Same idea, lower stakes.

Both `listPublishedPosts` and `listCalendarPosts` use it, so the two client-facing reads cannot drift apart.

**`toPostImage` / `imageColumns` — one flattening, one rebuild**

```ts
function toPostImage(post: LinkedInPost): PostImageValues | undefined {
  if (!post.imageFileId || !post.imageUrl) return undefined;
  return { fileId: post.imageFileId, url: post.imageUrl,
    ...(post.imageTransform ? { transform: post.imageTransform } : {}) };
}

function imageColumns(image: PostImageValues | undefined) {
  return {
    imageFileId: image?.fileId ?? null,
    imageUrl:    image?.url ?? null,
    imageTransform: image?.transform ?? null,
  };
}
```

An image is **one object in the API and three columns in the database**. These are the only two places that translation happens — `imageColumns` is used by both `recordPublishedPost` and `createScheduledPost`, so an immediate post and a scheduled post can never store an image differently.

`toPostImage` returning `undefined` (not `null`) matters: that is exactly what `publishPost`'s optional `image` parameter expects, so the worker passes it straight through with no branching.

The conditional spread on `transform` is not cosmetic — the project runs `exactOptionalPropertyTypes`, so `{ transform: undefined }` and `{}` are different types. Spreading conditionally produces the second.

**`resolvePostImage` — the one place the transform is decided**

```ts
async function resolvePostImage(image: PostImageValues): Promise<LinkedInImageBinary> {
  return imagekitService.fetchImageBinary(
    imagekitService.buildTransformedUrl(
      image.url,
      image.transform ?? LINKEDIN_IMAGE_TRANSFORM,   // ← the fallback lives here, once
    ),
  );
}
```

Called from inside `publishPost`, which both the router (immediate) and the worker (scheduled) go through. **That is why an immediate post and a scheduled post can never render different pixels** — there is exactly one expression that picks the transform, and one function that fetches the result.

Until the image editor ships, `image.transform` is always absent and every post gets `LINKEDIN_IMAGE_TRANSFORM`. When the editor lands it writes that field and this line starts preferring it. No other code changes.

### `listCalendarPosts` — why the `OR` is the whole query

```ts
where: {
  organizationId,
  OR: [
    { scheduledFor: { gte: from, lte: to } },
    { publishedAt:  { gte: from, lte: to } },
  ],
},
orderBy: [{ scheduledFor: "asc" }, { publishedAt: "asc" }],
select: POST_SAFE_SELECT,
```

A scheduled post has `scheduledFor` set and `publishedAt` null. A published post has the reverse. **A single date filter would silently drop half the calendar** — and it would look like a rendering bug, not a query bug, which is the worst kind to chase.

The `orderBy` has two keys for the same reason: rows sort by whichever date they actually have.

Note there is no `take`. The range is the page — a calendar draws a fixed window, so pagination would be meaningless. That is safe only because the input schema caps the span:

```ts
.refine((v) => v.to.getTime() - v.from.getTime() <= 100 * 24 * 60 * 60 * 1000,
  { message: "Date range is too large" })
```

100 days covers a six-week grid with room to spare. Without that cap, a crafted request could ask for a decade of rows in one unpaginated query.

### The claim — the most important 15 lines in the feature

```sql
UPDATE "linkedin_post"
   SET "status" = 'publishing',
       "attemptCount" = "attemptCount" + 1,
       "claimedAt" = $now
 WHERE "id" IN (
   SELECT "id" FROM "linkedin_post"
    WHERE "status" = 'scheduled'
      AND "scheduledFor" <= $now
      AND "attemptCount" < $maxAttempts
    ORDER BY "scheduledFor" ASC
    LIMIT $batchSize
    FOR UPDATE SKIP LOCKED
 )
RETURNING "id";
```

Read it as three guarantees stacked together:

| Clause | Prevents |
|---|---|
| `status = 'scheduled'` in the `WHERE` | Claiming a row someone else already moved |
| `FOR UPDATE SKIP LOCKED` | Two concurrent runs blocking on the same row |
| Single atomic `UPDATE … RETURNING` | A gap between "I read it" and "I claimed it" |

**Why this matters more than anything else here:** publishing twice is the one failure the user's audience sees, and it cannot be undone. Every other bug is recoverable. This query is why calling the trigger endpoint twice a second would still publish each post exactly once.

**Why not `updateMany`?** Prisma's `updateMany` doesn't return the rows it changed, so you would have to read them separately — and that read-then-write gap is precisely the race we are closing.

### Publishing, sequentially

```ts
for (const { id } of claimed) { ... }
```

Never `Promise.all`. LinkedIn rate-limits member posting, and the app's own limit is 5/minute. Firing 25 posts concurrently would earn a 429 from LinkedIn and mark healthy posts as failed.

### Terminal vs retryable, decided structurally

Notice that the token step is caught **separately** from the publish step:

```ts
try {
  token = await getValidAccessToken(db, post.organizationId);
} catch (error) {
  await markPostFailed(db, post, error, /* terminal */ true);
  continue;
}
```

A missing or unrefreshable connection can never be fixed by retrying — a human has to reconnect. By catching the token step on its own, we decide "terminal" from **which step failed**, not by string-matching an error message. Message matching breaks the first time a vendor rewords an error.

Everything else — LinkedIn 5xx, a timeout, an ImageKit hiccup — returns the row to `scheduled` and lets the next poll try again. **The backoff is implicit:** a failed row simply waits for the next run. No backoff library, no retry scheduler.

### The reaper

```ts
export async function reclaimStalePublishingPosts(db, now) {
  const cutoff = new Date(now.getTime() - PUBLISHING_STALE_MS);
  return db.linkedInPost.updateMany({
    where: { status: "publishing", claimedAt: { lt: cutoff } },
    data: { status: "scheduled", claimedAt: null },
  });
}
```

Only `scheduled` rows are ever claimed. So if a worker dies mid-publish, its row sits in `publishing` **forever** — invisible to every future run. The reaper is what makes a crash survivable.

It deliberately does *not* reset `attemptCount`. A post that reliably kills the worker still hits `MAX_PUBLISH_ATTEMPTS` and stops, instead of crashing the worker in a loop.

### Auditing without a procedure

```ts
await logActivity({
  userId: post.authorId,
  organizationId: post.organizationId,
  action: "publish",
  entity: "linkedinPosts",
  entityId: post.id,
  description: "Published a scheduled LinkedIn post",
}, db);
```

[activity-log.service.ts](../src/services/activity-log.service.ts) warns *"Routers must NOT call this — protected procedure auto-audit already does."* The worker is exempt because **there is no procedure in this path to auto-audit it**. The warning is about double-writing, and there is nothing here to double.

No type changes were needed: `ActivityAction` is an open branded union, and `AuditEntityName` already includes every `ResourceKey`.

### The line that must never be added

```ts
// The worker must NOT call incrementUsage — the slot was spent at schedule time.
```

That comment is in the code for a reason. It looks like an omission. It is the whole design.

---

## Step 6 — The router

[src/trpc/routers/linkedin-posts.ts](../src/trpc/routers/linkedin-posts.ts) — four procedures, three of them changed.

### `create` — one branch, one quota

```ts
// Resolve the token on BOTH branches, then:
if (input.scheduledFor) {
  return linkedinService.createScheduledPost(ctx.db, { ...,
    accountId: token.accountId,
    scheduledFor: input.scheduledFor,
  });
}
// ...otherwise publish immediately
```

**Why resolve the LinkedIn token even when scheduling?** Two reasons. Scheduling against a broken connection would queue a post that can only fail hours later, when nobody is watching — better to refuse it while the user is still looking at the composer. And it supplies `accountId`, which the scheduled row needs in order to know who will publish it.

### `delete` — one procedure, two meanings

Cancelling a scheduled post and forgetting a published record are **the same operation to the quota system**: both refund a slot. Which one it is depends on the row's status, not on the caller. So there is one procedure.

The interesting part is the guard:

```ts
if (existing.status === STATUS.publishing) throw new Error(...);

const { count } = await db.linkedInPost.deleteMany({
  where: { id: postId, organizationId, status: { not: STATUS.publishing } },
});
```

The status is checked **twice** — once on the read, once inside the delete. If the worker claims the row in between, the delete matches nothing and returns `count: 0`. The user gets "no longer exists" instead of racing the worker.

And the returned `count` is load-bearing. From the original code's comment:

> `computeDeleteDecrement` in protectedProcedure only honours a `count` field, and anything else decrements by 1. Returning void meant deleting an already-deleted or other-tenant post still refunded a post slot.

Deleting nothing must refund nothing.

### `uploadAuth` — a query, not a mutation

```ts
uploadAuth: protectedProcedure({ requirePermission: permissions.LINKEDIN_POSTS_CREATE })
  .input(withOrganization)
  .query(async () => imagekitService.getUploadAuthParams()),
```

**Why a query?** It creates nothing, and it must not consume post quota — a user might swap the image five times before publishing. Being a query is also why it needs no new registry verb: the `<resource>.<verb>` guardrail only governs mutations.

### Image cleanup happens *after* the transaction

```ts
if (result.wasScheduled && result.imageFileId) {
  await imagekitService.deleteImage(result.imageFileId);
}
```

Never inside the transaction. A rollback that had already deleted the remote asset would leave a live row pointing at a dead image — the database can roll back; ImageKit cannot.

Only *scheduled* posts own their asset. A published post's image already lives on LinkedIn.

---

## Step 7 — The trigger route

[src/app/api/scheduled-posts/run/route.ts](../src/app/api/scheduled-posts/run/route.ts) — the only new infrastructure, and deliberately thin:

```ts
export async function POST(request: Request) {
  if (!isSchedulerConfigured()) return 503;
  if (!isAuthorizedTrigger(request.headers.get("authorization"))) return 401;

  await linkedinService.reclaimStalePublishingPosts(prisma, now);
  const result = await linkedinService.publishDueScheduledPosts(prisma, now);
  return Response.json(result);
}

export const maxDuration = 60;
export const dynamic = "force-dynamic";
```

**Constant-time comparison, and why it isn't paranoia:**

```ts
if (providedBytes.length !== expectedBytes.length) return false;
return timingSafeEqual(providedBytes, expectedBytes);
```

A plain `===` returns as soon as two bytes differ. An attacker who can measure response time can therefore recover the secret one character at a time. Length is checked first because `timingSafeEqual` throws on a length mismatch — and length alone is not the secret.

**Reap before publish.** A row stranded by a crashed run is due *right now*, so reclaiming it first means the very next line can claim it.

**503 vs 500.** An unconfigured scheduler is not a fault — nothing is broken, the feature simply isn't wired up. A scheduler reading status codes should back off, not alert.

---

## Step 8 — The registry

Two edits to [src/lib/resources.ts](../src/lib/resources.ts), and one of them is a compromise worth understanding.

**The audit verb**, written by the worker:

```ts
audit: {
  entity: "linkedinPost",
  describe: {
    create:  "Published a LinkedIn post",
    publish: "Published a scheduled LinkedIn post",   // ← worker
    delete:  "Removed a LinkedIn post record",
  },
},
```

**The calendar's own key** — and here is the compromise:

```ts
contentCalendar: {
  name: "Content Calendar",
  permissions: ["read"],
  nav: { label: "Calendar", href: "/dashboard/calendar", icon: "CalendarDays" },
},
```

We just spent [Decision 2](#decision-2--no-new-resource-key-the-expensive-trap) explaining why scheduling must *not* have its own key. So why does the calendar get one?

Because `nav` is **one entry per resource**, and `linkedinPosts` already spends its on the composer. The sidebar permission is derived as `` `${key}:${action}` ``, so a second page needs a second key. There is no way around it without changing the registry's shape.

It carries **no `limit`** — that is what keeps Decision 2 intact. Scheduling still spends a `linkedinPosts` slot. This key exists purely to own a page and a permission.

The consequence, which you must know: **`contentCalendar:read` is a new permission.** Owners bypass permission checks, so you will see the calendar immediately. **Any custom role needs it granted explicitly**, or the sidebar link is invisible to those members.

`listCalendar` is gated on `CONTENT_CALENDAR_READ` rather than `LINKEDIN_POSTS_READ`, so one grant governs both seeing the page and loading its data. Splitting them would let an admin grant a link to an empty screen.

---

## Step 9 — The UI

### Two global components

**`src/components/global/image-upload/`** — file picker + direct ImageKit upload. It knows **nothing** about LinkedIn or posts: the caller supplies the auth-param fetcher, accepted MIME types, and size cap. The next feature that needs an upload reuses it.

The `transform` field passes straight through untouched. That is the seam the image editor will write to.

**`src/components/global/month-calendar/`** — a month grid, generic over its item type, slot-driven via `renderItem` and `renderDayAction`.

**Why hand-built instead of `npx shadcn add calendar`?** shadcn's calendar is `react-day-picker` — a date *picker* for selecting a day, not a surface for rendering content inside cells. Using it here would mean fighting a component built for a different job, and adding a dependency to do it.

Two implementation details worth stealing:

```ts
export function getMonthGridRange(month: Date) {
  return { from: startOfWeek(startOfMonth(month)), to: endOfWeek(endOfMonth(month)) };
}
```

A month grid draws leading and trailing days from adjacent months. Querying `startOfMonth`→`endOfMonth` leaves those cells wrongly empty. Exporting this means the query and the render share one definition and cannot disagree.

```ts
const itemsByDay = React.useMemo(() => { /* bucket once */ }, [items, getItemDate]);
```

Bucketed once per render rather than filtering the list inside all 42 cells — otherwise the grid is quadratic in the number of posts.

### The calendar page's three route-local files

Global components stay generic; anything post-specific lives under `_components/`.

**`calendar-types.ts` — types derived from the router, never hand-written**

```ts
export type CalendarPost =
  inferRouterOutputs<AppRouter>["linkedinPosts"]["listCalendar"][number];

export function getCalendarPostDate(post: CalendarPost): Date {
  return post.scheduledFor ?? post.publishedAt ?? post.createdAt;
}
```

The type is *inferred from the procedure*, the same pattern as `member-types.ts` and `use-active-organization.ts`. Add a column to `POST_SAFE_SELECT` and it appears here automatically; remove one and every consumer stops compiling. A hand-written interface would drift the first time the select changed, and drift silently.

This also honours the CLAUDE.md rule that DB-shaped types come from Prisma rather than being re-declared — the chain is `Prisma model → POST_SAFE_SELECT → procedure return → CalendarPost`, with no manual link in it.

`getCalendarPostDate` is the client-side mirror of the service's `OR`: scheduled posts land on `scheduledFor`, published posts on `publishedAt`. `createdAt` is a last resort so a row can never fall out of the grid entirely — it is unreachable in practice, but a post with no date at all would otherwise just vanish.

**`post-status-badge.tsx` (`PostStatusBadge`) — where a new status becomes a compile error**

```ts
const POST_STATUS_LABELS: Record<LinkedInPostStatus, string> = { ... };
const POST_STATUS_CLASSES: Record<LinkedInPostStatus, string> = { ... };
```

Both are `Record<LinkedInPostStatus, …>` rather than partials. **Add a sixth status to the union and this file fails to compile until it has both copy and a colour** — a new state can never ship rendering as a blank chip.

Colour choices are theme tokens only, so the chips follow light/dark automatically:

| Status | Class | Why |
|---|---|---|
| `scheduled` | `bg-brand-soft` | Uses the app's brand ramp — this is the normal, expected state |
| `publishing` | `bg-primary/10` | Transient; should read as active work, not as a warning |
| `published` | `bg-muted` | Done, recedes into the background |
| `failed` | `bg-destructive/10` | The only state a user must act on |
| `canceled` | `bg-muted` dimmed | Present but inert |

And a defensive fallback, because the column is a bare `String` in Postgres:

```ts
function asStatus(value: string): LinkedInPostStatus {
  return value in POST_STATUS_LABELS ? (value as LinkedInPostStatus) : "scheduled";
}
```

A value outside the union is possible in principle — a manual `UPDATE`, a future migration. Falling back beats rendering an empty badge.

**`content-calendar.tsx` — the page, and `DayDetail`**

The grid renders a compact chip per post (status badge, an image icon if one is attached, two lines of commentary). Clicking a day opens `DayDetail` below the grid.

`DayDetail` is a plain function component in the same file rather than its own module: it is used once, by this page, and splitting it would be indirection for its own sake. It doubles as the empty state — **clicking a day with nothing on it is how a user discovers they can schedule there**, which is why it renders "Nothing planned for this day" plus the schedule button instead of rendering nothing.

The cancel button is gated on the shared constant, not a local list:

```ts
{(CANCELABLE_POST_STATUSES as readonly string[]).includes(post.status) ? <Button …/> : null}
```

`publishing` is excluded, so the UI never offers a button whose only possible outcome is an error toast — the server refuses that delete. Client and server read the same constant from `@/lib/types`, so they cannot disagree about what is cancellable.

Two smaller details:

*Links styled as buttons use `buttonVariants`, not `<Button asChild>`.* This project's `Button` is a **base-ui** primitive, and base-ui has no `asChild` slot (that is a Radix idiom). So a link that should look like a button borrows the classes instead:

```tsx
<Link href={composeHref(day)} className={cn(buttonVariants({ variant: "ghost", size: "icon-xs" }))}>
```

*The per-day "+" stops propagation.* The day cell has its own `onClick` that opens the detail panel. Without `event.stopPropagation()` on the link, clicking "+" would navigate *and* open a panel behind the navigation.

Deep-linking back to the composer is a plain query param:

```ts
`/dashboard/post-generation?date=${encodeURIComponent(day.toISOString())}`
```

Parsed in the **server component**, so a malformed or attacker-supplied `?date=` becomes `undefined` and the composer simply opens in immediate mode — rather than seeding an `Invalid Date` into a form control.

### Config flags are read on the server

```tsx
// page.tsx (server component)
<PostComposer
  imageUploadsEnabled={isImageKitConfigured()}
  schedulingEnabled={isSchedulerConfigured()}
/>
```

`isSchedulerConfigured()` reads a server-only env var. Called inside a client component it would evaluate to `false` **on a correctly configured install** and silently hide the feature. A server component is the only place it can be answered honestly.

### The preview shows what LinkedIn gets

```ts
const imagePreviewUrl = image
  ? `${image.url}?tr=${image.transform ?? LINKEDIN_IMAGE_TRANSFORM}`
  : null;
```

Same transform the publish path applies, so the preview cannot flatter the result.

### A React purity trap

The first version of the schedule validation looked like this:

```ts
const isValid = new Date(scheduledFor).getTime() > Date.now() + MIN_SCHEDULE_LEAD_MS;
//                                                 ^^^^^^^^^^ lint error
```

`Date.now()` during render is impure — it returns a different value on every re-render. The fix:

```ts
const [minSchedule] = React.useState(earliestSchedule);   // computed once at mount
const scheduleIsValid = !isScheduling || scheduledFor >= minSchedule;
```

`YYYY-MM-DDTHH:mm` sorts lexicographically in chronological order, so a **string** compare is both correct and pure. The floor going slightly stale in a long-lived tab is harmless — the server enforces the real one.

And on the input itself: `<input type="datetime-local">` speaks **local time**. Using `toISOString()` would shift the value by the timezone offset, so a user picks 09:00 and the post goes out at 04:00.

---

## The life of one scheduled post

```
Tuesday 14:00 — user hits "Schedule post" for Thursday 09:00
  │
  ├─ Browser uploads image → ImageKit (direct; never touches our server)
  │     ↳ returns { fileId, url }
  │
  ├─ linkedinPosts.create  { commentary, image, scheduledFor: Thu 09:00 }
  │     ├─ protectedProcedure: permission ✓  rate limit ✓
  │     ├─ PLAN LIMIT CHECKED  ← the quota moment
  │     ├─ token resolved (fails fast if LinkedIn is disconnected)
  │     ├─ row written: status='scheduled', postUrn=NULL, publishedAt=NULL
  │     ├─ USAGE COUNTER +1   ← spent here, never again
  │     └─ audit: "Published a LinkedIn post"
  │
  ├─ Post appears on the calendar under Thursday, chip reads "Scheduled"
  │
Thursday 09:00 — scheduler POSTs /api/scheduled-posts/run
  │
  ├─ bearer token verified (constant-time)
  ├─ reaper: any row stuck in 'publishing' > 10 min → back to 'scheduled'
  │
  ├─ CLAIM (atomic): status → 'publishing', attemptCount +1, claimedAt = now
  │     ↳ FOR UPDATE SKIP LOCKED — a second concurrent run claims nothing
  │
  ├─ getValidAccessToken()          ← fails ⇒ TERMINAL, status='failed'
  ├─ fetch ImageKit URL + ?tr=...   ← the only time bytes touch our server
  ├─ uploadImage() → imageUrn
  ├─ publishPost() → postUrn from the `x-restli-id` response HEADER
  │
  ├─ row: status='published', postUrn set, publishedAt=now, claimedAt=NULL
  ├─ audit: "Published a scheduled LinkedIn post"
  └─ USAGE COUNTER UNTOUCHED  ← already paid on Tuesday
```

If the publish throws instead, the row goes back to `scheduled` with `lastError` set — unless `attemptCount` has reached 3, in which case it becomes `failed` and is never claimed again.

---

## Wiring an actual scheduler

The endpoint is identical for all three. Pick one.

**Upstash QStash** (recommended — Upstash is already a dependency, works on any host):
Create a schedule in the [QStash console](https://console.upstash.com/qstash) pointing at
`https://your-app.com/api/scheduled-posts/run`, method `POST`, cron `* * * * *`, with header
`Authorization: Bearer <SCHEDULER_SECRET>`.

**Vercel Cron** (needs Pro — Hobby is capped at once per *day*, which is useless here):

```json
{ "crons": [{ "path": "/api/scheduled-posts/run", "schedule": "* * * * *" }] }
```

**A plain crontab** (self-hosted / Railway / a VPS):

```cron
* * * * * curl -fsS -X POST https://your-app.com/api/scheduled-posts/run \
  -H "Authorization: Bearer $SCHEDULER_SECRET"
```

Run it **every minute**. The endpoint is idempotent, a run with nothing due is a single indexed query, and a shorter interval means tighter publish accuracy.

---

## Testing it

```bash
npm run typecheck     # must be clean — no `any`, no casts
npm run build         # catches client/server boundary mistakes tsc cannot
npx prisma db push    # or migrate, with DIRECT_URL set
```

Then, in order of what actually proves the wiring:

1. **Immediate publish still works.** The biggest regression risk — the image path changed underneath it. Publish with and without an image. Quota should increment once; audit should read "Published a LinkedIn post".

2. **A >4.5 MB image uploads.** Impossible before this feature. Confirm the tRPC payload stays small (check the Network tab — the file should go to `upload.imagekit.io`, not to your app).

3. **Schedule → fire.** Schedule ~6 minutes out. Confirm `status='scheduled'` and the counter **already incremented**. Then:
   ```bash
   curl -X POST http://localhost:3000/api/scheduled-posts/run \
     -H "Authorization: Bearer $SCHEDULER_SECRET"
   ```
   Expect `{ claimed: 1, published: 1, failed: 0, reclaimed: 0 }`, `postUrn` populated, a `publish` audit row — **and the counter unchanged.**

4. **Double-publish guard.** Fire the endpoint twice concurrently with a due post. Exactly one LinkedIn post, one `published` row. This is the test that matters most.

5. **Auth.** No header → 401. Wrong header → 401. `SCHEDULER_SECRET` unset → 503.

6. **Terminal failure.** Disconnect LinkedIn, let a post fire. `status='failed'`, `lastError` populated, no crash, attempts stop at 3.

7. **Refund + cleanup.** Cancel a scheduled post with an image. Counter decrements, ImageKit asset gone, cancelling twice does **not** double-refund.

8. **Reaper.** Manually set a row to `publishing` with a `claimedAt` 20 minutes old. Next run reclaims it.

9. **Fail-soft.** Unset the ImageKit vars — app runs, image button hidden. Unset `SCHEDULER_SECRET` — app runs, schedule toggle hidden.

---

## Mistakes that are easy to make

| Mistake | What happens | Fix |
|---|---|---|
| Giving scheduling its own resource key with a `limit` | Every plan's quota silently doubles | One `linkedinPosts.create` with an optional date |
| Calling `incrementUsage` in the worker | Customers charged twice per post | The worker never touches the counter |
| `updateMany` + separate read for the claim | Two runs publish the same post | One atomic `UPDATE … RETURNING` with `SKIP LOCKED` |
| Forgetting the reaper | One crash strands a post permanently | `reclaimStalePublishingPosts` at the top of every run |
| Resetting `attemptCount` in the reaper | A poisonous post loops forever | Reclaim the row, keep the count |
| `Promise.all` over the claimed batch | LinkedIn 429s; healthy posts marked failed | Publish sequentially |
| Deleting the ImageKit asset inside the transaction | Rollback leaves a row pointing at a dead image | Delete after commit; never throw |
| `===` on the bearer token | Timing attack recovers the secret | `timingSafeEqual`, length-checked first |
| `isSchedulerConfigured()` in a client component | Feature hidden on a working install | Read it in the server component, pass as a prop |
| `toISOString()` for `datetime-local` | Posts fire at the wrong hour | Format in local time |
| `Date.now()` during render | React purity lint error; unstable renders | Compute once in `useState` |
| Running `prisma db push` through the pooler | `P1017`, looks like a network fault | `DIRECT_URL` without `-pooler` |
| Returning `{ id }` instead of `{ count }` from delete | Deleting nothing still refunds a slot | Return the real `count` |

---

## What we deliberately did NOT build

| Not built | Why | When |
|---|---|---|
| **Inngest / a real queue** | The DB is the source of truth for what's due; the trigger is 15 lines. Switching later costs nothing. | When fan-out to multiple platforms or per-org concurrency limits arrive |
| **Drag-to-reschedule** | Needs a reschedule mutation with re-arm logic and a lot more UI. The grid already shows the plan. | Once people actually use the calendar daily |
| **The image editor** | The seam is finished — `imageTransform` flows end to end. Nothing writes it yet. | Next; it is a UI that produces a `tr:` string |
| **Storage quota metering** | `RESOURCES.storage` declares a limit in **bytes**, but `incrementUsage` doesn't accept an amount. Half-wiring it would report nonsense. | When `incrementUsage(amount)` exists |
| **Recurring posts** | "Every Tuesday" needs a recurrence rule and expansion logic — a different feature wearing the same hat | Later |
| **Per-post timezones** | Everything is the browser's local timezone. A user scheduling from two countries in one week gets surprises. | When teams span timezones |
| **QStash signature verification** | The shared bearer secret keeps all three adapters identical. Signatures are strictly better but vendor-specific. | When you commit to QStash permanently |

### Known limitations you should plan for

**Disconnecting LinkedIn deletes every scheduled post — and does not refund quota.** `LinkedInPost.account` is `onDelete: Cascade`, and `disconnectAccount` does a `deleteMany` on the account. This predates the feature, but scheduling makes it bite harder: a user with 20 queued posts who disconnects loses all of them silently. Fixing it means either a nullable `accountId` with `SetNull`, or blocking disconnect while posts are queued.

**Reconnecting is safe.** `upsertConnection` upserts on `organizationId`, so the row id is preserved and scheduled posts survive. Only an explicit *disconnect* destroys them.

**Publish accuracy is bounded by your poll interval.** A one-minute cron means a post scheduled for 09:00 goes out between 09:00 and 09:01. That is why `MIN_SCHEDULE_LEAD_MS` exists.

---

## File map

**New (9):**

```
src/lib/config/imagekit.ts                        ImageKit keys, ceiling, default transform
src/lib/config/scheduler.ts                       secret + worker tuning constants
src/lib/types/imagekit.ts                         postImageSchema (reference, not bytes)
src/services/imagekit.service.ts                  auth params, transform URL, fetch, delete
src/app/api/scheduled-posts/run/route.ts          the trigger endpoint
src/components/global/image-upload/               generic direct-upload picker
src/components/global/month-calendar/             generic month grid
src/app/(dashboard)/dashboard/calendar/           the calendar page + day detail
docs/12-calendar-and-scheduled-posts.md           this file
```

**Edited (11):**

```
prisma/schema.prisma                              LinkedInPost lifecycle + ImageKit columns
prisma.config.ts                                  DIRECT_URL for DDL
src/lib/resources.ts                              publish audit verb + contentCalendar key
src/lib/config/index.ts                           barrel
src/lib/config/required-env.ts                    ImageKit + scheduler setup-checklist rows
src/lib/types/index.ts                            barrel
src/lib/types/linkedin.ts                         statuses, scheduledFor, calendar input
src/services/linkedin.service.ts                  scheduling + the whole worker
src/trpc/routers/linkedin-posts.ts                create branch, delete unify, uploadAuth, listCalendar
src/components/global/sidebar/nav-icons.tsx       CalendarDays
src/app/(dashboard)/dashboard/post-generation/    composer: upload + schedule control
```

---

## The one thing to remember

If you forget everything else in this document, remember this:

> **The database is the source of truth for what is due. The scheduler only says "wake up." And the quota is spent once — when the user commits to the post, not when it publishes.**

The first sentence is why you can swap Inngest for QStash for a crontab in one env var. The second is why nobody gets billed twice. Every other decision here is downstream of those two.

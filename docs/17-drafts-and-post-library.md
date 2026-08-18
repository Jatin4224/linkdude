# Drafts and the post library — one feature, decided by the usage counter

This is the build log for the eighth feature: **a post you are not ready to send, and a page that finally shows you everything you have written.**

It is the smallest feature in this app by lines of code and one of the most dangerous, because it lives directly on top of the money. Every design decision here follows from a single mechanic in `protectedProcedure`, so that is where this document starts.

---

## Table of contents

1. [The 10-second version](#the-10-second-version)
2. [The mechanic that decides everything](#the-mechanic-that-decides-everything)
3. [Why a draft is not `linkedinPosts.create`](#why-a-draft-is-not-linkedinpostscreate)
4. [Why publishing a draft IS `linkedinPosts.create`](#why-publishing-a-draft-is-linkedinpostscreate)
5. [The three ways this feature could have leaked quota](#the-three-ways-this-feature-could-have-leaked-quota)
6. [Why the library needed a second registry key](#why-the-library-needed-a-second-registry-key)
7. [The status union, and what it broke on purpose](#the-status-union-and-what-it-broke-on-purpose)
8. [Where drafts must not appear](#where-drafts-must-not-appear)
9. [Seeding the composer without an effect](#seeding-the-composer-without-an-effect)
10. [How one draft flows end to end](#how-one-draft-flows-end-to-end)
11. [Mistakes that are easy to make](#mistakes-that-are-easy-to-make)
12. [Follow-up: the content plan feeds the library](#follow-up-the-content-plan-feeds-the-library)
13. [Known limitations](#known-limitations)
14. [What we deliberately did NOT build](#what-we-deliberately-did-not-build)
15. [File map](#file-map)

---

## The 10-second version

**No new dependency. No new column. One new index.**

```
registry (2 verbs + 1 key) → status union → service → router → DataTable slot → library page → composer button
```

Two ideas carry the whole feature:

1. **A draft costs nothing, so it cannot travel on `create` or `delete`** — those are the only two verbs the factory meters.
2. **Publishing a draft promotes the same row in place**, so the post slot is spent exactly once, at the moment the user commits.

---

## The mechanic that decides everything

Two blocks in `src/trpc/procedures/protected.ts`:

```
[9]  PLAN LIMIT GATE     fires when pathAction === "create"
[13] USAGE-COUNTER PLAN  "create" increments · "delete" decrements
```

The verb is read off the tRPC path. Nothing else in the app decides whether an action costs a post — not the handler, not the service, not the UI. `linkedinPosts.create` charges. `linkedinPosts.delete` refunds. Everything else is free.

That is the entire specification for this feature. A draft is unspent intent, so it must ride verbs that are neither.

| Verb | Meters? | Used for |
|---|---|---|
| `linkedinPosts.create` | **increment** | publishing or scheduling — including promoting a draft |
| `linkedinPosts.delete` | **decrement** | cancelling a scheduled post, forgetting a published one |
| `linkedinPosts.draft` | no | save a draft (create or update) |
| `linkedinPosts.discard` | no | throw a draft away |
| `linkedinPosts.get` / `listLibrary` | no | queries never meter |

---

## Why a draft is not `linkedinPosts.create`

The obvious implementation is "add a `draft` status and let `create` write it." It fails immediately: a free-plan org gets **10 posts**, and under that design, ten saved drafts exhaust the plan without a single post reaching LinkedIn. The user would be billed, in quota, for typing.

So saving got its own verb. Because `draft` covers create-and-update in one procedure, pressing Save five times updates one row instead of littering the library with five copies — the `postId` field is what distinguishes the two, and neither branch touches the counter.

It is also the one mutation on this router that **does not resolve a LinkedIn token.** Every other one refuses without a live connection, correctly — a scheduled post against a dead connection is a failure waiting for a day when nobody is watching. But a draft is ours, not LinkedIn's. Requiring a connection to save one would make the composer useless to a user on their first visit, which is precisely when they are most likely to want to write something and think about it.

---

## Why publishing a draft IS `linkedinPosts.create`

The mirror-image trap. A `publishDraft` verb would have spent **no** quota at all — the factory only meters `create` — so an org could save ten drafts and publish them all for free, forever. Same failure as the one `scheduledPosts` was never allowed to become (see `12-calendar-and-scheduled-posts.md`).

So `publishPostSchema` gained an optional `draftId`, and the publish path branches on it:

```
create (no draftId)   → INSERT a row
create (with draftId) → UPDATE that draft in place → published | scheduled
```

The update — `promoteDraft` in `linkedin.service.ts` — is not an optimisation. Consider the alternative: insert the published post, then delete the draft. The delete would run through `linkedinPosts.delete`, which **refunds a post slot**, handing back the slot `create` had just spent. Net cost of a published post: zero. The one-row lifecycle the schema already describes is what makes the arithmetic come out right.

Two details inside `promoteDraft` earn their comments:

- The `status: draft` guard is in the **WHERE clause**, not a prior read, so two tabs racing the same draft cannot both promote it.
- `accountId` is written at promotion time, because a draft is saved without one and the publishing account is only known now.

---

## The three ways this feature could have leaked quota

All three were live possibilities, and all three are now closed by something you can point at:

| Leak | What it would have cost | What closes it |
|---|---|---|
| Saving a draft through `create` | Free plan exhausted by typing | the `draft` verb |
| Discarding a draft through `delete` | Save → discard on repeat mints free posts | the `discard` verb, plus the explicit refusal in `deletePublishedPost` |
| Publishing a draft through a new verb | Every drafted post free | `create` + `draftId` promotion |

The second one deserves a note. `deletePublishedPost` now **throws** when handed a draft rather than quietly deleting it, because the function's caller is the metered verb. A guard in the UI would not be enough: the row id travels over the wire, and the counter is the thing being protected.

---

## Why the library needed a second registry key

`nav` is one entry per resource, and `linkedinPosts` already spends its on the composer. This is the same reason `contentCalendar` exists as a key of its own — the sidebar permission is derived as `<key>:<action>`, so a second page needs a second key.

`postLibrary` therefore declares `permissions: ["read"]`, a `nav` entry, and **no `limit`**. A quota here would charge twice for one post: every row it lists was already metered by `linkedinPosts.create`, except drafts, which are free on purpose.

`listLibrary` lives on the `linkedinPosts` router (it reads that table) but is gated on `postLibrary:read`, following the `listCalendar` precedent: one grant governs both seeing the sidebar link and loading the page behind it. Splitting them would let an admin grant a link to an empty screen.

---

## The status union, and what it broke on purpose

`"draft"` went into `LINKEDIN_POST_STATUSES`, and that is a **compile error generator** — which is the point. `PostStatusBadge` types its label and colour maps as `Record<LinkedInPostStatus, …>`, so the build refused until the new state had both. A status that renders as a blank chip is exactly what that map exists to prevent.

The same is true of the `STATUS` map in `linkedin.service.ts`, which is `satisfies Record<LinkedInPostStatus, LinkedInPostStatus>`.

Draft is the only **dashed** chip in the app. Nothing is committed yet, and a broken border says that without spending another colour.

`postStatusLabel` was exported from the badge module so the library's status filter reads its words from the same map. A dropdown offering "Canceled" while the chip says "Cancelled" is the exact drift a single map is supposed to make impossible.

---

## Where drafts must not appear

Four surfaces read this table. Only one of them should show a draft:

| Surface | Query | Drafts appear? | Why |
|---|---|---|---|
| Post library | `listLibrary` | **yes** | it is the point |
| Composer's recent strip | `list` | no | already filters `status: published` |
| Dashboard activity panel | `list` + `listCalendar` | no | same filters |
| Calendar grid | `listCalendar` | no | **a draft has neither date, and null matches no range** |

The calendar needed no status filter at all, and that is worth understanding rather than patching: a post with no date has no square to sit in. The range filter is already the honest answer.

One surface outside the feature did need a fix. `getPlatformMetrics` and `getEngagementSeries` in `portal-analytics.service.ts` counted **every** `linkedin_post` row by `createdAt` for the operator's "posts created" metric. Drafts would have inflated it — and inflated only the current window, making the trend arrow lie. Both now exclude `draft`.

---

## Seeding the composer without an effect

The first version of the reopen path fetched the draft in the composer and copied it into state inside a `useEffect`. Lint rejected it (`react-hooks/set-state-in-effect`), and the rule was right: that effect fires on every refetch and would overwrite whatever the user had typed since the draft loaded.

The fix is the pattern the page **already used** for `?date=`: resolve it on the server and pass it down as the form's initial value.

```
library "Edit" → /dashboard/post-generation?draftId=…
                   → page: loadDraftSeed() via the in-process tRPC proxy
                     → <PostComposer initialDraft={…}>  ← useState initialiser
```

Three things fall out of doing it server-side:

- **No flash.** The textarea is never briefly empty.
- **Scoping is free.** `loadDraftSeed` goes through `linkedinPosts.get`, so the id is checked against the active organization and the read permission. A guessed cuid resolves to nothing.
- **Every failure opens a blank composer.** A bookmark to a draft that has since been published or discarded costs the user a link, not the screen.

`createTRPCContext` is wrapped in React `cache()`, so the auth and membership lookups the dashboard layout already performed are reused rather than repeated.

---

## How one draft flows end to end

```
Composer: type, attach an image (no LinkedIn connection needed)
  │
  ├─ Save as draft ──→ linkedinPosts.draft (no postId)
  │                      → INSERT status=draft, accountId=null
  │                      → returns id → URL becomes ?draftId=…
  │                      → counter: UNTOUCHED
  │
  ├─ Save draft ─────→ linkedinPosts.draft (postId)
  │                      → UPDATE … WHERE status = 'draft'
  │
  ├─ Post to LinkedIn → linkedinPosts.create (draftId)
  │                      → gate + increment fire HERE
  │                      → pre-check the draft still exists
  │                      → LinkedIn call
  │                      → promoteDraft → status=published, postUrn, publishedAt
  │
  └─ Library: Discard → linkedinPosts.discard
                         → DELETE … WHERE status = 'draft'
                         → ImageKit asset deleted after the row
                         → counter: UNTOUCHED
```

The pre-check before the LinkedIn call is deliberate. The ordinary failure is a stale tab publishing a draft that is already gone, and discovering that *after* LinkedIn accepts the post would leave a live post this app cannot record. A genuine two-tab race is still caught by the guard inside `promoteDraft`; it just costs the loser its round trip.

---

## Mistakes that are easy to make

| Mistake | What happens | Do this instead |
|---|---|---|
| Saving a draft through `create` | Quota spent on unpublished writing | the `draft` verb |
| Deleting a draft through `delete` | Counter drifts **down**; free posts | the `discard` verb |
| Inserting on publish and deleting the draft | Refund cancels the charge; posts are free | `promoteDraft` |
| Adding a status without touching `PostStatusBadge` | Won't compile — and that is the feature | give it a label and a colour |
| Filtering the library's search in the browser | "Nothing matches" while the match sits on page two, and `total` disagrees with the rows | filter in the query |
| Sorting the library by `publishedAt` | Every draft sinks to the bottom under a null | `createdAt`, the one date every status has |
| Seeding composer state in a `useEffect` | Overwrites live edits on refetch; lint error | resolve it in the page, seed `useState` |
| Letting `draft` require a LinkedIn token | Nobody can save anything before connecting | drafting is the one unconnected mutation |

---

## Follow-up: the content plan feeds the library

Shipped straight after, and it belongs in this document because it is the same lifecycle seen from the other end: drafts gave the plan somewhere to put its output.

The Post Idea Bank produced up to six ideas that rendered as a bullet list and went nowhere. The plan generation is metered, so the user had **paid** for that list and could only act on it by retyping an idea into the composer. Each idea now carries a **"Draft this"** action: generate from the idea, save the result as a draft, and the row keeps an "Open draft" link for the rest of the session.

**No new resource, verb, schema or migration.** It chains two procedures that already exist and are already metered correctly:

```
aiGeneration.create   → spends one generation (25 free · 10/min)
linkedinPosts.draft   → spends nothing
```

Chained in the client, not merged into a server verb, for a reason worth keeping: a combined endpoint would have to pick ONE resource key to charge, and these are two different budgets on purpose. `handleStart` in the same file already chains `profileLookup.create` into `contentPlan.brief` for the same reason.

Four decisions that are easy to get wrong:

| Decision | Why |
|---|---|
| **Two permissions, not one** | Drafting an idea spends model budget *and* writes a post row — `aiGeneration:create` **and** `linkedinPosts:draft`. The action is omitted, not disabled, when either is missing: six greyed buttons down a list is noise, unlike the single greyed Save above them. |
| **`draftable` on the section registry** | `CONTENT_PLAN_SECTIONS` already carries `copyable`; what a section can DO belongs beside what it means. Only `postIdeas` opts in — a hook is an opening line, not a subject, and generating a whole post from one produces thin copy. |
| **A shared minimum length** | `generatePostSchema` requires a topic of `AI_POST_TOPIC_MIN` characters and `postIdeas` items are `min(1)`, so a short idea would spend nothing but return a validation error about "topics" for text the app itself wrote. The bound is now a named constant the button reads before spending anything. |
| **A persistent link, not a toast** | The user works DOWN the bank. A toast takes the only route back to the draft with it when it fades, and says nothing about which ideas are already done. |

`DEFAULT_POST_TONE` / `DEFAULT_POST_LENGTH` were extracted for this: the plan has no opinion on either, and the composer's two literals were the de-facto defaults. Naming them means both surfaces generate comparable copy by construction rather than by coincidence.

**No "draft all six" button**, deliberately — six metered generations behind one click, in one long request, with the cost invisible until the meter moves.

**Deliberately not done:** the generated post gets only the idea as its topic, not the plan's niche, audience or positioning. Enriching it would produce more on-brand copy, but the same button would then produce different output from the composer's identical one. Worth revisiting once there is a view on the output quality.

**Files:** `content-plan-sections.ts` (+ `draftable`), `content-plan-result.tsx` (`BulletList` item-action slot, `DraftIdeaButton`, `ContentPlanDraftControls`), `content-plan-chat.tsx` (`handleDraftIdea`), `types/ai.ts` (+ the four constants), `utils.ts` (+ `buildDraftComposerHref`, lifted out of the post library now that two surfaces link to a draft).

---

## Known limitations

**No autosave.** Saving is a button. Autosave would need debouncing, a dirty-state indicator, and a conversation with the `draft` rate limit; none of that is free, and a lost draft is a worse bug than an extra click.

**A scheduled or published post still cannot be edited.** Only a `draft` row is editable. Fixing the text of a queued post is a genuinely separate feature — it wants an `update` verb and a decision about what happens to a row the worker has claimed.

**Swapping a draft's image orphans the old ImageKit file.** Pre-existing behaviour in the composer, not new here: the reference is replaced in state and the previous asset is left behind. Kilobytes, and cheaper than a save that fails on a third-party DELETE.

**The library has no bulk actions.** One row at a time.

**Search is a `contains` scan.** Fine at this scale; a `pg_trgm` index is the answer if a workspace ever holds tens of thousands of posts.

---

## What we deliberately did NOT build

| Not built | Why | When |
|---|---|---|
| **Autosave** | Needs debounce + dirty state + a rate-limit conversation | When users report losing work |
| **Editing scheduled posts** | Wants an `update` verb and a claimed-row policy | Its own feature |
| **Saving a carousel as a draft** | The schema supports it (`documentId` on the draft), the publish dialog has no Save path | If decks start needing review before they go out |
| **Draft approval / review** | Needs a `needs_approval` status and an `approve` permission — a workflow, not a save button | The agency use case |
| **"Draft all six" on the idea bank** | Six metered generations behind one click, in one long request | Never — cost has to stay visible |
| **Bulk discard** | A checkbox column in `DataTable` that four other lists would then want | When a list is long enough to need it |
| **Restoring a discarded draft** | A trash state doubles every query's filter | Probably never |

---

## File map

**New files (4):**

```
docs/17-drafts-and-post-library.md
src/app/(dashboard)/dashboard/posts/page.tsx
src/app/(dashboard)/dashboard/posts/_components/posts-library.tsx
src/app/(dashboard)/dashboard/posts/_components/post-types.ts
```

**Edited files (12):**

```
prisma/schema.prisma                     + @@index([organizationId, createdAt]); status comment
src/lib/resources.ts                     + linkedinPosts draft/discard verbs, audit, rate limit
                                         + postLibrary key; create-section nav renumbered
src/lib/types/linkedin.ts                + "draft" status, saveDraftSchema, discardDraftSchema,
                                           getPostSchema, listLibraryPostsSchema, publish draftId,
                                           shared postContentSchema + media-exclusivity refine
src/lib/types/index.ts                   + barrel exports
src/lib/config/linkedin.ts               + buildLinkedInPostUrl
src/lib/config/index.ts                  + barrel export
src/services/linkedin.service.ts         + saveDraft, discardDraft, getPostForEdit,
                                           listLibraryPosts, promoteDraft, POST_EDIT_SELECT;
                                           draft guard in deletePublishedPost
src/services/portal-analytics.service.ts   drafts excluded from "posts created"
src/trpc/routers/linkedin-posts.ts       + draft, discard, get, listLibrary; create promotes
src/components/global/data-table/data-table.tsx  + filters slot
src/components/global/post-status-badge/*  + draft chip, postStatusLabel export
src/app/(dashboard)/dashboard/post-generation/page.tsx           + loadDraftSeed
src/app/(dashboard)/dashboard/post-generation/_components/post-composer.tsx
                                         + PostDraftSeed, Save draft, draftId on publish
```

---

## The one thing to remember

> **`create` charges and `delete` refunds — nothing else moves the counter.** A draft is unspent intent, so it saves and discards on verbs that are neither, and it becomes a post by being promoted in place rather than copied. Every other decision in this feature is downstream of that sentence.

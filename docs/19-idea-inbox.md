# Building the idea inbox — a complete walkthrough

This is the build log for **the idea inbox: a member saves a post idea in a couple of seconds, and later turns it into a post with one click.**

Read [07 — Adding a feature](./07-adding-a-feature.md) first. This feature is small, uses no AI, and follows that guide step for step.

---

## The 10-second version

```
schema → registry → types/config → service → router → UI
```

- **One table**, `post_idea`, scoped to one member in one organization.
- **One resource key**, `postIdeas`, with a limit on ideas **held**: free 100, starter 1,000, pro 10,000.
- **Three places to save an idea:**
  - the Ideas page
  - a card on the dashboard
  - **Save as idea** under the topic box in Create Post
- **Turn into post** opens Create Post with the idea as the topic. The idea is marked **Used** once a post is generated from it.
- **No model calls, no new dependency.**

---

## Step 1 — The schema

`PostIdea` holds:
- `text`
- `status` (`new` or `used`, a bare String like `LinkedInPost.status`)
- `usedAt`
- timestamps

It back-relates to `User` and `Organization`. The index leads with `(organizationId, authorId, status, createdAt)`, because the inbox always lists one member's ideas newest first.

Ideas are **per member**, like `VoiceProfile`: a teammate's half-formed thoughts don't belong in someone else's inbox.

Run `npx prisma db push` after pulling.

---

## Step 2 — The registry

`postIdeas` in `src/lib/resources.ts`:
- `permissions`: create, read, update, delete
- `limit`: counts ideas held
- a 30-per-minute create limit
- audit lines
- nav under **Create** as "Ideas" at `/dashboard/ideas`

**`delete` is the right verb here**, unlike `voiceProfile`'s `discard`. This limit counts things held, not model spend, so the factory's refund on delete is wanted: deleting an idea frees a slot.

Also edit `nav-icons.tsx` (`Lightbulb`). Custom roles need the new permissions granted; owners have them already.

---

## Step 3 — Types and config

`src/lib/types/post-ideas.ts`:
- **Text:** `POST_IDEA_TEXT_MAX` equals the composer's topic limit, so any saved idea fits the topic box. The minimum is 3 characters: a two-word note is a real idea.
- **Update:** `updatePostIdeaSchema` is a discriminated union on `field` (`text` or `status`), the `voiceProfile.update` precedent. One verb covers both edits, and the audit line still says which.
- **Labels:** `POST_IDEA_STATUS_LABELS` lives in `src/lib/config/post-generation.ts`.

---

## Step 4 — Service and router

`src/services/post-ideas.service.ts` takes `db` first and scopes every query by **organization and author**.
- **Writes** use `updateMany` / `deleteMany`, so the scope is in the WHERE and `count` says whether anything matched.
- **Search** runs in the database.

`src/trpc/routers/post-ideas.ts`, mounted as `postIdeas`:

| Procedure | Does |
|---|---|
| `list` | Paged, with status filter and search |
| `get` | One idea, used by the composer's `?ideaId=` seed |
| `create` | Saves an idea and spends a slot |
| `update` | Edits text or status; `NOT_FOUND` when nothing matched |
| `delete` | Removes an idea and refunds the slot via `count` |

---

## Step 5 — The UI

- **`/dashboard/ideas`:** `IdeasInbox`
  - quick-add at the top
  - the global `DataTable` with search, status filter and paging
  - row actions: **Turn into post**, **Edit** (`EditIdeaDialog`), **Mark used / Mark as new**, **Delete**
- **Global `IdeaQuickAdd`** (`src/components/global/idea-quick-add/`): a one-line form that owns its mutation and hides itself without `postIdeas:create`. It's used on the Ideas page and in the dashboard's `IdeaInboxCard`.
- **Create Post:**
  - **Save as idea** under the topic box, validated with `createPostIdeaSchema` before sending
  - `?ideaId=` resolved server-side by `loadIdeaSeed` in `post-generation/page.tsx`, so the idea is the topic box's initial value
  - after a topic post generates, the idea is marked used; it's silent, because it's bookkeeping
  - `buildIdeaComposerHref` in `src/lib/utils.ts` builds the link

---

## Step 6 — Expand, pick and draft

A list alone doesn't help with a vague idea, so the inbox became a pipeline: **capture → sharpen → draft**.

**Expand into angles** (`ideaAngles.create`):
- **Its own resource key**, `ideaAngles` (free 10, starter 200, pro 1,000). Only `<resource>.create` spends, and a verb on `postIdeas` couldn't meter model spend without also charging it against saved ideas.
- **The idea is read on the server by id**, scoped to the caller. `expandPostIdea` returns 3 angles through `generateStructured` with `ideaAnglesSchema`.
- **Each angle has:**
  - a title
  - a topic brief (within the composer's topic limits)
  - a sample first line
  - its hook formula (`HOOK_FORMULAS`)
  - `needs`: the one real detail the member should add
- **Never invented facts.** The prompt reuses `LINKEDIN_HOOK_RULES` and `LINKEDIN_LANGUAGE_RULES`, and asks for missing facts in `needs` rather than inventing them.
- **The inbox starts the expansion from the click**, not from an effect in `IdeaAnglesDialog`, because an effect runs twice in development and would spend twice.
- **From the dialog:** **Use this angle** replaces the idea's text, and **Save as new idea** keeps both.

**Draft it** (row button): chains `aiGeneration.create` (topic, with the composer's default tone, length and goal) and then `linkedinPosts.draft`, the content plan's "Draft this" precedent, then marks the idea used. The toast has **Open draft**.

**Use an idea** (Create Post): a menu next to the topic box lists up to 20 unused ideas (`postIdeas.list`, status `new`). Picking one fills the topic and marks that idea to be set used after generation.

**Row layout:** Expand and Draft it are buttons. Open in Create Post, Edit, Mark used and Delete moved into a "⋯" menu.

---

## Testing it

1. `npx prisma db push`, then `npm run typecheck` and `npm run lint` are clean.
2. **Ideas** appears in the sidebar. Save an idea from the Ideas page, then another from the dashboard card. Both show up.
3. Search and the New/Used filter narrow the list. Edit changes the text.
4. **Turn into post** opens Create Post with the idea in the topic box. Generate, go back to Ideas, and the idea shows **Used**.
5. In Create Post, type a topic and click **Save as idea**. It appears in the inbox.
6. Delete an idea. On a free plan, the usage meter goes down by one.

---

## File map

**New**
- `src/lib/types/post-ideas.ts`
- `src/services/post-ideas.service.ts`
- `src/trpc/routers/post-ideas.ts`
- `src/components/global/idea-quick-add/`
- `src/app/(dashboard)/dashboard/ideas/page.tsx`
- `src/app/(dashboard)/dashboard/ideas/_components/`: `ideas-inbox.tsx`, `edit-idea-dialog.tsx`, `idea-types.ts`
- `src/app/(dashboard)/dashboard/_components/idea-inbox-card.tsx`
- `docs/19-idea-inbox.md`

**Edited**
- `prisma/schema.prisma`: `PostIdea` and back-relations
- `src/lib/resources.ts`: `postIdeas`
- `src/components/global/sidebar/nav-icons.tsx`: `Lightbulb`
- `src/lib/config/post-generation.ts`, `src/lib/config/index.ts`, `src/lib/types/index.ts`
- `src/lib/utils.ts`: `buildIdeaComposerHref`
- `src/trpc/routers/_app.ts`: mount
- `src/app/(dashboard)/dashboard/page.tsx` and `_components/index.ts`: the idea card
- `src/app/(dashboard)/dashboard/post-generation/page.tsx`, `post-composer.tsx`, `generate-form.tsx`: seed, Save as idea, mark used
- `docs/00-start-here.md`: index entry
